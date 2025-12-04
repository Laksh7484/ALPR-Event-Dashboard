import dotenv from 'dotenv';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: resolve(__dirname, '.env') });

console.log('='.repeat(60));
console.log('DATABASE CONNECTION DIAGNOSTIC TEST');
console.log('='.repeat(60));

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
};

console.log('\nDatabase Configuration:');
console.log('  Host:', dbConfig.host);
console.log('  Port:', dbConfig.port);
console.log('  Database:', dbConfig.database);
console.log('  User:', dbConfig.user);
console.log('  Password:', dbConfig.password ? '***' + dbConfig.password.slice(-3) : '(empty)');
console.log('  SSL:', dbConfig.ssl ? 'ENABLED' : 'DISABLED');
console.log('\n' + '-'.repeat(60));

const pool = new Pool(dbConfig);

async function testConnection() {
  console.log('\n🔍 Testing connection...\n');

  try {
    console.time('Connection time');
    const client = await pool.connect();
    console.timeEnd('Connection time');

    console.log('✅ Connection successful!\n');

    // Test query
    console.log('Running test query: SELECT NOW()...');
    const result = await client.query('SELECT NOW() as server_time, version() as pg_version');
    console.log('✅ Query successful!');
    console.log('  Server time:', result.rows[0].server_time);
    console.log('  PostgreSQL version:', result.rows[0].pg_version);

    client.release();

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED - DATABASE IS ACCESSIBLE');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ CONNECTION FAILED');
    console.log('='.repeat(60));
    console.log('\nError message:', error.message);
    console.log('Error code:', error.code);
    console.log('Error errno:', error.errno);
    console.log('Syscall:', error.syscall);

    console.log('\n' + '-'.repeat(60));
    console.log('TROUBLESHOOTING STEPS:');
    console.log('-'.repeat(60));

    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - database server is not accepting connections');
      console.log('   Check: Is PostgreSQL running?');
    } else if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      console.log('❌ Connection reset or host not found');
      console.log('   Possible causes:');
      console.log('   1. AWS RDS Security Group blocking your IP');
      console.log('   2. Database instance is stopped or unavailable');
      console.log('   3. Network/firewall issues');
      console.log('   4. Incorrect hostname');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('❌ Connection timed out');
      console.log('   Check: Network connectivity, security groups, firewall');
    } else if (error.code === '28P01') {
      console.log('❌ Authentication failed - invalid username or password');
    } else if (error.code === '3D000') {
      console.log('❌ Database does not exist');
      console.log('   Check: Database name is correct');
    }

    console.log('\n📋 AWS RDS CHECKLIST:');
    console.log('   □ RDS instance is publicly accessible');
    console.log('   □ Security group allows inbound on port 5432');
    console.log('   □ Your current IP is whitelisted in security group');
    console.log('   □ DB_PASSWORD is correct in .env file');
    console.log('   □ DB_SSL=true is set in .env file');

    console.log('\n💡 TO FIX SECURITY GROUP:');
    console.log('   1. Go to AWS Console → RDS → Your Database');
    console.log('   2. Click on VPC security groups');
    console.log('   3. Edit inbound rules');
    console.log('   4. Add rule: Type=PostgreSQL, Port=5432, Source=My IP');

    console.log('\n' + '='.repeat(60));

    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
