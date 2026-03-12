import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

/**
 * Ejecuta las migraciones de Payload directamente usando drizzle-kit
 * Uso: POST /api/run-migrations?secret=<PAYLOAD_SECRET>
 *
 * Respuesta:
 * {
 *   "success": true|false,
 *   "output": "stdout/stderr output",
 *   "error": "error message if failed"
 * }
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')

  if (secret !== process.env.PAYLOAD_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🚀 Iniciando migraciones...')

    // Ejecutar drizzle migrate (más directo que payload migrate)
    const output = execSync(
      'DATABASE_URL="' + process.env.DATABASE_URL + '" npx drizzle-kit migrate',
      {
        encoding: 'utf-8',
        stdio: 'pipe',
        cwd: process.cwd(),
      }
    )

    console.log('✅ Migraciones completadas')
    return NextResponse.json({
      success: true,
      output: output,
    })
  } catch (error: any) {
    console.error('❌ Error en migraciones:', error.message)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        output: error.stderr?.toString() || error.stdout?.toString() || '',
      },
      { status: 500 }
    )
  }
}
