import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const migrations = [
  // Tabla payload_migrations
  `CREATE TABLE IF NOT EXISTS "payload_migrations" (
    "id" serial PRIMARY KEY,
    "name" varchar NOT NULL,
    "batch" integer NOT NULL,
    "created_at" timestamp DEFAULT now()
  );`,

  // Tabla payloads (para PayloadCMS)
  `CREATE TABLE IF NOT EXISTS "payloads" (
    "id" serial PRIMARY KEY,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
  );`,

  // Tabla payload_preferences (para usuario preferences)
  `CREATE TABLE IF NOT EXISTS "payload_preferences" (
    "id" serial PRIMARY KEY,
    "user" integer,
    "key" varchar,
    "value" jsonb,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
  );`,
];

async function runMigrations() {
  console.log('🔧 Creating base tables...');

  for (const sql of migrations) {
    try {
      await pool.query(sql);
      console.log('✅ Table created');
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  // Verificar tablas
  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  console.log('\n📊 Current tables:');
  result.rows.forEach(row => console.log('  -', row.table_name));

  await pool.end();
  console.log('\n✅ Done!');
}

runMigrations().catch(console.error);
