import { execSync } from 'child_process'
import { NextResponse } from 'next/server'

/**
 * GET /api/backup-db
 *
 * Generates a PostgreSQL database dump and returns it as a downloadable file.
 * Executes pg_dump from within the Docker container which has access to the database.
 *
 * Query parameters:
 * - format: 'sql' (default) or 'custom' (compressed binary format)
 *
 * Returns: SQL dump file or binary backup file
 */
export async function GET(request: Request) {
  try {
    // Check if DATABASE_URL is configured
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      return NextResponse.json(
        { error: 'DATABASE_URL not configured' },
        { status: 500 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'sql'

    // Generate timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename =
      format === 'custom'
        ? `warynessy-db-${timestamp}.dump`
        : `warynessy-db-${timestamp}.sql`

    // Build pg_dump command
    let command: string
    if (format === 'custom') {
      // Compressed binary format (faster, smaller)
      command = `pg_dump "${databaseUrl}" --format=custom --file=/tmp/${filename}`
    } else {
      // Plain SQL format (larger, human-readable)
      command = `pg_dump "${databaseUrl}"`
    }

    console.log(`[BACKUP-DB] Starting database backup (format: ${format})...`)

    // Execute pg_dump
    let output: Buffer | string
    try {
      if (format === 'custom') {
        // For custom format, execute and return the file
        execSync(command, { encoding: 'buffer', maxBuffer: 500 * 1024 * 1024 })
        // Read the dump file
        const fs = await import('fs/promises')
        output = await fs.readFile(`/tmp/${filename}`)
      } else {
        // For SQL format, get output directly
        output = execSync(command, {
          encoding: 'utf-8',
          maxBuffer: 500 * 1024 * 1024,
        })
      }
    } catch (execError: any) {
      console.error('[BACKUP-DB] pg_dump execution failed:', execError.message)
      return NextResponse.json(
        {
          error: 'Database backup failed',
          details: execError.stderr?.toString() || execError.message,
        },
        { status: 500 }
      )
    }

    console.log(
      `[BACKUP-DB] Backup completed successfully. Size: ${
        typeof output === 'string' ? output.length : output.length
      } bytes`
    )

    // Return as downloadable file
    const contentType =
      format === 'custom' ? 'application/octet-stream' : 'text/plain'

    return new NextResponse(output, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Backup-Timestamp': timestamp,
        'X-Backup-Format': format,
      },
    })
  } catch (error: any) {
    console.error('[BACKUP-DB] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Unexpected error during backup',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
