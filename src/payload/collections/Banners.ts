import type { CollectionConfig } from 'payload'

export const Banners: CollectionConfig = {
  slug: 'banners',
  labels: {
    singular: 'Banner',
    plural: 'Banners',
  },
  admin: {
    useAsTitle: 'titulo',
    defaultColumns: ['titulo', 'posicion', 'activo', 'fechaInicio', 'fechaFin'],
    group: 'Contenido',
  },
  access: {
    read: () => true, // Public read access
  },
  fields: [
    {
      name: 'titulo',
      type: 'text',
      label: 'Título del Banner',
      required: true,
      localized: true,
    },
    {
      name: 'texto',
      type: 'textarea',
      label: 'Texto del Banner',
      localized: true,
      admin: {
        description: 'Texto descriptivo del anuncio',
      },
    },
    {
      name: 'imagen',
      type: 'upload',
      label: 'Imagen del Banner',
      relationTo: 'archivos',
    },
    {
      name: 'link',
      type: 'group',
      label: 'Enlace (opcional)',
      fields: [
        {
          name: 'url',
          type: 'text',
          label: 'URL',
        },
        {
          name: 'texto',
          type: 'text',
          label: 'Texto del enlace',
        },
        {
          name: 'externo',
          type: 'checkbox',
          label: '¿Link externo?',
          defaultValue: false,
          admin: {
            description: 'Se abrirá en nueva pestaña',
          },
        },
      ],
    },
    {
      name: 'fechaInicio',
      type: 'date',
      label: 'Fecha de Inicio',
      required: true,
      admin: {
        description: 'Fecha desde la que se muestra el banner',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'fechaFin',
      type: 'date',
      label: 'Fecha de Fin',
      required: true,
      admin: {
        description: 'Fecha hasta la que se muestra el banner',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'posicion',
      type: 'select',
      label: 'Posición en la Web',
      required: true,
      options: [
        { label: 'Home - Superior', value: 'home-top' },
        { label: 'Home - Medio', value: 'home-middle' },
        { label: 'Home - Inferior', value: 'home-bottom' },
        { label: 'Carta - Superior', value: 'carta-top' },
        { label: 'Menús - Superior', value: 'menus-top' },
        { label: 'Global - Banner superior', value: 'global-top' },
      ],
      admin: {
        description: 'Dónde se mostrará el banner',
      },
    },
    {
      name: 'tipo',
      type: 'select',
      label: 'Tipo de Banner',
      options: [
        { label: 'Informativo', value: 'info' },
        { label: 'Promoción', value: 'promo' },
        { label: 'Aviso', value: 'warning' },
        { label: 'Evento', value: 'event' },
      ],
      admin: {
        description: 'Tipo de banner para aplicar estilos',
      },
    },
    {
      name: 'activo',
      type: 'checkbox',
      label: '¿Activo?',
      defaultValue: true,
      admin: {
        description: 'Activa o desactiva el banner manualmente',
      },
    },
    {
      name: 'prioridad',
      type: 'number',
      label: 'Prioridad',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Orden si hay múltiples banners (mayor número = mayor prioridad)',
      },
    },
  ],
  defaultSort: '-prioridad',
}
