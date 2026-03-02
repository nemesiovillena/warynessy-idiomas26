// Cliente REST de Payload para Astro
// Usa la API REST de Payload en lugar de la API local para evitar conflictos de inicialización

// Usar process.env para SSR en Astro
const API_URL = process.env.PUBLIC_PAYLOAD_API_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL
  ? `${process.env.PAYLOAD_PUBLIC_SERVER_URL}/api`
  : 'http://localhost:3000/api'

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

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${endpoint}`

  try {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      console.error(`API Error: ${response.status} - ${url}`)
      throw new Error(`API request failed: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error)
    throw error
  }
}

// Helper para construir query strings de Payload
function buildQuery(params: Record<string, any>): string {
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

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

// ============================================
// COLECCIONES
// ============================================

export async function getPlatos(activo = true) {
  const where = activo ? { activo: { equals: true } } : {}
  const query = buildQuery({ where, sort: 'orden', depth: 2, limit: 500 })
  const result = await fetchAPI<PayloadResponse<any>>(`/platos${query}`)
  return result.docs
}

export async function getPlatosPorCategoria(categoriaId: string, activo = true) {
  const where: any = { categoria: { equals: categoriaId } }
  if (activo) where.activo = { equals: true }
  const query = buildQuery({ where, sort: 'orden', depth: 2, limit: 100 })
  const result = await fetchAPI<PayloadResponse<any>>(`/platos${query}`)
  return result.docs
}

export async function getCategorias(activa = true) {
  const where = activa ? { activa: { equals: true } } : {}
  const query = buildQuery({ where, sort: 'orden', limit: 100 })
  const result = await fetchAPI<PayloadResponse<any>>(`/categorias${query}`)
  return result.docs
}

export async function getAlergenos() {
  const query = buildQuery({ sort: 'orden', limit: 100 })
  const result = await fetchAPI<PayloadResponse<any>>(`/alergenos${query}`)
  return result.docs
}

export async function getMenus(activo = true) {
  const url = activo
    ? `/menus?where[activo][equals]=true&sort=orden&depth=1&limit=100`
    : `/menus?sort=orden&depth=1&limit=100`
  const result = await fetchAPI<PayloadResponse<any>>(url)

  // Refuerzo manual del orden para asegurar consistencia total
  return result.docs.sort((a: any, b: any) => {
    const ordenA = typeof a.orden === 'number' ? a.orden : 999
    const ordenB = typeof b.orden === 'number' ? b.orden : 999
    if (ordenA !== ordenB) return ordenA - ordenB
    return String(a.nombre).localeCompare(String(b.nombre))
  })
}

export async function getMenuBySlug(slug: string) {
  // Use direct query string format for Payload REST API
  // Aumentamos depth a 3 para asegurar que se cargan todos los campos Rich Text correctamente
  const url = `/menus?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=3`
  const result = await fetchAPI<PayloadResponse<any>>(url)
  return result.docs[0] || null
}

export async function getActiveMenusSlugs() {
  // Use direct query string format for Payload REST API
  const url = `/menus?where[activo][equals]=true&limit=100`
  const result = await fetchAPI<PayloadResponse<any>>(url)
  return result.docs.map((doc: any) => doc.slug)
}

export async function getEspacios(activo = true) {
  const where = activo ? { activo: { equals: true } } : {}
  const query = buildQuery({ where, sort: 'orden', depth: 1, limit: 100 })
  const result = await fetchAPI<PayloadResponse<any>>(`/espacios${query}`)
  return result.docs
}

export async function getMenusGrupo(activo = true) {
  try {
    // Use direct query string format for Payload REST API
    const url = activo
      ? `/menus-grupo?where[activo][equals]=true&sort=orden&depth=2&limit=100`
      : `/menus-grupo?sort=orden&depth=2&limit=100`
    const result = await fetchAPI<PayloadResponse<any>>(url)

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



export async function getBannersActivos(posicion?: string) {
  const now = new Date().toISOString()

  const where: any = {
    activo: { equals: true },
    fechaInicio: { less_than_equal: now },
    fechaFin: { greater_than_equal: now },
  }

  if (posicion) {
    where.posicion = { equals: posicion }
  }

  const query = buildQuery({ where, sort: '-prioridad', depth: 1, limit: 100 })
  const result = await fetchAPI<PayloadResponse<any>>(`/banners${query}`)
  return result.docs
}

// ============================================
// GLOBALS
// ============================================

export async function getPaginaInicio() {
  const query = buildQuery({ depth: 3 })
  return fetchAPI<any>(`/globals/pagina-inicio${query}`)
}

export async function getConfiguracionSitio() {
  const query = buildQuery({ depth: 1 })
  return fetchAPI<any>(`/globals/configuracion-sitio${query}`)
}

export async function getPaginaBySlug(slug: string) {
  try {
    // Use direct query string format for Payload REST API
    const url = `/paginas?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=1`
    const result = await fetchAPI<PayloadResponse<any>>(url)
    return result.docs[0] || null
  } catch (error) {
    console.error(`Error al obtener pagina por slug (${slug}):`, error)
    return null
  }
}

// ============================================
// UTILIDADES
// ============================================

export async function getCategoriasConPlatos() {
  const categorias = await getCategorias()
  const platos = await getPlatos()

  return categorias.map((categoria: any) => ({
    ...categoria,
    platos: platos.filter((plato: any) =>
      plato.categoria?.id === categoria.id || plato.categoria === categoria.id
    ),
  }))
}

export async function getPlatosDestacados() {
  const where = {
    activo: { equals: true },
    destacado: { equals: true },
  }
  const query = buildQuery({ where, sort: 'orden', depth: 2, limit: 10 })
  const result = await fetchAPI<PayloadResponse<any>>(`/platos${query}`)
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
