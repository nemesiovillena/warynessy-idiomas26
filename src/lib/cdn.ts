/**
* Bunny.net CDN Helper
* Transforma URLs de Payload a URLs optimizadas de Bunny.net
*/

// Helper para obtener variables de entorno de forma segura tanto en build-time como runtime
function getEnv(key: string, defaultValue: string = ''): string {
    if (typeof process !== 'undefined' && process.env[key]) return process.env[key] as string;
    if (import.meta.env[key]) return import.meta.env[key] as string;
    return defaultValue;
}

interface CDNOptions {
    width?: number;
    height?: number;
    quality?: number;
    crop?: 'fill' | 'fit' | 'cover';
}

/**
 * Transforma una URL de imagen para usar el CDN si está configurado
 */
export function getOptimizedImageUrl(src: string, options: CDNOptions = {}): string {
    if (!src) return '/images/placeholder.jpg';

    let BUNNY_URL = getEnv('PUBLIC_BUNNY_CDN_URL').replace(/\/$/, "");
    // Asegurar que tiene protocolo https://
    if (BUNNY_URL && !BUNNY_URL.startsWith('http')) {
        BUNNY_URL = `https://${BUNNY_URL}`;
    }
    const PAYLOAD_URL = (getEnv('PAYLOAD_PUBLIC_SERVER_URL') || getEnv('PUBLIC_PAYLOAD_API_URL', 'http://localhost:3000').replace('/api', '')).replace(/\/$/, "");

    // Normalizar src si viene como path relativo
    let path = src;

    // Si viene de localhost o de la URL del servidor configurada
    if (path.includes('localhost:3000') || (PAYLOAD_URL && path.includes(PAYLOAD_URL))) {
        path = path.split('localhost:3000').pop() as string;
        path = path.split(PAYLOAD_URL).pop() as string;
    }

    // Limpiar paths de la API de Payload si existen
    if (path.includes('/api/archivos/file/')) {
        path = '/' + path.split('/api/archivos/file/')[1];
    }

    // Si sigue siendo una URL absoluta externa (S3, etc), no hacemos nada
    if (path.startsWith('http')) {
        return path;
    }

    // Asegurarnos de que el path empieza por /
    if (!path.startsWith('/')) path = '/' + path;

    // Log para depurar
    console.log('[CDN Debug]', {
        NODE_ENV: process.env.NODE_ENV,
        BUNNY_URL,
        PAYLOAD_URL,
        path: path.substring(0, 50),
        willUseCDN: !!BUNNY_URL
    });

    if (!BUNNY_URL) {
        return `${PAYLOAD_URL}${path}`;
    }

    // Construir URL de Bunny.net
    const searchParams = new URLSearchParams();
    if (options.width) searchParams.append('w', options.width.toString());
    if (options.height) searchParams.append('h', options.height.toString());
    if (options.quality) searchParams.append('q', options.quality.toString());

    const queryString = searchParams.toString();
    const separator = path.includes('?') ? '&' : '?';

    return `${BUNNY_URL}${path}${queryString ? separator + queryString : ''}`;
}
