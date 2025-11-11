<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ALPR Event Dashboard

A real-time dashboard for viewing Automatic License Plate Recognition (ALPR) events with PostgreSQL backend integration.

View your app in AI Studio: https://ai.studio/apps/drive/16QX1P2fE7hQjEQl5D-JU3Tcx3QTCF3Tv

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database with ALPR event data

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Backend Database

Create a `.env` file in the root directory (or in `server/` directory) with your PostgreSQL connection details:

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
- If your table is in the default `public` schema, omit `DB_SCHEMA`
- If your table name is `alpr_data` instead of `alpr_event`, set `DB_TABLE=alpr_data`
- Based on typical database structures, the table might be `alpr_event` in the `alpr_data` schema

### 3. Run the Application

You need to run both the backend API server and the frontend development server:

**Terminal 1 - Backend Server:**
```bash
npm run server
```

**Terminal 2 - Frontend Development Server:**
```bash
npm run dev
```

The backend API will run on `http://localhost:3001` and the frontend will run on `http://localhost:3000`.

## Database Schema

The application expects a PostgreSQL table with the following columns:

- `id` (string/uuid) - Unique identifier
- `timestamp` (timestamp) - Event timestamp
- `plate_tag` (string) - License plate number
- `camera_id` (string) - Camera identifier
- `camera_name` (string) - Camera name
- `metadata` (jsonb/json) - JSON containing event details (image, location, plate, source, etc.)
- `source_file` (string) - Source file path

The `metadata` column should contain JSON with fields like:
- `image`, `location`, `plate`, `source`, `timeOfDay`, `type`, `version`
- Optionally: `vehicle` (with color, type, orientation, etc.)

## Available Scripts

- `npm run dev` - Start frontend development server
- `npm run server` - Start backend API server
- `npm run dev:server` - Start backend server with auto-reload
- `npm run build` - Build the frontend for production
