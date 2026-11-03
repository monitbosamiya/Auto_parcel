-- ==========================================================
-- Automatic Parcel Sorting & Dispatch Simulator Database Schema
-- MySQL 8.0+
-- ==========================================================

CREATE DATABASE IF NOT EXISTS parcel_sorting_db;
USE parcel_sorting_db;

-- 1. Single Operator Authentication
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Routes Table
CREATE TABLE IF NOT EXISTS routes (
  route_id INT AUTO_INCREMENT PRIMARY KEY,
  origin VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  estimated_travel_hours DECIMAL(6,2) NOT NULL,
  processing_buffer_hours DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  UNIQUE KEY uq_route_origin_dest (origin, destination)
);

-- 3. Trucks Table
CREATE TABLE IF NOT EXISTS trucks (
  truck_id INT AUTO_INCREMENT PRIMARY KEY,
  truck_number VARCHAR(30) NOT NULL UNIQUE,
  route_id INT NOT NULL,
  capacity DECIMAL(10,2) NOT NULL,
  availability_status ENUM('Available','In Transit','Maintenance') NOT NULL DEFAULT 'Available',
  FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE RESTRICT
);

-- 4. Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
  schedule_id INT AUTO_INCREMENT PRIMARY KEY,
  truck_id INT NOT NULL,
  departure_time TIME NOT NULL,
  departure_days VARCHAR(100) NOT NULL, -- e.g. MON,TUE,WED,THU,FRI,SAT,SUN
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (truck_id) REFERENCES trucks(truck_id) ON DELETE RESTRICT
);

-- 5. Destination Groups
CREATE TABLE IF NOT EXISTS destination_groups (
  group_id INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT NOT NULL UNIQUE,
  group_name VARCHAR(100) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE
);

-- 6. Parcels Table
CREATE TABLE IF NOT EXISTS parcels (
  parcel_id INT AUTO_INCREMENT PRIMARY KEY,
  tracking_id VARCHAR(30) NOT NULL UNIQUE,
  sender_name VARCHAR(100) NOT NULL,
  receiver_name VARCHAR(100) NOT NULL,
  origin VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  route_id INT NOT NULL,
  weight DECIMAL(10,2) NOT NULL,
  urgency ENUM('Normal','Urgent') NOT NULL DEFAULT 'Normal',
  arrival_time DATETIME NOT NULL,
  deadline DATETIME NULL,
  max_wait_hours INT NOT NULL DEFAULT 48,
  status ENUM('Registered','Waiting for Sorting','Sorted','Awaiting Dispatch','Batched','Dispatched','Delivered','Exception') NOT NULL DEFAULT 'Registered',
  FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE RESTRICT,
  INDEX idx_route_status_arrival (route_id, status, arrival_time),
  INDEX idx_deadline (deadline),
  INDEX idx_status (status)
);

-- 7. Batches Table
CREATE TABLE IF NOT EXISTS batches (
  batch_id INT AUTO_INCREMENT PRIMARY KEY,
  batch_code VARCHAR(30) NOT NULL UNIQUE,
  truck_id INT NOT NULL,
  route_id INT NOT NULL,
  schedule_id INT NOT NULL,
  scheduled_departure DATETIME NOT NULL,
  total_weight DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  parcel_count INT NOT NULL DEFAULT 0,
  batch_status ENUM('Generated','Ready','Dispatched','Delayed','Cancelled') NOT NULL DEFAULT 'Generated',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_truck_departure (truck_id, scheduled_departure),
  FOREIGN KEY (truck_id) REFERENCES trucks(truck_id) ON DELETE RESTRICT,
  FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE RESTRICT,
  FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id) ON DELETE RESTRICT,
  INDEX idx_route_dep_status (route_id, scheduled_departure, batch_status)
);

-- 8. Batch Parcels Junction Table
CREATE TABLE IF NOT EXISTS batch_parcels (
  batch_parcel_id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  parcel_id INT NOT NULL UNIQUE,
  FOREIGN KEY (batch_id) REFERENCES batches(batch_id) ON DELETE CASCADE,
  FOREIGN KEY (parcel_id) REFERENCES parcels(parcel_id) ON DELETE RESTRICT
);

-- 9. Dispatch History Table
CREATE TABLE IF NOT EXISTS dispatch_history (
  dispatch_id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL UNIQUE,
  scheduled_departure DATETIME NOT NULL,
  actual_departure DATETIME NULL,
  dispatch_status ENUM('Dispatched','Delayed') NOT NULL DEFAULT 'Delayed',
  FOREIGN KEY (batch_id) REFERENCES batches(batch_id) ON DELETE CASCADE
);

-- 10. Parcel Status History Table
CREATE TABLE IF NOT EXISTS parcel_status_history (
  history_id INT AUTO_INCREMENT PRIMARY KEY,
  parcel_id INT NOT NULL,
  previous_status VARCHAR(30) NULL,
  new_status VARCHAR(30) NOT NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  remarks VARCHAR(255) NULL,
  FOREIGN KEY (parcel_id) REFERENCES parcels(parcel_id) ON DELETE CASCADE
);

-- ==========================================================
-- Initial Seed Data
-- ==========================================================

-- Seed Operator: username 'admin', password 'admin123' (bcrypt hash)
INSERT INTO users (user_id, username, password_hash)
VALUES (1, 'admin', '$2b$10$cmGO3dBkOpmmvVYALJ68yuw9YkgYbQBfCifFxDETeoDQs9ymRn7Oi')
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);

-- Seed Sample Routes
INSERT IGNORE INTO routes (route_id, origin, destination, estimated_travel_hours, processing_buffer_hours)
VALUES 
(1, 'Ahmedabad', 'Mumbai', 8.00, 1.00),
(2, 'Mumbai', 'Ahmedabad', 8.00, 1.00),
(3, 'Ahmedabad', 'Delhi', 16.00, 2.00);

-- Seed Destination Groups
INSERT IGNORE INTO destination_groups (group_id, route_id, group_name)
VALUES 
(1, 1, 'Ahmedabad -> Mumbai Group'),
(2, 2, 'Mumbai -> Ahmedabad Group'),
(3, 3, 'Ahmedabad -> Delhi Group');

-- Seed Trucks
INSERT IGNORE INTO trucks (truck_id, truck_number, route_id, capacity, availability_status)
VALUES 
(1, 'GJ-01-AX-1001', 1, 500.00, 'Available'),
(2, 'GJ-01-AX-1002', 2, 500.00, 'Available'),
(3, 'GJ-01-AX-2001', 3, 1000.00, 'Available');

-- Seed Schedules
INSERT IGNORE INTO schedules (schedule_id, truck_id, departure_time, departure_days, is_active)
VALUES 
(1, 1, '10:00:00', 'MON,TUE,WED,THU,FRI,SAT,SUN', TRUE),
(2, 1, '18:00:00', 'MON,TUE,WED,THU,FRI,SAT,SUN', TRUE),
(3, 2, '11:00:00', 'MON,TUE,WED,THU,FRI,SAT,SUN', TRUE),
(4, 3, '20:00:00', 'MON,WED,FRI', TRUE);

