/**
 * BackupList
 *
 * Componente React que muestra la tabla de snapshots de backup.
 * Incluye controles para restaurar y eliminar cada backup.
 *
 * Es un Client Component (no lleva 'use client' propio porque
 * está embebido dentro de BackupsView que ya lo declara).
 */

import React from 'react'

// ─────────────────────────────────────────────
// Tipos
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

interface BackupListProps {
  snapshots: SnapshotSummary[]
  onRestore: (snapshotId: string) => void
  onDelete: (snapshotId: string) => void
  disabled?: boolean
}

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

export const BackupList: React.FC<BackupListProps> = ({
  snapshots,
  onRestore,
  onDelete,
  disabled = false,
}) => {
  if (snapshots.length === 0) {
    return (
      <div
        style={{
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--theme-text)',
          opacity: 0.6,
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💾</div>
        <p style={{ fontSize: '1rem', fontWeight: 500 }}>No hay backups disponibles</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Crea el primer backup usando el botón "Backup completo manual"
        </p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem',
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: '2px solid var(--theme-elevation-150)',
              textAlign: 'left',
            }}
          >
            <Th>Etiqueta</Th>
            <Th>Tipo</Th>
            <Th>Estado</Th>
            <Th>Fecha</Th>
            <Th>Tamaño</Th>
            <Th>Cambios</Th>
            <Th>Iniciado por</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((snapshot) => (
            <tr
              key={snapshot.id}
              style={{
                borderBottom: '1px solid var(--theme-elevation-100)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLTableRowElement).style.background =
                  'var(--theme-elevation-50)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLTableRowElement).style.background = ''
              }}
            >
              <Td>
                <span style={{ fontWeight: 500 }}>{snapshot.label}</span>
                <br />
                <span style={{ fontSize: '0.75rem', opacity: 0.6, fontFamily: 'monospace' }}>
                  {snapshot.id}
                </span>
              </Td>

              <Td>
                <span style={typeBadgeStyle(snapshot.type)}>{typeLabel(snapshot.type)}</span>
              </Td>

              <Td>
                <span style={statusBadgeStyle(snapshot.status)}>{statusLabel(snapshot.status)}</span>
              </Td>

              <Td>
                {new Date(snapshot.createdAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Td>

              <Td>{snapshot.sizeBytes ? formatBytes(snapshot.sizeBytes) : '—'}</Td>

              <Td>
                {snapshot.deltaCount > 0 ? (
                  <span style={{ fontWeight: 600 }}>{snapshot.deltaCount}</span>
                ) : (
                  '—'
                )}
              </Td>

              <Td>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  {snapshot.triggeredBy === 'admin' ? '👤' : '🤖'}
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                    {snapshot.triggeredByEmail ?? (snapshot.triggeredBy === 'admin' ? 'Admin' : 'Sistema')}
                  </span>
                </span>
              </Td>

              <Td>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {/* Botón de restaurar: solo para backups completados */}
                  {snapshot.status === 'completed' && (
                    <button
                      onClick={() => onRestore(snapshot.id)}
                      disabled={disabled}
                      title="Restaurar este backup"
                      style={actionButtonStyle('#2563eb', disabled)}
                    >
                      ↩ Restaurar
                    </button>
                  )}

                  {/* Botón de eliminar */}
                  <button
                    onClick={() => onDelete(snapshot.id)}
                    disabled={disabled || snapshot.retentionPolicy === 'permanent'}
                    title={
                      snapshot.retentionPolicy === 'permanent'
                        ? 'Este backup está marcado como permanente'
                        : 'Eliminar este backup'
                    }
                    style={actionButtonStyle(
                      '#dc2626',
                      disabled || snapshot.retentionPolicy === 'permanent',
                    )}
                  >
                    🗑 Eliminar
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────
// Componentes de celdas de tabla
// ─────────────────────────────────────────────

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th
    style={{
      padding: '0.75rem 1rem',
      fontWeight: 600,
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      opacity: 0.7,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </th>
)

const Td: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>{children}</td>
)

// ─────────────────────────────────────────────
// Utilidades de formato y estilo
// ─────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function typeLabel(type: SnapshotSummary['type']): string {
  const labels: Record<SnapshotSummary['type'], string> = {
    full: 'Completo',
    incremental: 'Incremental',
    weekly: 'Semanal',
    monthly: 'Mensual',
    manual: 'Manual',
  }
  return labels[type] ?? type
}

function statusLabel(status: SnapshotSummary['status']): string {
  const labels: Record<SnapshotSummary['status'], string> = {
    pending: '⏳ Pendiente',
    processing: '⚙️ Procesando',
    completed: '✅ Completado',
    error: '❌ Error',
    restored: '↩ Restaurado',
  }
  return labels[status] ?? status
}

function typeBadgeStyle(type: SnapshotSummary['type']): React.CSSProperties {
  const colors: Record<string, string> = {
    full: '#dbeafe',
    incremental: '#dcfce7',
    weekly: '#fef3c7',
    monthly: '#f3e8ff',
    manual: '#fee2e2',
  }
  const textColors: Record<string, string> = {
    full: '#1e40af',
    incremental: '#166534',
    weekly: '#92400e',
    monthly: '#6b21a8',
    manual: '#991b1b',
  }
  return {
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: colors[type] ?? '#f3f4f6',
    color: textColors[type] ?? '#374151',
  }
}

function statusBadgeStyle(status: SnapshotSummary['status']): React.CSSProperties {
  const colors: Record<string, string> = {
    pending: '#fef3c7',
    processing: '#dbeafe',
    completed: '#dcfce7',
    error: '#fee2e2',
    restored: '#f3e8ff',
  }
  const textColors: Record<string, string> = {
    pending: '#92400e',
    processing: '#1e40af',
    completed: '#166534',
    error: '#991b1b',
    restored: '#6b21a8',
  }
  return {
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 500,
    background: colors[status] ?? '#f3f4f6',
    color: textColors[status] ?? '#374151',
    whiteSpace: 'nowrap',
  }
}

function actionButtonStyle(color: string, disabled: boolean): React.CSSProperties {
  return {
    padding: '0.3rem 0.6rem',
    borderRadius: '4px',
    border: `1px solid ${color}`,
    background: 'transparent',
    color: disabled ? '#9ca3af' : color,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.75rem',
    fontWeight: 500,
    opacity: disabled ? 0.5 : 1,
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  }
}
