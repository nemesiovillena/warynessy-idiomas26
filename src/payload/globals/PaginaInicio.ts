import type { GlobalConfig } from 'payload'

export const PaginaInicio: GlobalConfig = {
  slug: 'pagina-inicio',
  label: 'Página de Inicio',
  access: {
    read: () => true, // Public read access
  },
  fields: [
    // Hero Section
    {
      name: 'heroTitle',
      type: 'text',
      label: 'Título Principal (Hero)',
      required: true,
      admin: {
        description: 'Título principal de la página de inicio',
      },
    },
    {
      name: 'heroSubtitle',
      type: 'textarea',
      label: 'Subtítulo (Hero)',
      admin: {
        description: 'Subtítulo o claim del restaurante',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      label: 'Imagen Hero',
      relationTo: 'archivos',
      required: true,
    },

    // Sección de Bienvenida
    {
      name: 'welcomeTitle',
      type: 'text',
      label: 'Título de Bienvenida',
      admin: {
        description: 'Título de la sección de bienvenida (Historia)',
      },
    },
    {
      name: 'welcomeText',
      type: 'richText',
      label: 'Texto de Bienvenida / Fundación',
      admin: {
        description: 'Historia y filosofía del restaurante',
      },
    },

    // Galería de Bienvenida
    {
      name: 'galeriaInicio',
      type: 'array',
      label: 'Galería de Imágenes Inicio',
      fields: [
        {
          name: 'imagen',
          type: 'upload',
          relationTo: 'archivos',
          required: true,
        },
      ],
      admin: {
        description: 'Galería de imágenes para la página de inicio',
      },
    },

    // CTA (Call to Action)
    {
      name: 'ctaTitle',
      type: 'text',
      label: 'Título del CTA de Reservas',
      admin: {
        description: 'Texto del call to action para reservar',
      },
    },
    {
      name: 'ctaText',
      type: 'textarea',
      label: 'Texto del CTA',
    },
    {
      name: 'ctaButtonText',
      type: 'text',
      label: 'Texto del Botón CTA',
      defaultValue: 'Reservar ahora',
      admin: {
        description: 'Texto del botón de reserva',
      },
    },

    // Galería Regala Gastronomía (fondo)
    {
      name: 'galeriaRegalo',
      type: 'array',
      label: 'Galería Sección Regalo (Fondo)',
      minRows: 4,
      maxRows: 4,
      fields: [
        {
          name: 'imagen',
          type: 'upload',
          relationTo: 'archivos',
          required: true,
        },
      ],
      admin: {
        description: 'Selecciona 4 imágenes para el fondo de la sección "Regala Gastronomía"',
      },
    },

    // Espacios destacados
    {
      name: 'espaciosDestacados',
      type: 'relationship',
      label: 'Espacios Destacados en Home',
      relationTo: 'espacios',
      hasMany: true,
      maxRows: 5,
      admin: {
        description: 'Selecciona los espacios a mostrar en el home',
      },
    },
    // Experiencias destacadas
    {
      name: 'experienciasDestacadas',
      type: 'relationship',
      label: 'Experiencias Destacadas en Home',
      relationTo: 'experiencias',
      hasMany: true,
      maxRows: 3,
      admin: {
        description: 'Selecciona las experiencias a mostrar en el home',
      },
    },

    // SEO
    {
      name: 'seoTitle',
      type: 'text',
      label: 'SEO: Título',
      maxLength: 60,
      admin: {
        description: 'Título para SEO (meta title)',
      },
    },
    {
      name: 'seoDescription',
      type: 'textarea',
      label: 'SEO: Descripción',
      maxLength: 160,
      admin: {
        description: 'Descripción para SEO (meta description)',
      },
    },
  ],
}
