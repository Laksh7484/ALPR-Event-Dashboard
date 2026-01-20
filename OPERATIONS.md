# ALPR System Operations & Analytics

Use this guide to check the health and performance of your services on the VM.

## 1. Quick Health Check (Analytics)
Run this command to see a summary of all services, their memory usage, and uptime:
```bash
node health-report.js
```

## 2. Live Dashboard (Recommended)
Run this command to open the full-screen "Control Room". You can see all services, their CPU/RAM, and their logs side-by-side:
```bash
pm2 monit
```
*Tip: Use arrow keys to navigate between processes.*

## 3. Managing Processes
| Command | What it does |
|:---|:---|
| `pm2 list` | Shows a simple list of all processes and status |
| `pm2 restart all` | Restarts everything if something feels stuck |
| `pm2 stop all` | Stops everything |
| `pm2 start ecosystem.config.cjs` | Starts everything from the config |

## 4. Log Analytics
If a service is showing an error in `health-report.js` or `pm2 monit`:
```bash
# See the last 50 lines of logs for backend
pm2 logs alpr-backend --lines 50

# See the last 50 lines of logs for UI
pm2 logs alpr-ui-dev --lines 50
```

## 5. Daily Log Files
Logs are stored in the `logs/` folder and organized by date:
- `logs/backend-out.log` (Today)
- `logs/2026-01-XX/` (History)
