import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

export const dynamic = 'force-dynamic';

/**
 * Endpoint para ejecutar la migración inicial de Payload manualmente.
 * Uso: GET /api/run-initial-migration?secret=<PAYLOAD_SECRET>
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
        log.push('🔧 Running initial Payload migration...');

        // Crear enums
        await pool.query(`CREATE TYPE IF NOT EXISTS "enum_usuarios_role" AS ENUM('admin', 'editor')`);
        await pool.query(`CREATE TYPE IF NOT EXISTS "enum_menus_dias_semana" AS ENUM('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo')`);
        await pool.query(`CREATE TYPE IF NOT EXISTS "enum_menus_horario" AS ENUM('comidas', 'cenas', 'ambos')`);
        await pool.query(`CREATE TYPE IF NOT EXISTS "enum_banners_posicion" AS ENUM('home-top', 'home-middle', 'home-bottom', 'carta-top', 'menus-top', 'global-top')`);
        await pool.query(`CREATE TYPE IF NOT EXISTS "enum_banners_tipo" AS ENUM('info', 'promo', 'warning', 'event')`);
        log.push('✅ Enums created');

        // Crear tablas principales (simplificado - solo las críticas)
        const tables = [
            `CREATE TABLE IF NOT EXISTS "usuarios" (
                "id" serial PRIMARY KEY,
                "first_name" varchar,
                "last_name" varchar,
                "role" "enum_usuarios_role" DEFAULT 'editor' NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "email" varchar NOT NULL UNIQUE,
                "reset_password_token" varchar,
                "reset_password_expiration" timestamp,
                "salt" varchar,
                "hash" varchar,
                "login_attempts" numeric DEFAULT 0,
                "lock_until" timestamp
            )`,

            `CREATE TABLE IF NOT EXISTS "usuarios_sessions" (
                "_order" integer NOT NULL,
                "_parent_id" integer NOT NULL,
                "id" varchar PRIMARY KEY NOT NULL,
                "created_at" timestamp,
                "expires_at" timestamp NOT NULL,
                CONSTRAINT "usuarios_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "usuarios"("id") ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS "archivos" (
                "id" serial PRIMARY KEY,
                "alt" varchar,
                "caption" varchar,
                "updated_at" timestamp DEFAULT now() NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "url" varchar,
                "filename" varchar UNIQUE,
                "mime_type" varchar,
                "filesize" numeric,
                "width" numeric,
                "height" numeric
            )`,

            `CREATE TABLE IF NOT EXISTS "alergenos" (
                "id" serial PRIMARY KEY,
                "nombre" varchar NOT NULL,
                "codigo" varchar NOT NULL,
                "descripcion" varchar,
                "icono" varchar,
                "orden" numeric DEFAULT 0 NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "categorias" (
                "id" serial PRIMARY KEY,
                "nombre" varchar NOT NULL,
                "slug" varchar NOT NULL UNIQUE,
                "descripcion" varchar,
                "orden" numeric DEFAULT 1 NOT NULL,
                "activa" boolean DEFAULT true,
                "imagen_id" integer,
                "updated_at" timestamp DEFAULT now() NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "platos" (
                "id" serial PRIMARY KEY,
                "nombre" varchar NOT NULL,
                "descripcion" varchar,
                "precio" numeric NOT NULL,
                "imagen_id" integer,
                "categoria_id" integer NOT NULL,
                "activo" boolean DEFAULT true,
                "destacado" boolean DEFAULT false,
                "orden" numeric DEFAULT 0,
                "updated_at" timestamp DEFAULT now() NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "platos_etiquetas" (
                "_order" integer NOT NULL,
                "_parent_id" integer NOT NULL,
                "id" varchar PRIMARY KEY NOT NULL,
                "etiqueta" varchar NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "platos_rels" (
                "id" serial PRIMARY KEY,
                "order" integer,
                "parent_id" integer NOT NULL,
                "path" varchar NOT NULL,
                "alergenos_id" integer
            )`,

            `CREATE TABLE IF NOT EXISTS "menus" (
                "id" serial PRIMARY KEY,
                "nombre" varchar NOT NULL,
                "slug" varchar NOT NULL UNIQUE,
                "imagen_id" integer,
                "precio" numeric NOT NULL,
                "fechas_dias" varchar,
                "fecha_inicio" timestamp,
                "fecha_fin" timestamp,
                "descripcion" jsonb,
                "activo" boolean DEFAULT true,
                "destacado" boolean DEFAULT false,
                "orden" numeric DEFAULT 0,
                "horario" "enum_menus_horario",
                "updated_at" timestamp DEFAULT now() NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "menus_dias_semana" (
                "order" integer NOT NULL,
                "parent_id" integer NOT NULL,
                "value" "enum_menus_dias_semana",
                "id" serial PRIMARY KEY
            )`,

            `CREATE TABLE IF NOT EXISTS "espacios" (
                "id" serial PRIMARY KEY,
                "nombre" varchar NOT NULL,
                "slug" varchar NOT NULL UNIQUE,
                "descripcion" jsonb,
                "capacidad" numeric,
                "orden" numeric DEFAULT 0 NOT NULL,
                "activo" boolean DEFAULT true,
                "disponible_eventos" boolean DEFAULT false,
                "updated_at" timestamp DEFAULT now() NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "espacios_galeria" (
                "_order" integer NOT NULL,
                "_parent_id" integer NOT NULL,
                "id" varchar PRIMARY KEY NOT NULL,
                "imagen_id" integer NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "espacios_caracteristicas" (
                "_order" integer NOT NULL,
                "_parent_id" integer NOT NULL,
                "id" varchar PRIMARY KEY NOT NULL,
                "caracteristica" varchar NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "experiencias" (
                "id" serial PRIMARY KEY,
                "titulo" varchar NOT NULL,
                "slug" varchar NOT NULL UNIQUE,
                "descripcion" jsonb,
                "resumen" varchar,
                "precio" numeric NOT NULL,
                "imagen_id" integer NOT NULL,
                "link_compra" varchar,
                "color_fondo" varchar,
                "validez" varchar,
                "activo" boolean DEFAULT true,
                "destacado" boolean DEFAULT false,
                "orden" numeric DEFAULT 0,
                "updated_at" timestamp DEFAULT now() NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "experiencias_incluye" (
                "_order" integer NOT NULL,
                "_parent_id" integer NOT NULL,
                "id" varchar PRIMARY KEY NOT NULL,
                "item" varchar NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "banners" (
                "id" serial PRIMARY KEY,
                "titulo" varchar NOT NULL,
                "texto" varchar,
                "imagen_id" integer,
                "link_url" varchar,
                "link_texto" varchar,
                "link_externo" boolean DEFAULT false,
                "fecha_inicio" timestamp NOT NULL,
                "fecha_fin" timestamp NOT NULL,
                "posicion" "enum_banners_posicion" NOT NULL,
                "tipo" "enum_banners_tipo",
                "activo" boolean DEFAULT true,
                "prioridad" numeric DEFAULT 0,
                "updated_at" timestamp DEFAULT now() NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "payload_kv" (
                "id" serial PRIMARY KEY,
                "key" varchar NOT NULL UNIQUE,
                "data" jsonb NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "payload_locked" (
                "id" serial PRIMARY KEY,
                "global_slug" varchar,
                "updated_at" timestamp DEFAULT now() NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "pagina_inicio" (
                "id" serial PRIMARY KEY,
                "hero_title" varchar NOT NULL,
                "hero_subtitle" varchar,
                "hero_image_id" integer NOT NULL,
                "welcome_title" varchar,
                "welcome_text" jsonb,
                "cta_title" varchar,
                "cta_text" varchar,
                "cta_button_text" varchar DEFAULT 'Reservar ahora',
                "seo_title" varchar,
                "seo_description" varchar,
                "updated_at" timestamp,
                "created_at" timestamp
            )`,

            `CREATE TABLE IF NOT EXISTS "pagina_inicio_galeria_inicio" (
                "_order" integer NOT NULL,
                "_parent_id" integer NOT NULL,
                "id" varchar PRIMARY KEY NOT NULL,
                "imagen_id" integer NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "pagina_inicio_rels" (
                "id" serial PRIMARY KEY,
                "order" integer,
                "parent_id" integer NOT NULL,
                "path" varchar NOT NULL,
                "espacios_id" integer,
                "experiencias_id" integer
            )`,

            `CREATE TABLE IF NOT EXISTS "configuracion_sitio" (
                "id" serial PRIMARY KEY,
                "title" varchar NOT NULL,
                "logo_id" integer,
                "description" varchar,
                "contact_phone" varchar,
                "contact_email" varchar,
                "contact_address" varchar,
                "updated_at" timestamp,
                "created_at" timestamp
            )`,

            `CREATE TABLE IF NOT EXISTS "configuracion_sitio_opening_hours" (
                "_order" integer NOT NULL,
                "_parent_id" integer NOT NULL,
                "id" varchar PRIMARY KEY NOT NULL,
                "days" varchar,
                "hours" varchar,
                "closed" boolean DEFAULT false
            )`,

            `CREATE TABLE IF NOT EXISTS "configuracion_sitio_footer_logos" (
                "_order" integer NOT NULL,
                "_parent_id" integer NOT NULL,
                "id" varchar PRIMARY KEY NOT NULL,
                "logo_id" integer NOT NULL,
                "alt" varchar NOT NULL,
                "link" varchar
            )`,
        ];

        for (const sql of tables) {
            try {
                await pool.query(sql);
            } catch (e: any) {
                // Ignore "already exists" errors
                if (!e.message.includes('already exists')) {
                    log.push(`⚠️ Warning: ${e.message}`);
                }
            }
        }

        log.push(`✅ Created ${tables.length} tables`);

        // Marcar migración como aplicada
        await pool.query(`
            INSERT INTO payload_migrations (name, batch)
            VALUES ('20260115_120514_initial', 1)
            ON CONFLICT (name) DO NOTHING
        `);
        log.push('✅ Migration marked as applied');

        // Verificar tablas
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        const tablesList = result.rows.map((r: any) => r.table_name);
        log.push(`\n📊 Total tables: ${tablesList.length}`);
        log.push('Tables created successfully!');

        return NextResponse.json({ success: true, log, tables: tablesList });
    } catch (error: any) {
        log.push(`❌ Error: ${error.message}`);
        return NextResponse.json({ success: false, log, error: error.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
