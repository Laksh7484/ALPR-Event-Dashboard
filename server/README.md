# Backend API Server

This is the Express.js backend server for the ALPR Event Dashboard.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure database connection:**
   Create a `.env` file in the `server/` directory (or in the root directory) with the following variables:

   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=alpr_data
   DB_USER=postgres
   DB_PASSWORD=your_password_here
   DB_SCHEMA=alpr_data
   DB_TABLE=alpr_event
   PORT=3001
   ```

   **Note:** 
   - If your table is in the default `public` schema, you can omit `DB_SCHEMA`
   - If your table name is `alpr_data` (not `alpr_event`), set `DB_TABLE=alpr_data`
   - Based on the database structure, the table might be `alpr_event` in the `alpr_data` schema

3. **Run the server:**
   ```bash
   npm run server
   ```

   For development with auto-reload:
   ```bash
   npm run dev:server
   ```

## API Endpoints

### GET /api/detections
Fetches all ALPR detection events from the database.

**Response:**
```json
[
  {
    "id": "...",
    "timestamp": 1683619186901,
    "plate": {
      "tag": "GFWI87",
      ...
    },
    "source": {
      "name": "Camera2",
      ...
    },
    ...
  }
]
```

### GET /api/kpis
Fetches KPI statistics (total detections, active cameras).

**Response:**
```json
[
  {
    "title": "Total Detections",
    "value": "1428",
    "icon": "...",
    "color": "cyan"
  },
  {
    "title": "Active Cameras",
    "value": "24",
    "icon": "...",
    "color": "purple"
  }
]
```

### GET /api/health
Health check endpoint.

## Database Schema

The server expects a table with the following columns:
- `id` (string/uuid)
- `timestamp` (timestamp)
- `plate_tag` (string)
- `camera_id` (string)
- `camera_name` (string)
- `metadata` (jsonb/json)
- `source_file` (string)

The `metadata` column should contain JSON with fields like:
- `image`, `location`, `plate`, `source`, `timeOfDay`, `type`, `version`
- Optionally: `vehicle` (with color, type, orientation, etc.)

