import { getPayload } from 'payload';
import config from '../../../../payload.config';
import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

export const dynamic = 'force-dynamic';

/**
 * Endpoint para inicializar los globals de Payload.
 * Uso: GET /api/init-globals?secret=<PAYLOAD_SECRET>
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
        log.push('🔧 Initializing Payload globals...');

        // Verificar si configuracion_sitio existe
        const checkResult = await pool.query(`SELECT id FROM "configuracion_sitio" LIMIT 1`);

        if (checkResult.rows.length === 0) {
            log.push('Creating configuracion_sitio global...');
            await pool.query(`
                INSERT INTO "configuracion_sitio"
                ("id", "title", "logo_id", "description", "updated_at", "created_at")
                VALUES (1, 'Warynessy', NULL, 'Restaurante de cocina autóctona y mediterránea', NOW(), NOW())
            `);
            log.push('✅ configuracion_sitio created');
        } else {
            log.push('✅ configuracion_sitio already exists');
        }

        // Verificar si pagina_inicio existe
        const paginaInicioResult = await pool.query(`SELECT id FROM "pagina_inicio" LIMIT 1`);

        if (paginaInicioResult.rows.length === 0) {
            log.push('Creating pagina_inicio global...');

            // Primero necesitamos un archivo para la imagen hero
            const archivoResult = await pool.query(`
                INSERT INTO "archivos" ("filename", "url", "mime_type", "updated_at", "created_at")
                VALUES ('hero-placeholder.jpg', '/media/hero-placeholder.jpg', 'image/jpeg', NOW(), NOW())
                ON CONFLICT ("filename") DO NOTHING
                RETURNING id
            `);

            const imagenId = archivoResult.rows[0]?.id || 1;

            await pool.query(`
                INSERT INTO "pagina_inicio"
                ("id", "hero_title", "hero_subtitle", "hero_image_id", "cta_button_text", "updated_at", "created_at")
                VALUES (1, 'Bienvenido a Warynessy', 'Cocina autóctona y mediterránea', $1, 'Reservar ahora', NOW(), NOW())
            `, [imagenId]);
            log.push('✅ pagina_inicio created');
        } else {
            log.push('✅ pagina_inicio already exists');
        }

        // Inicializar via Payload API
        log.push('Initializing via Payload...');
        const payload = await getPayload({ config });

        // Intentar leer los globals
        try {
            await payload.findGlobal({ slug: 'configuracion-sitio' as any });
            log.push('✅ configuracion-sitio accessible via Payload');
        } catch (e: any) {
            log.push(`⚠️ configuracion-sitio Payload error: ${e.message}`);
        }

        try {
            await payload.findGlobal({ slug: 'pagina-inicio' as any });
            log.push('✅ pagina-inicio accessible via Payload');
        } catch (e: any) {
            log.push(`⚠️ pagina-inicio Payload error: ${e.message}`);
        }

        return NextResponse.json({ success: true, log });
    } catch (error: any) {
        log.push(`❌ Error: ${error.message}`);
        return NextResponse.json({ success: false, log, error: error.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
