/**
 * Colección: BackupSnapshot
 *
 * Registra los metadatos de cada "snapshot" o punto de restauración del sistema.
 * Un snapshot puede ser:
 *   - FULL: volcado completo de todas las colecciones en un momento dado
 *   - INCREMENTAL: conjunto de deltas desde el último snapshot
 *
 * El contenido real del backup puede almacenarse:
 *   - En el campo 'data' (JSON en la propia BD PostgreSQL) — para proyectos pequeños
 *   - En un archivo local comprimido (ruta en 'storagePath')
 *   - En S3/Bunny CDN (URL en 'storageUrl')
 *
 * La política de retención la gestiona el BackupAgent.
 */

import type { CollectionConfig } from 'payload'

export const BackupSnapshot: CollectionConfig = {
  slug: 'backup-snapshots',

  labels: {
    singular: 'Snapshot de Backup',
    plural: 'Snapshots de Backup',
  },

  access: {
    create: ({ req: { user } }) => (user as any)?.role === 'admin',
    read: ({ req: { user } }) => (user as any)?.role === 'admin',
    update: ({ req: { user } }) => (user as any)?.role === 'admin',
    delete: ({ req: { user } }) => (user as any)?.role === 'admin',
  },

  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'type', 'status', 'createdAt', 'sizeBytes', 'deltaCount'],
    group: 'Sistema',
    hidden: true, // Se accede desde la vista personalizada de Backups
  },

  timestamps: true,

  fields: [
    // Etiqueta legible por humanos (ej: "Backup diario 2026-03-02 03:00")
    {
      name: 'label',
      type: 'text',
      required: true,
      label: 'Etiqueta',
    },

    // Tipo de backup
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'Tipo',
      options: [
        { label: 'Completo (Full)', value: 'full' },
        { label: 'Incremental', value: 'incremental' },
        { label: 'Semanal', value: 'weekly' },
        { label: 'Mensual', value: 'monthly' },
        { label: 'Manual', value: 'manual' },
      ],
      index: true,
    },

    // Estado del backup
    {
      name: 'status',
      type: 'select',
      required: true,
      label: 'Estado',
      defaultValue: 'pending',
      options: [
        { label: 'Pendiente', value: 'pending' },
        { label: 'En proceso', value: 'processing' },
        { label: 'Completado', value: 'completed' },
        { label: 'Error', value: 'error' },
        { label: 'Restaurado', value: 'restored' },
      ],
      index: true,
    },

    // Cuántos deltas incluye este snapshot
    {
      name: 'deltaCount',
      type: 'number',
      label: 'Nº de cambios',
      defaultValue: 0,
      admin: {
        description: 'Número de deltas (cambios individuales) incluidos en este snapshot.',
      },
    },

    // Colecciones incluidas en este snapshot
    {
      name: 'collections',
      type: 'json',
      label: 'Colecciones incluidas',
      admin: {
        description: 'Array de slugs de colecciones incluidas en este backup.',
      },
    },

    // Resumen de estadísticas: cuántos documentos de cada colección
    {
      name: 'stats',
      type: 'json',
      label: 'Estadísticas',
      admin: {
        description: 'Resumen de documentos por colección: { "platos": 45, "menus": 3, ... }',
      },
    },

    // Tamaño aproximado del backup en bytes
    {
      name: 'sizeBytes',
      type: 'number',
      label: 'Tamaño (bytes)',
    },

    // Almacenamiento: JSON inline en la BD (para backups pequeños < 10MB)
    {
      name: 'data',
      type: 'json',
      label: 'Datos del backup',
      admin: {
        description:
          'Contenido serializado del backup. Solo para backups almacenados en la BD.',
        condition: (data) => data.storageType === 'database',
      },
    },

    // Tipo de almacenamiento
    {
      name: 'storageType',
      type: 'select',
      required: true,
      label: 'Tipo de almacenamiento',
      defaultValue: 'database',
      options: [
        { label: 'Base de datos (PostgreSQL)', value: 'database' },
        { label: 'Archivo local', value: 'local' },
        { label: 'S3 / Bunny CDN', value: 's3' },
      ],
    },

    // Ruta al archivo local (si storageType === 'local')
    {
      name: 'storagePath',
      type: 'text',
      label: 'Ruta del archivo',
      admin: {
        condition: (data) => data.storageType === 'local',
      },
    },

    // URL del archivo en S3/CDN (si storageType === 's3')
    {
      name: 'storageUrl',
      type: 'text',
      label: 'URL de almacenamiento',
      admin: {
        condition: (data) => data.storageType === 's3',
      },
    },

    // Hash SHA-256 del contenido completo para verificar integridad
    {
      name: 'contentHash',
      type: 'text',
      label: 'Hash de integridad (SHA-256)',
    },

    // Timestamp del período que cubre este snapshot (inicio y fin)
    {
      name: 'periodStart',
      type: 'date',
      label: 'Inicio del período',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'periodEnd',
      type: 'date',
      label: 'Fin del período',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },

    // Quién disparó el backup (sistema o usuario)
    {
      name: 'triggeredBy',
      type: 'select',
      label: 'Iniciado por',
      options: [
        { label: 'Sistema (automático)', value: 'system' },
        { label: 'Administrador (manual)', value: 'admin' },
      ],
      defaultValue: 'system',
    },
    {
      name: 'triggeredByEmail',
      type: 'email',
      label: 'Email del iniciador',
    },

    // Mensaje de error si status === 'error'
    {
      name: 'errorMessage',
      type: 'textarea',
      label: 'Mensaje de error',
      admin: {
        condition: (data) => data.status === 'error',
      },
    },

    // Política de retención aplicada a este backup
    {
      name: 'retentionPolicy',
      type: 'select',
      label: 'Política de retención',
      options: [
        { label: 'Normal (30 deltas)', value: 'normal' },
        { label: 'Semanal (conservar 4 semanas)', value: 'weekly' },
        { label: 'Mensual (conservar 12 meses)', value: 'monthly' },
        { label: 'Permanente', value: 'permanent' },
      ],
      defaultValue: 'normal',
    },
  ],
}
