-- Authentication tables for ALPR Dashboard
-- All tables are created in the alpr_data schema to match the existing alpr_event table

-- Users table
CREATE TABLE IF NOT EXISTS alpr_data.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- OTP tokens table
CREATE TABLE IF NOT EXISTS alpr_data.otp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table
CREATE TABLE IF NOT EXISTS alpr_data.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES alpr_data.users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_otp_tokens_email ON alpr_data.otp_tokens(email);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires_at ON alpr_data.otp_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON alpr_data.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON alpr_data.user_sessions(expires_at);
