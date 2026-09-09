import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;

if (!connectionString) {
  console.error('❌ ERROR: No DATABASE_URL found in environment variables');
  process.exit(1);
}

console.log('🔍 Testing Neon PostgreSQL connection...\n');
console.log('Connection string:', connectionString.replace(/:[^:@]+@/, ':***@'));

const sql = neon(connectionString);

async function verifyConnection() {
  try {
    // Test basic connection
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    console.log('\n✅ Database connection successful!');
    console.log('📅 Server time:', result[0].current_time);
    console.log('🐘 PostgreSQL version:', result[0].pg_version.split(' ')[0], result[0].pg_version.split(' ')[1]);

    // Check tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('\n📊 Database tables created:');
    tables.forEach(row => {
      console.log('  ✓', row.table_name);
    });

    // Count records in each table
    console.log('\n📈 Table record counts:');
    
    const counts = await Promise.all([
      sql`SELECT COUNT(*) as count FROM categories`,
      sql`SELECT COUNT(*) as count FROM products`,
      sql`SELECT COUNT(*) as count FROM orders`,
      sql`SELECT COUNT(*) as count FROM held_orders`,
      sql`SELECT COUNT(*) as count FROM users`,
      sql`SELECT COUNT(*) as count FROM customers`,
      sql`SELECT COUNT(*) as count FROM settings`,
    ]);

    const tableNames = ['categories', 'products', 'orders', 'held_orders', 'users', 'customers', 'settings'];
    counts.forEach((result, index) => {
      console.log(`  ${tableNames[index]}: ${result[0].count} records`);
    });

    console.log('\n🎉 Neon PostgreSQL setup complete!');
    console.log('✅ Your multi-location café POS database is ready!\n');
    
    console.log('📝 Next steps:');
    console.log('  1. Run: npm run dev');
    console.log('  2. Open: http://localhost:3000');
    console.log('  3. Your app will now use Neon database for multi-location sync!\n');

  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('  1. Check your .env file has DATABASE_URL and VITE_DATABASE_URL');
    console.error('  2. Verify the connection string is correct');
    console.error('  3. Check your internet connection');
    console.error('  4. Verify your Neon project is active at https://console.neon.tech\n');
    process.exit(1);
  }
}

verifyConnection();
