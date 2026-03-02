/**
 * BackupsView
 *
 * Vista personalizada del panel de administración para gestionar backups.
 * Se registra como una custom view en la config de Payload y aparece
 * en la sidebar como "Copias de Seguridad".
 *
 * Es un Client Component ('use client') para poder usar useState/useEffect
 * y hacer llamadas a los endpoints REST del plugin.
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { BackupList } from '../components/BackupList'

// ─────────────────────────────────────────────
// Tipos de datos que vienen de la API
// ─────────────────────────────────────────────

interface SnapshotSummary {
  id: string
  label: string
  type: 'full' | 'incremental' | 'weekly' | 'monthly' | 'manual'
  status: 'pending' | 'processing' | 'completed' | 'error' | 'restored'
  createdAt: string
  sizeBytes: number | null
  deltaCount: number
  triggeredBy: 'system' | 'admin'
  triggeredByEmail?: string
  retentionPolicy: string
}

interface BackupStats {
  totalDeltas: number
  deltasByCollection: Record<string, number>
  totalSnapshots: number
  lastSnapshotAt: string | null
  agentStatus?: {
    isRunning: boolean
    isConsolidating: boolean
    lastError: { message: string; timestamp: string } | null
  }
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export const BackupsView: React.FC = () => {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([])
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)

  // ─────────────────────────────────────────────
  // Carga de datos
  // ─────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [snapshotsRes, statsRes] = await Promise.all([
        fetch('/api/backup-plugin/snapshots'),
        fetch('/api/backup-plugin/stats'),
      ])

      if (!snapshotsRes.ok || !statsRes.ok) {
        throw new Error('Error al cargar datos del servidor')
      }

      const [snapshotsData, statsData] = await Promise.all([
        snapshotsRes.json(),
        statsRes.json(),
      ])

      setSnapshots(snapshotsData.docs ?? [])
      setStats(statsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ─────────────────────────────────────────────
  // Acciones del usuario
  // ─────────────────────────────────────────────

  /** Lanza un backup completo manual */
  const handleCreateFullBackup = async () => {
    if (
      !confirm(
        '¿Crear un backup completo ahora?\n\nEsto puede tardar unos segundos dependiendo del volumen de datos.',
      )
    ) {
      return
    }

    setActionLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const res = await fetch('/api/backup-plugin/create-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Error al crear el backup')
      }

      setSuccessMessage(`Backup completo creado correctamente (ID: ${data.snapshotId})`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el backup')
    } finally {
      setActionLoading(false)
    }
  }

  /** Inicia el proceso de restauración (requiere confirmación en dos pasos) */
  const handleRestoreClick = (snapshotId: string) => {
    setConfirmRestore(snapshotId)
  }

  /** Ejecuta la restauración tras la confirmación */
  const handleConfirmRestore = async () => {
    if (!confirmRestore) return

    setConfirmRestore(null)
    setActionLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const res = await fetch(`/api/backup-plugin/restore/${confirmRestore}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Error durante la restauración')
      }

      setSuccessMessage(
        `Restauración completada: ${data.restoredCount} documentos restaurados. ${data.errors?.length > 0 ? `⚠️ ${data.errors.length} errores.` : ''}`,
      )
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la restauración')
    } finally {
      setActionLoading(false)
    }
  }

  /** Elimina un snapshot */
  const handleDeleteSnapshot = async (snapshotId: string) => {
    if (!confirm('¿Eliminar este backup permanentemente? Esta acción no se puede deshacer.')) {
      return
    }

    setActionLoading(true)

    try {
      const res = await fetch(`/api/backup-plugin/snapshots/${snapshotId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al eliminar el backup')
      }

      setSuccessMessage('Backup eliminado correctamente')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el backup')
    } finally {
      setActionLoading(false)
    }
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── Cabecera ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          borderBottom: '1px solid var(--theme-elevation-150)',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Copias de Seguridad
          </h1>
          <p style={{ color: 'var(--theme-text)', opacity: 0.7, fontSize: '0.875rem' }}>
            Sistema de backups granulares e incrementales
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={loadData}
            disabled={loading || actionLoading}
            style={buttonStyle('secondary')}
          >
            {loading ? 'Cargando...' : '↻ Actualizar'}
          </button>
          <button
            onClick={handleCreateFullBackup}
            disabled={actionLoading || loading}
            style={buttonStyle('primary')}
          >
            {actionLoading ? 'Procesando...' : '+ Backup completo manual'}
          </button>
        </div>
      </div>

      {/* ── Mensajes de estado ── */}
      {error && (
        <div style={alertStyle('error')}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {successMessage && (
        <div style={alertStyle('success')}>
          <strong>✓</strong> {successMessage}
        </div>
      )}

      {/* ── Modal de confirmación de restauración ── */}
      {confirmRestore && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
              ⚠️ Confirmar Restauración
            </h2>
            <p style={{ marginBottom: '1rem', lineHeight: 1.6 }}>
              Estás a punto de restaurar el sistema al estado de este backup. Esta operación:
            </p>
            <ul style={{ marginLeft: '1.5rem', marginBottom: '1.5rem', lineHeight: 1.8 }}>
              <li>Sobrescribirá los documentos actuales con los del backup</li>
              <li>No eliminará documentos creados después del backup</li>
              <li>Es una operación potencialmente destructiva</li>
            </ul>
            <p style={{ fontWeight: 600, marginBottom: '1.5rem' }}>
              ¿Estás seguro de que quieres continuar?
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmRestore(null)} style={buttonStyle('secondary')}>
                Cancelar
              </button>
              <button
                onClick={handleConfirmRestore}
                style={{ ...buttonStyle('primary'), background: '#dc2626' }}
              >
                Sí, restaurar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tarjetas de estadísticas ── */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <StatCard title="Total de cambios" value={stats.totalDeltas.toString()} icon="📝" />
          <StatCard title="Snapshots totales" value={stats.totalSnapshots.toString()} icon="💾" />
          <StatCard
            title="Último backup"
            value={
              stats.lastSnapshotAt
                ? new Date(stats.lastSnapshotAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Nunca'
            }
            icon="🕐"
          />
          <StatCard
            title="Estado del agente"
            value={stats.agentStatus?.isRunning ? 'Activo' : 'Inactivo'}
            icon={stats.agentStatus?.isRunning ? '🟢' : '🔴'}
            subtitle={
              stats.agentStatus?.isConsolidating
                ? 'Consolidando...'
                : stats.agentStatus?.lastError
                  ? `⚠️ ${stats.agentStatus.lastError.message}`
                  : undefined
            }
          />
        </div>
      )}

      {/* ── Cambios por colección ── */}
      {stats && Object.keys(stats.deltasByCollection).length > 0 && (
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Cambios por colección</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {Object.entries(stats.deltasByCollection).map(([slug, count]) => (
              <span key={slug} style={badgeStyle}>
                {slug}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Lista de backups ── */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Backups disponibles</h2>
        {loading ? (
          <p style={{ color: 'var(--theme-text)', opacity: 0.6 }}>Cargando backups...</p>
        ) : (
          <BackupList
            snapshots={snapshots}
            onRestore={handleRestoreClick}
            onDelete={handleDeleteSnapshot}
            disabled={actionLoading}
          />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Componente auxiliar: tarjeta de estadística
// ─────────────────────────────────────────────

const StatCard: React.FC<{
  title: string
  value: string
  icon: string
  subtitle?: string
}> = ({ title, value, icon, subtitle }) => (
  <div
    style={{
      background: 'var(--theme-elevation-50)',
      border: '1px solid var(--theme-elevation-150)',
      borderRadius: '8px',
      padding: '1rem',
    }}
  >
    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
    <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.25rem' }}>{title}</div>
    <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{value}</div>
    {subtitle && (
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.25rem' }}>{subtitle}</div>
    )}
  </div>
)

// ─────────────────────────────────────────────
// Estilos inline (compatible con el tema de Payload)
// ─────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--theme-elevation-0)',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '8px',
  padding: '1.5rem',
  marginBottom: '1.5rem',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: '1rem',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid var(--theme-elevation-100)',
}

const badgeStyle: React.CSSProperties = {
  background: 'var(--theme-elevation-100)',
  borderRadius: '4px',
  padding: '0.25rem 0.75rem',
  fontSize: '0.875rem',
}

const buttonStyle = (variant: 'primary' | 'secondary'): React.CSSProperties => ({
  padding: '0.5rem 1rem',
  borderRadius: '6px',
  border: variant === 'secondary' ? '1px solid var(--theme-elevation-200)' : 'none',
  background:
    variant === 'primary' ? 'var(--theme-success-500, #2563eb)' : 'var(--theme-elevation-100)',
  color: variant === 'primary' ? '#fff' : 'var(--theme-text)',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
  transition: 'opacity 0.2s',
})

const alertStyle = (type: 'error' | 'success'): React.CSSProperties => ({
  padding: '0.75rem 1rem',
  borderRadius: '6px',
  marginBottom: '1rem',
  background: type === 'error' ? '#fef2f2' : '#f0fdf4',
  color: type === 'error' ? '#dc2626' : '#166534',
  border: `1px solid ${type === 'error' ? '#fecaca' : '#bbf7d0'}`,
  fontSize: '0.875rem',
})

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
}

const modalStyle: React.CSSProperties = {
  background: 'var(--theme-elevation-0)',
  borderRadius: '12px',
  padding: '2rem',
  maxWidth: '480px',
  width: '90%',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
}
