# Phase 02: Dominio y Health Check para translation-agent

**Prioridad:** MEDIA
**Estado:** 🟡 Pendiente
**Esfuerzo estimado:** ~30min

---

## Contexto

La app `translation-agent` (FastAPI en `/services/translation-agent`) está desplegada en Dokploy pero:
- Sin dominio público configurado
- Sin health check externo posible
- Solo accesible internamente dentro de la red Docker de Dokploy

La app `payload` la llama internamente via `http://app-program-optical-bus-i2vif6:8000` (nombre del container Docker).

## Decisión

**¿Necesita dominio público?**

- **Sí**, si se quiere health check externo post-deploy y acceso admin/debug
- **No**, si la comunicación interna Docker es suficiente (caso actual — funciona)

**Recomendación:** Añadir subdominio `api.warynessy.com` apuntando al translation-agent en puerto 8000. Esto permite:
1. Health check post-deploy en CI/CD
2. Debug remoto sin acceso SSH al servidor
3. Futuro uso de la API desde el frontend directamente

---

## Pasos de Implementación

### 1. Verificar que FastAPI expone `/health`

Comprobar que el endpoint existe en `services/translation-agent/`:

```bash
grep -r "health" services/translation-agent/ --include="*.py"
```

Si no existe, añadir en el archivo principal (`main.py` o equivalente):

```python
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "translation-agent"}
```

### 2. Añadir dominio en Dokploy via MCP

```
domain-create(
  host: "api.warynessy.com",
  applicationId: "HbxY8PMKXumsvLBaLQEnT",
  domainType: "application",
  https: true,
  certificateType: "letsencrypt",
  port: 8000,
  path: "/",
  stripPath: false
)
```

### 3. Configurar DNS

En el proveedor DNS de `warynessy.com`:
```
api.warynessy.com → A → <IP del servidor Dokploy>
```

### 4. Actualizar health check en CI/CD (si se hace Phase 1)

Añadir al job `deploy` del workflow:

```yaml
- name: 🏥 Health check translation-agent
  run: |
    echo "⏳ Esperando que translation-agent arranque (30s)..."
    sleep 30

    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://api.warynessy.com/health --max-time 15)
    if [ "$RESPONSE" -eq 200 ]; then
      echo "✅ translation-agent OK (HTTP $RESPONSE)"
    else
      echo "⚠️ translation-agent health check fallido (HTTP $RESPONSE)"
    fi
```

---

## Archivos a Modificar

- `services/translation-agent/main.py` (o equivalente) — añadir `/health` si no existe
- `.github/workflows/ci-cd-payload.yml` — añadir health check post-deploy (Phase 1 primero)

## Todo

- [ ] Verificar si existe endpoint `/health` en FastAPI
- [ ] Si no existe, añadir endpoint `/health` en el servicio
- [ ] Crear dominio `api.warynessy.com` via MCP Dokploy
- [ ] Configurar DNS en proveedor de dominio
- [ ] Añadir health check al CI/CD (después de Phase 1)

## Success Criteria

- `https://api.warynessy.com/health` responde `{"status": "ok"}`
- CI/CD verifica health de ambas apps post-deploy

## Preguntas Sin Resolver

1. ¿Se desea exponer `translation-agent` públicamente? Podría haber implicaciones de seguridad si la API no tiene autenticación.
2. ¿El proveedor DNS de `warynessy.com` es accesible para añadir el registro A?
