/**
 * backupPlugin
 *
 * Plugin de Payload CMS para copias de seguridad granulares e incrementales.
 *
 * Qué hace este plugin:
 *   1. Registra las colecciones BackupDelta y BackupSnapshot en Payload
 *   2. Inyecta hooks afterChange/afterDelete en todas las colecciones monitorizadas
 *   3. Inyecta hooks afterChange en los globals monitorizados
 *   4. Agrega una vista personalizada "Copias de Seguridad" a la sidebar del admin
 *   5. Registra endpoints REST para las acciones del dashboard
 *   6. Inicia el BackupAgent en onInit de Payload
 *
 * Uso:
 *   import { backupPlugin } from './plugins/backupPlugin'
 *
 *   export default buildConfig({
 *     plugins: [
 *       backupPlugin({
 *         collections: ['platos', 'menus', 'categorias', ...],
 *         globals: ['paginaInicio', 'configuracionSitio'],
 *       })
 *     ]
 *   })
 */

import type {
  Config,
  Plugin,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  Endpoint,
} from 'payload'

import { BackupDelta } from '../src/payload/collections/BackupDelta'
import { BackupSnapshot } from '../src/payload/collections/BackupSnapshot'
import { BackupService } from '../src/backup/BackupService'
import { getOrCreateBackupAgent, destroyBackupAgent } from '../src/backup/BackupAgent'
import type { BackupAgentConfig } from '../src/backup/BackupAgent'

// ─────────────────────────────────────────────
// Configuración del plugin
// ─────────────────────────────────────────────

export interface BackupPluginConfig {
  /**
   * Slugs de las colecciones a monitorizar para backups.
   * Si no se especifica, se monitorizan TODAS las colecciones del proyecto.
   */
  collections?: string[]

  /**
   * Slugs de los globals a monitorizar para backups.
   */
  globals?: string[]

  /**
   * Configuración del agente de background.
   */
  agent?: Partial<BackupAgentConfig>

  /**
   * Si false, el plugin se registra pero no captura cambios ni inicia el agente.
   * Las colecciones de backup siguen existiendo para mantener el esquema de BD.
   * Default: true
   */
  enabled?: boolean

  /**
   * Colecciones internas del plugin que NO deben ser monitorizadas
   * (para evitar loops infinitos).
   * Se añade automáticamente ['backup-deltas', 'backup-snapshots'].
   */
  excludeCollections?: string[]
}

// ─────────────────────────────────────────────
// Factory del plugin
// ─────────────────────────────────────────────

export const backupPlugin =
  (options: BackupPluginConfig = {}): Plugin =>
  (config: Config): Config => {
    const {
      enabled = true,
      excludeCollections: userExcludes = [],
    } = options

    // Colecciones que siempre excluimos (las propias del plugin)
    const internalCollections = ['backup-deltas', 'backup-snapshots']
    const excludeSet = new Set([...internalCollections, ...userExcludes])

    // ── 1. Añadir nuestras colecciones de backups al config ──────────────────
    const updatedConfig: Config = {
      ...config,
      collections: [
        ...(config.collections ?? []),
        BackupDelta,
        BackupSnapshot,
      ],
    }

    // Si el plugin está desactivado, solo añadimos el esquema y salimos
    if (!enabled) {
      return updatedConfig
    }

    // ── 2. Determinar qué colecciones monitorizar ───────────────────────────
    const allCollectionSlugs = (updatedConfig.collections ?? [])
      .map((c) => c.slug)
      .filter((slug) => !excludeSet.has(slug))

    const collectionsToWatch = options.collections
      ? options.collections.filter((s) => !excludeSet.has(s))
      : allCollectionSlugs

    const globalsToWatch = options.globals ?? (updatedConfig.globals ?? []).map((g) => g.slug)

    // ── 3. Inyectar hooks afterChange/afterDelete en colecciones ────────────
    const collectionsWithHooks = (updatedConfig.collections ?? []).map((collection) => {
      // Solo inyectar en colecciones monitorizadas
      if (!collectionsToWatch.includes(collection.slug)) {
        return collection
      }

      // Hook afterChange: captura creates y updates
      const afterChangeHook: CollectionAfterChangeHook = async ({ doc, operation, req, previousDoc }) => {
        // Evitar loops: si viene de nuestras propias operaciones, ignorar
        if ((req.context as any)?.skipBackupHook) return doc

        const service = new BackupService(req.payload)

        // Fire-and-forget: no esperamos para no ralentizar la respuesta
        void service.saveDelta({
          collectionSlug: collection.slug,
          resourceType: 'collection',
          documentId: String(doc.id),
          operation,
          previousData: operation === 'create' ? null : (previousDoc ?? null),
          currentData: doc,
          authorId: req.user ? String(req.user.id) : null,
          authorEmail: (req.user as any)?.email ?? null,
        })

        return doc
      }

      // Hook afterDelete: captura deletes
      const afterDeleteHook: CollectionAfterDeleteHook = async ({ doc, req, id }) => {
        if ((req.context as any)?.skipBackupHook) return doc

        const service = new BackupService(req.payload)

        void service.saveDelta({
          collectionSlug: collection.slug,
          resourceType: 'collection',
          documentId: String(id),
          operation: 'delete',
          previousData: doc ?? null,
          currentData: null,
          authorId: req.user ? String(req.user.id) : null,
          authorEmail: (req.user as any)?.email ?? null,
        })

        return doc
      }

      return {
        ...collection,
        hooks: {
          ...(collection.hooks ?? {}),
          afterChange: [afterChangeHook, ...(collection.hooks?.afterChange ?? [])],
          afterDelete: [afterDeleteHook, ...(collection.hooks?.afterDelete ?? [])],
        },
      }
    })

    // ── 4. Inyectar hooks afterChange en globals ────────────────────────────
    const globalsWithHooks = (updatedConfig.globals ?? []).map((global) => {
      if (!globalsToWatch.includes(global.slug)) return global

      const afterChangeHook: GlobalAfterChangeHook = async ({ doc, req, previousDoc }) => {
        if ((req.context as any)?.skipBackupHook) return doc

        const service = new BackupService(req.payload)

        void service.saveDelta({
          collectionSlug: global.slug,
          resourceType: 'global',
          documentId: null,
          operation: 'update',
          previousData: previousDoc ?? null,
          currentData: doc,
          authorId: req.user ? String(req.user.id) : null,
          authorEmail: (req.user as any)?.email ?? null,
        })

        return doc
      }

      return {
        ...global,
        hooks: {
          ...(global.hooks ?? {}),
          afterChange: [afterChangeHook, ...(global.hooks?.afterChange ?? [])],
        },
      }
    })

    // ── 5. Endpoints REST para el dashboard ────────────────────────────────

    const backupEndpoints: Endpoint[] = [
      // GET /api/backup-plugin/snapshots - Lista de snapshots
      {
        path: '/backup-plugin/snapshots',
        method: 'get',
        handler: async (req) => {
          try {
            // Verificar que el usuario sea admin
            if (!req.user || (req.user as any).role !== 'admin') {
              return Response.json({ error: 'Acceso denegado' }, { status: 403 })
            }

            const page = Number(req.query?.page ?? 1)
            const limit = Number(req.query?.limit ?? 20)

            // Cast necesario: 'backup-snapshots' no existe en payload-types.ts hasta regenerar tipos
            const result = await (req.payload as any).find({
              collection: 'backup-snapshots',
              sort: '-createdAt',
              page,
              limit,
              depth: 0,
              overrideAccess: true,
            })

            return Response.json(result)
          } catch (error) {
            return Response.json(
              { error: error instanceof Error ? error.message : 'Error interno' },
              { status: 500 },
            )
          }
        },
      },

      // GET /api/backup-plugin/stats - Estadísticas del sistema
      {
        path: '/backup-plugin/stats',
        method: 'get',
        handler: async (req) => {
          try {
            if (!req.user || (req.user as any).role !== 'admin') {
              return Response.json({ error: 'Acceso denegado' }, { status: 403 })
            }

            const service = new BackupService(req.payload)
            const stats = await service.getStats()

            // Incluir estado del agente si está disponible
            let agentStatus = null
            try {
              const agent = getOrCreateBackupAgent(req.payload, {
                collections: collectionsToWatch,
                enabled: false, // No iniciar uno nuevo, solo obtener el existente
              })
              agentStatus = agent.getStatus()
            } catch {
              // El agente puede no estar inicializado aún
            }

            return Response.json({ ...stats, agentStatus })
          } catch (error) {
            return Response.json(
              { error: error instanceof Error ? error.message : 'Error interno' },
              { status: 500 },
            )
          }
        },
      },

      // POST /api/backup-plugin/create-full - Crear backup completo manual
      {
        path: '/backup-plugin/create-full',
        method: 'post',
        handler: async (req) => {
          try {
            if (!req.user || (req.user as any).role !== 'admin') {
              return Response.json({ error: 'Acceso denegado' }, { status: 403 })
            }

            const service = new BackupService(req.payload)
            const snapshotId = await service.createFullSnapshot({
              label: `Backup manual - ${new Date().toLocaleString('es-ES')}`,
              collections: collectionsToWatch,
              triggeredBy: 'admin',
              triggeredByEmail: (req.user as any).email,
              storageType: 'database',
            })

            return Response.json({ success: true, snapshotId })
          } catch (error) {
            return Response.json(
              { error: error instanceof Error ? error.message : 'Error al crear backup' },
              { status: 500 },
            )
          }
        },
      },

      // POST /api/backup-plugin/restore/:snapshotId - Restaurar un snapshot
      {
        path: '/backup-plugin/restore/:snapshotId',
        method: 'post',
        handler: async (req) => {
          try {
            if (!req.user || (req.user as any).role !== 'admin') {
              return Response.json({ error: 'Acceso denegado' }, { status: 403 })
            }

            const snapshotId = Array.isArray(req.routeParams?.snapshotId)
              ? req.routeParams.snapshotId[0]
              : req.routeParams?.snapshotId
            if (!snapshotId) {
              return Response.json({ error: 'snapshotId requerido' }, { status: 400 })
            }

            const body = (await req.json?.()) ?? {}
            const dryRun = body.dryRun === true

            const service = new BackupService(req.payload)
            // body.collections puede ser undefined (string[] | undefined es válido)
            const result = await service.restoreSnapshot(snapshotId, {
              dryRun,
              collections: body.collections as string[] | undefined,
            })

            return Response.json(result, { status: result.success ? 200 : 400 })
          } catch (error) {
            return Response.json(
              { error: error instanceof Error ? error.message : 'Error en restauración' },
              { status: 500 },
            )
          }
        },
      },

      // POST /api/backup-plugin/restore-delta/:deltaId - Restaurar un delta concreto
      {
        path: '/backup-plugin/restore-delta/:deltaId',
        method: 'post',
        handler: async (req) => {
          try {
            if (!req.user || (req.user as any).role !== 'admin') {
              return Response.json({ error: 'Acceso denegado' }, { status: 403 })
            }

            const deltaId = req.routeParams?.deltaId
            if (!deltaId) {
              return Response.json({ error: 'deltaId requerido' }, { status: 400 })
            }

            const service = new BackupService(req.payload)
            // deltaId viene del routeParam y ya se validó arriba
            const result = await service.restoreDelta(deltaId as string)

            return Response.json(result, { status: result.success ? 200 : 400 })
          } catch (error) {
            return Response.json(
              { error: error instanceof Error ? error.message : 'Error en restauración de delta' },
              { status: 500 },
            )
          }
        },
      },

      // DELETE /api/backup-plugin/snapshots/:id - Eliminar un snapshot
      {
        path: '/backup-plugin/snapshots/:id',
        method: 'delete',
        handler: async (req) => {
          try {
            if (!req.user || (req.user as any).role !== 'admin') {
              return Response.json({ error: 'Acceso denegado' }, { status: 403 })
            }

            const id = req.routeParams?.id
            if (!id) {
              return Response.json({ error: 'id requerido' }, { status: 400 })
            }

            // Cast necesario hasta regenerar payload-types.ts con las nuevas colecciones
            const payloadAny = req.payload as any

            // Verificar que no sea un backup permanente
            const snapshot = await payloadAny.findByID({
              collection: 'backup-snapshots',
              id,
              overrideAccess: true,
            })

            if (!snapshot) {
              return Response.json({ error: 'Snapshot no encontrado' }, { status: 404 })
            }

            if (snapshot.retentionPolicy === 'permanent') {
              return Response.json(
                { error: 'No se puede eliminar un backup marcado como permanente' },
                { status: 403 },
              )
            }

            await payloadAny.delete({
              collection: 'backup-snapshots',
              id,
              overrideAccess: true,
            })

            return Response.json({ success: true })
          } catch (error) {
            return Response.json(
              { error: error instanceof Error ? error.message : 'Error al eliminar' },
              { status: 500 },
            )
          }
        },
      },
    ]

    // ── 6. Vista personalizada en el dashboard ─────────────────────────────

    // Aseguramos que la config de admin y sus subobjetos existen
    if (!updatedConfig.admin) updatedConfig.admin = {}
    if (!updatedConfig.admin.components) updatedConfig.admin.components = {}
    if (!updatedConfig.admin.components.views) updatedConfig.admin.components.views = {}

    const existingViews = updatedConfig.admin.components.views as Record<string, unknown>

    existingViews['backups'] = {
      // Ruta en la sidebar del admin: /admin/backups
      path: '/backups',
      // Wrapper server component que incluye DefaultTemplate
      Component: '/src/views/BackupsPage',
      // Metadatos para la entrada en la sidebar
      meta: {
        label: 'Copias de Seguridad',
        description: 'Gestión de backups granulares',
      },
    }

    // Añadir enlace en la sidebar (afterNavLinks)
    const existingAfterNavLinks = updatedConfig.admin.components.afterNavLinks ?? []
    updatedConfig.admin.components.afterNavLinks = [
      ...existingAfterNavLinks,
      '/src/views/BackupsNavLink',
    ]

    // ── 7. Inicializar el agente en onInit ──────────────────────────────────

    const existingOnInit = updatedConfig.onInit

    updatedConfig.onInit = async (payload) => {
      // IMPORTANTE: llamar siempre al onInit existente primero
      if (existingOnInit) await existingOnInit(payload)

      payload.logger.info({ msg: '[BackupPlugin] Inicializando sistema de backups...' })

      // Crear y arrancar el agente
      const agent = getOrCreateBackupAgent(payload, {
        collections: collectionsToWatch,
        ...(options.agent ?? {}),
      })

      agent.start()

      payload.logger.info({
        msg: `[BackupPlugin] Sistema de backups activo. Monitorizando ${collectionsToWatch.length} colecciones y ${globalsToWatch.length} globals.`,
      })
    }

    // ── 8. Limpiar el agente al cerrar ──────────────────────────────────────
    // Nota: Payload no expone onDestroy todavía, pero registramos el evento
    // de proceso para una limpieza ordenada
    if (typeof process !== 'undefined') {
      const cleanup = () => {
        destroyBackupAgent()
      }
      process.once('SIGTERM', cleanup)
      process.once('SIGINT', cleanup)
    }

    return {
      ...updatedConfig,
      collections: collectionsWithHooks,
      globals: globalsWithHooks,
      endpoints: [...(updatedConfig.endpoints ?? []), ...backupEndpoints],
    }
  }
