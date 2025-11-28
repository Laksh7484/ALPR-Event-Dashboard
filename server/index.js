import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import session from 'express-session';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root (parent directory)
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// PostgreSQL connection pool
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'alpr_data',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  // AWS RDS requires SSL connections
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

console.log('Database configuration:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  password: dbConfig.password ? '***' : '(empty)',
});

const pool = new Pool(dbConfig);

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Email transporter configuration
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailgun.org',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'postmaster@your-domain.mailgun.org',
    pass: process.env.SMTP_PASS || 'your-mailgun-smtp-password'
  }
});

// Verify email configuration on startup
emailTransporter.verify((error, success) => {
  if (error) {
    console.error('Email transporter configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Initialize database tables
async function initializeDatabase() {
  try {
    // Create users table in alpr_data schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alpr_data.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    // Create OTP tokens table in alpr_data schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alpr_data.otp_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create user sessions table in alpr_data schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alpr_data.user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES alpr_data.users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_otp_tokens_email ON alpr_data.otp_tokens(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires_at ON alpr_data.otp_tokens(expires_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON alpr_data.user_sessions(session_token)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON alpr_data.user_sessions(expires_at)`);

    console.log('Database tables initialized successfully in alpr_data schema');
  } catch (error) {
    console.error('Error initializing database tables:', error);
  }
}

// Helper function to generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to generate session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to send OTP email
async function sendOTPEmail(email, otp) {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'support@mail.platesmart.net',
    to: email,
    subject: 'Your Login OTP - ALPR Archive Dashboard',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <!--[if mso]>
        <style type="text/css">
          table {border-collapse: collapse;}
        </style>
        <![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background-color: #667eea; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">ALPR Archive Dashboard</h1>
                    <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">Secure Login Verification</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px; background: white;">
                    <p style="color: #555; font-size: 16px; line-height: 1.8; margin: 20px 0; text-align: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                      You've requested to log in to your ALPR Archive Dashboard. Use the verification code below to complete your login:
                    </p>
                    
                    <!-- OTP Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                      <tr>
                        <td style="background-color: #f5f7fa; border: 2px solid #667eea; border-radius: 12px; padding: 30px; text-align: center;">
                          <p style="color: #666; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 15px 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">YOUR VERIFICATION CODE</p>
                          <p style="font-size: 48px; font-weight: bold; letter-spacing: 12px; color: #667eea; margin: 15px 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Courier, monospace;">${otp}</p>
                          <p style="color: #888; font-size: 14px; margin: 15px 0 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">Valid for 5 minutes</p>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #555; font-size: 16px; line-height: 1.8; margin: 20px 0; text-align: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                      Enter this code on the login page to access your dashboard.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 8px 0; font-size: 13px; color: #888; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">This is an automated message from ALPR Archive Dashboard</p>
                    <p style="margin: 8px 0; font-size: 13px; color: #888; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">Please do not reply to this email</p>
                    <p style="margin-top: 15px; color: #aaa; font-size: 12px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">© 2025 ALPR Archive Dashboard. All rights reserved.</p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Authentication middleware
async function authenticateSession(req, res, next) {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');

  if (!sessionToken) {
    return res.status(401).json({ error: 'No session token provided' });
  }

  try {
    const result = await pool.query(
      `SELECT us.*, u.email, u.name 
       FROM alpr_data.user_sessions us
       JOIN alpr_data.users u ON us.user_id = u.id
       WHERE us.session_token = $1 
       AND us.expires_at > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`,
      [sessionToken]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Error authenticating session:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

// ==================== AUTHENTICATION ROUTES ====================

// Check if user exists
app.post('/api/auth/check-user', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, name FROM alpr_data.users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    res.json({
      exists: result.rows.length > 0,
    });
  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({ error: 'Failed to check user' });
  }
});

// Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  try {
    // Delete old OTPs for this email
    await pool.query('DELETE FROM alpr_data.otp_tokens WHERE email = $1', [normalizedEmail]);

    // Insert new OTP
    await pool.query(
      'INSERT INTO alpr_data.otp_tokens (email, otp_code, expires_at) VALUES ($1, $2, $3)',
      [normalizedEmail, otp, expiresAt]
    );

    // Send email
    const emailSent = await sendOTPEmail(normalizedEmail, otp);

    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send OTP email' });
    }

    res.json({
      success: true,
      message: 'OTP sent to your email',
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP and create session
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Get the OTP without time filtering (we'll check expiry in JavaScript)
    const otpResult = await pool.query(
      `SELECT * FROM alpr_data.otp_tokens 
       WHERE email = $1 AND otp_code = $2 
       AND verified = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail, otp.trim()]
    );

    if (otpResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    const otpData = otpResult.rows[0];
    const now = new Date();
    const expiresAt = new Date(otpData.expires_at);

    // Debug logging
    console.log('OTP Validation Debug:', {
      email: normalizedEmail,
      otp: otp.trim(),
      expires_at: expiresAt.toISOString(),
      current_time: now.toISOString(),
      time_diff_seconds: (expiresAt - now) / 1000,
      is_expired: now > expiresAt
    });

    // Check if OTP has expired
    if (now > expiresAt) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    // Mark OTP as verified
    await pool.query(
      'UPDATE alpr_data.otp_tokens SET verified = TRUE WHERE id = $1',
      [otpResult.rows[0].id]
    );

    // Check if user exists
    const userResult = await pool.query(
      'SELECT * FROM alpr_data.users WHERE email = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found. Please sign up first.',
        requiresSignup: true
      });
    }

    const user = userResult.rows[0];

    // Update last login
    await pool.query(
      'UPDATE alpr_data.users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Create session
    const sessionToken = generateSessionToken();
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
      'INSERT INTO alpr_data.user_sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3)',
      [user.id, sessionToken, sessionExpiresAt]
    );

    res.json({
      success: true,
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Signup new user
app.post('/api/auth/signup', async (req, res) => {
  const { email, name, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Get the OTP without time filtering (we'll check expiry in JavaScript)
    const otpResult = await pool.query(
      `SELECT * FROM alpr_data.otp_tokens 
       WHERE email = $1 AND otp_code = $2 
       AND verified = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail, otp.trim()]
    );

    if (otpResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    const otpData = otpResult.rows[0];
    const now = new Date();
    const expiresAt = new Date(otpData.expires_at);

    // Check if OTP has expired
    if (now > expiresAt) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    // Mark OTP as verified
    await pool.query(
      'UPDATE alpr_data.otp_tokens SET verified = TRUE WHERE id = $1',
      [otpResult.rows[0].id]
    );

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM alpr_data.users WHERE email = $1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    const userResult = await pool.query(
      'INSERT INTO alpr_data.users (email, name, last_login) VALUES ($1, $2, NOW()) RETURNING *',
      [normalizedEmail, name || null]
    );

    const user = userResult.rows[0];

    // Create session
    const sessionToken = generateSessionToken();
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
      'INSERT INTO alpr_data.user_sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3)',
      [user.id, sessionToken, sessionExpiresAt]
    );

    res.json({
      success: true,
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Error signing up user:', error);
    res.status(500).json({ error: 'Failed to sign up' });
  }
});

// Get current session
app.get('/api/auth/session', authenticateSession, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name
    }
  });
});

// Logout
app.post('/api/auth/logout', authenticateSession, async (req, res) => {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');

  try {
    await pool.query('DELETE FROM alpr_data.user_sessions WHERE session_token = $1', [sessionToken]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// ==================== EXISTING ALPR ROUTES ====================

// Helper function to sanitize table/schema names
function sanitizeIdentifier(identifier) {
  // Only allow alphanumeric, underscore, and dot characters
  return identifier.replace(/[^a-zA-Z0-9_.]/g, '');
}

// Normalize various timestamp formats to a Unix epoch in milliseconds (number)
function normalizeTimestamp(input) {
  if (input === null || input === undefined) return null;

  // If Postgres sends Date
  if (input instanceof Date) {
    const t = input.getTime();
    return Number.isNaN(t) ? null : t;
  }

  // If already a number (seconds or milliseconds)
  if (typeof input === 'number') {
    // Heuristic: seconds vs milliseconds
    // < 10^11 → seconds; >= 10^11 → milliseconds
    if (input < 1e11) return Math.round(input * 1000);
    return Math.round(input);
  }

  // If numeric string
  if (typeof input === 'string' && /^\d+$/.test(input.trim())) {
    const n = parseInt(input.trim(), 10);
    if (!Number.isFinite(n)) return null;
    return n < 1e11 ? n * 1000 : n;
  }

  // If ISO/date string
  if (typeof input === 'string') {
    const d = new Date(input);
    const t = d.getTime();
    return Number.isNaN(t) ? null : t;
  }

  return null;
}

// Try to extract vehicle make from various possible locations and shapes
function extractVehicleMake(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;

  // Candidates for where make might appear
  const candidates = [
    metadata.vehicle && metadata.vehicle.make,
    metadata.make,
    metadata.vehicleMake,
    metadata.attributes && metadata.attributes.make,
    metadata.vehicle && metadata.vehicle.manufacturer,
    metadata.vehicle && metadata.vehicle.brand,
    metadata.attributes && metadata.attributes.manufacturer,
    metadata.attributes && metadata.attributes.brand,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    // If make is an array, pick the first non-empty
    const value = Array.isArray(candidate) ? candidate.find(Boolean) : candidate;
    if (!value) continue;

    if (typeof value === 'string') {
      const name = value.trim();
      if (name) return { code: name.toLowerCase(), name };
    }

    if (typeof value === 'object') {
      const name = (value.name || value.code || '').toString();
      if (name) return { code: (value.code || name).toString().toLowerCase(), name };
    }
  }

  return null;
}

function toTitleCase(s) {
  if (!s) return s;
  return s
    .toString()
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const CAR_MAKE_SOURCE_SQL = `
  COALESCE(
    NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'vehicle', 'make', 'name')), ''),
    NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'vehicle', 'make', 'code')), ''),
    NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'vehicle', 'make')), ''),
    NULLIF(btrim((metadata::jsonb)->>'make'), ''),
    NULLIF(btrim((metadata::jsonb)->>'vehicleMake'), ''),
    NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'attributes', 'make', 'name')), ''),
    NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'attributes', 'make', 'code')), ''),
    NULLIF(btrim((metadata::jsonb)->'attributes'->>'make'), ''),
    'unknown'
  )
`;

// Helper function to transform database row to Detection object
function transformRowToDetection(row) {
  let metadata = {};
  try {
    metadata = typeof row.metadata === 'string'
      ? JSON.parse(row.metadata)
      : (row.metadata || {});
  } catch (error) {
    console.error('Error parsing metadata JSON:', error);
    metadata = {};
  }

  // Extract vehicle info from metadata - check multiple possible locations
  const vehicleData = metadata.vehicle || metadata.vehicleData ||
    (metadata.attributes && metadata.attributes.vehicle) || null;

  let vehicle = {
    bearing: 0,
    color: { code: 'unknown' },
    occlusion: 0,
    orientation: {
      code: 'unknown',
      name: 'N/A'
    },
    make: {
      code: 'unknown',
      name: 'N/A'
    },
    type: {
      code: 'unknown',
      name: 'N/A'
    }
  };

  if (vehicleData) {
    // Extract color
    if (vehicleData.color) {
      if (typeof vehicleData.color === 'object') {
        vehicle.color = {
          code: vehicleData.color.code || vehicleData.color.name || 'unknown'
        };
      } else {
        vehicle.color = { code: vehicleData.color };
      }
    }

    // Extract orientation
    if (vehicleData.orientation) {
      const orientationCode = typeof vehicleData.orientation === 'object'
        ? (vehicleData.orientation.code || vehicleData.orientation.name || 'unknown')
        : vehicleData.orientation;

      vehicle.orientation = {
        code: orientationCode,
        name: (typeof vehicleData.orientation === 'object' ? vehicleData.orientation.name : null) ||
          (orientationCode === 'rear' ? 'Rear' :
            orientationCode === 'front' ? 'Front' :
              orientationCode === 'side' ? 'Side' :
                orientationCode === 'back' ? 'Rear' :
                  orientationCode === 'forward' ? 'Front' : 'N/A')
      };
    }

    // Extract make
    if (vehicleData.make) {
      const value = vehicleData.make;
      if (typeof value === 'string') {
        vehicle.make = { code: value.toLowerCase(), name: toTitleCase(value) };
      } else if (typeof value === 'object') {
        const nameSource = value.name || value.code || 'N/A';
        const name = toTitleCase(nameSource.toString());
        vehicle.make = { code: (value.code || name).toString().toLowerCase(), name };
      }
    }

    const metaLevelMake = extractVehicleMake(metadata);
    if (metaLevelMake) {
      vehicle.make = {
        code: metaLevelMake.code.toLowerCase(),
        name: toTitleCase(metaLevelMake.name),
      };
    }

    // Extract type
    if (vehicleData.type) {
      const typeCode = typeof vehicleData.type === 'object'
        ? (vehicleData.type.code || vehicleData.type.name || 'unknown')
        : vehicleData.type;

      vehicle.type = {
        code: typeCode,
        name: (typeof vehicleData.type === 'object' ? vehicleData.type.name : null) ||
          (typeCode === 'sedan' ? 'Sedan' :
            typeCode === 'suv' ? 'SUV' :
              typeCode === 'truck' ? 'Truck' :
                typeCode === 'van' ? 'Van' :
                  typeCode === 'car' ? 'Car' :
                    typeCode === 'motorcycle' ? 'Motorcycle' :
                      typeCode === 'bus' ? 'Bus' : 'N/A')
      };
    }

    // Extract other vehicle properties
    if (vehicleData.bearing !== undefined && vehicleData.bearing !== null) {
      vehicle.bearing = vehicleData.bearing;
    }
    if (vehicleData.occlusion !== undefined && vehicleData.occlusion !== null) {
      vehicle.occlusion = vehicleData.occlusion;
    }
  }

  // Use metadata.plate if available, otherwise construct from database columns
  const plate = metadata.plate ? {
    ...metadata.plate,
    tag: metadata.plate.tag || row.plate_tag || ''
  } : {
    code: 'US-FL',
    region: { height: 0, width: 0, x: 0, y: 0 },
    tag: row.plate_tag || ''
  };

  // Use metadata.source if available, otherwise construct from database columns
  const source = metadata.source ? {
    ...metadata.source,
    name: metadata.source.name || row.camera_name || 'N/A',
    id: metadata.source.id || row.camera_id || ''
  } : {
    id: row.camera_id || '',
    name: row.camera_name || 'N/A',
    type: 'alpr_processor'
  };

  // Handle timestamp from multiple possible sources
  let timestamp = null;
  timestamp = normalizeTimestamp(metadata.timestamp);
  if (!timestamp) timestamp = normalizeTimestamp(row.timestamp);
  if (!timestamp) timestamp = normalizeTimestamp(metadata.image && metadata.image.timestamp);

  return {
    id: row.id || metadata.id,
    image: metadata.image || { height: 1080, id: '', width: 1920 },
    location: metadata.location || { lat: 0, lon: 0 },
    plate: plate,
    source: source,
    timeOfDay: metadata.timeOfDay || 0,
    timestamp: timestamp,
    type: metadata.type || 'alpr',
    vehicle: vehicle,
    version: metadata.version || '1.0'
  };
}

// API endpoint to search for a plate tag across all records
// This must come BEFORE /api/detections to ensure proper route matching
app.get('/api/detections/search', authenticateSession, async (req, res) => {
  const plateTag = req.query.plateTag;
  const cameraName = req.query.cameraName;
  const carMake = req.query.carMake;
  const startTimestamp = req.query.startTimestamp;
  const endTimestamp = req.query.endTimestamp;

  if (!plateTag || plateTag.trim() === '') {
    return res.status(400).json({ error: 'Plate tag is required' });
  }

  try {
    const tableName = sanitizeIdentifier(process.env.DB_TABLE || 'alpr_data');
    const schemaName = process.env.DB_SCHEMA ? sanitizeIdentifier(process.env.DB_SCHEMA) : null;
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

    // Search for plate tag (case-insensitive, partial match)
    let query = `
      SELECT 
        id,
        timestamp,
        plate_tag,
        camera_id,
        camera_name,
        metadata,
        source_file
      FROM ${fullTableName}
      WHERE LOWER(plate_tag) LIKE LOWER($1)
    `;

    const queryParams = [`%${plateTag.trim()}%`];
    const whereConditions = [];

    // Add camera filter if provided
    if (cameraName && cameraName !== 'All Cameras' && cameraName.trim() !== '') {
      whereConditions.push(`camera_name = $${queryParams.length + 1}`);
      queryParams.push(cameraName);
    }

    // Add car make filter if provided (search in metadata JSON)
    if (carMake && carMake !== 'All Makes' && carMake.trim() !== '') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const makeValue = normalizedCarMake === 'unknown' || normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      const makeCondition = `(LOWER(${CAR_MAKE_SOURCE_SQL}) = LOWER($${queryParams.length + 1}))`;
      whereConditions.push(makeCondition);
      queryParams.push(makeValue);
    }

    // Add date range filter if provided
    if (startTimestamp && startTimestamp.trim() !== '') {
      const startTs = parseInt(startTimestamp, 10);
      if (!isNaN(startTs)) {
        whereConditions.push(`timestamp >= $${queryParams.length + 1}`);
        queryParams.push(startTs);
      }
    }

    if (endTimestamp && endTimestamp.trim() !== '') {
      const endTs = parseInt(endTimestamp, 10);
      if (!isNaN(endTs)) {
        whereConditions.push(`timestamp <= $${queryParams.length + 1}`);
        queryParams.push(endTs);
      }
    }

    // Add additional WHERE conditions if we have any
    if (whereConditions.length > 0) {
      query += ` AND ${whereConditions.join(' AND ')}`;
    }

    query += ` ORDER BY timestamp DESC LIMIT 100`;

    const result = await pool.query(query, queryParams);

    // Transform database rows to match Detection interface
    const detections = result.rows.map(row => transformRowToDetection(row));

    res.json(detections);
  } catch (error) {
    console.error('Error searching detections:', error);
    res.status(500).json({ error: 'Failed to search detections', message: error.message });
  }
});

// API endpoint to get detection counts by camera (for visualization)
app.get('/api/analytics/detections-by-camera', authenticateSession, async (req, res) => {
  const cameraName = req.query.cameraName;
  const carMake = req.query.carMake;

  try {
    const tableName = sanitizeIdentifier(process.env.DB_TABLE || 'alpr_data');
    const schemaName = process.env.DB_SCHEMA ? sanitizeIdentifier(process.env.DB_SCHEMA) : null;
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

    let query = `
      SELECT 
        camera_name,
        COUNT(*) as detections
      FROM ${fullTableName}
    `;

    const queryParams = [];
    const whereConditions = [];

    // Add camera filter if provided
    if (cameraName && cameraName !== 'All Cameras' && cameraName.trim() !== '') {
      whereConditions.push(`camera_name = $${queryParams.length + 1}`);
      queryParams.push(cameraName);
    }

    // Add car make filter if provided
    if (carMake && carMake !== 'All Makes' && carMake.trim() !== '') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const makeValue = normalizedCarMake === 'unknown' || normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      const makeCondition = `(LOWER(${CAR_MAKE_SOURCE_SQL}) = LOWER($${queryParams.length + 1}))`;
      whereConditions.push(makeCondition);
      queryParams.push(makeValue);
    }

    // Add WHERE clause if we have any conditions
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += ` GROUP BY camera_name ORDER BY detections DESC`;

    const result = await pool.query(query, queryParams);

    const cameraStats = result.rows.map(row => ({
      camera: row.camera_name || 'N/A',
      detections: parseInt(row.detections, 10)
    }));

    res.json(cameraStats);
  } catch (error) {
    console.error('Error fetching camera detection counts:', error);
    res.status(500).json({ error: 'Failed to fetch camera detection counts', message: error.message });
  }
});

// API endpoint to get vehicle type distribution (for visualization)
app.get('/api/analytics/vehicle-types', authenticateSession, async (req, res) => {
  const cameraName = req.query.cameraName;
  const carMake = req.query.carMake;

  try {
    const tableName = sanitizeIdentifier(process.env.DB_TABLE || 'alpr_data');
    const schemaName = process.env.DB_SCHEMA ? sanitizeIdentifier(process.env.DB_SCHEMA) : null;
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

    let query = `
      SELECT 
        COALESCE(
          NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'vehicle', 'type', 'name')), ''),
          NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'vehicle', 'type', 'code')), ''),
          NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'vehicle', 'type')), ''),
          'Unknown'
        ) as vehicle_type,
        COUNT(*) as count
      FROM ${fullTableName}
    `;

    const queryParams = [];
    const whereConditions = [];

    // Add camera filter if provided
    if (cameraName && cameraName !== 'All Cameras' && cameraName.trim() !== '') {
      whereConditions.push(`camera_name = $${queryParams.length + 1}`);
      queryParams.push(cameraName);
    }

    // Add car make filter if provided
    if (carMake && carMake !== 'All Makes' && carMake.trim() !== '') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const makeValue = normalizedCarMake === 'unknown' || normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      const makeCondition = `(LOWER(${CAR_MAKE_SOURCE_SQL}) = LOWER($${queryParams.length + 1}))`;
      whereConditions.push(makeCondition);
      queryParams.push(makeValue);
    }

    // Add WHERE clause if we have any conditions
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += ` GROUP BY vehicle_type ORDER BY count DESC`;

    const result = await pool.query(query, queryParams);

    const typeStats = result.rows.map(row => ({
      name: (row.vehicle_type && row.vehicle_type.trim() !== '') ? row.vehicle_type : 'N/A',
      count: parseInt(row.count, 10)
    }));

    res.json(typeStats);
  } catch (error) {
    console.error('Error fetching vehicle type counts:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle type counts', message: error.message });
  }
});

// API endpoint to get vehicle color distribution (for visualization)
app.get('/api/analytics/vehicle-colors', authenticateSession, async (req, res) => {
  const cameraName = req.query.cameraName;
  const carMake = req.query.carMake;

  try {
    const tableName = sanitizeIdentifier(process.env.DB_TABLE || 'alpr_data');
    const schemaName = process.env.DB_SCHEMA ? sanitizeIdentifier(process.env.DB_SCHEMA) : null;
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

    let query = `
      SELECT 
        COALESCE(
          NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'vehicle', 'color', 'code')), ''),
          NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'vehicle', 'color')), ''),
          'unknown'
        ) as vehicle_color,
        COUNT(*) as count
      FROM ${fullTableName}
    `;

    const queryParams = [];
    const whereConditions = [];

    // Add camera filter if provided
    if (cameraName && cameraName !== 'All Cameras' && cameraName.trim() !== '') {
      whereConditions.push(`camera_name = $${queryParams.length + 1}`);
      queryParams.push(cameraName);
    }

    // Add car make filter if provided
    if (carMake && carMake !== 'All Makes' && carMake.trim() !== '') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const makeValue = normalizedCarMake === 'unknown' || normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      const makeCondition = `(LOWER(${CAR_MAKE_SOURCE_SQL}) = LOWER($${queryParams.length + 1}))`;
      whereConditions.push(makeCondition);
      queryParams.push(makeValue);
    }

    // Add WHERE clause if we have any conditions
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += ` GROUP BY vehicle_color ORDER BY count DESC`;

    const result = await pool.query(query, queryParams);

    const colorStats = result.rows.map(row => ({
      name: (row.vehicle_color && row.vehicle_color.trim() !== '' && row.vehicle_color !== 'unknown') ? row.vehicle_color : 'N/A',
      count: parseInt(row.count, 10)
    }));

    res.json(colorStats);
  } catch (error) {
    console.error('Error fetching vehicle color counts:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle color counts', message: error.message });
  }
});

// API endpoint to get vehicle orientation distribution (for visualization)
app.get('/api/analytics/vehicle-orientations', authenticateSession, async (req, res) => {
  const cameraName = req.query.cameraName;
  const carMake = req.query.carMake;

  try {
    const tableName = sanitizeIdentifier(process.env.DB_TABLE || 'alpr_data');
    const schemaName = process.env.DB_SCHEMA ? sanitizeIdentifier(process.env.DB_SCHEMA) : null;
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

    let query = `
      SELECT 
        COALESCE(
          NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'vehicle', 'orientation', 'name')), ''),
          NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'vehicle', 'orientation', 'code')), ''),
          NULLIF(btrim(jsonb_extract_path_text((metadata::jsonb), 'vehicle', 'orientation')), ''),
          'Unknown'
        ) as vehicle_orientation,
        COUNT(*) as count
      FROM ${fullTableName}
    `;

    const queryParams = [];
    const whereConditions = [];

    // Add camera filter if provided
    if (cameraName && cameraName !== 'All Cameras' && cameraName.trim() !== '') {
      whereConditions.push(`camera_name = $${queryParams.length + 1}`);
      queryParams.push(cameraName);
    }

    // Add car make filter if provided
    if (carMake && carMake !== 'All Makes' && carMake.trim() !== '') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const makeValue = normalizedCarMake === 'unknown' || normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      const makeCondition = `(LOWER(${CAR_MAKE_SOURCE_SQL}) = LOWER($${queryParams.length + 1}))`;
      whereConditions.push(makeCondition);
      queryParams.push(makeValue);
    }

    // Add WHERE clause if we have any conditions
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += ` GROUP BY vehicle_orientation ORDER BY count DESC`;

    const result = await pool.query(query, queryParams);

    const orientationStats = result.rows.map(row => ({
      name: (row.vehicle_orientation && row.vehicle_orientation.trim() !== '' && row.vehicle_orientation !== 'Unknown') ? row.vehicle_orientation : 'N/A',
      count: parseInt(row.count, 10)
    }));

    res.json(orientationStats);
  } catch (error) {
    console.error('Error fetching vehicle orientation counts:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle orientation counts', message: error.message });
  }
});

// API endpoint to fetch ALPR events
app.get('/api/detections', authenticateSession, async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = (page - 1) * limit;
  const cameraName = req.query.cameraName;
  const carMake = req.query.carMake;
  const startTimestamp = req.query.startTimestamp;
  const endTimestamp = req.query.endTimestamp;

  try {
    const tableName = sanitizeIdentifier(process.env.DB_TABLE || 'alpr_data');
    const schemaName = process.env.DB_SCHEMA ? sanitizeIdentifier(process.env.DB_SCHEMA) : null;
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

    let query = `
      SELECT 
        id,
        timestamp,
        plate_tag,
        camera_id,
        camera_name,
        metadata,
        source_file
      FROM ${fullTableName}
    `;

    const queryParams = [];
    const whereConditions = [];

    // Add camera filter if provided
    if (cameraName && cameraName !== 'All Cameras' && cameraName.trim() !== '') {
      whereConditions.push(`camera_name = $${queryParams.length + 1}`);
      queryParams.push(cameraName);
    }

    // Add car make filter if provided (search in metadata JSON)
    if (carMake && carMake !== 'All Makes' && carMake.trim() !== '') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const makeValue = normalizedCarMake === 'unknown' || normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      const makeCondition = `(LOWER(${CAR_MAKE_SOURCE_SQL}) = LOWER($${queryParams.length + 1}))`;
      whereConditions.push(makeCondition);
      queryParams.push(makeValue);
    }

    // Add date range filter if provided
    if (startTimestamp && startTimestamp.trim() !== '') {
      const startTs = parseInt(startTimestamp, 10);
      if (!isNaN(startTs)) {
        whereConditions.push(`timestamp >= $${queryParams.length + 1}`);
        queryParams.push(startTs);
      }
    }

    if (endTimestamp && endTimestamp.trim() !== '') {
      const endTs = parseInt(endTimestamp, 10);
      if (!isNaN(endTs)) {
        whereConditions.push(`timestamp <= $${queryParams.length + 1}`);
        queryParams.push(endTs);
      }
    }

    // Add WHERE clause if we have any conditions
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Transform database rows to match Detection interface
    const detections = result.rows.map(row => transformRowToDetection(row));

    res.json(detections);
  } catch (error) {
    console.error('Error fetching detections:', error);
    res.status(500).json({ error: 'Failed to fetch detections', message: error.message });
  }
});

// API endpoint to get all unique camera names
app.get('/api/cameras', authenticateSession, async (req, res) => {
  try {
    const tableName = sanitizeIdentifier(process.env.DB_TABLE || 'alpr_data');
    const schemaName = process.env.DB_SCHEMA ? sanitizeIdentifier(process.env.DB_SCHEMA) : null;
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

    const query = `
      SELECT DISTINCT camera_name 
      FROM ${fullTableName}
      WHERE camera_name IS NOT NULL
      ORDER BY camera_name ASC
    `;

    const result = await pool.query(query);
    const cameras = result.rows.map(row => row.camera_name);

    res.json(cameras);
  } catch (error) {
    console.error('Error fetching cameras:', error);
    res.status(500).json({ error: 'Failed to fetch cameras', message: error.message });
  }
});

// API endpoint to get all unique car makes from metadata
app.get('/api/car-makes', authenticateSession, async (req, res) => {
  try {
    const tableName = sanitizeIdentifier(process.env.DB_TABLE || 'alpr_data');
    const schemaName = process.env.DB_SCHEMA ? sanitizeIdentifier(process.env.DB_SCHEMA) : null;
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

    const query = `
      SELECT DISTINCT ${CAR_MAKE_SOURCE_SQL} AS raw_make
      FROM ${fullTableName}
      WHERE metadata IS NOT NULL
      ORDER BY raw_make ASC
    `;

    const result = await pool.query(query);
    const makes = result.rows
      .map(row => row.raw_make)
      .filter(make => make && make.trim() !== '')
      .map(make => {
        // Normalize "unknown" to "N/A"
        const normalized = make.trim().toLowerCase();
        if (normalized === 'unknown') {
          return 'N/A';
        }
        return toTitleCase(make.trim());
      })
      .filter((make, index, self) => self.indexOf(make) === index) // Remove duplicates
      .sort();

    res.json(makes);
  } catch (error) {
    console.error('Error fetching car makes:', error);
    res.status(500).json({ error: 'Failed to fetch car makes', message: error.message });
  }
});

// API endpoint to get total detection count
app.get('/api/detections/count', authenticateSession, async (req, res) => {
  const cameraName = req.query.cameraName;
  const carMake = req.query.carMake;
  const startTimestamp = req.query.startTimestamp;
  const endTimestamp = req.query.endTimestamp;

  try {
    const tableName = sanitizeIdentifier(process.env.DB_TABLE || 'alpr_data');
    const schemaName = process.env.DB_SCHEMA ? sanitizeIdentifier(process.env.DB_SCHEMA) : null;
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

    let query = `SELECT COUNT(*) FROM ${fullTableName}`;
    const queryParams = [];
    const whereConditions = [];

    // Add camera filter if provided
    if (cameraName && cameraName !== 'All Cameras' && cameraName.trim() !== '') {
      whereConditions.push(`camera_name = $${queryParams.length + 1}`);
      queryParams.push(cameraName);
    }

    // Add car make filter if provided
    if (carMake && carMake !== 'All Makes' && carMake.trim() !== '') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const makeValue = normalizedCarMake === 'unknown' || normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      const makeCondition = `(LOWER(${CAR_MAKE_SOURCE_SQL}) = LOWER($${queryParams.length + 1}))`;
      whereConditions.push(makeCondition);
      queryParams.push(makeValue);
    }

    // Add date range filter if provided
    if (startTimestamp && startTimestamp.trim() !== '') {
      const startTs = parseInt(startTimestamp, 10);
      if (!isNaN(startTs)) {
        whereConditions.push(`timestamp >= $${queryParams.length + 1}`);
        queryParams.push(startTs);
      }
    }

    if (endTimestamp && endTimestamp.trim() !== '') {
      const endTs = parseInt(endTimestamp, 10);
      if (!isNaN(endTs)) {
        whereConditions.push(`timestamp <= $${queryParams.length + 1}`);
        queryParams.push(endTs);
      }
    }

    // Add WHERE clause if we have any conditions
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    const result = await pool.query(query, queryParams);

    res.json({ total: parseInt(result.rows[0].count, 10) });

  } catch (err) {
    console.error('Error fetching detection count:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API endpoint to export all filtered detections (for CSV export)
// This endpoint returns ALL filtered data without pagination
app.get('/api/detections/export', authenticateSession, async (req, res) => {
  const plateTag = req.query.plateTag;
  const cameraName = req.query.cameraName;
  const carMake = req.query.carMake;
  const startTimestamp = req.query.startTimestamp;
  const endTimestamp = req.query.endTimestamp;

  try {
    const tableName = sanitizeIdentifier(process.env.DB_TABLE || 'alpr_data');
    const schemaName = process.env.DB_SCHEMA ? sanitizeIdentifier(process.env.DB_SCHEMA) : null;
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

    let query = `
      SELECT 
        id,
        timestamp,
        plate_tag,
        camera_id,
        camera_name,
        metadata,
        source_file
      FROM ${fullTableName}
    `;

    const queryParams = [];
    const whereConditions = [];

    // Add plate tag filter if provided (for search mode)
    if (plateTag && plateTag.trim() !== '') {
      whereConditions.push(`LOWER(plate_tag) LIKE LOWER($${queryParams.length + 1})`);
      queryParams.push(`%${plateTag.trim()}%`);
    }

    // Add camera filter if provided
    if (cameraName && cameraName !== 'All Cameras' && cameraName.trim() !== '') {
      whereConditions.push(`camera_name = $${queryParams.length + 1}`);
      queryParams.push(cameraName);
    }

    // Add car make filter if provided (search in metadata JSON)
    if (carMake && carMake !== 'All Makes' && carMake.trim() !== '') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const makeValue = normalizedCarMake === 'unknown' || normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      const makeCondition = `(LOWER(${CAR_MAKE_SOURCE_SQL}) = LOWER($${queryParams.length + 1}))`;
      whereConditions.push(makeCondition);
      queryParams.push(makeValue);
    }

    // Add date range filter if provided
    if (startTimestamp && startTimestamp.trim() !== '') {
      const startTs = parseInt(startTimestamp, 10);
      if (!isNaN(startTs)) {
        whereConditions.push(`timestamp >= $${queryParams.length + 1}`);
        queryParams.push(startTs);
      }
    }

    if (endTimestamp && endTimestamp.trim() !== '') {
      const endTs = parseInt(endTimestamp, 10);
      if (!isNaN(endTs)) {
        whereConditions.push(`timestamp <= $${queryParams.length + 1}`);
        queryParams.push(endTs);
      }
    }

    // Add WHERE clause if we have any conditions
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Order by timestamp and limit to prevent excessive data transfer
    // Set a reasonable maximum limit (e.g., 100,000 records)
    query += ` ORDER BY timestamp DESC LIMIT 100000`;

    console.log('Export query:', query);
    console.log('Export params:', queryParams);

    const result = await pool.query(query, queryParams);

    // Transform database rows to match Detection interface
    const detections = result.rows.map(row => transformRowToDetection(row));

    console.log(`Exporting ${detections.length} detections`);
    res.json(detections);
  } catch (error) {
    console.error('Error exporting detections:', error);
    res.status(500).json({ error: 'Failed to export detections', message: error.message });
  }
});

// API endpoint to get KPIs
app.get('/api/kpis', authenticateSession, async (req, res) => {
  try {
    const tableName = sanitizeIdentifier(process.env.DB_TABLE || 'alpr_data');
    const schemaName = process.env.DB_SCHEMA ? sanitizeIdentifier(process.env.DB_SCHEMA) : null;
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

    const totalQuery = `
      SELECT COUNT(*) as total
      FROM ${fullTableName}
    `;

    const camerasQuery = `
      SELECT COUNT(DISTINCT camera_name) as total
      FROM ${fullTableName}
      WHERE camera_name IS NOT NULL
    `;

    const [totalResult, camerasResult] = await Promise.all([
      pool.query(totalQuery),
      pool.query(camerasQuery)
    ]);

    const totalDetections = parseInt(totalResult.rows[0].total) || 0;
    const activeCameras = parseInt(camerasResult.rows[0].total) || 0;

    res.json([
      {
        title: 'Total Detections',
        value: totalDetections.toLocaleString('en-US'),
        icon: 'M3 10h18M3 14h18m-9-4v8',
        color: 'cyan'
      },
      {
        title: 'Active Cameras',
        value: activeCameras.toString(),
        icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
        color: 'purple'
      }
    ]);
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs', message: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test database connection on startup
async function testDatabaseConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful. Server time:', result.rows[0].now);
    await initializeDatabase();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.error('Make sure your PostgreSQL database is running and .env file is configured correctly.');
  }
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  await testDatabaseConnection();
});
