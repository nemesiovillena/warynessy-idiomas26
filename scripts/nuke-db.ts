import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * ⚠️⚠️⚠️ ADVERTENCIA CRÍTICA - ARCHIVO DEPRECATED ⚠️⚠️⚠️
 * 
 * ⛑ ESTE SCRIPT HA SIDO RENOMBRADO POR SEGURIDAD
 * 
 * Archivo nuevo seguro: nuke-db-dev-only.ts
 * 
 * RAZÓN: Este script puede borrar TODA la base de datos accidentalmente
 * 
 * ⚠️ NO USAR ESTE ARCHIVO - ESTÁ OBSOLETO POR SEGURIDAD
 * 
 * Si necesitas resetear la base de datos:
 * 1. Usa: tsx scripts/nuke-db-dev-only.ts (más seguro)
 * 2. O usa migraciones controladas en src/migrations/
 * 3. O ejecuta: npm run seed (si existe script de seed)
 * 
 * 🚨 Si ejecutas este script, perderás TODOS los datos
 * 
 * Este archivo se mantiene solo para documentación histórica
 */

async function checkEnvironment(): Promise<boolean> {
    const env = process.env.NODE_ENV || 'development';

    if (env === 'production' || env === 'prod') {
        console.error('❌❌❌ ERROR CRÍTICO ❌❌❌');
        console.error('❌ Este archivo está DEPRECATED y no debe usarse');
        console.error('❌ Usa en su lugar: tsx scripts/nuke-db-dev-only.ts');
        console.error('');
        console.error('🛑 Acción requerida:');
        console.error('   - Presiona Ctrl+C inmediatamente');
        console.error('   - Usa el script seguro: nuke-db-dev-only.ts');
        console.error('');
        return false;
    }

    console.error('');
    console.error('⚠️⚠️⚠️ ADVERTENCIA ⚠️⚠️⚠️');
    console.error('');
    console.error('Este archivo está OBSOLETO');
    console.error('Archivo nuevo seguro: scripts/nuke-db-dev-only.ts');
    console.error('');
    console.error('Si estás seguro de que quieres continuar, usa:');
    console.error('  tsx scripts/nuke-db-dev-only.ts');
    console.error('');
    return false;
}

async function nuke() {
    console.log('🔍 Verificando script...');

    // Bloquear ejecución del script deprecated
    if (!await checkEnvironment()) {
        process.exit(1);
    }

    // Nunca debería llegar aquí
    console.error('❌ Este script no debe ejecutarse');
    console.error('❌ Usa: tsx scripts/nuke-db-dev-only.ts');
    process.exit(1);
}

// Ejecutar script
console.log('='.repeat(60));
console.log('⚠️  SCRIPT DEPRECATED - NO USAR ⚠️');
console.log('Archivo nuevo seguro: scripts/nuke-db-dev-only.ts');
console.log('='.repeat(60));
console.log('');

nuke();