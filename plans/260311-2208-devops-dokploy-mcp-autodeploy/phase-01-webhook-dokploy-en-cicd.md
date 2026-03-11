# Phase 01: Integrar webhook de Dokploy en CI/CD

**Prioridad:** ALTA
**Estado:** 🟡 Pendiente
**Esfuerzo estimado:** ~1h

---

## Contexto

El job `deploy` en `.github/workflows/ci-cd-payload.yml` actualmente solo imprime instrucciones manuales. Dokploy expone un endpoint webhook por aplicación para triggerear re-deploys.

## Análisis

### ¿Por qué no usar el GitHub App de Dokploy directamente?

La app `payload` ya tiene `autoDeploy: true` vía GitHub App de Dokploy y se despliega sola en push a `main`. **El problema:** el deploy ocurre antes de que pase el CI/CD (verify, migrate). Con el webhook podemos controlar cuándo se despliega.

**Opciones:**
1. **Desactivar autoDeploy + usar webhook desde CI** → Control total, deploy solo si CI pasa ✅
2. **Mantener autoDeploy + añadir webhook** → Doble deploy, ineficiente ❌

→ **Opción elegida: Opción 1** para `payload`. Para `translation-agent` también usar webhook.

### URL del webhook de Dokploy

Dokploy usa el `refreshToken` de cada aplicación como autenticación del webhook:

```
POST https://<DOKPLOY_HOST>/api/deploy.redeploy
Body: { "refreshToken": "<TOKEN>" }
```

Los tokens ya están en el plan.md:
- `payload` refreshToken: `4-eqs6HuOAS_iwBCktwpb`
- `translation-agent` refreshToken: `DCrnGXNceEoKVOXvrBJG8`

La URL base del servidor Dokploy hay que obtenerla (no está en los datos del MCP).

---

## Pasos de Implementación

### 1. Obtener la URL del servidor Dokploy

Necesitamos saber el host de Dokploy. Verificar en el `.env` del proyecto o en los logs previos.

```bash
# Buscar referencias a la URL de Dokploy en el proyecto
grep -r "dokploy" .env* --include="*.env*" 2>/dev/null
grep -r "DOKPLOY" .github/ 2>/dev/null
```

### 2. Desactivar autoDeploy en la app `payload` via MCP

Usar el MCP de Dokploy:
```
application-update(applicationId: "lmXdN12f4gz89axMWZ6e8", autoDeploy: false)
```

Esto asegura que el deploy solo ocurre cuando CI lo triggerea explícitamente.

### 3. Añadir secrets en GitHub

En el repositorio `nemesiovillena/warynessy-idiomas26` → Settings → Secrets:

| Secret | Valor |
|--------|-------|
| `DOKPLOY_WEBHOOK_URL` | `https://<DOKPLOY_HOST>/api/deploy.redeploy` |
| `DOKPLOY_PAYLOAD_TOKEN` | `4-eqs6HuOAS_iwBCktwpb` |
| `DOKPLOY_TRANSLATION_TOKEN` | `DCrnGXNceEoKVOXvrBJG8` |

### 4. Modificar `.github/workflows/ci-cd-payload.yml`

Reemplazar el step `🚀 Trigger de Dokploy (manual)` por llamadas reales al webhook:

```yaml
- name: 🚀 Deploy payload a Dokploy
  run: |
    echo "🚀 Triggerando deploy de payload en Dokploy..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${{ secrets.DOKPLOY_WEBHOOK_URL }}" \
      -H "Content-Type: application/json" \
      -d '{"refreshToken": "${{ secrets.DOKPLOY_PAYLOAD_TOKEN }}"}')

    if [ "$RESPONSE" -eq 200 ]; then
      echo "✅ Deploy de payload triggerado (HTTP $RESPONSE)"
    else
      echo "❌ Error al triggerear deploy (HTTP $RESPONSE)"
      exit 1
    fi

- name: 🚀 Deploy translation-agent a Dokploy
  run: |
    echo "🚀 Triggerando deploy de translation-agent en Dokploy..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${{ secrets.DOKPLOY_WEBHOOK_URL }}" \
      -H "Content-Type: application/json" \
      -d '{"refreshToken": "${{ secrets.DOKPLOY_TRANSLATION_TOKEN }}"}')

    if [ "$RESPONSE" -eq 200 ]; then
      echo "✅ Deploy de translation-agent triggerado (HTTP $RESPONSE)"
    else
      echo "❌ Error al triggerear deploy (HTTP $RESPONSE)"
      exit 1
    fi
```

### 5. Añadir step de health check post-deploy

Solo para `payload` (tiene dominio público):

```yaml
- name: 🏥 Health check post-deploy
  run: |
    echo "⏳ Esperando que la app arranque (60s)..."
    sleep 60

    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://warynessy.com/ --max-time 30)
    if [ "$RESPONSE" -eq 200 ]; then
      echo "✅ Health check OK (HTTP $RESPONSE)"
    else
      echo "⚠️ Health check fallido (HTTP $RESPONSE) — verificar manualmente"
    fi
```

---

## Archivos a Modificar

- `.github/workflows/ci-cd-payload.yml` — Reemplazar job `deploy`

## Todo

- [ ] Obtener URL del host de Dokploy
- [ ] Desactivar `autoDeploy` en app `payload` via MCP
- [ ] Añadir 3 secrets en GitHub: `DOKPLOY_WEBHOOK_URL`, `DOKPLOY_PAYLOAD_TOKEN`, `DOKPLOY_TRANSLATION_TOKEN`
- [ ] Modificar job `deploy` en el workflow
- [ ] Verificar que el pipeline funciona con un push de prueba

## Success Criteria

- CI/CD pipeline triggerea deploy automático en Dokploy después de verify + migrate
- Health check confirma que warynessy.com responde 200 post-deploy
- No doble deploy: autoDeploy desactivado en Dokploy para `payload`

## Consideraciones de Seguridad

- Los `refreshToken` son secretos de deploy — no commitear en el repo
- El endpoint webhook de Dokploy acepta solo el token correcto
- Si el health check falla, el job falla pero el deploy ya ocurrió → notificar al operador

## Preguntas Sin Resolver

1. ¿Cuál es la URL exacta del servidor Dokploy? (necesaria para configurar el secret `DOKPLOY_WEBHOOK_URL`)
2. ¿Se quiere desactivar `autoDeploy` en `payload`? Si se mantiene activo, habrá doble deploy (Dokploy auto + CI webhook).
