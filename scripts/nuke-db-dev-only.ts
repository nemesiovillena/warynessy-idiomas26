import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * ⚠️⚠️⚠️ ADVERTENCIA CRÍTICA ⚠️⚠️⚠️
 * 
 * ESTE SCRIPT BORRA COMPLETAMENTE LA BASE DE DATOS
 * 
 * Operaciones que ejecuta:
 * - DROP SCHEMA public CASCADE
 * - CREATE SCHEMA public
 * 
 * RESULTADO: PERDERÁS TODOS LOS DATOS
 * 
 * Restricciones de seguridad:
 * - Solo se permite ejecutar en entorno de desarrollo
 * - Requiere confirmación explícita
 * - Detiene ejecución si NODE_ENV=production
 * 
 * Si necesitas hacer esto en producción, primero:
 * 1. Hacer backup completo de la base de datos
 * 2. Confirmar con tu equipo técnico
 * 3. Usar scripts de migración controlados en lugar de nuke
 */

async function checkEnvironment(): Promise<boolean> {
    const env = process.env.NODE_ENV || 'development';

    if (env === 'production' || env === 'prod') {
        console.error('❌❌❌ ERROR CRÍTICO ❌❌❌');
        console.error('❌ DETENIDO: Intento de borrar base de datos en PRODUCCIÓN');
        console.error('❌ Esta operación NO está permitida en producción');
        console.error('❌ Datos que se perderían: TODOS los registros de la base de datos');
        console.error('');
        console.error('🛑 Acción requerida:');
        console.error('   - Si esto es un error: Presiona Ctrl+C inmediatamente');
        console.error('   - Si necesitas resetear producción: Contacta al equipo técnico primero');
        console.error('   - Script de migración controlado: Usar migraciones en src/migrations/');
        console.error('');
        return false;
    }

    console.log('✅ Entorno verificado:', env);
    console.log('⚠️  Este script solo está permitido en desarrollo');
    return true;
}

async function requestConfirmation(): Promise<boolean> {
    console.log('');
    console.log('🔥🔥🔥 ADVERTENCIA DE SEGURIDAD 🔥🔥🔥');
    console.log('');
    console.log('Estás a punto de ejecutar: DROP SCHEMA public CASCADE');
    console.log('Esto borrará TODOS los datos de la base de datos.');
    console.log('');
    console.log('Colecciones que se eliminarán:');
    console.log('   - usuarios');
    console.log('   - archivos');
    console.log('   - alergenos');
    console.log('   - categorias');
    console.log('   - platos');
    console.log('   - menus');
    console.log('   - espacios');
    console.log('   - banners');
    console.log('   - paginas');
    console.log('   - experiencias');
    console.log('   - menus-grupo');
    console.log('   - backup-deltas');
    console.log('   - backup-snapshots');
    console.log('');
    console.log('🤔 ¿Estás absolutamente seguro de que quieres continuar?');
    console.log('');

    // Forzar confirmación manual en producción
    const env = process.env.NODE_ENV || 'development';
    if (env !== 'development') {
        console.log('❌ Confirmación manual requerida:');
        console.log('   Escribe "YES-I-UNDERSTAND-AND-ACCEPT-DATA-LOSS" para continuar:');
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer: string = await new Promise((resolve) => {
            rl.question('> ', (response: string) => resolve(response));
        });
        rl.close();

        const requiredPhrase = 'YES-I-UNDERSTAND-AND-ACCEPT-DATA-LOSS';
        if (answer.trim() !== requiredPhrase) {
            console.log('');
            console.log('✅ Operación CANCELADA por el usuario');
            return false;
        }
    } else {
        // En desarrollo, confirmación simple
        console.log('📝 Escribe "YES" para confirmar:');
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer: string = await new Promise((resolve) => {
            rl.question('> ', (response: string) => resolve(response));
        });
        rl.close();

        if (answer.trim().toUpperCase() !== 'YES') {
            console.log('');
            console.log('✅ Operación CANCELADA por el usuario');
            return false;
        }
    }

    return true;
}

async function nuke() {
    console.log('🔍 Conectando a base de datos...');
    const client = await pool.connect();

    try {
        // Verificar entorno
        if (!await checkEnvironment()) {
            process.exit(1);
        }

        // Solicitar confirmación
        if (!await requestConfirmation()) {
            process.exit(0);
        }

        console.log('');
        console.log('⚠️  Iniciando reset de base de datos...');
        console.log('⏰ Hora:', new Date().toISOString());
        console.log('');

        // Ejecutar DROP SCHEMA CASCADE
        console.log('🗑️  Eliminando esquema público...');
        await client.query('DROP SCHEMA public CASCADE');

        // Crear nuevo esquema
        console.log('🆕 Creando nuevo esquema público...');
        await client.query('CREATE SCHEMA public');

        console.log('');
        console.log('✅ Base de datos reseteada exitosamente');
        console.log('');
        console.log('⚠️  Próximos pasos:');
        console.log('   1. Ejecuta: npm run payload migrate');
        console.log('   2. Ejecuta: npm run seed (si existe script de seed)');
        console.log('   3. Verifica: npm run generate:types');
        console.log('');

    } catch (err) {
        console.error('');
        console.error('❌❌❌ ERROR RESETEANDO BASE DE DATOS ❌❌❌');
        console.error('Detalle del error:', err);
        console.error('');
        console.error('🚨 Acciones recomendadas:');
        console.error('   1. Verifica que la base de datos no esté en uso');
        console.error('   2. Cierra conexiones activas a la base de datos');
        console.error('   3. Verifica permisos de usuario en PostgreSQL');
        console.error('   4. Revisa los logs de PostgreSQL');
        console.error('');
        process.exit(1);
    } finally {
        client.release();
        pool.end();
        console.log('🔌 Conexión cerrada');
    }
}

// Ejecutar script
console.log('='.repeat(60));
console.log('Script: NUKE-DB-DEV-ONLY');
console.log('Propósito: Reset completo de base de datos en desarrollo');
console.log('Fecha:', new Date().toISOString());
console.log('='.repeat(60));
console.log('');

nuke();