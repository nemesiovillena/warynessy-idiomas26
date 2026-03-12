import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

export const dynamic = 'force-dynamic';

/**
 * Endpoint para crear tablas faltantes de Payload.
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
        log.push('🔧 Adding missing columns to configuracion_sitio...');

        // Columnas faltantes en configuracion_sitio
        const alterColumns = [
            `ALTER TABLE "configuracion_sitio" ADD COLUMN IF NOT EXISTS "contact_whatsapp" varchar`,
            `ALTER TABLE "configuracion_sitio" ADD COLUMN IF NOT EXISTS "contact_whatsapp_message" varchar`,
            `ALTER TABLE "configuracion_sitio" ADD COLUMN IF NOT EXISTS "instagram_config_method" varchar`,
            `ALTER TABLE "configuracion_sitio" ADD COLUMN IF NOT EXISTS "instagram_config_api_token" varchar`,
            `ALTER TABLE "configuracion_sitio" ADD COLUMN IF NOT EXISTS "instagram_config_api_user_id" varchar`,
            `ALTER TABLE "configuracion_sitio" ADD COLUMN IF NOT EXISTS "instagram_config_embed_code" varchar`,
        ];

        for (const sql of alterColumns) {
            try {
                await pool.query(sql);
                log.push(`✅ Column added`);
            } catch (e: any) {
                if (!e.message.includes('already exists')) {
                    log.push(`⚠️ ${e.message}`);
                }
            }
        }

        // Crear tablas de locales
        log.push('Creating locale tables...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS "configuracion_sitio_opening_hours_locales" (
                "_parent_id" integer NOT NULL,
                "days" varchar,
                "hours" varchar,
                "_locale" varchar
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS "configuracion_sitio_locales" (
                "_parent_id" integer NOT NULL,
                "_locale" varchar
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS "configuracion_sitio_footer_logos" (
                "_order" integer NOT NULL,
                "_parent_id" integer NOT NULL,
                "id" serial PRIMARY KEY,
                "logo_id" integer NOT NULL,
                "alt" varchar NOT NULL,
                "link" varchar
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS "pagina_inicio_galeria_regalo" (
                "_order" integer NOT NULL,
                "_parent_id" integer NOT NULL,
                "id" varchar PRIMARY KEY NOT NULL,
                "imagen_id" integer NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS "pagina_inicio_locales" (
                "_parent_id" integer NOT NULL,
                "hero_title" varchar,
                "hero_subtitle" varchar,
                "welcome_title" varchar,
                "welcome_text" varchar,
                "cta_title" varchar,
                "cta_text" varchar,
                "cta_button_text" varchar,
                "seo_title" varchar,
                "seo_description" varchar,
                "_locale" varchar
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS "pagina_inicio_galeria_inicio_locales" (
                "_parent_id" integer NOT NULL,
                "_locale" varchar
            )
        `);

        log.push('✅ All missing tables created');

        // Verificar tablas finales
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        const tables = result.rows.map((r: any) => r.table_name);
        log.push(`\n📊 Total tables: ${tables.length}`);

        return NextResponse.json({ success: true, log, tables });
    } catch (error: any) {
        log.push(`❌ Error: ${error.message}`);
        return NextResponse.json({ success: false, log, error: error.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
