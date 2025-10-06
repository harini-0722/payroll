// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// ====================== MIDDLEWARE ======================
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// ====================== AUTH HELPERS ======================
function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  next();
}

function authAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
  next();
}

// ====================== AUTH ROUTES ======================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE username=?", [username]);
    if (!rows.length) return res.status(401).json({ success: false, error: "Invalid username or password" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, error: "Invalid username or password" });

    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name
    };
    res.json({ success: true, role: user.role, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error, try again" });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ====================== PAGE ROUTES ======================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/employee', (req, res) => res.sendFile(path.join(__dirname, 'public', 'employee.html')));

// ====================== EMPLOYEE ROUTES ======================

// Helper to convert time to 12-hour format with AM/PM
function formatTime12Hour(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  let seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${ampm}`;
}

// Attendance
app.post('/api/attendance/checkin', auth, async (req, res) => {
  const userId = req.session.user.id;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const timeNow = now.toTimeString().slice(0, 8); // "HH:MM:SS" (24-hr format for DB)

  const [rows] = await db.query("SELECT * FROM attendance WHERE user_id=? AND date=?", [userId, today]);
  if (rows.length) return res.json({ error: "Already checked in" });

  let status = "Present";
  const hour = now.getHours();
  if (hour >= 10 && hour < 13) status = "Half Day";
  else if (hour >= 13) status = "Absent";

  await db.query("INSERT INTO attendance(user_id, date, time_in, status) VALUES (?, ?, ?, ?)", [userId, today, timeNow, status]);
  res.json({ ok: true, time_in: formatTime12Hour(now), status });
});

app.post('/api/attendance/checkout', auth, async (req, res) => {
  const userId = req.session.user.id;
  const today = new Date().toISOString().slice(0, 10);
  const timeNow = new Date().toTimeString().slice(0, 8); // 24-hr for DB

  await db.query("UPDATE attendance SET time_out=? WHERE user_id=? AND date=?", [timeNow, userId, today]);
  res.json({ ok: true, time_out: formatTime12Hour(new Date()) });
});

app.get('/api/attendance/mine', auth, async (req, res) => {
  const userId = req.session.user.id;
  const [rows] = await db.query("SELECT * FROM attendance WHERE user_id=? ORDER BY date DESC LIMIT 20", [userId]);

  const formatted = rows.map(row => {
    const timeIn = row.time_in ? formatTime12Hour(new Date(`1970-01-01T${row.time_in}`)) : null;
    const timeOut = row.time_out ? formatTime12Hour(new Date(`1970-01-01T${row.time_out}`)) : null;

    // ✅ Calculate working hours in hh:mm:ss format
    let workingHours = '';
    if (row.time_in && row.time_out) {
      const inTime = new Date(`1970-01-01T${row.time_in}`);
      const outTime = new Date(`1970-01-01T${row.time_out}`);
      const diffMs = outTime - inTime;
      if (diffMs > 0) {
        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        workingHours = `${hours}:${minutes}:${seconds} Hrs`;
      }
    }

    return {
      date: row.date,
      time_in: timeIn,
      time_out: timeOut,
      working_hours: workingHours,
      status: row.status
    };
  });

  res.json(formatted);
});


// Leave
app.post('/api/leave/apply', auth, async (req, res) => {
  const { start_date, end_date, type, reason } = req.body;
  const userId = req.session.user.id;

  try {
    const [userRows] = await db.query("SELECT gender FROM users WHERE id=?", [userId]);
    const gender = userRows[0]?.gender || '-';
    const month = new Date(start_date).getMonth() + 1;

    if (type === 'monthly') {
      const [rows] = await db.query("SELECT * FROM leave_requests WHERE user_id=? AND type='monthly' AND MONTH(start_date)=?", [userId, month]);
      if (rows.length > 0) return res.json({ error: 'You already took your monthly leave this month' });
    }

    if (type === 'special' && gender === 'female') {
      const [rows] = await db.query("SELECT * FROM leave_requests WHERE user_id=? AND type='special' AND MONTH(start_date)=?", [userId, month]);
      if (rows.length > 0) return res.json({ error: 'You already took your special health leave this month' });
    }

    await db.query("INSERT INTO leave_requests(user_id,start_date,end_date,gender,type,reason) VALUES(?,?,?,?,?,?)", [userId, start_date, end_date, gender, type, reason]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to apply leave' });
  }
});

app.get('/api/leave/mine', auth, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [rows] = await db.query("SELECT * FROM leave_requests WHERE user_id=? ORDER BY id DESC", [userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// Payroll
app.get('/api/payroll/mine', auth, async (req, res) => {
  const { month } = req.query;
  const userId = req.session.user.id;
  const [rows] = await db.query("SELECT * FROM payroll WHERE user_id=? AND month=?", [userId, month]);
  res.json(rows[0] || {});
});

// Profile
app.get('/api/me', auth, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, username, full_name, email, department, phone, address, emergency_contact, role FROM users WHERE id=?", [req.session.user.id]);
    res.json({ user: rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/profile/update', auth, async (req, res) => {
  const { phone, address, emergency_contact } = req.body;
  await db.query("UPDATE users SET phone=?, address=?, emergency_contact=? WHERE id=?", [phone, address, emergency_contact, req.session.user.id]);
  res.json({ ok: true });
});

// ====================== ADMIN ROUTES ======================
// Employee management
app.post('/api/admin/employees', authAdmin, async (req, res) => {
  const { username, password, full_name, gender, email, department, salary } = req.body;
  if (!username || !password || !full_name || !email) return res.json({ ok: false, error: "Username, password, full name, and email required" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query("INSERT INTO users (username,password,full_name,gender,email,department,salary,role) VALUES (?,?,?,?,?,?,?, 'employee')", [username, hashedPassword, full_name, gender || 'male', email, department, salary || 0]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.json({ ok: false, error: 'Username exists' });
    res.json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/employees', authAdmin, async (req, res) => {
  const [rows] = await db.query("SELECT full_name AS Name, username AS Username, gender AS Gender, email AS Email, department AS Department, salary AS Salary FROM users WHERE role='employee' ORDER BY id ASC");
  res.json(rows);
});

app.get('/api/admin/employees/:username', authAdmin, async (req, res) => {
  const [rows] = await db.query("SELECT full_name, username, gender, email, department, salary FROM users WHERE username=? AND role='employee'", [req.params.username]);
  if (!rows.length) return res.json({ ok: false, error: 'Employee not found' });
  res.json(rows[0]);
});

app.put('/api/admin/employees/:username', authAdmin, async (req, res) => {
  const { password, full_name, gender, email, department, salary } = req.body;
  try {
    let query, params;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = "UPDATE users SET password=?, full_name=?, gender=?, email=?, department=?, salary=? WHERE username=? AND role='employee'";
      params = [hashedPassword, full_name, gender, email, department, salary, req.params.username];
    } else {
      query = "UPDATE users SET full_name=?, gender=?, email=?, department=?, salary=? WHERE username=? AND role='employee'";
      params = [full_name, gender, email, department, salary, req.params.username];
    }
    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.json({ ok: false, error: 'Employee not found or not updated' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, error: err.message });
  }
});

app.delete('/api/admin/employees/:username', authAdmin, async (req, res) => {
  const [result] = await db.query("DELETE FROM users WHERE username=? AND role='employee'", [req.params.username]);
  if (result.affectedRows === 0) return res.json({ ok: false, error: 'Employee not found' });
  res.json({ ok: true });
});

// Attendance admin
app.get('/api/admin/attendance', authAdmin, async (req, res) => {
  const { date, month, employee_id } = req.query;
  try {
    if (date) {
      const [employees] = await db.query("SELECT id, full_name FROM users WHERE role='employee' ORDER BY full_name");
      const [attRecords] = await db.query("SELECT user_id, time_in, time_out, status FROM attendance WHERE date=?", [date]);
      const dayOfWeek = new Date(date).getDay();

      const result = employees.map(emp => {
        const att = attRecords.find(a => a.user_id === emp.id);
        let status = (dayOfWeek === 0 || dayOfWeek === 6) ? 'Weekend' : (att?.time_in ? (att.time_in <= '10:00:00' ? 'Present' : 'Half Day') : 'Absent');
        return { full_name: emp.full_name, date, time_in: att?.time_in || null, time_out: att?.time_out || null, status };
      });
      return res.json(result);
    }

    if (month && employee_id) {
      const year = new Date().getFullYear();
      const daysInMonth = new Date(year, month, 0).getDate();
      const [attRecords] = await db.query("SELECT date, time_in, time_out, status FROM attendance WHERE user_id=? AND MONTH(date)=?", [employee_id, month]);
      const [emp] = await db.query("SELECT full_name FROM users WHERE id=?", [employee_id]);
      const empName = emp[0]?.full_name || 'Unknown';

      const result = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${year}-${month.toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
        const dayOfWeek = new Date(dayStr).getDay();
        const att = attRecords.find(a => a.date.toISOString().slice(0,10) === dayStr);
        let status = (dayOfWeek === 0 || dayOfWeek === 6) ? 'Weekend' : (att?.time_in ? (att.time_in <= '10:00:00' ? 'Present' : 'Half Day') : 'Absent');
        result.push({ full_name: empName, date: dayStr, time_in: att?.time_in || null, time_out: att?.time_out || null, status });
      }
      return res.json(result);
    }

    res.status(400).json({ error: "Provide either date or month+employee_id" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Leaves admin
app.get('/api/admin/leaves', authAdmin, async (req, res) => {
  const [rows] = await db.query("SELECT l.*, u.full_name FROM leave_requests l JOIN users u ON l.user_id=u.id ORDER BY l.id DESC");
  res.json(rows);
});
app.post('/api/admin/leaves/:id/approve', authAdmin, async (req, res) => {
  await db.query("UPDATE leave_requests SET status='Approved' WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});
app.post('/api/admin/leaves/:id/reject', authAdmin, async (req, res) => {
  await db.query("UPDATE leave_requests SET status='Rejected' WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

// Payroll processing
app.post('/api/payroll/process', authAdmin, async (req, res) => {
  try {
    const { month } = req.body; // "YYYY-MM"
    const [year, mon] = month.split('-').map(Number);
    const [users] = await db.query("SELECT id, full_name, gender, salary FROM users");

    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0);
    const totalDaysInMonth = endDate.getDate();

    const [holidays] = await db.query("SELECT holiday_date FROM holidays WHERE holiday_date BETWEEN ? AND ?", [startDate, endDate]);
    const holidaySet = new Set(holidays.map(h => h.holiday_date.toISOString().split('T')[0]));

    for (const user of users) {
      const { id: userId, salary: gross, gender } = user;
      const perDaySalary = gross / totalDaysInMonth;
      const [att] = await db.query("SELECT date, status FROM attendance WHERE user_id=? AND date BETWEEN ? AND ?", [userId, startDate, endDate]);

      let normalLeave=0, monthlyLeave=0, specialLeave=0, absent=0, halfDay=0;
      att.forEach(a => {
        const dateObj = new Date(a.date);
        const day = dateObj.getDay();
        const dateStr = dateObj.toISOString().split("T")[0];
        if (day===0 || day===6 || holidaySet.has(dateStr)) return;
        if (a.status==="Normal Leave") normalLeave++;
        else if (a.status==="Monthly Leave") monthlyLeave++;
        else if (a.status==="Special Health Leave") specialLeave++;
        else if (a.status==="Absent") absent++;
        else if (a.status==="Half Day") halfDay++;
      });

      let nonDeduct = holidaySet.size;
      if (monthlyLeave>0){ nonDeduct+=1; monthlyLeave-=1; if(monthlyLeave<0) monthlyLeave=0; }
      if (gender==="female" && specialLeave>0){ nonDeduct+=1; specialLeave-=1; if(specialLeave<0) specialLeave=0; }

      const unpaidLeaveDays = normalLeave + monthlyLeave + specialLeave + absent + halfDay*0.5;
      const deductions = unpaidLeaveDays * perDaySalary;
      const net = gross - deductions;

      await db.query(
        `INSERT INTO payroll (user_id,month,gross,total_absent_days,total_half_days,total_non_deduct_leaves,deductions,net)
        VALUES (?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE gross=?, total_absent_days=?, total_half_days=?, total_non_deduct_leaves=?, deductions=?, net=?`,
        [userId,month,gross,normalLeave+absent,halfDay,nonDeduct,deductions.toFixed(2),net.toFixed(2),
         gross,normalLeave+absent,halfDay,nonDeduct,deductions.toFixed(2),net.toFixed(2)]
      );
    }

    res.json({ success:true, message:`Payroll processed for ${month}`});
  } catch(err){
    console.error(err);
    res.status(500).json({ error:"Payroll processing failed", details: err.message });
  }
});

// Admin payroll view
app.get('/api/admin/payroll', authAdmin, async (req, res) => {
  const { month } = req.query;
  const [rows] = await db.query(
    "SELECT p.*, u.full_name, u.id AS user_id FROM payroll p JOIN users u ON p.user_id=u.id WHERE p.month=?",
    [month]
  );
  res.json(rows);
});

// ====================== HOLIDAY ROUTES ======================
app.get('/api/holidays', async (req,res)=>{
  try{
    const [rows]=await db.query("SELECT * FROM holidays ORDER BY holiday_date ASC");
    res.json(rows);
  }catch(err){console.error(err); res.status(500).json({error:'Failed to fetch holidays'});}
});

app.post('/api/holidays', authAdmin, async (req,res)=>{
  const {holiday_date,name,weekday}=req.body;
  if(!holiday_date||!name||!weekday) return res.status(400).json({error:'Missing holiday fields'});
  try{
    const [result]=await db.query("INSERT INTO holidays(holiday_date,name,weekday) VALUES(?,?,?)",[holiday_date,name,weekday]);
    res.json({success:true,id:result.insertId});
  }catch(err){console.error(err); res.status(500).json({error:'Failed to add holiday'});}
});

app.delete('/api/holidays/:id', authAdmin, async (req,res)=>{
  try{
    const [result]=await db.query("DELETE FROM holidays WHERE id=?",[req.params.id]);
    if(result.affectedRows===0) return res.status(404).json({error:'Holiday not found'});
    res.json({success:true});
  }catch(err){console.error(err); res.status(500).json({error:'Failed to delete holiday'});}
});

// ====================== START SERVER ======================
app.listen(PORT, ()=>console.log(`✅ Server running at http://localhost:${PORT}`));
