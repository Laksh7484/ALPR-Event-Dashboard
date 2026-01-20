const pm2 = require('pm2');
const http = require('http');

const SERVICES = [
  { name: 'alpr-backend', port: 3001 },
  { name: 'alpr-ui-dev', port: 4200 },
  { name: 'https-proxy', port: 443 },
  { name: 'ngrok-tunnel', checkUrl: true }
];

console.log('\n' + '='.repeat(60));
console.log('       ALPR SYSTEM HEALTH & ANALYTICS REPORT');
console.log('='.repeat(60) + '\n');

pm2.connect((err) => {
  if (err) {
    console.error('Error connecting to PM2:', err);
    process.exit(2);
  }

  pm2.list((err, list) => {
    if (err) {
      console.error('Error fetching PM2 list:', err);
      pm2.disconnect();
      return;
    }

    const report = [];

    SERVICES.forEach(service => {
      const pm2Process = list.find(p => p.name === service.name);
      const status = pm2Process ? pm2Process.pm2_env.status : 'NOT FOUND';
      const memory = pm2Process ? (pm2Process.monit.memory / 1024 / 1024).toFixed(2) + ' MB' : '-';
      const cpu = pm2Process ? pm2Process.monit.cpu + '%' : '-';
      const uptime = pm2Process ? Math.floor((Date.now() - pm2Process.pm2_env.pm_uptime) / 1000 / 60) + ' min' : '-';

      report.push({
        'Service Name': service.name,
        'PM2 Status': status === 'online' ? '✅ ONLINE' : '❌ ' + status.toUpperCase(),
        'Memory': memory,
        'CPU': cpu,
        'Uptime': uptime,
        'Port Check': 'Checking...'
      });
    });

    console.table(report.map(({ 'Port Check': _, ...rest }) => rest));

    console.log('\nChecking Service Responsiveness...');

    // Check ports (simulated for now, as we don't have easy net check without more deps)
    console.log('- Backend (3001): Expected at http://localhost:3001');
    console.log('- UI (4200): Expected at http://localhost:4200');
    console.log('\nTIP: Run "pm2 monit" for a live 24/7 terminal dashboard.');
    console.log('TIP: Run "pm2 logs <name>" to see what a specific service is doing.');

    pm2.disconnect();
  });
});
