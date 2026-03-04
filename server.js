import "dotenv/config";
import express from "express";
import { createServer } from "http";
import next from "next";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import pg from "pg";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dev = process.env.NODE_ENV !== "production";
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = "0.0.0.0";
async function runDatabaseHotfix() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("\u26A0\uFE0F No DATABASE_URL found, skipping DB hotfix");
    return;
  }
  const pool = new pg.Pool({ connectionString });
  try {
    console.log("\u{1F50D} Running Robust Database Hotfix...");
    const menusGrupoExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'menus_grupo'
      );
    `);
    if (!menusGrupoExists.rows[0].exists) {
      console.log("\u2795 Creating menus_grupo table...");
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
      `);
      console.log("\u2705 menus_grupo table created.");
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_imagen_portada_idx" ON "menus_grupo" USING btree ("imagen_portada_id");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_orden_idx" ON "menus_grupo" USING btree ("orden");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_created_at_idx" ON "menus_grupo" USING btree ("created_at");`);
      console.log("\u2705 menus_grupo indexes created.");
    }
    const menusGrupoRelsExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'menus_grupo_rels'
      );
    `);
    if (!menusGrupoRelsExists.rows[0].exists) {
      console.log("\u2795 Creating menus_grupo_rels table...");
      await pool.query(`
        CREATE TABLE "menus_grupo_rels" (
          "id" serial PRIMARY KEY,
          "order" integer,
          "parent_id" integer NOT NULL,
          "path" varchar NOT NULL,
          "menus_id" integer
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_rels_order_idx" ON "menus_grupo_rels" USING btree ("order");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_rels_parent_idx" ON "menus_grupo_rels" USING btree ("parent_id");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_rels_path_idx" ON "menus_grupo_rels" USING btree ("path");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "menus_grupo_rels_menus_id_idx" ON "menus_grupo_rels" USING btree ("menus_id");`);
      console.log("\u2705 menus_grupo_rels table and indexes created.");
    }
    const paginasExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'paginas'
      );
    `);
    if (!paginasExists.rows[0].exists) {
      console.log("\u2795 Creating paginas table...");
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
          "historia_mision" varchar,
          "meta_title" varchar,
          "meta_description" varchar,
          "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
          "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
      `);
      console.log("\u2705 paginas table created.");
      await pool.query(`CREATE INDEX IF NOT EXISTS "paginas_slug_idx" ON "paginas" USING btree ("slug");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "paginas_hero_image_idx" ON "paginas" USING btree ("hero_image_id");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "paginas_created_at_idx" ON "paginas" USING btree ("created_at");`);
      console.log("\u2705 paginas indexes created.");
    } else {
      await pool.query(`ALTER TABLE "paginas" ADD COLUMN IF NOT EXISTS "historia_mision" varchar;`);
    }
    const paginasHitosExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'paginas_historia_hitos');
    `);
    if (!paginasHitosExists.rows[0].exists) {
      console.log("\u2795 Creating paginas_historia_hitos table...");
      await pool.query(`
        CREATE TABLE "paginas_historia_hitos" (
          "id" serial PRIMARY KEY,
          "_order" integer NOT NULL,
          "_parent_id" integer NOT NULL,
          "titulo" varchar NOT NULL,
          "descripcion" varchar NOT NULL,
          "imagen_id" integer,
          CONSTRAINT "paginas_historia_hitos_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "paginas"("id") ON DELETE CASCADE
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS "paginas_historia_hitos_order_idx" ON "paginas_historia_hitos" USING btree ("_order");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "paginas_historia_hitos_parent_id_idx" ON "paginas_historia_hitos" USING btree ("_parent_id");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "paginas_historia_hitos_imagen_idx" ON "paginas_historia_hitos" USING btree ("imagen_id");`);
      console.log("\u2705 paginas_historia_hitos table created.");
    }
    const backupDeltasExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'backup_deltas');
    `);
    if (!backupDeltasExists.rows[0].exists) {
      console.log("\u2795 Creating backup_deltas table...");
      await pool.query(`
        CREATE TABLE "backup_deltas" (
          "id" serial PRIMARY KEY,
          "collection_slug" varchar NOT NULL,
          "resource_type" varchar NOT NULL DEFAULT 'collection',
          "document_id" varchar,
          "operation" varchar NOT NULL,
          "previous_data" jsonb,
          "current_data" jsonb,
          "changed_fields" jsonb,
          "author_id" varchar,
          "author_email" varchar,
          "captured_at" timestamp(3) with time zone NOT NULL,
          "snapshot_id" varchar,
          "content_hash" varchar
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS "backup_deltas_collection_slug_idx" ON "backup_deltas" USING btree ("collection_slug");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "backup_deltas_document_id_idx" ON "backup_deltas" USING btree ("document_id");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "backup_deltas_operation_idx" ON "backup_deltas" USING btree ("operation");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "backup_deltas_captured_at_idx" ON "backup_deltas" USING btree ("captured_at");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "backup_deltas_snapshot_id_idx" ON "backup_deltas" USING btree ("snapshot_id");`);
      console.log("\u2705 backup_deltas table created.");
    }
    const backupSnapshotsExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'backup_snapshots');
    `);
    if (!backupSnapshotsExists.rows[0].exists) {
      console.log("\u2795 Creating backup_snapshots table...");
      await pool.query(`
        CREATE TABLE "backup_snapshots" (
          "id" serial PRIMARY KEY,
          "label" varchar NOT NULL,
          "type" varchar NOT NULL,
          "status" varchar NOT NULL DEFAULT 'pending',
          "delta_count" numeric DEFAULT 0,
          "collections" jsonb,
          "stats" jsonb,
          "size_bytes" numeric,
          "data" jsonb,
          "storage_type" varchar NOT NULL DEFAULT 'database',
          "storage_path" varchar,
          "storage_url" varchar,
          "content_hash" varchar,
          "period_start" timestamp(3) with time zone,
          "period_end" timestamp(3) with time zone,
          "triggered_by" varchar DEFAULT 'system',
          "triggered_by_email" varchar,
          "error_message" varchar,
          "retention_policy" varchar DEFAULT 'normal',
          "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
          "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS "backup_snapshots_type_idx" ON "backup_snapshots" USING btree ("type");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "backup_snapshots_status_idx" ON "backup_snapshots" USING btree ("status");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "backup_snapshots_created_at_idx" ON "backup_snapshots" USING btree ("created_at");`);
      console.log("\u2705 backup_snapshots table created.");
    }
    const relationsToFix = [
      ["experiencias_id", "experiencias"],
      ["menus_grupo_id", "menus_grupo"],
      ["paginas_id", "paginas"],
      ["backup_deltas_id", "backup_deltas"],
      ["backup_snapshots_id", "backup_snapshots"]
    ];
    const tablesToCheck = [
      "payload_locked_documents_rels",
      "payload_locked_documents__rels",
      "pagina_inicio_rels"
    ];
    for (const tableName of tablesToCheck) {
      const tableExistsRes = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        );
      `, [tableName]);
      if (tableExistsRes.rows[0].exists) {
        console.log(`\u{1F4CB} Checking table: ${tableName}`);
        for (const [colName, refTable] of relationsToFix) {
          const checkColumnQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 
            AND column_name = $2;
          `;
          const res = await pool.query(checkColumnQuery, [tableName, colName]);
          if (res.rowCount === 0) {
            console.log(`\u2795 Column "${colName}" missing in "${tableName}". Adding it...`);
            await pool.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${colName}" integer;`);
            try {
              const refTableExistsRes = await pool.query(`
                SELECT EXISTS (
                  SELECT FROM information_schema.tables 
                  WHERE table_name = $1
                );
              `, [refTable]);
              if (refTableExistsRes.rows[0].exists) {
                await pool.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${tableName}_${colName}_fk";`);
                await pool.query(`
                  ALTER TABLE "${tableName}" 
                  ADD CONSTRAINT "${tableName}_${colName}_fk" 
                  FOREIGN KEY ("${colName}") REFERENCES "${refTable}"("id") ON DELETE SET NULL;
                `);
                console.log(`\u2705 FK added for ${colName} in ${tableName}.`);
              }
            } catch (fkError) {
              console.warn(`\u26A0\uFE0F Failed to add FK for ${colName} in ${tableName}:`, fkError.message);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("\u274C Robust Database Hotfix failed:", error.message);
  } finally {
    await pool.end();
  }
}
async function start() {
  try {
    await runDatabaseHotfix();
  } catch (dbError) {
    console.error("\u274C Database hotfix failed:", dbError);
  }
  const app = express();
  app.use((req, res, next2) => {
    const isPayloadRoute = /^\/(admin|api|_next)(\/|$)/.test(req.path);
    if (!isPayloadRoute) {
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' *.googletagmanager.com *.google-analytics.com *.covermanager.com; style-src 'self' 'unsafe-inline' *.googleapis.com *.cloudflare.com cdnjs.cloudflare.com *.covermanager.com; img-src 'self' data: blob: *.googleapis.com *.gstatic.com *.b-cdn.net lh3.googleusercontent.com *.cdninstagram.com *.fbcdn.net *.instagram.com *.covermanager.com; font-src 'self' *.googleapis.com *.gstatic.com *.cloudflare.com cdnjs.cloudflare.com; connect-src 'self' *.google-analytics.com *.googletagmanager.com graph.instagram.com *.instagram.com *.covermanager.com; frame-src *.covermanager.com; frame-ancestors 'none';"
      );
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader(
        "Permissions-Policy",
        "geolocation=(), microphone=(), camera=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
      );
    }
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (!dev) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    res.removeHeader("X-Powered-By");
    next2();
  });
  const nextApp = next({ dev, dir: process.cwd() });
  console.log("\u{1F4E6} Initializing Next.js...");
  try {
    await nextApp.prepare();
    console.log("\u2705 Next.js initialized successfully");
  } catch (err) {
    console.error("\u274C Critical error during Next.js app.prepare():", err);
    console.error("Error details:", err);
    process.exit(1);
  }
  const nextHandler = nextApp.getRequestHandler();
  app.use((req, res, next2) => {
    if (/^\/(admin|api|_next)(\/|$)/.test(req.path)) return next2();
    express.static(path.join(__dirname, "dist/client"), { index: false })(req, res, next2);
  });
  const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutos
    max: 5,
    // Máximo 5 requests por IP
    message: JSON.stringify({ error: "Demasiados intentos. Por favor espera 15 minutos antes de intentar de nuevo." }),
    standardHeaders: true,
    // Enviar headers estándar de rate limit
    legacyHeaders: false,
    // No enviar headers legacy
    skip: (req) => dev,
    // Desactivar en desarrollo
    handler: (req, res) => {
      res.status(429).json({
        error: "Demasiados intentos. Por favor espera 15 minutos antes de intentar de nuevo.",
        retryAfter: "15 minutes"
      });
    }
  });
  app.get("/health", (req, res) => {
    res.status(200).send("OK - Unified Server is up");
  });
  app.all(/^\/(admin|_next)($|\/.*)/, (req, res) => {
    return nextHandler(req, res);
  });
  app.all(/^\/api\/(?!contact|instagram|reviews).*/, (req, res) => {
    return nextHandler(req, res);
  });
  app.use("/api/contact", contactLimiter);
  try {
    const entryPath = path.join(__dirname, "dist/server/entry.mjs");
    console.log(`\u{1F4E6} Loading Astro handler from: ${entryPath}`);
    const { handler: astroHandler } = await import(entryPath);
    app.use((req, res, next2) => {
      astroHandler(req, res, next2);
    });
  } catch (astroError) {
    console.error("\u26A0\uFE0F Failed to load Astro handler. Web frontend might be unavailable:", astroError.message);
    app.use((req, res) => {
      res.status(503).send("Servicio temporalmente no disponible (Astro Error)");
    });
  }
  const server = createServer(app);
  server.listen(PORT, HOST, () => {
    console.log("");
    console.log(`\u{1F680} Servidor unificado corriendo en ${HOST}:${PORT}!`);
    console.log(`\u{1F4CA} Payload Admin: http://localhost:${PORT}/admin`);
    console.log(`\u{1F50C} Payload API: http://localhost:${PORT}/api`);
    console.log(`\u{1F310} Astro Frontend: http://localhost:${PORT}/`);
    console.log("");
  });
}
start().catch((error) => {
  console.error("\u274C Error starting server:", error);
  process.exit(1);
});
