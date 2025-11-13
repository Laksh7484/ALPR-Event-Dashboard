import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root (parent directory)
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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
app.get('/api/detections/search', async (req, res) => {
  const plateTag = req.query.plateTag;
  
  if (!plateTag || plateTag.trim() === '') {
    return res.status(400).json({ error: 'Plate tag is required' });
  }

  try {
    const tableName = sanitizeIdentifier(process.env.DB_TABLE || 'alpr_data');
    const schemaName = process.env.DB_SCHEMA ? sanitizeIdentifier(process.env.DB_SCHEMA) : null;
    const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;
    
    // Search for plate tag (case-insensitive, partial match)
    const query = `
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
      ORDER BY timestamp DESC
      LIMIT 100
    `;

    const searchPattern = `%${plateTag.trim()}%`;
    const result = await pool.query(query, [searchPattern]);
    
    // Transform database rows to match Detection interface
    const detections = result.rows.map(row => transformRowToDetection(row));

    res.json(detections);
  } catch (error) {
    console.error('Error searching detections:', error);
    res.status(500).json({ error: 'Failed to search detections', message: error.message });
  }
});

// API endpoint to fetch ALPR events
app.get('/api/detections', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = (page - 1) * limit;
  const cameraName = req.query.cameraName;
  const carMake = req.query.carMake;

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
app.get('/api/cameras', async (req, res) => {
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
app.get('/api/car-makes', async (req, res) => {
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
app.get('/api/detections/count', async (req, res) => {
  const cameraName = req.query.cameraName;
  const carMake = req.query.carMake;
  
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

// API endpoint to get KPIs
app.get('/api/kpis', async (req, res) => {
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
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.error('Make sure your PostgreSQL database is running and .env file is configured correctly.');
  }
}

app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  await testDatabaseConnection();
});

