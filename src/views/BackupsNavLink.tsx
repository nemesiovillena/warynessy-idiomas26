'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BackupsNavLink() {
  const pathname = usePathname()
  const isActive = pathname?.startsWith('/admin/backups')

  return (
    <div className="nav__group">
      <Link
        href="/admin/backups"
        className="nav__link"
        prefetch={false}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.375rem 1.25rem',
          borderRadius: '4px',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: isActive ? 600 : 400,
          color: isActive ? 'var(--theme-text)' : 'var(--theme-text)',
          background: isActive ? 'var(--theme-elevation-100)' : 'transparent',
          transition: 'background 0.15s',
        }}
      >
        💾 Copias de Seguridad
      </Link>
    </div>
  )
}
