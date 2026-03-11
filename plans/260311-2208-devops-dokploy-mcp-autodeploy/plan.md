# Plan: DevOps — Dokploy Auto-Deploy via MCP

**Fecha:** 2026-03-11
**Slug:** devops-dokploy-mcp-autodeploy
**Prioridad:** ALTA
**Estado:** ✅ Completado (2026-03-11)

---

## Contexto

El proyecto Warynessy tiene 2 aplicaciones en Dokploy (producción):
- `payload` (Next.js + Payload CMS) — app principal con autoDeploy activo via GitHub App
- `translation-agent` (FastAPI Python) — agente de traducción con custom git (sin GitHub App)

El CI/CD actual (`ci-cd-payload.yml`) tiene 4 jobs pero el job de **deploy es solo informativo** — imprime instrucciones manuales. El objetivo es completar el ciclo añadiendo deploy automático real usando el MCP de Dokploy.

## Objetivo

Automatizar el deploy desde GitHub Actions usando el **webhook de Dokploy** para triggerear re-deploys post-CI.

---

## Estado Actual

| App | Source | AutoDeploy | Dominios |
|-----|--------|------------|---------|
| `payload` | GitHub App (nemesiovillena/warynessy-idiomas26, branch: main) | ✅ Activo | warynessy.com, www.warynessy.com |
| `translation-agent` | Custom Git (HTTPS, branch: main, path: /services/translation-agent) | ✅ Activo | Sin dominio público |

**Situación real:**
- `payload` ya tiene `autoDeploy: true` vía GitHub App → ya se auto-despliega en push a main
- `translation-agent` usa custom git → también tiene `autoDeploy: true` pero su webhook no está integrado en CI/CD
- El CI/CD pipeline actual **no activa ningún deploy** — es puramente verificación

---

## Fases

### Phase 1: Integrar webhook de Dokploy en el CI/CD pipeline
- [Detalle →](./phase-01-webhook-dokploy-en-cicd.md)
- **Estado:** 🟡 Pendiente
- **Esfuerzo:** ~1h

### Phase 2: Configurar dominio + health check para translation-agent
- [Detalle →](./phase-02-translation-agent-dominio-health.md)
- **Estado:** 🟡 Pendiente
- **Esfuerzo:** ~30min

---

## Dependencias

- Phase 1 → Phase 2 (independientes, pueden hacerse en cualquier orden)

## Riesgos

- Dokploy `payload` ya auto-deploya vía GitHub App, integrar webhook podría causar doble deploy → **mitigación:** usar `refreshToken` de Dokploy solo para `translation-agent` en el CI/CD
- La `translation-agent` no tiene dominio público → healthcheck post-deploy no es posible externamente

## Links Relacionados

- [CI/CD Pipeline doc](../../docs/ci-cd-pipeline.md)
- [Workflow actual](.github/workflows/ci-cd-payload.yml)
- Dokploy proyecto ID: `lntkkfjp31i-jGaRnzlZy`
- App payload ID: `lmXdN12f4gz89axMWZ6e8` (refreshToken: `4-eqs6HuOAS_iwBCktwpb`)
- App translation-agent ID: `HbxY8PMKXumsvLBaLQEnT` (refreshToken: `DCrnGXNceEoKVOXvrBJG8`)
