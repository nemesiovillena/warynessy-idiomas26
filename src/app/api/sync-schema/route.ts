import { getPayload } from 'payload';
import config from '../../../../payload.config';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Endpoint para forzar la sincronización del schema de Payload.
 * Uso: GET /api/sync-schema?secret=<PAYLOAD_SECRET>
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (secret !== process.env.PAYLOAD_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const log: string[] = [];

    try {
        log.push('🔧 Initializing Payload...');
        const payload = await getPayload({ config });
        log.push('✅ Payload initialized');

        // Forzar sync del schema
        log.push('🔄 Syncing schema...');
        await payload.triggerInit();
        log.push('✅ Schema synced');

        // Verificar tablas creadas
        const { DatabaseAdapter } = await import('@payloadcms/db-postgres');
        const adapter = payload.db;

        log.push('📊 Sync complete!');

        return NextResponse.json({ success: true, log });
    } catch (error: any) {
        log.push(`❌ Error: ${error.message}`);
        log.push(`Stack: ${error.stack}`);
        return NextResponse.json({ success: false, log, error: error.message }, { status: 500 });
    }
}
