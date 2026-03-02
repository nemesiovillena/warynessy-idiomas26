import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import next from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
import rateLimit from 'express-rate-limit'

import pg from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dev = process.env.NODE_ENV !== 'production'
const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = '0.0.0.0' // Importante para contenedores/Docker

/**
 * HOTFIX: Asegura que la columna experiencias_id existe en la tabla de bloqueo de documentos.
 * Payload 3 a veces falla al sincronizar relaciones de bloqueo en tablas existentes.
 */
async function runDatabaseHotfix() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.log('⚠️ No DATABASE_URL found, skipping DB hotfix')
    return
  }

  const pool = new pg.Pool({ connectionString })

  try {
    console.log('🔍 Running Robust Database Hotfix...')

    // ========================================
    // 1. Crear tabla menus_grupo si no existe
    // ========================================
    const menusGrupoExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'menus_grupo'
      );
    `)

    if (!menusGrupoExists.rows[0].exists) {
      console.log('➕ Creating menus_grupo table...')
      await pool.query(`
        CREATE TABLE "menus_grupo" (
          "id" serial PRIMARY KEY,
          "nombre" varchar NOT NULL,
          "descripcion" varchar,
          "imagen_portada_id" integer,
          "orden" numeric DEFAULT 0,
          "activo" boolean DEFAULT true,
          "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
          "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
      `)
      console.log('✅ menus_grupo table created.')

      // Crear índices
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_imagen_portada_idx" ON "menus_grupo" USING btree ("imagen_portada_id");`)
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_orden_idx" ON "menus_grupo" USING btree ("orden");`)
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_created_at_idx" ON "menus_grupo" USING btree ("created_at");`)
      console.log('✅ menus_grupo indexes created.')
    }

    // Crear tabla de relación menus_grupo_rels si no existe
    const menusGrupoRelsExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'menus_grupo_rels'
      );
    `)

    if (!menusGrupoRelsExists.rows[0].exists) {
      console.log('➕ Creating menus_grupo_rels table...')
      await pool.query(`
        CREATE TABLE "menus_grupo_rels" (
          "id" serial PRIMARY KEY,
          "order" integer,
          "parent_id" integer NOT NULL,
          "path" varchar NOT NULL,
          "menus_id" integer
        );
      `)

      // Crear índices
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_rels_order_idx" ON "menus_grupo_rels" USING btree ("order");`)
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_rels_parent_idx" ON "menus_grupo_rels" USING btree ("parent_id");`)
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_rels_path_idx" ON "menus_grupo_rels" USING btree ("path");`)
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_rels_menus_id_idx" ON "menus_grupo_rels" USING btree ("menus_id");`)
      console.log('✅ menus_grupo_rels table and indexes created.')
    }

    // ========================================
    // 2. Crear tabla paginas si no existe
    // ========================================
    const paginasExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'paginas'
      );
    `)

    if (!paginasExists.rows[0].exists) {
      console.log('➕ Creating paginas table...')
      await pool.query(`
        CREATE TABLE "paginas" (
          "id" serial PRIMARY KEY,
          "titulo_interno" varchar NOT NULL,
          "slug" varchar NOT NULL UNIQUE,
          "hero_image_id" integer,
          "hero_title" varchar,
          "hero_subtitle" varchar,
          "imagen_espacio1_id" integer,
          "imagen_espacio2_id" integer,
          "imagen_espacio3_id" integer,
          "imagen_espacio4_id" integer,
          "meta_title" varchar,
          "meta_description" varchar,
          "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
          "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
      `)
      console.log('✅ paginas table created.')

      // Crear índices
      await pool.query(`CREATE INDEX IF NOT EXISTS "paginas_slug_idx" ON "paginas" USING btree ("slug");`)
      await pool.query(`CREATE INDEX IF NOT EXISTS "paginas_hero_image_idx" ON "paginas" USING btree ("hero_image_id");`)
      await pool.query(`CREATE INDEX IF NOT EXISTS "paginas_created_at_idx" ON "paginas" USING btree ("created_at");`)
      console.log('✅ paginas indexes created.')
    }

    // ========================================
    // 3. Fix relation columns in other tables
    // ========================================

    // Lista de pares [nombre_columna, referencia_tabla]
    const relationsToFix = [
      ['experiencias_id', 'experiencias'],
      ['menus_grupo_id', 'menus_grupo'],
      ['paginas_id', 'paginas'],
    ]

    const tablesToCheck = [
      'payload_locked_documents_rels',
      'payload_locked_documents__rels',
      'pagina_inicio_rels',
    ]

    for (const tableName of tablesToCheck) {
      const tableExistsRes = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        );
      `, [tableName])

      if (tableExistsRes.rows[0].exists) {
        console.log(`📋 Checking table: ${tableName}`)

        for (const [colName, refTable] of relationsToFix) {
          const checkColumnQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 
            AND column_name = $2;
          `
          const res = await pool.query(checkColumnQuery, [tableName, colName])

          if (res.rowCount === 0) {
            console.log(`➕ Column "${colName}" missing in "${tableName}". Adding it...`)

            // Añadir la columna
            await pool.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${colName}" integer;`)

            // Intentar añadir la FK si la tabla de referencia existe
            try {
              const refTableExistsRes = await pool.query(`
                SELECT EXISTS (
                  SELECT FROM information_schema.tables 
                  WHERE table_name = $1
                );
              `, [refTable])

              if (refTableExistsRes.rows[0].exists) {
                await pool.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${tableName}_${colName}_fk";`)
                await pool.query(`
                  ALTER TABLE "${tableName}" 
                  ADD CONSTRAINT "${tableName}_${colName}_fk" 
                  FOREIGN KEY ("${colName}") REFERENCES "${refTable}"("id") ON DELETE SET NULL;
                `)
                console.log(`✅ FK added for ${colName} in ${tableName}.`)
              }
            } catch (fkError) {
              console.warn(`⚠️ Failed to add FK for ${colName} in ${tableName}:`, (fkError as Error).message)
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Robust Database Hotfix failed:', (error as Error).message)
  } finally {
    await pool.end()
  }
}

async function start() {
  try {
    await runDatabaseHotfix()
  } catch (dbError) {
    console.error('❌ Database hotfix failed:', dbError)
    // Continuar aunque el hotfix falle
  }

  const app = express()

  // Headers de seguridad para prevenir ataques comunes
  // Se omiten en rutas de Payload/Next.js para no interferir con el admin
  app.use((req, res, next) => {
    const isPayloadRoute = /^\/(admin|api|_next)(\/|$)/.test(req.path)

    if (!isPayloadRoute) {
      // Content Security Policy solo para rutas de Astro
      res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.googletagmanager.com *.google-analytics.com; " +
        "style-src 'self' 'unsafe-inline' *.googleapis.com *.cloudflare.com cdnjs.cloudflare.com; " +
        "img-src 'self' data: blob: *.googleapis.com *.gstatic.com *.b-cdn.net lh3.googleusercontent.com; " +
        "font-src 'self' *.googleapis.com *.gstatic.com *.cloudflare.com cdnjs.cloudflare.com; " +
        "connect-src 'self' *.google-analytics.com *.googletagmanager.com; " +
        "frame-ancestors 'none';"
      )
      res.setHeader('X-Frame-Options', 'DENY')
      res.setHeader('Permissions-Policy',
        'geolocation=(), ' +
        'microphone=(), ' +
        'camera=(), ' +
        'payment=(), ' +
        'usb=(), ' +
        'magnetometer=(), ' +
        'gyroscope=(), ' +
        'accelerometer=()'
      )
    }

    // Headers comunes a todas las rutas
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    if (!dev) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }
    res.removeHeader('X-Powered-By')

    next()
  })

  // Inicializar Next.js para Payload CMS
  const nextApp = next({ dev, dir: process.cwd() })
  console.log('📦 Initializing Next.js...')
  try {
    await nextApp.prepare()
    console.log('✅ Next.js initialized successfully')
  } catch (err) {
    console.error('❌ Critical error during Next.js app.prepare():', err)
    console.error('Error details:', err)
    process.exit(1)
  }
  const nextHandler = nextApp.getRequestHandler()

  // Rate limiting para endpoint de contacto (prevenir SPAM y DoS)
  const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // Máximo 5 requests por IP
    message: JSON.stringify({ error: 'Demasiados intentos. Por favor espera 15 minutos antes de intentar de nuevo.' }),
    standardHeaders: true, // Enviar headers estándar de rate limit
    legacyHeaders: false, // No enviar headers legacy
    skip: (req) => dev, // Desactivar en desarrollo
    handler: (req, res) => {
      res.status(429).json({
        error: 'Demasiados intentos. Por favor espera 15 minutos antes de intentar de nuevo.',
        retryAfter: '15 minutes'
      })
    }
  })

  // Endpoint de salud para Dokploy
  app.get('/health', (req, res) => {
    res.status(200).send('OK - Unified Server is up')
  })

  // Rutas de Payload/Next.js (admin, api, _next)
  // Excluir endpoints de Astro: /api/contact, /api/instagram, /api/reviews
  app.all(/^\/(admin|_next)($|\/.*)/, (req, res) => {
    return nextHandler(req, res)
  })

  // API de Payload (excluyendo endpoints de Astro)
  app.all(/^\/api\/(?!contact|instagram|reviews).*/, (req, res) => {
    return nextHandler(req, res)
  })

  // Aplicar rate limiting a endpoint de contacto
  app.use('/api/contact', contactLimiter)

  try {
    // Importar handler de Astro SSR dinámicamente
    const entryPath = path.join(__dirname, 'dist/server/entry.mjs')
    console.log(`📦 Loading Astro handler from: ${entryPath}`)
    const { handler: astroHandler } = await import(entryPath)

    // Resto de rutas → Astro SSR
    app.use((req, res, next) => {
      astroHandler(req, res, next)
    })
  } catch (astroError) {
    console.error('⚠️ Failed to load Astro handler. Web frontend might be unavailable:', (astroError as Error).message)
    app.use((req, res) => {
      res.status(503).send('Servicio temporalmente no disponible (Astro Error)')
    })
  }

  const server = createServer(app)
  server.listen(PORT, HOST, () => {
    console.log('')
    console.log(`🚀 Servidor unificado corriendo en ${HOST}:${PORT}!`)
    console.log(`📊 Payload Admin: http://localhost:${PORT}/admin`)
    console.log(`🔌 Payload API: http://localhost:${PORT}/api`)
    console.log(`🌐 Astro Frontend: http://localhost:${PORT}/`)
    console.log('')
  })
}

start().catch((error) => {
  console.error('❌ Error starting server:', error)
  process.exit(1)
})
