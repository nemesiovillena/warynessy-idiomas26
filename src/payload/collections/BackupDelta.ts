/**
 * Colección: BackupDelta
 *
 * Registra cada cambio individual (delta) capturado por los hooks de Payload.
 * Cada documento representa una operación atómica (create/update/delete)
 * realizada sobre cualquier colección o global monitorizado.
 *
 * Esta tabla actúa como el "log de transacciones" del sistema de backups.
 * Los deltas se consolidan periódicamente en snapshots completos por el BackupAgent.
 */

import type { CollectionConfig } from 'payload'

export const BackupDelta: CollectionConfig = {
  slug: 'backup-deltas',

  labels: {
    singular: 'Delta de Backup',
    plural: 'Deltas de Backup',
  },

  // Solo los administradores pueden ver y gestionar backups
  access: {
    create: ({ req: { user } }) => (user as any)?.role === 'admin',
    read: ({ req: { user } }) => (user as any)?.role === 'admin',
    update: ({ req: { user } }) => (user as any)?.role === 'admin',
    delete: ({ req: { user } }) => (user as any)?.role === 'admin',
  },

  admin: {
    useAsTitle: 'collectionSlug',
    defaultColumns: ['collectionSlug', 'operation', 'documentId', 'capturedAt', 'authorEmail'],
    group: 'Sistema',
    // Ocultar del menú principal (se accede desde la vista de Backups)
    hidden: true,
  },

  // No necesitamos timestamps de Payload, usamos nuestro propio campo capturedAt
  timestamps: false,

  fields: [
    // Colección o global afectada (ej: 'platos', 'menus', 'paginaInicio')
    {
      name: 'collectionSlug',
      type: 'text',
      required: true,
      label: 'Colección',
      index: true,
    },

    // Tipo de recurso: colección normal o global singleton
    {
      name: 'resourceType',
      type: 'select',
      required: true,
      label: 'Tipo de recurso',
      options: [
        { label: 'Colección', value: 'collection' },
        { label: 'Global', value: 'global' },
      ],
      defaultValue: 'collection',
    },

    // ID del documento afectado (null para globals)
    {
      name: 'documentId',
      type: 'text',
      label: 'ID del documento',
      index: true,
    },

    // Tipo de operación: create, update, delete
    {
      name: 'operation',
      type: 'select',
      required: true,
      label: 'Operación',
      options: [
        { label: 'Creación', value: 'create' },
        { label: 'Actualización', value: 'update' },
        { label: 'Eliminación', value: 'delete' },
      ],
      index: true,
    },

    // Estado completo del documento ANTES del cambio (null para creates)
    {
      name: 'previousData',
      type: 'json',
      label: 'Estado anterior',
      admin: {
        description: 'Estado del documento antes del cambio. Null en operaciones de creación.',
      },
    },

    // Estado completo del documento DESPUÉS del cambio (null para deletes)
    {
      name: 'currentData',
      type: 'json',
      label: 'Estado actual',
      admin: {
        description: 'Estado del documento tras el cambio. Null en operaciones de eliminación.',
      },
    },

    // Solo los campos que cambiaron (diff ligero para updates)
    {
      name: 'changedFields',
      type: 'json',
      label: 'Campos modificados',
      admin: {
        description: 'Array con los nombres de los campos que cambiaron en esta operación.',
      },
    },

    // Metadatos del autor del cambio
    {
      name: 'authorId',
      type: 'text',
      label: 'ID del autor',
      index: true,
    },
    {
      name: 'authorEmail',
      type: 'email',
      label: 'Email del autor',
    },

    // Timestamp preciso de cuándo se capturó el delta
    {
      name: 'capturedAt',
      type: 'date',
      required: true,
      label: 'Capturado el',
      index: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },

    // Referencia al snapshot al que pertenece este delta (null si no consolidado)
    {
      name: 'snapshotId',
      type: 'text',
      label: 'Snapshot ID',
      index: true,
      admin: {
        description: 'ID del snapshot (backup completo) que incluye este delta.',
      },
    },

    // Hash de integridad del contenido (SHA-256 del JSON)
    {
      name: 'contentHash',
      type: 'text',
      label: 'Hash de integridad',
      admin: {
        description: 'SHA-256 del contenido para verificar integridad del delta.',
      },
    },
  ],
}
