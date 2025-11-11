# Troubleshooting Guide

## API Endpoints Failing

If you're getting failed requests to `/api/kpis` and `/api/detections`, follow these steps:

### 1. Check Database Connection

The error "password authentication failed for user 'postgres'" means:

**Solution:**
1. Make sure your `.env` file in the project root has the correct database credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=alpr_data
   DB_USER=postgres
   DB_PASSWORD=your_actual_password_here
   ```

2. **Restart the backend server** after updating the `.env` file:
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart it:
   npm run server
   ```

### 2. Verify Database is Running

Make sure PostgreSQL is running on your machine:
- Check if PostgreSQL service is running
- Verify you can connect using `psql` or pgAdmin

### 3. Check Database Credentials

Test your database connection manually:
```bash
psql -h localhost -p 5432 -U postgres -d alpr_data
```

### 4. Verify Table Name

Make sure the table name in your `.env` matches your actual database:
- If your table is `alpr_event` in schema `alpr_data`: `DB_SCHEMA=alpr_data` and `DB_TABLE=alpr_event`
- If your table is just `alpr_data` in the default schema: Remove `DB_SCHEMA` or set it to empty

### 5. Check Server Logs

When you start the server, you should see:
- "Server is running on http://localhost:3001"
- "Database connection successful. Server time: ..."

If you see "Database connection failed", check your `.env` file configuration.

### Common Issues

**Issue:** Server starts but endpoints return 500 errors
- **Cause:** Database connection failed
- **Fix:** Check `.env` file and restart server

**Issue:** CORS errors in browser
- **Cause:** Frontend and backend are on different ports
- **Fix:** Already configured - make sure both servers are running

**Issue:** Table not found errors
- **Cause:** Wrong table name or schema
- **Fix:** Update `DB_TABLE` and `DB_SCHEMA` in `.env` file

