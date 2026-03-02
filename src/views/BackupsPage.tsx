/**
 * BackupsPage
 *
 * Wrapper server component registrado como custom view en el plugin de backups.
 * Payload inyecta las serverProps incluyendo initPageResult que contiene
 * visibleEntities y req, necesarios para que DefaultTemplate renderice
 * correctamente la sidebar con todas las colecciones.
 */

import type { PayloadRequest, VisibleEntities } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { BackupsView } from './BackupsView'

interface InitPageResult {
  req: PayloadRequest
  visibleEntities: VisibleEntities
  permissions: unknown
  locale?: unknown
}

interface BackupsPageProps {
  initPageResult: InitPageResult
  i18n: unknown
  params?: unknown
  payload: unknown
  searchParams?: unknown
  [key: string]: unknown
}

export default function BackupsPage({
  initPageResult,
  i18n,
  params,
  payload,
  searchParams,
}: BackupsPageProps) {
  const { req, visibleEntities, permissions, locale } = initPageResult

  return (
    <DefaultTemplate
      i18n={i18n as any}
      locale={locale as any}
      params={params as any}
      payload={payload as any}
      permissions={permissions as any}
      req={req}
      searchParams={searchParams as any}
      user={req.user as any}
      visibleEntities={{
        collections: visibleEntities?.collections,
        globals: visibleEntities?.globals,
      }}
    >
      <BackupsView />
    </DefaultTemplate>
  )
}
