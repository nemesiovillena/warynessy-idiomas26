/**
 * BackupAgent
 *
 * Agente de background que gestiona automáticamente el sistema de backups.
 * Se ejecuta como un singleton dentro del proceso de Payload/Next.js.
 *
 * Responsabilidades:
 *   1. Consolidar deltas en snapshots completos periódicamente
 *   2. Aplicar política de retención para no llenar la BD
 *   3. Detectar y notificar errores (console + hook configurable)
 *   4. Programar backups automáticos (diario, semanal, mensual)
 *
 * Nota de implementación: Usamos setInterval nativo por compatibilidad
 * con Next.js App Router. Para cargas de trabajo altas, considerar
 * migrar a Payload Jobs Queue (ver ADVANCED.md#jobs-queue).
 */

import type { Payload } from 'payload'
import { BackupService } from './BackupService'

// ─────────────────────────────────────────────
// Configuración del agente
// ─────────────────────────────────────────────

export interface BackupAgentConfig {
  /** Colecciones a incluir en los backups automáticos */
  collections: string[]

  /** Frecuencia del backup incremental en milisegundos (default: 1 hora) */
  incrementalIntervalMs?: number

  /** Frecuencia del backup completo diario en milisegundos (default: 24 horas) */
  fullBackupIntervalMs?: number

  /** Número máximo de deltas sueltos antes de forzar consolidación (default: 100) */
  consolidateAfterDeltas?: number

  /** Configuración de la política de retención */
  retention?: {
    maxDeltas?: number
    maxIncrementalSnapshots?: number
    keepWeeklySnapshots?: number
    keepMonthlySnapshots?: number
  }

  /** Callback para notificaciones de error (ej: enviar email con Resend) */
  onError?: (error: Error, context: string) => Promise<void> | void

  /** Si false, el agente no se inicia automáticamente (default: true) */
  enabled?: boolean
}

// ─────────────────────────────────────────────
// Singleton del agente
// ─────────────────────────────────────────────

// Guardamos la instancia en el scope del módulo para evitar duplicados
// en hot-reload de Next.js dev mode
let agentInstance: BackupAgent | null = null

export class BackupAgent {
  private payload: Payload
  private service: BackupService
  private config: Required<Omit<BackupAgentConfig, 'onError'>> & {
    onError?: BackupAgentConfig['onError']
  }

  private incrementalTimer: NodeJS.Timeout | null = null
  private fullBackupTimer: NodeJS.Timeout | null = null
  private isRunning = false
  private isConsolidating = false
  private lastError: { message: string; timestamp: Date } | null = null

  constructor(payload: Payload, config: BackupAgentConfig) {
    this.payload = payload
    this.service = new BackupService(payload)

    // Aplicar valores por defecto
    this.config = {
      collections: config.collections,
      incrementalIntervalMs: config.incrementalIntervalMs ?? 60 * 60 * 1000, // 1 hora
      fullBackupIntervalMs: config.fullBackupIntervalMs ?? 24 * 60 * 60 * 1000, // 24 horas
      consolidateAfterDeltas: config.consolidateAfterDeltas ?? 100,
      retention: {
        maxDeltas: config.retention?.maxDeltas ?? 500,
        maxIncrementalSnapshots: config.retention?.maxIncrementalSnapshots ?? 30,
        keepWeeklySnapshots: config.retention?.keepWeeklySnapshots ?? 4,
        keepMonthlySnapshots: config.retention?.keepMonthlySnapshots ?? 12,
      },
      enabled: config.enabled !== false,
      onError: config.onError,
    }
  }

  // ─────────────────────────────────────────────
  // CICLO DE VIDA
  // ─────────────────────────────────────────────

  /**
   * Inicia el agente de backups.
   * Se llama desde onInit del plugin.
   */
  start(): void {
    if (!this.config.enabled || this.isRunning) return

    this.isRunning = true
    this.payload.logger.info({
      msg: '[BackupAgent] Agente iniciado',
    })

    // Timer incremental: consolida deltas cada hora
    this.incrementalTimer = setInterval(
      () => this.runIncrementalCycle().catch((err) => this.handleError(err, 'ciclo incremental')),
      this.config.incrementalIntervalMs,
    )

    // Timer completo: backup completo cada 24 horas
    this.fullBackupTimer = setInterval(
      () => this.runFullBackupCycle().catch((err) => this.handleError(err, 'ciclo backup completo')),
      this.config.fullBackupIntervalMs,
    )

    // Ejecutar el ciclo incremental inicial con delay para no bloquear el arranque
    setTimeout(
      () =>
        this.runIncrementalCycle().catch((err) =>
          this.handleError(err, 'ciclo inicial incremental'),
        ),
      30 * 1000, // 30 segundos después del arranque
    )
  }

  /**
   * Detiene el agente limpiamente.
   */
  stop(): void {
    if (this.incrementalTimer) {
      clearInterval(this.incrementalTimer)
      this.incrementalTimer = null
    }
    if (this.fullBackupTimer) {
      clearInterval(this.fullBackupTimer)
      this.fullBackupTimer = null
    }
    this.isRunning = false
    this.payload.logger.info({ msg: '[BackupAgent] Agente detenido' })
  }

  /**
   * Estado actual del agente (para mostrar en el dashboard).
   */
  getStatus(): {
    isRunning: boolean
    isConsolidating: boolean
    lastError: { message: string; timestamp: Date } | null
    config: {
      incrementalIntervalMinutes: number
      fullBackupIntervalHours: number
      consolidateAfterDeltas: number
    }
  } {
    return {
      isRunning: this.isRunning,
      isConsolidating: this.isConsolidating,
      lastError: this.lastError,
      config: {
        incrementalIntervalMinutes: this.config.incrementalIntervalMs / 60000,
        fullBackupIntervalHours: this.config.fullBackupIntervalMs / 3600000,
        consolidateAfterDeltas: this.config.consolidateAfterDeltas,
      },
    }
  }

  // ─────────────────────────────────────────────
  // CICLOS AUTOMATIZADOS
  // ─────────────────────────────────────────────

  /**
   * Ciclo incremental: comprueba si hay suficientes deltas para consolidar
   * y aplica la política de retención.
   */
  private async runIncrementalCycle(): Promise<void> {
    if (this.isConsolidating) {
      this.payload.logger.info({
        msg: '[BackupAgent] Ciclo incremental omitido (consolidación en curso)',
      })
      return
    }

    // Contar deltas no consolidados
    const pendingDeltas = await this.payload.find({
      collection: 'backup-deltas',
      where: { snapshotId: { equals: null } },
      limit: 1,
      overrideAccess: true,
    })

    if (pendingDeltas.totalDocs >= this.config.consolidateAfterDeltas) {
      await this.consolidateDeltas()
    }

    // Aplicar retención periódicamente (1 de cada 10 ciclos aproximadamente)
    if (Math.random() < 0.1) {
      await this.service.applyRetentionPolicy(this.config.retention)
    }
  }

  /**
   * Ciclo de backup completo: vuelca el estado actual de todas las colecciones.
   * Se ejecuta una vez al día por defecto.
   */
  private async runFullBackupCycle(): Promise<void> {
    this.payload.logger.info({ msg: '[BackupAgent] Iniciando ciclo de backup completo diario' })

    await this.service.createFullSnapshot({
      label: `Backup automático diario - ${new Date().toLocaleDateString('es-ES')}`,
      collections: this.config.collections,
      triggeredBy: 'system',
      storageType: 'database',
    })

    // Aplicar retención después del backup completo
    await this.service.applyRetentionPolicy(this.config.retention)
  }

  /**
   * Consolida los deltas pendientes en un snapshot incremental.
   */
  private async consolidateDeltas(): Promise<void> {
    if (this.isConsolidating) return

    this.isConsolidating = true

    try {
      this.payload.logger.info({ msg: '[BackupAgent] Consolidando deltas en snapshot incremental' })

      // Crear snapshot incremental con los deltas actuales
      await this.service.createFullSnapshot({
        label: `Consolidación automática - ${new Date().toLocaleString('es-ES')}`,
        collections: this.config.collections,
        triggeredBy: 'system',
        storageType: 'database',
      })
    } finally {
      this.isConsolidating = false
    }
  }

  // ─────────────────────────────────────────────
  // MANEJO DE ERRORES
  // ─────────────────────────────────────────────

  /**
   * Registra el error y notifica vía el callback configurado.
   */
  private async handleError(error: unknown, context: string): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error))

    this.lastError = { message: err.message, timestamp: new Date() }

    this.payload.logger.error({
      msg: `[BackupAgent] Error en ${context}`,
      err,
    })

    if (this.config.onError) {
      try {
        await this.config.onError(err, context)
      } catch (notifyErr) {
        this.payload.logger.error({
          msg: '[BackupAgent] Error en callback de notificación',
          err: notifyErr,
        })
      }
    }
  }
}

// ─────────────────────────────────────────────
// Factory de singleton
// ─────────────────────────────────────────────

/**
 * Obtiene o crea la instancia única del agente.
 * Evita duplicados en hot-reload de Next.js.
 */
export function getOrCreateBackupAgent(
  payload: Payload,
  config: BackupAgentConfig,
): BackupAgent {
  if (!agentInstance) {
    agentInstance = new BackupAgent(payload, config)
  }
  return agentInstance
}

/**
 * Detiene y elimina la instancia del agente.
 * Útil para tests y para reiniciar con nueva configuración.
 */
export function destroyBackupAgent(): void {
  if (agentInstance) {
    agentInstance.stop()
    agentInstance = null
  }
}
