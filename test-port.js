import net from 'net';

const host = 'adept-tech-mall-archive.caonoa8tamco.us-east-2.rds.amazonaws.com';
const port = 5432;
const timeout = 10000; // 10 seconds

console.log('='.repeat(60));
console.log('PORT CONNECTIVITY TEST');
console.log('='.repeat(60));
console.log(`\nTesting connection to: ${host}:${port}`);
console.log(`Timeout: ${timeout / 1000} seconds\n`);

const socket = new net.Socket();

socket.setTimeout(timeout);

socket.on('connect', () => {
  console.log('✅ SUCCESS! Port 5432 is OPEN and accessible');
  console.log('='.repeat(60));
  console.log('✅ This means the Security Group allows your IP');
  console.log('The connection timeout in your Node.js app is likely');
  console.log('a different issue (SSL, credentials, etc.)');
  console.log('='.repeat(60));
  socket.destroy();
  process.exit(0);
});

socket.on('timeout', () => {
  console.log('❌ TIMEOUT: Port 5432 is BLOCKED or unreachable');
  console.log('='.repeat(60));
  console.log('❌ This confirms: Security Group is blocking your IP');
  console.log('\nWhat this means:');
  console.log('- AWS RDS Security Group does NOT allow your VM IP');
  console.log('- You MUST ask your AWS admin to whitelist your IP');
  console.log('\nGet your VM public IP by running:');
  console.log('  curl ifconfig.me');
  console.log('\nThen ask admin to add it to RDS Security Group');
  console.log('='.repeat(60));
  socket.destroy();
  process.exit(1);
});

socket.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    console.log('❌ CONNECTION REFUSED');
    console.log('Port is reachable but connection was actively refused.');
    console.log('This could mean the RDS instance is stopped or database is down.');
  } else if (err.code === 'ENOTFOUND') {
    console.log('❌ HOST NOT FOUND');
    console.log('Cannot resolve the hostname. Check DNS or hostname spelling.');
  } else {
    console.log(`❌ ERROR: ${err.message}`);
    console.log(`Code: ${err.code}`);
  }
  socket.destroy();
  process.exit(1);
});

console.log('Attempting connection...\n');
socket.connect(port, host);
