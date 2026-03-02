/**
 * BackupService
 *
 * Servicio central que encapsula toda la lógica de backups:
 *   - Captura y almacenamiento de deltas individuales
 *   - Creación de snapshots completos (full backups)
 *   - Cálculo de diferencias (diffs) entre estados de documentos
 *   - Restauración de documentos o snapshots completos
 *   - Generación de hashes de integridad
 *
 * No tiene dependencias de MongoDB ni de change streams.
 * Funciona íntegramente con la API local de Payload y PostgreSQL.
 */

import type { Payload } from 'payload'
import crypto from 'crypto'

// ─────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────

export interface DeltaInput {
  collectionSlug: string
  resourceType: 'collection' | 'global'
  documentId?: string | null
  operation: 'create' | 'update' | 'delete'
  previousData?: Record<string, unknown> | null
  currentData?: Record<string, unknown> | null
  authorId?: string | null
  authorEmail?: string | null
}

export interface BackupStats {
  totalDeltas: number
  deltasByCollection: Record<string, number>
  oldestDelta: Date | null
  newestDelta: Date | null
  totalSnapshots: number
  lastSnapshotAt: Date | null
}

export interface RestoreResult {
  success: boolean
  restoredCount: number
  errors: string[]
  message: string
}

// ─────────────────────────────────────────────
// Clase principal
// ─────────────────────────────────────────────

export class BackupService {
  // Usamos 'any' para las operaciones internas porque los slugs 'backup-deltas' y
  // 'backup-snapshots' no están en payload-types.ts hasta ejecutar `pnpm generate:types`.
  // Una vez regenerados los tipos, se puede quitar el cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private payload: any

  constructor(payload: Payload) {
    this.payload = payload
  }

  // ─────────────────────────────────────────────
  // CAPTURA DE DELTAS
  // ─────────────────────────────────────────────

  /**
   * Registra un delta (cambio atómico) capturado por un hook de Payload.
   * Se llama desde afterChange y afterDelete de las colecciones.
   *
   * No bloquea la operación original: se ejecuta en background con fire-and-forget.
   */
  async saveDelta(input: DeltaInput): Promise<void> {
    try {
      // Calcular qué campos cambiaron (solo para updates)
      const changedFields =
        input.operation === 'update' && input.previousData && input.currentData
          ? this.getChangedFields(input.previousData, input.currentData)
          : null

      // Hash de integridad del estado actual
      const contentToHash = input.currentData ?? input.previousData ?? {}
      const contentHash = this.hashContent(contentToHash)

      // Guardar en la colección backup-deltas
      await this.payload.create({
        collection: 'backup-deltas',
        data: {
          collectionSlug: input.collectionSlug,
          resourceType: input.resourceType,
          documentId: input.documentId ?? null,
          operation: input.operation,
          previousData: input.previousData ?? null,
          currentData: input.currentData ?? null,
          changedFields: changedFields,
          authorId: input.authorId ?? null,
          authorEmail: input.authorEmail ?? null,
          capturedAt: new Date().toISOString(),
          contentHash,
        },
        // Omitimos req para que no interfiera con la transacción del hook original
        overrideAccess: true,
        depth: 0,
      })
    } catch (error) {
      // Log del error pero NO propagarlo para no romper la operación original
      this.payload.logger.error({
        msg: '[BackupService] Error al guardar delta',
        err: error,
        collection: input.collectionSlug,
        operation: input.operation,
      })
    }
  }

  // ─────────────────────────────────────────────
  // CREACIÓN DE SNAPSHOTS
  // ─────────────────────────────────────────────

  /**
   * Crea un snapshot completo de todas las colecciones especificadas.
   * Vuelca el estado actual de cada colección y lo almacena en la BD.
   *
   * Para proyectos grandes, considerar cambiar storageType a 'local' o 's3'.
   */
  async createFullSnapshot(options: {
    label?: string
    collections: string[]
    triggeredBy?: 'system' | 'admin'
    triggeredByEmail?: string
    storageType?: 'database' | 'local' | 's3'
  }): Promise<string> {
    const label =
      options.label ??
      `Backup completo - ${new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`

    // Crear el registro del snapshot con estado 'processing'
    const snapshot = await this.payload.create({
      collection: 'backup-snapshots',
      data: {
        label,
        type: options.triggeredBy === 'admin' ? 'manual' : 'full',
        status: 'processing',
        collections: options.collections,
        triggeredBy: options.triggeredBy ?? 'system',
        triggeredByEmail: options.triggeredByEmail,
        periodStart: new Date().toISOString(),
        storageType: options.storageType ?? 'database',
        retentionPolicy: 'normal',
      },
      overrideAccess: true,
    })

    this.payload.logger.info({
      msg: `[BackupService] Iniciando snapshot completo: ${snapshot.id}`,
    })

    try {
      // Volcar el estado actual de cada colección
      const allData: Record<string, unknown[]> = {}
      const stats: Record<string, number> = {}
      let totalSize = 0

      for (const collectionSlug of options.collections) {
        try {
          // Leer todos los documentos de la colección (sin límite)
          const result = await this.payload.find({
            collection: collectionSlug as any,
            limit: 0, // 0 = sin límite en Payload
            depth: 0, // Sin relaciones expandidas para reducir tamaño
            overrideAccess: true,
          })

          allData[collectionSlug] = result.docs
          stats[collectionSlug] = result.totalDocs
          totalSize += JSON.stringify(result.docs).length
        } catch (collErr) {
          // Si falla una colección, continuar con las demás
          this.payload.logger.error({
            msg: `[BackupService] Error volcando colección ${collectionSlug}`,
            err: collErr,
          })
          allData[collectionSlug] = []
          stats[collectionSlug] = 0
        }
      }

      // Contar los deltas no consolidados que existían antes de este snapshot
      const deltasResult = await this.payload.find({
        collection: 'backup-deltas',
        where: {
          snapshotId: { equals: null },
        },
        limit: 0,
        overrideAccess: true,
      })

      const contentHash = this.hashContent(allData)

      // Actualizar el snapshot con los datos y estado 'completed'
      await this.payload.update({
        collection: 'backup-snapshots',
        id: snapshot.id,
        data: {
          status: 'completed',
          data: options.storageType === 'database' ? allData : null,
          stats,
          sizeBytes: totalSize,
          deltaCount: deltasResult.totalDocs,
          periodEnd: new Date().toISOString(),
          contentHash,
        },
        overrideAccess: true,
      })

      // Marcar los deltas pendientes como consolidados en este snapshot
      await this.markDeltasAsConsolidated(snapshot.id as string)

      this.payload.logger.info({
        msg: `[BackupService] Snapshot completado: ${snapshot.id} | ${options.collections.length} colecciones | ${(totalSize / 1024).toFixed(1)} KB`,
      })

      return snapshot.id as string
    } catch (error) {
      // Marcar como error
      await this.payload.update({
        collection: 'backup-snapshots',
        id: snapshot.id,
        data: {
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
          periodEnd: new Date().toISOString(),
        },
        overrideAccess: true,
      })

      this.payload.logger.error({
        msg: `[BackupService] Error en snapshot ${snapshot.id}`,
        err: error,
      })

      throw error
    }
  }

  // ─────────────────────────────────────────────
  // RESTAURACIÓN
  // ─────────────────────────────────────────────

  /**
   * Restaura un snapshot completo. Sobrescribe los documentos actuales
   * con los del backup seleccionado.
   *
   * ⚠️ OPERACIÓN DESTRUCTIVA: Requiere confirmación explícita.
   * Solo restaura los documentos incluidos en el snapshot.
   * No elimina documentos creados después del backup.
   */
  async restoreSnapshot(
    snapshotId: string,
    options: {
      dryRun?: boolean // Si true, simula la restauración sin escribir
      collections?: string[] // Restaurar solo estas colecciones
    } = {},
  ): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      restoredCount: 0,
      errors: [],
      message: '',
    }

    try {
      // Obtener el snapshot
      const snapshot = await this.payload.findByID({
        collection: 'backup-snapshots',
        id: snapshotId,
        overrideAccess: true,
      })

      if (!snapshot) {
        result.message = `Snapshot ${snapshotId} no encontrado`
        return result
      }

      if (snapshot.status !== 'completed') {
        result.message = `El snapshot ${snapshotId} no está en estado 'completed' (estado actual: ${snapshot.status})`
        return result
      }

      if (!snapshot.data) {
        result.message = `El snapshot ${snapshotId} no tiene datos almacenados en la BD. Restauración desde archivo local/S3 no implementada en esta versión.`
        return result
      }

      const snapshotData = snapshot.data as Record<string, any[]>
      const collectionsToRestore = options.collections ?? Object.keys(snapshotData)

      this.payload.logger.info({
        msg: `[BackupService] ${options.dryRun ? '[DRY RUN] ' : ''}Iniciando restauración del snapshot ${snapshotId}`,
      })

      for (const collectionSlug of collectionsToRestore) {
        const docs = snapshotData[collectionSlug]
        if (!docs || !Array.isArray(docs)) continue

        for (const doc of docs) {
          try {
            if (options.dryRun) {
              // Solo simular, no escribir
              result.restoredCount++
              continue
            }

            // Intentar actualizar si existe, crear si no
            try {
              await this.payload.update({
                collection: collectionSlug as any,
                id: doc.id,
                data: doc,
                overrideAccess: true,
                depth: 0,
              })
            } catch {
              // Si no existe, crearlo
              await this.payload.create({
                collection: collectionSlug as any,
                data: doc,
                overrideAccess: true,
                depth: 0,
              })
            }

            result.restoredCount++
          } catch (docErr) {
            const errMsg = `Error restaurando ${collectionSlug}/${doc.id}: ${docErr instanceof Error ? docErr.message : String(docErr)}`
            result.errors.push(errMsg)
            this.payload.logger.error({ msg: `[BackupService] ${errMsg}` })
          }
        }
      }

      if (!options.dryRun) {
        // Marcar el snapshot como restaurado
        await this.payload.update({
          collection: 'backup-snapshots',
          id: snapshotId,
          data: { status: 'restored' },
          overrideAccess: true,
        })
      }

      result.success = result.errors.length === 0
      result.message = options.dryRun
        ? `[Simulación] Se restaurarían ${result.restoredCount} documentos`
        : `Restauración completada: ${result.restoredCount} documentos restaurados, ${result.errors.length} errores`

      return result
    } catch (error) {
      result.message = `Error fatal en la restauración: ${error instanceof Error ? error.message : String(error)}`
      this.payload.logger.error({ msg: `[BackupService] ${result.message}`, err: error })
      return result
    }
  }

  /**
   * Restaura un único documento a su estado en un delta específico.
   * Útil para "deshacer" un cambio concreto sin restaurar todo el sistema.
   */
  async restoreDelta(deltaId: string): Promise<RestoreResult> {
    const result: RestoreResult = { success: false, restoredCount: 0, errors: [], message: '' }

    try {
      const delta = await this.payload.findByID({
        collection: 'backup-deltas',
        id: deltaId,
        overrideAccess: true,
      })

      if (!delta) {
        result.message = `Delta ${deltaId} no encontrado`
        return result
      }

      const collectionSlug = delta.collectionSlug as string
      const documentId = delta.documentId as string

      // Si el delta era un CREATE, el estado anterior es vacío → eliminar el doc actual
      if (delta.operation === 'create') {
        await this.payload.delete({
          collection: collectionSlug as any,
          id: documentId,
          overrideAccess: true,
        })
        result.restoredCount++
        result.success = true
        result.message = `Documento ${collectionSlug}/${documentId} eliminado (revertido su creación)`
        return result
      }

      // Para update o delete: restaurar al estado previo
      const previousData = delta.previousData as Record<string, unknown>
      if (!previousData) {
        result.message = `El delta ${deltaId} no tiene datos del estado anterior`
        return result
      }

      try {
        await this.payload.update({
          collection: collectionSlug as any,
          id: documentId,
          data: previousData,
          overrideAccess: true,
          depth: 0,
        })
      } catch {
        // Si no existe (fue eliminado), recrearlo
        await this.payload.create({
          collection: collectionSlug as any,
          data: previousData,
          overrideAccess: true,
          depth: 0,
        })
      }

      result.restoredCount = 1
      result.success = true
      result.message = `Documento ${collectionSlug}/${documentId} restaurado al estado del delta ${deltaId}`
      return result
    } catch (error) {
      result.message = `Error restaurando delta: ${error instanceof Error ? error.message : String(error)}`
      result.errors.push(result.message)
      return result
    }
  }

  // ─────────────────────────────────────────────
  // ESTADÍSTICAS Y CONSULTAS
  // ─────────────────────────────────────────────

  /**
   * Obtiene estadísticas globales del sistema de backups.
   */
  async getStats(): Promise<BackupStats> {
    try {
      const [deltasResult, snapshotsResult] = await Promise.all([
        this.payload.find({
          collection: 'backup-deltas',
          limit: 1,
          sort: '-capturedAt',
          overrideAccess: true,
        }),
        this.payload.find({
          collection: 'backup-snapshots',
          limit: 1,
          sort: '-createdAt',
          where: { status: { equals: 'completed' } },
          overrideAccess: true,
        }),
      ])

      // Contar por colección
      const deltasByCollection: Record<string, number> = {}
      const allDeltas = await this.payload.find({
        collection: 'backup-deltas',
        limit: 0,
        overrideAccess: true,
      })

      for (const delta of allDeltas.docs) {
        const slug = delta.collectionSlug as string
        deltasByCollection[slug] = (deltasByCollection[slug] ?? 0) + 1
      }

      return {
        totalDeltas: allDeltas.totalDocs,
        deltasByCollection,
        oldestDelta: null, // Simplificado: se puede añadir query específica
        newestDelta: deltasResult.docs[0]?.capturedAt
          ? new Date(deltasResult.docs[0].capturedAt as string)
          : null,
        totalSnapshots: snapshotsResult.totalDocs,
        lastSnapshotAt: snapshotsResult.docs[0]?.createdAt
          ? new Date(snapshotsResult.docs[0].createdAt as string)
          : null,
      }
    } catch (error) {
      this.payload.logger.error({ msg: '[BackupService] Error obteniendo estadísticas', err: error })
      return {
        totalDeltas: 0,
        deltasByCollection: {},
        oldestDelta: null,
        newestDelta: null,
        totalSnapshots: 0,
        lastSnapshotAt: null,
      }
    }
  }

  // ─────────────────────────────────────────────
  // POLÍTICA DE RETENCIÓN
  // ─────────────────────────────────────────────

  /**
   * Aplica la política de retención de backups:
   *  - Mantiene los últimos N deltas no consolidados
   *  - Elimina snapshots antiguos según política
   *
   * Se llama periódicamente desde el BackupAgent.
   */
  async applyRetentionPolicy(policy: {
    maxDeltas?: number // Máximo de deltas sueltos (default: 500)
    maxIncrementalSnapshots?: number // Máximo de snapshots incrementales (default: 30)
    keepWeeklySnapshots?: number // Cuántos semanales conservar (default: 4)
    keepMonthlySnapshots?: number // Cuántos mensuales conservar (default: 12)
  }): Promise<{ deletedDeltas: number; deletedSnapshots: number }> {
    const {
      maxDeltas = 500,
      maxIncrementalSnapshots = 30,
      keepWeeklySnapshots: _keepWeekly = 4,       // reservado para futura lógica semanal
      keepMonthlySnapshots: _keepMonthly = 12,    // reservado para futura lógica mensual
    } = policy

    let deletedDeltas = 0
    let deletedSnapshots = 0

    try {
      // 1. Limpiar deltas consolidados excedentes
      const consolidatedDeltas = await this.payload.find({
        collection: 'backup-deltas',
        where: {
          snapshotId: { not_equals: null },
        },
        sort: '-capturedAt',
        limit: 0,
        overrideAccess: true,
      })

      if (consolidatedDeltas.totalDocs > maxDeltas) {
        const toDelete = consolidatedDeltas.docs.slice(maxDeltas)
        for (const delta of toDelete) {
          await this.payload.delete({
            collection: 'backup-deltas',
            id: delta.id as string,
            overrideAccess: true,
          })
          deletedDeltas++
        }
      }

      // 2. Limpiar snapshots incrementales excedentes (conservar solo los N más recientes)
      const incrementalSnapshots = await this.payload.find({
        collection: 'backup-snapshots',
        where: {
          and: [
            { type: { equals: 'incremental' } },
            { status: { equals: 'completed' } },
            { retentionPolicy: { equals: 'normal' } },
          ],
        },
        sort: '-createdAt',
        limit: 0,
        overrideAccess: true,
      })

      if (incrementalSnapshots.totalDocs > maxIncrementalSnapshots) {
        const toDelete = incrementalSnapshots.docs.slice(maxIncrementalSnapshots)
        for (const snapshot of toDelete) {
          await this.payload.delete({
            collection: 'backup-snapshots',
            id: snapshot.id as string,
            overrideAccess: true,
          })
          deletedSnapshots++
        }
      }

      this.payload.logger.info({
        msg: `[BackupService] Retención aplicada: ${deletedDeltas} deltas y ${deletedSnapshots} snapshots eliminados`,
      })
    } catch (error) {
      this.payload.logger.error({ msg: '[BackupService] Error en política de retención', err: error })
    }

    return { deletedDeltas, deletedSnapshots }
  }

  // ─────────────────────────────────────────────
  // UTILIDADES PRIVADAS
  // ─────────────────────────────────────────────

  /**
   * Calcula el hash SHA-256 de un objeto JSON para verificar integridad.
   */
  private hashContent(data: unknown): string {
    const json = JSON.stringify(data, Object.keys(data as object).sort())
    return crypto.createHash('sha256').update(json).digest('hex')
  }

  /**
   * Compara dos estados de un documento y devuelve los nombres
   * de los campos que han cambiado (comparación superficial de primer nivel).
   */
  private getChangedFields(
    previous: Record<string, unknown>,
    current: Record<string, unknown>,
  ): string[] {
    const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)])
    const changed: string[] = []

    for (const key of allKeys) {
      // Excluir campos de sistema que siempre cambian
      if (['updatedAt', '__v'].includes(key)) continue

      const prevVal = JSON.stringify(previous[key])
      const currVal = JSON.stringify(current[key])

      if (prevVal !== currVal) {
        changed.push(key)
      }
    }

    return changed
  }

  /**
   * Marca todos los deltas sin snapshot asignado como consolidados
   * en el snapshot especificado.
   */
  private async markDeltasAsConsolidated(snapshotId: string): Promise<void> {
    try {
      // Buscar en lotes de 100 para no sobrecargar la BD
      let page = 1
      let hasMore = true

      while (hasMore) {
        const deltas = await this.payload.find({
          collection: 'backup-deltas',
          where: { snapshotId: { equals: null } },
          limit: 100,
          page,
          overrideAccess: true,
        })

        for (const delta of deltas.docs) {
          await this.payload.update({
            collection: 'backup-deltas',
            id: delta.id as string,
            data: { snapshotId },
            overrideAccess: true,
          })
        }

        hasMore = deltas.hasNextPage ?? false
        page++
      }
    } catch (error) {
      this.payload.logger.error({
        msg: '[BackupService] Error marcando deltas como consolidados',
        err: error,
      })
    }
  }
}
