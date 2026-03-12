import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

export const dynamic = 'force-dynamic';

/**
 * Endpoint para diagnosticar el error de configuracion_sitio.
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
        log.push('🔍 Diagnosing configuracion_sitio...');

        // 1. Verificar que la tabla existe
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'configuracion_sitio'
            );
        `);
        log.push(`Table exists: ${tableCheck.rows[0].exists}`);

        // 2. Verificar que tiene datos
        const dataCheck = await pool.query(`SELECT COUNT(*) as count FROM "configuracion_sitio"`);
        log.push(`Row count: ${dataCheck.rows[0].count}`);

        // 3. Verificar las columnas
        const columns = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'configuracion_sitio'
            ORDER BY ordinal_position
        `);
        log.push(`Columns: ${columns.rows.length}`);
        columns.rows.forEach((c: any) => log.push(`  - ${c.column_name}: ${c.data_type}`));

        // 4. Intentar leer el registro directamente
        const row = await pool.query(`SELECT * FROM "configuracion_sitio" LIMIT 1`);
        log.push(`Direct query result: ${JSON.stringify(row.rows[0] || null)}`);

        // 5. Verificar tablas relacionadas
        const relatedTables = [
            'configuracion_sitio_opening_hours',
            'configuracion_sitio_footer_logos',
            'configuracion_sitio_opening_hours_locales',
            'configuracion_sitio_locales',
        ];

        for (const tableName of relatedTables) {
            const exists = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = $1
                );
            `, [tableName]);
            log.push(`${tableName}: ${exists.rows[0].exists ? '✅' : '❌'}`);
        }

        return NextResponse.json({ success: true, log, row: row.rows[0] || null });
    } catch (error: any) {
        log.push(`❌ Error: ${error.message}`);
        log.push(`Stack: ${error.stack}`);
        return NextResponse.json({ success: false, log, error: error.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
