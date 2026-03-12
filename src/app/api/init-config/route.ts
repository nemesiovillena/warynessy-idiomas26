import { getPayload } from 'payload'
import config from '../../../../payload.config'
import { NextResponse } from 'next/server'
import pg from 'pg'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

/**
 * Endpoint para ejecutar migraciones y arreglar schema en producción.
 * Crea enums y columnas faltantes (proveedor_i_a, modelo_i_a) si no existen.
 * Uso: GET /api/init-config?secret=<PAYLOAD_SECRET>
 * Diagnóstico: GET /api/init-config?secret=<PAYLOAD_SECRET>&action=diagnose
 * Ejecutar migraciones Drizzle: GET /api/init-config?secret=<PAYLOAD_SECRET>&action=migrate-all
 * Aplicar migraciones manuales: GET /api/init-config?secret=<PAYLOAD_SECRET>&action=migrate
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret')
    const action = searchParams.get('action')

    if (secret !== process.env.PAYLOAD_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Action: diagnose — reads DB state without modifying anything
    if (action === 'diagnose') {
        const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
        try {
            const [migrations, tables, menuGrupoColumns, platosColumns] = await Promise.all([
                pool.query(`SELECT name, batch FROM payload_migrations ORDER BY created_at`),
                pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`),
                pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'menus_grupo' ORDER BY ordinal_position`),
                pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'platos' AND column_name = 'precio'`),
            ])
            return NextResponse.json({
                migrations: migrations.rows,
                tables: tables.rows.map((r: any) => r.table_name),
                menuGrupoColumns: menuGrupoColumns.rows,
                platosPrecion: platosColumns.rows,
            })
        } catch (e: any) {
            return NextResponse.json({ error: e.message }, { status: 500 })
        } finally {
            await pool.end()
        }
    }

    // Action: migrate-all — executes full Drizzle migrations to create all tables
    if (action === 'migrate-all') {
        const log: string[] = []
        try {
            log.push('Executing Drizzle migrations...')
            const output = execSync(
                `DATABASE_URL="${process.env.DATABASE_URL}" npx drizzle-kit migrate`,
                {
                    encoding: 'utf-8',
                    stdio: 'pipe',
                    cwd: process.cwd(),
                }
            )
            log.push(output)
            log.push('✅ Drizzle migrations completed successfully')
            return NextResponse.json({ success: true, log })
        } catch (error: any) {
            log.push(`❌ Error: ${error.message}`)
            log.push(error.stderr?.toString() || error.stdout?.toString() || '')
            return NextResponse.json({ success: false, log, error: error.message }, { status: 500 })
        }
    }

    // Action: migrate — applies pending Payload migrations using raw SQL
    if (action === 'migrate') {
        const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
        const log: string[] = []
        try {
            // Check current migrations
            const applied = await pool.query(`SELECT name FROM payload_migrations`)
            const appliedNames = applied.rows.map((r: any) => r.name)
            log.push(`Applied migrations: ${appliedNames.join(', ')}`)

            // Migration 20260218_192308: ALTER platos.precio to varchar
            if (!appliedNames.includes('20260218_192308')) {
                await pool.query(`ALTER TABLE "platos" ALTER COLUMN "precio" SET DATA TYPE varchar`)
                await pool.query(`INSERT INTO payload_migrations (name, batch) VALUES ('20260218_192308', 2)`)
                log.push('Applied: 20260218_192308 (platos.precio -> varchar)')
            } else {
                log.push('Skip: 20260218_192308 (already applied)')
            }

            // Migration 20260309_add_menus_grupo_contrasena: ADD COLUMN contrasena
            if (!appliedNames.includes('20260309_add_menus_grupo_contrasena')) {
                await pool.query(`ALTER TABLE "menus_grupo" ADD COLUMN IF NOT EXISTS "contrasena" varchar`)
                await pool.query(`INSERT INTO payload_migrations (name, batch) VALUES ('20260309_add_menus_grupo_contrasena', 3)`)
                log.push('Applied: 20260309_add_menus_grupo_contrasena (menus_grupo.contrasena)')
            } else {
                log.push('Skip: 20260309_add_menus_grupo_contrasena (already applied)')
            }

            return NextResponse.json({ success: true, log })
        } catch (e: any) {
            log.push(`Error: ${e.message}`)
            return NextResponse.json({ success: false, log, error: e.message }, { status: 500 })
        } finally {
            await pool.end()
        }
    }

    const dbLog: string[] = []
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

    try {
        // 1. Crear enums si no existen
        await pool.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."enum_configuracion_traduccion_proveedor_i_a"
                    AS ENUM('agente-python');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        dbLog.push('Enum proveedor_i_a: ok')

        await pool.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."enum_configuracion_traduccion_modelo_i_a"
                    AS ENUM('anthropic/claude-3-5-haiku', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o-mini', 'google/gemini-2.0-flash-001');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        dbLog.push('Enum modelo_i_a: ok')

        // 2. Añadir columna proveedor_i_a si no existe
        await pool.query(`
            ALTER TABLE "configuracion_traduccion"
            ADD COLUMN IF NOT EXISTS "proveedor_i_a" "enum_configuracion_traduccion_proveedor_i_a" DEFAULT 'agente-python';
        `)
        dbLog.push('Column proveedor_i_a: ok')

        // 3. Añadir columna modelo_i_a si no existe
        await pool.query(`
            ALTER TABLE "configuracion_traduccion"
            ADD COLUMN IF NOT EXISTS "modelo_i_a" "enum_configuracion_traduccion_modelo_i_a" DEFAULT 'anthropic/claude-3-5-haiku';
        `)
        dbLog.push('Column modelo_i_a: ok')

        // 4. Asegurar que hay un registro con los valores correctos
        const countRes = await pool.query(`SELECT COUNT(*) FROM "configuracion_traduccion";`)
        const count = parseInt(countRes.rows[0].count)
        dbLog.push(`Row count: ${count}`)

        if (count === 0) {
            await pool.query(`
                INSERT INTO "configuracion_traduccion" ("proveedor_i_a", "modelo_i_a", "endpoint_agente")
                VALUES ('agente-python', 'anthropic/claude-3-5-haiku', 'http://localhost:8000/translate');
            `)
            dbLog.push('Default row inserted.')
        } else {
            await pool.query(`
                UPDATE "configuracion_traduccion"
                SET "proveedor_i_a" = 'agente-python', "modelo_i_a" = 'anthropic/claude-3-5-haiku', "updated_at" = now()
                WHERE id = (SELECT id FROM "configuracion_traduccion" ORDER BY id LIMIT 1);
            `)
            dbLog.push('Row updated to agente-python.')
        }

        // 5. Verificar resultado final
        const finalRow = await pool.query(`SELECT * FROM "configuracion_traduccion" ORDER BY id LIMIT 1;`)
        dbLog.push(`Final row: ${JSON.stringify(finalRow.rows[0])}`)

    } catch (e: any) {
        dbLog.push(`DB error: ${e.message}`)
    } finally {
        await pool.end()
    }

    // Paso 2: Verificar via Payload
    let payloadRead: any = null
    let payloadError: string | null = null
    try {
        const payload = await getPayload({ config })
        payloadRead = await payload.findGlobal({ slug: 'configuracion-traduccion' as any })
    } catch (e: any) {
        payloadError = e.message
    }

    return NextResponse.json({ dbLog, payloadRead, payloadError })
}
