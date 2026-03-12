import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

export const dynamic = 'force-dynamic';

/**
 * Endpoint para crear datos iniciales en tablas de relación.
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
        log.push('🔧 Seeding relation tables...');

        // 1. Crear opening hours para configuracion_sitio
        await pool.query(`
            INSERT INTO "configuracion_sitio_opening_hours"
            ("_order", "_parent_id", "id", "days", "hours", "closed")
            VALUES (0, 1, '1', 'Lunes a Viernes', '13:00 - 16:00', false)
            ON CONFLICT DO NOTHING
        `);
        log.push('✅ configuracion_sitio_opening_hours seeded');

        // 2. Crear locales para configuracion_sitio
        await pool.query(`
            INSERT INTO "configuracion_sitio_opening_hours_locales"
            ("_parent_id", "days", "hours", "_locale")
            VALUES (1, 'Lunes a Viernes', '13:00 - 16:00', 'es')
            ON CONFLICT DO NOTHING
        `);
        log.push('✅ configuracion_sitio_opening_hours_locales seeded');

        // 3. Crear registro en configuracion_sitio_locales
        await pool.query(`
            INSERT INTO "configuracion_sitio_locales"
            ("_parent_id", "_locale")
            VALUES (1, 'es')
            ON CONFLICT DO NOTHING
        `);
        log.push('✅ configuracion_sitio_locales seeded');

        // 4. Crear galería para pagina_inicio
        await pool.query(`
            INSERT INTO "pagina_inicio_galeria_inicio"
            ("_order", "_parent_id", "id", "imagen_id")
            VALUES (0, 1, '1', 1)
            ON CONFLICT DO NOTHING
        `);
        log.push('✅ pagina_inicio_galeria_inicio seeded');

        // 5. Crear locales para galeria
        await pool.query(`
            INSERT INTO "pagina_inicio_galeria_inicio_locales"
            ("_parent_id", "_locale")
            VALUES (1, 'es')
            ON CONFLICT DO NOTHING
        `);
        log.push('✅ pagina_inicio_galeria_inicio_locales seeded');

        // 6. Crear _rels para pagina_inicio
        await pool.query(`
            INSERT INTO "pagina_inicio_rels"
            ("id", "order", "parent_id", "path")
            VALUES (1, 0, 1, '')
            ON CONFLICT DO NOTHING
        `);
        log.push('✅ pagina_inicio_rels seeded');

        // 7. Crear locales para pagina_inicio
        await pool.query(`
            INSERT INTO "pagina_inicio_locales"
            ("_parent_id", "_locale")
            VALUES (1, 'es')
            ON CONFLICT DO NOTHING
        `);
        log.push('✅ pagina_inicio_locales seeded');

        return NextResponse.json({ success: true, log });
    } catch (error: any) {
        log.push(`❌ Error: ${error.message}`);
        return NextResponse.json({ success: false, log, error: error.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
