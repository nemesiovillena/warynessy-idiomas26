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

    const isDevelopment = getEnv('NODE_ENV') === 'development';
    const isLocalPath = src.includes('localhost') || src.includes('127.0.0.1') || (!src.startsWith('http') && isDevelopment);

    // Si estamos en desarrollo y es una ruta local, no forzamos el CDN
    // a menos que no haya otra opción.
    const shouldIgnoreCDN = isDevelopment && isLocalPath;

    // Normalizar src si viene como path relativo
    let path = src;

    // Si el path ya es una URL optimizada de Bunny, no hacer nada
    if (BUNNY_URL && path.includes(BUNNY_URL)) {
        return path;
    }

    // Si viene de localhost o de la URL del servidor configurada
    if (path.includes('localhost:3000') || (PAYLOAD_URL && path.includes(PAYLOAD_URL))) {
        // No strippear si vamos a devolver la URL local
        if (!shouldIgnoreCDN || !BUNNY_URL) {
            path = path.split('localhost:3000').pop() as string;
            path = path.split(PAYLOAD_URL).pop() as string;
        }
    }

    // Limpiar paths de la API de Payload si existen (SOLO para Bunny)
    const isPayloadPath = path.includes('/api/archivos/file/');
    if (isPayloadPath && BUNNY_URL && !shouldIgnoreCDN) {
        path = '/' + path.split('/api/archivos/file/')[1];
    }

    // Si sigue siendo una URL absoluta externa (S3, etc), no hacemos nada
    if (path.startsWith('http') && !path.includes('localhost:3000') && (PAYLOAD_URL && !path.includes(PAYLOAD_URL))) {
        return path;
    }

    // Asegurarnos de que el path empieza por / si es relativo
    if (!path.startsWith('http') && !path.startsWith('/')) path = '/' + path;

    // Log para depurar
    const willUseCDN = !!BUNNY_URL && !shouldIgnoreCDN;

    // Si no usamos CDN o estamos en desarrollo ignorándolo, devolver URL de Payload
    if (!willUseCDN) {
        // Si el path ya es una URL absoluta, devolverla
        if (path.startsWith('http')) return path;
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
