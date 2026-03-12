import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

export const dynamic = 'force-dynamic';

/**
 * Endpoint para crear las tablas base de Payload manualmente.
 * Uso: GET /api/create-base-tables?secret=<PAYLOAD_SECRET>
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (secret !== process.env.PAYLOAD_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const log: string[] = [];

    try {
        log.push('🔧 Creating base tables...');

        // Tabla payload_migrations
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "payload_migrations" (
                "id" serial PRIMARY KEY,
                "name" varchar NOT NULL,
                "batch" integer NOT NULL,
                "created_at" timestamp DEFAULT now()
            );
        `);
        log.push('✅ payload_migrations table created');

        // Tabla payloads
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "payloads" (
                "id" serial PRIMARY KEY,
                "createdAt" timestamp DEFAULT now(),
                "updatedAt" timestamp DEFAULT now()
            );
        `);
        log.push('✅ payloads table created');

        // Tabla payload_preferences
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "payload_preferences" (
                "id" serial PRIMARY KEY,
                "user" integer,
                "key" varchar,
                "value" jsonb,
                "createdAt" timestamp DEFAULT now(),
                "updatedAt" timestamp DEFAULT now()
            );
        `);
        log.push('✅ payload_preferences table created');

        // Verificar tablas creadas
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        const tables = result.rows.map((r: any) => r.table_name);
        log.push(`\n📊 Current tables (${tables.length}):`);
        tables.forEach((t: string) => log.push(`  - ${t}`));

        return NextResponse.json({ success: true, log, tables });
    } catch (error: any) {
        log.push(`❌ Error: ${error.message}`);
        return NextResponse.json({ success: false, log, error: error.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
