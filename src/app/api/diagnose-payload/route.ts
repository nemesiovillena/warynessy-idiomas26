import { NextResponse } from 'next/server'

/**
 * GET /api/diagnose-payload
 *
 * Diagnostic endpoint to check if Payload is initialized and accessible.
 * Returns configuration info and any initialization errors.
 */
export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL ? '***configured***' : 'NOT_CONFIGURED',
  }

  try {
    // Try to require payload locally
    const { getPayload } = await import('payload')
    diagnostics.payloadImport = 'SUCCESS'

    try {
      // Try to get payload instance
      const payload = await getPayload({ config: '/app/payload.config.ts' })
      diagnostics.payloadInstance = 'SUCCESS'
      diagnostics.collections = payload.collections?.map((c: any) => ({
        slug: c.slug,
        labels: c.labels,
      }))
      diagnostics.globals = payload.globals?.map((g: any) => ({
        slug: g.slug,
        label: g.label,
      }))
    } catch (payloadErr: any) {
      diagnostics.payloadInstance = 'ERROR'
      diagnostics.payloadError = payloadErr?.message
      diagnostics.payloadStack = payloadErr?.stack?.split('\n').slice(0, 5)
    }
  } catch (importErr: any) {
    diagnostics.payloadImport = 'ERROR'
    diagnostics.importError = importErr?.message
  }

  // Try to connect to database
  try {
    const { Pool } = await import('pg')
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 5000,
    })

    const result = await pool.query('SELECT 1 as connected')
    diagnostics.database = {
      status: 'CONNECTED',
      version: result.rows[0]?.connected ? 'OK' : 'UNKNOWN',
    }
    await pool.end()
  } catch (dbErr: any) {
    diagnostics.database = {
      status: 'ERROR',
      error: dbErr?.message,
    }
  }

  return NextResponse.json(diagnostics, { status: 200 })
}

export const runtime = 'nodejs'
