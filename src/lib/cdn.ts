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
    fallback?: string;
}

/**
 * Transforma una URL de imagen para usar el CDN si está configurado
 */
export function getOptimizedImageUrl(src: string, options: CDNOptions = {}): string {
    if (!src) return options.fallback || '/images/placeholder.jpg';

    let BUNNY_URL = getEnv('PUBLIC_BUNNY_CDN_URL').replace(/\/$/, "");
    // Asegurar que tiene protocolo https://
    if (BUNNY_URL && !BUNNY_URL.startsWith('http')) {
        BUNNY_URL = `https://${BUNNY_URL}`;
    }
    const PAYLOAD_URL = (getEnv('PAYLOAD_PUBLIC_SERVER_URL') || getEnv('PUBLIC_PAYLOAD_API_URL', 'http://localhost:3000').replace('/api', '')).replace(/\/$/, "");

    const isDevelopment = getEnv('NODE_ENV') === 'development';
    const isLocalPath = src.includes('localhost') || src.includes('127.0.0.1') || (!src.startsWith('http') && isDevelopment);

    // En desarrollo, verificar si Bunny Storage está configurado
    // Si no está configurado (BUNNY_STORAGE_ZONE_NAME vacío), no usar CDN
    const hasBunnyStorage = getEnv('BUNNY_STORAGE_ZONE_NAME', '').length > 0;

    // En desarrollo, ignorar CDN si:
    // 1. No está configurado el almacenamiento en Bunny, O
    // 2. Es una ruta local y no hay FORCE_CDN
    const FORCE_CDN = getEnv('PUBLIC_FORCE_CDN_LOCAL') === 'true';
    const shouldIgnoreCDN = isDevelopment && (!hasBunnyStorage || (isLocalPath && !FORCE_CDN));

    // Normalizar src si viene como path relativo
    let path = src;
    let originalPayloadPath = src; // Guardar la ruta original para Payload

    // Si el path ya es una URL optimizada de Bunny, no hacer nada
    if (BUNNY_URL && path.includes(BUNNY_URL)) {
        return path;
    }

    // Si viene de localhost o de la URL del servidor configurada
    // IMPORTANTE: Siempre strippear el dominio si vamos a usar CDN,
    // de lo contrario tendremos URLs como bunny.net/http://localhost...
    if (path.includes('localhost:3000') || (PAYLOAD_URL && path.includes(PAYLOAD_URL))) {
        path = path.split('localhost:3000').pop() as string;
        path = path.split(PAYLOAD_URL).pop() as string;
        originalPayloadPath = path;
    }

    // Limpiar prefijos de Payload si existen para que la ruta sea relativa a la raíz de Bunny
    // Payload usa /media/ o /api/archivos/file/ dependiendo de la versión y config
    const prefixesToRemove = ['/api/archivos/file/', '/media/'];
    let cleanedPath = path;
    for (const prefix of prefixesToRemove) {
        if (path.includes(prefix)) {
            cleanedPath = '/' + path.split(prefix)[1];
            break;
        }
    }

    // Si sigue siendo una URL absoluta externa (S3, etc), no hacemos nada
    if (path.startsWith('http') && !path.includes('localhost:3000') && (PAYLOAD_URL && !path.includes(PAYLOAD_URL))) {
        return path;
    }

    // Asegurarnos de que el path empieza por / si es relativo
    if (!path.startsWith('http') && !path.startsWith('/')) path = '/' + path;
    if (!cleanedPath.startsWith('http') && !cleanedPath.startsWith('/')) cleanedPath = '/' + cleanedPath;

    // Log para depurar
    const willUseCDN = !!BUNNY_URL && !shouldIgnoreCDN;

    // Si no usamos CDN o estamos en desarrollo ignorándolo, devolver URL de Payload
    if (!willUseCDN) {
        // Si el path ya es una URL absoluta, devolverla
        if (path.startsWith('http')) return path;
        // Usar la ruta original que incluye el prefijo /api/archivos/file/ para Payload
        return `${PAYLOAD_URL}${originalPayloadPath}`;
    }

    // Construir URL de Bunny.net
    const searchParams = new URLSearchParams();
    if (options.width) searchParams.append('w', options.width.toString());
    if (options.height) searchParams.append('h', options.height.toString());
    if (options.quality) searchParams.append('q', options.quality.toString());

    const queryString = searchParams.toString();
    const separator = cleanedPath.includes('?') ? '&' : '?';

    const finalResult = `${BUNNY_URL}${cleanedPath}${queryString ? separator + queryString : ''}`;

    if (getEnv('PUBLIC_FORCE_CDN_LOCAL') === 'true') {
        console.log(`[DEBUG] getOptimizedImageUrl: ${src} -> ${finalResult}`);
    }

    return finalResult;
}
