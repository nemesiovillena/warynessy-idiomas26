// Cliente REST de Payload para Astro
// Usa la API REST de Payload en lugar de la API local para evitar conflictos de inicialización

// En SSR siempre usar localhost para evitar loop Traefik → contenedor → Traefik
// La URL pública (PUBLIC_PAYLOAD_API_URL) solo aplica en el cliente (browser)
const PORT = process.env.PORT || '3000'
const API_URL = `http://localhost:${PORT}/api`


interface PayloadResponse<T> {
  docs: T[]
  totalDocs: number
  limit: number
  totalPages: number
  page: number
  pagingCounter: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage: number | null
  nextPage: number | null
}

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}, _locale?: string): Promise<T> {
  const finalUrl = `${API_URL}${endpoint}`;

  try {
    const response = await fetch(finalUrl, {
      ...options,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`API Error: ${response.status} ${response.statusText} - ${finalUrl}`, errorText)
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Request aborted for ${finalUrl}: Request timed out`)
      throw new Error(`Request timed out for ${finalUrl}`)
    }
    console.error(`Fetch error for ${finalUrl}:`, error)
    throw error
  }
}

// Helper para construir query strings de Payload
function buildQuery(params: Record<string, any>, locale?: string): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        searchParams.set(key, JSON.stringify(value))
      } else {
        searchParams.set(key, String(value))
      }
    }
  }

  if (locale) {
    searchParams.set('locale', locale);
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

// ============================================
// COLECCIONES
// ============================================

export async function getPlatos(activo = true, locale?: string) {
  const where = activo ? { activo: { equals: true } } : {}
  const query = buildQuery({ where, sort: 'orden', depth: 2, limit: 500 }, locale)
  const result = await fetchAPI<PayloadResponse<any>>(`/platos${query}`, {}, locale)
  return result.docs
}

export async function getPlatosPorCategoria(categoriaId: string, activo = true, locale?: string) {
  const where: any = { categoria: { equals: categoriaId } }
  if (activo) where.activo = { equals: true }
  const query = buildQuery({ where, sort: 'orden', depth: 2, limit: 100 }, locale)
  const result = await fetchAPI<PayloadResponse<any>>(`/platos${query}`, {}, locale)
  return result.docs
}

export async function getCategorias(activa = true, locale?: string) {
  const where = activa ? { activa: { equals: true } } : {}
  const query = buildQuery({ where, sort: 'orden', limit: 100 }, locale)
  const result = await fetchAPI<PayloadResponse<any>>(`/categorias${query}`, {}, locale)
  return result.docs
}

export async function getAlergenos(locale?: string) {
  const query = buildQuery({ sort: 'orden', limit: 100 }, locale)
  const result = await fetchAPI<PayloadResponse<any>>(`/alergenos${query}`, {}, locale)
  return result.docs
}

export async function getMenus(activo = true, locale?: string) {
  const baseParams = { sort: 'orden', depth: 1, limit: 100 }
  const where = activo ? { activo: { equals: true } } : {}
  const query = buildQuery({ ...baseParams, where }, locale)
  const url = `/menus${query}`
  const result = await fetchAPI<PayloadResponse<any>>(url, {}, locale)

  // Refuerzo manual del orden para asegurar consistencia total
  return result.docs.sort((a: any, b: any) => {
    const ordenA = typeof a.orden === 'number' ? a.orden : 999
    const ordenB = typeof b.orden === 'number' ? b.orden : 999
    if (ordenA !== ordenB) return ordenA - ordenB
    return String(a.nombre).localeCompare(String(b.nombre))
  })
}

export async function getMenuBySlug(slug: string, locale?: string) {
  const localeParam = locale ? `&locale=${locale}` : ''
  const url = `/menus?where[slug][equals]=${slug}&limit=1&depth=3${localeParam}`
  const result = await fetchAPI<PayloadResponse<any>>(url, {}, locale)
  return result.docs[0] || null
}

export async function getActiveMenusSlugs() {
  // Use direct query string format for Payload REST API
  const url = `/menus?where[activo][equals]=true&limit=100`
  const result = await fetchAPI<PayloadResponse<any>>(url)
  return result.docs.map((doc: any) => doc.slug)
}

export async function getEspacios(activo = true, locale?: string) {
  const where = activo ? { activo: { equals: true } } : {}
  const query = buildQuery({ where, sort: 'orden', depth: 2, limit: 100 }, locale)
  const result = await fetchAPI<PayloadResponse<any>>(`/espacios${query}`, {}, locale)
  return result.docs
}

export async function getMenusGrupo(activo = true, locale?: string) {
  try {
    const where = activo ? { activo: { equals: true } } : {}
    const query = buildQuery({ where, sort: 'orden', depth: 2, limit: 100 }, locale)
    const url = `/menus-grupo${query}`
    const result = await fetchAPI<PayloadResponse<any>>(url, {}, locale)

    if (!result || !result.docs) return []

    return result.docs.sort((a: any, b: any) => {
      const ordenA = typeof a.orden === 'number' ? a.orden : 999
      const ordenB = typeof b.orden === 'number' ? b.orden : 999
      return ordenA - ordenB
    })
  } catch (error) {
    console.error('Error fetching menus-grupo:', error)
    return []
  }
}

// Alias for backward compatibility
export const getGroupMenus = getMenusGrupo



export async function getBannersActivos(posicion?: string, locale?: string) {
  const now = new Date().toISOString()

  const where: any = {
    activo: { equals: true },
    fechaInicio: { less_than_equal: now },
    fechaFin: { greater_than_equal: now },
  }

  if (posicion) {
    where.posicion = { equals: posicion }
  }

  const query = buildQuery({ where, sort: '-prioridad', depth: 1, limit: 100 }, locale)
  const result = await fetchAPI<PayloadResponse<any>>(`/banners${query}`, {}, locale)
  return result.docs
}

// ============================================
// GLOBALS
// ============================================

export async function getPaginaInicio(locale?: string) {
  const query = buildQuery({ depth: 3 }, locale)
  return fetchAPI<any>(`/globals/pagina-inicio${query}`, {}, locale)
}

export async function getConfiguracionSitio(locale?: string) {
  const query = buildQuery({ depth: 2 }, locale)
  return fetchAPI<any>(`/globals/configuracion-sitio${query}`, {}, locale)
}

export async function getPaginaBySlug(slug: string, locale?: string) {
  try {
    const localeParam = locale ? `&locale=${locale}` : ''
    const url = `/paginas?where[slug][equals]=${slug}&limit=1&depth=2${localeParam}`
    const result = await fetchAPI<PayloadResponse<any>>(url, {}, locale)
    return result.docs[0] || null
  } catch (error) {
    console.error(`Error al obtener pagina por slug (${slug}):`, error)
    return null
  }
}

// ============================================
// UTILIDADES
// ============================================

export async function getCategoriasConPlatos(locale?: string) {
  const [categorias, platos] = await Promise.all([
    getCategorias(true, locale),
    getPlatos(true, locale),
  ])

  return categorias.map((categoria: any) => ({
    ...categoria,
    platos: platos.filter((plato: any) =>
      plato.categoria?.id === categoria.id || plato.categoria === categoria.id
    ),
  }))
}

export async function getPlatosDestacados(locale?: string) {
  const where = {
    activo: { equals: true },
    destacado: { equals: true },
  }
  const query = buildQuery({ where, sort: 'orden', depth: 2, limit: 10 }, locale)
  const result = await fetchAPI<PayloadResponse<any>>(`/platos${query}`, {}, locale)
  return result.docs
}

// ============================================
// ALIAS (compatibilidad con nombres anteriores)
// ============================================

export const getDishes = getPlatos
export const getDishesByCategory = getPlatosPorCategoria
export const getCategories = getCategorias
export const getAllergens = getAlergenos
export const getSpaces = getEspacios
export const getActiveBanners = getBannersActivos
export const getHomepage = getPaginaInicio
export const getSiteSettings = getConfiguracionSitio
export const getCategoriesWithDishes = getCategoriasConPlatos
export const getFeaturedDishes = getPlatosDestacados
