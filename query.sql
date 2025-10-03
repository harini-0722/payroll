DROP DATABASE IF EXISTS payroll_db;

-- 1. Database
CREATE DATABASE payroll_db;
USE payroll_db;

-- 2. Users Table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  email VARCHAR(100),
  department VARCHAR(50),
  phone VARCHAR(20),
  address VARCHAR(255),
  emergency_contact VARCHAR(20),
  role ENUM('admin','employee') DEFAULT 'employee',
  salary DECIMAL(10,2) DEFAULT 0,
  gender ENUM('male','female') NOT NULL DEFAULT 'male'
);

-- 3. Attendance Table
CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  time_in TIME,
  time_out TIME,
  status VARCHAR(20),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
select*from attendance;
-- Mark 10 Present days
INSERT INTO attendance (user_id, date, time_in, time_out, status)
VALUES
(8, '2025-09-01', '09:00:00', '17:00:00', 'Present'),
(8, '2025-09-02', '09:15:00', '17:10:00', 'Present'),
(8, '2025-09-04', '09:10:00', '17:20:00', 'Present'),
(8, '2025-09-05', '09:00:00', '17:00:00', 'Present'),
(8, '2025-09-08', '09:00:00', '17:00:00', 'Present'),
(8, '2025-09-09', '09:05:00', '17:00:00', 'Present'),
(8, '2025-09-10', '09:00:00', '17:00:00', 'Present'),
(8, '2025-09-11', '09:00:00', '17:00:00', 'Present'),
(8, '2025-09-12', '09:00:00', '17:00:00', 'Present'),
(8, '2025-09-15', '09:00:00', '17:00:00', 'Present');

-- Mark 2 Absent days
INSERT INTO attendance (user_id, date, status)
VALUES
(8, '2025-09-16', 'Absent'),
(8, '2025-09-17', 'Absent');

-- Mark 1 Half Day
INSERT INTO attendance (user_id, date, time_in, time_out, status)
VALUES
(8, '2025-09-18', '09:00:00', '13:00:00', 'Half Day');

-- Add 2 days Normal Leave (deductible)
INSERT INTO leave_requests (user_id, start_date, end_date, gender, type, reason, status)
VALUES
(8, '2025-09-22', '2025-09-23', 'male', 'Normal Leave', 'Personal work', 'Approved');

-- Add 2 days Monthly Leave (non-deductible)
INSERT INTO leave_requests (user_id, start_date, end_date, gender, type, reason, status)
VALUES
(8, '2025-09-24', '2025-09-25', 'male', 'Monthly Leave', 'Health issue', 'Approved');

-- 4. Leave Requests Table
CREATE TABLE leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  gender ENUM('male','female'),
  type VARCHAR(50),
  reason VARCHAR(255),
  status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 5. Payroll Table
CREATE TABLE payroll (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  month VARCHAR(7), -- YYYY-MM
  gross DECIMAL(10,2),
  deductions DECIMAL(10,2),
  total_unpaid_leave_days INT,
  total_absent_days INT,
  total_half_days INT,
  net DECIMAL(10,2),
  FOREIGN KEY(user_id) REFERENCES users(id),
  UNIQUE KEY user_month (user_id, month)
);

-- 6. Insert demo users
INSERT INTO users(username,password,full_name,role,email,department,salary,gender) VALUES
('admin','$2b$10$1w6t1Fkb1EouQovO9q2g1u0eG0pXb1w9IV3kQ6z1w7n4cT1u0h7a6', 'Admin User', 'admin','admin@example.com','Management',12000,'female'),
('employee','$2b$10$0/1yGq4HdKq3t2Vb7v9xzeF8R5Qz9XhFyY1GZ.pXjK0F8q1l9M8aG', 'Employee One', 'employee','emp1@example.com','HR',12000,'male');

-- Passwords are bcrypt hash for:
-- admin123 and emp123
select*from users;
SELECT * FROM payroll;
--- backup 
-- 1. Database
CREATE DATABASE payroll_db;
USE payroll_db;

-- 2. Users Table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  email VARCHAR(100),
  department VARCHAR(50),
  phone VARCHAR(20),
  address VARCHAR(255),
  emergency_contact VARCHAR(20),
  role ENUM('admin','employee') DEFAULT 'employee',
  salary DECIMAL(10,2) DEFAULT 0,
  gender ENUM('male','female') NOT NULL DEFAULT 'male'
);


-- 3. Attendance Table
CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  time_in TIME,
  time_out TIME,
  status VARCHAR(20),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
select*from attendance;
-- Mark 10 Present days
INSERT INTO attendance (user_id, date, time_in, time_out, status)
VALUES
(8, '2025-09-01', '09:00:00', '17:00:00', 'Present'),
(8, '2025-09-02', '09:15:00', '17:10:00', 'Present'),
(8, '2025-09-04', '09:10:00', '17:20:00', 'Present'),
(8, '2025-09-05', '09:00:00', '17:00:00', 'Present'),
(8, '2025-09-08', '09:00:00', '17:00:00', 'Present'),
(8, '2025-09-09', '09:05:00', '17:00:00', 'Present'),
(8, '2025-09-10', '09:00:00', '17:00:00', 'Present'),
(8, '2025-09-11', '09:00:00', '17:00:00', 'Present'),
(8, '2025-09-12', '09:00:00', '17:00:00', 'Present'),
(8, '2025-09-15', '09:00:00', '17:00:00', 'Present');

-- Mark 2 Absent days
INSERT INTO attendance (user_id, date, status)
VALUES
(8, '2025-09-16', 'Absent'),
(8, '2025-09-17', 'Absent');

-- Mark 1 Half Day
INSERT INTO attendance (user_id, date, time_in, time_out, status)
VALUES
(8, '2025-09-18', '09:00:00', '13:00:00', 'Half Day');

-- Add 2 days Normal Leave (deductible)
INSERT INTO leave_requests (user_id, start_date, end_date, gender, type, reason, status)
VALUES
(8, '2025-09-22', '2025-09-23', 'male', 'Normal Leave', 'Personal work', 'Approved');

-- Add 2 days Monthly Leave (non-deductible)
INSERT INTO leave_requests (user_id, start_date, end_date, gender, type, reason, status)
VALUES
(8, '2025-09-24', '2025-09-25', 'male', 'Monthly Leave', 'Health issue', 'Approved');

-- 4. Leave Requests Table
CREATE TABLE leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  gender ENUM('male','female'),
  type VARCHAR(50),
  reason VARCHAR(255),
  status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
  FOREIGN KEY(user_id) REFERENCES users(id)
);
select*from leave_requests;
-- 5. Payroll Table
CREATE TABLE payroll (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  month VARCHAR(7), -- YYYY-MM
  gross DECIMAL(10,2),
  deductions DECIMAL(10,2),
  total_unpaid_leave_days INT,
  total_absent_days INT,
  total_half_days INT,
  net DECIMAL(10,2),
  FOREIGN KEY(user_id) REFERENCES users(id),
  UNIQUE KEY user_month (user_id, month)
);

-- 6. Insert demo users
INSERT INTO users(username,password,full_name,role,email,department,salary,gender) VALUES
('admin','$2b$10$1w6t1Fkb1EouQovO9q2g1u0eG0pXb1w9IV3kQ6z1w7n4cT1u0h7a6', 'Admin User', 'admin','admin@example.com','Management',12000,'female'),
('employee','$2b$10$0/1yGq4HdKq3t2Vb7v9xzeF8R5Qz9XhFyY1GZ.pXjK0F8q1l9M8aG', 'Employee One', 'employee','emp1@example.com','HR',12000,'male');

-- Passwords are bcrypt hash for:
-- admin123 and emp123
select* from users;
DESC users;
SELECT id, username, full_name, email, department
ALTER TABLE attendance
DROP FOREIGN KEY attendance_ibfk_1;

SHOW CREATE TABLE attendance;
ALTER TABLE attendance DROP FOREIGN KEY attendance_ibfk_1;
ALTER TABLE attendance
ADD CONSTRAINT attendance_ibfk_1
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE;


SELECT CONSTRAINT_NAME, TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_NAME = 'attendance';
ALTER TABLE attendance DROP FOREIGN KEY attendance_ibfk_1;
ALTER TABLE attendance
ADD CONSTRAINT attendance_ibfk_1
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE;
ALTER TABLE attendance DROP INDEX user_id;
SHOW CREATE TABLE attendance;
SHOW CREATE TABLE leave_requests;
SHOW CREATE TABLE payroll;
ALTER TABLE attendance 
  DROP FOREIGN KEY attendance_ibfk_1,
  ADD CONSTRAINT attendance_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE payroll 
  DROP FOREIGN KEY payroll_ibfk_1,
  ADD CONSTRAINT payroll_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE leave_requests 
  DROP FOREIGN KEY leave_requests_ibfk_1,
  ADD CONSTRAINT leave_requests_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- Attendance table
ALTER TABLE attendance DROP FOREIGN KEY attendance_ibfk_1;
ALTER TABLE attendance 
  ADD CONSTRAINT attendance_ibfk_1 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Payroll table
ALTER TABLE payroll DROP FOREIGN KEY payroll_ibfk_1;
ALTER TABLE payroll 
  ADD CONSTRAINT payroll_ibfk_1 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Leave Requests table
ALTER TABLE leave_requests DROP FOREIGN KEY leave_requests_ibfk_1;
ALTER TABLE leave_requests 
  ADD CONSTRAINT leave_requests_ibfk_1 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;




 
FROM users;


SELECT * FROM payroll;
CREATE TABLE holidays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  holiday_date DATE NOT NULL,
  name VARCHAR(100) NOT NULL,
  weekday VARCHAR(20) NOT NULL
);

select*from holidays;