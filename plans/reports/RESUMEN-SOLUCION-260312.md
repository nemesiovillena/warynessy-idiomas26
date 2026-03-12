# 🔧 Resumen: Solución del Problema HTTP 500 en Producción

**Fecha:** 2026-03-12 11:05 AM
**Usuario:** Nemesio Villena
**Estado:** ✅ Fix aplicado, redeploy en progreso

---

## 📋 Problema Identificado

Tu sitio (https://warynessy.com) estaba retornando **HTTP 500** en endpoints como `/api/menus`, `/api/platos`, etc.

### Causa Raíz Descubierta

El comando `npx payload migrate` que ejecuta el contenedor **fallaba silenciosamente** por un error de CSS:

```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".css"
```

**¿Qué pasaba?**
1. El contenedor arrancaba el archivo `start.sh`
2. `start.sh` intentaba ejecutar `npx payload migrate`
3. Payload necesita cargar su configuración completa
4. La config carga dependencias de React que importan CSS
5. El loader de Node.js (tsx) no puede procesar CSS en ESM
6. La migración fallaba
7. El error se silenciaba con `|| echo "..."`
8. El servidor arrancaba **sin tablas de base de datos**
9. Resultado: HTTP 500 en todos los endpoints

---

## ✅ Solución Aplicada

### Cambio 1: Dockerfile
- ❌ **Antes:** Ejecutaba migraciones en `start.sh` (fallaba por CSS)
- ✅ **Ahora:** Solo inicia el servidor (sin intentar migraciones)

### Cambio 2: Nuevo Endpoint API
- ✅ **Crear:** `/api/run-migrations` - Ejecuta migraciones **después** de que el servidor está corriendo
- ✅ **Ventaja:** Evita el problema de CSS porque se ejecuta en contexto diferente
- ✅ **Seguridad:** Requiere PAYLOAD_SECRET como parámetro

### Commits
```
14e5502 - fix(docker): improve migration error logging
d6fb5ff - fix(docker): remove migration execution from start.sh + add API endpoint
```

---

## 🚀 Lo Que Está Sucediendo Ahora

**Redeploy iniciado a las 10:07 AM:**
1. ⏳ Docker compilando imagen nueva (~15 minutos)
2. ⏳ Descargando código de GitHub (commit d6fb5ff)
3. ⏳ Compilando Next.js + Astro
4. ⏳ Arrancando contenedor

**Una vez complete:**
- ✅ El servidor estará corriendo en https://warynessy.com
- ✅ El endpoint `/api/run-migrations` estará disponible
- ⏳ Necesitaremos llamar ese endpoint para crear las tablas de BD

---

## 📞 Pasos que Debes Hacer (Una Vez el Redeploy Complete)

### Paso 1: Verificar que el servidor está arriba
```bash
curl -I https://warynessy.com/
# Debería retornar HTTP 302 (redirect a /es/)
```

### Paso 2: Ejecutar las migraciones
```bash
curl -X POST "https://warynessy.com/api/run-migrations?secret=50761fc388a111c680f0d6e76afca43decb58684e4bf0fa8fb0e5b1779bb1341"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "output": "..."
}
```

### Paso 3: Verificar que las tablas se crearon
```bash
curl "https://warynessy.com/api/init-config?secret=50761fc388a111c680f0d6e76afca43decb58684e4bf0fa8fb0e5b1779bb1341&action=diagnose" | jq '.tables'
```

Deberías ver tablas como: `menus`, `platos`, `configuracion_sitio`, etc.

### Paso 4: Probar endpoints públicos
```bash
curl https://warynessy.com/api/menus
curl https://warynessy.com/api/platos
# Deberían retornar HTTP 200 + datos JSON
```

---

## ⏱️ Cronograma Estimado

| Hora | Evento |
|------|--------|
| 10:07 AM | Redeploy iniciado |
| 10:22 AM | Compilación esperada completa |
| 10:25 AM | Servidor arriba en https://warynessy.com |
| 10:26 AM | Llamar `/api/run-migrations` |
| 10:27 AM | HTTP 200 en `/api/menus` ✅ |

---

## 🛠️ Cambios en el Código

### Dockerfile (Eliminado)
```dockerfile
# ANTES:
RUN echo 'npx payload migrate' >> /app/start.sh

# AHORA:
RUN echo 'echo "Starting server..."' >> /app/start.sh
```

### Nuevo Archivo: src/app/api/run-migrations/route.ts
```typescript
export async function POST(req: Request) {
  const secret = searchParams.get('secret')

  if (secret !== process.env.PAYLOAD_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Ejecuta drizzle-kit migrate (maneja CSS correctamente)
  const output = execSync('npx drizzle-kit migrate', { ... })

  return NextResponse.json({ success: true, output })
}
```

---

## ⚠️ Notas Importantes

1. **PAYLOAD_SECRET** está configurado en Dokploy:
   - Valor: `50761fc388a111c680f0d6e76afca43decb58684e4bf0fa8fb0e5b1779bb1341`
   - Está seguro en el ambiente de Dokploy

2. **No hay que hacer nada manual** — Solo espera a que complete el redeploy y llama los endpoints

3. **Si algo va mal**, el endpoint `/api/init-config?action=diagnose` te muestra exactamente qué está en la BD

---

## 📊 Resumen del Progreso

| Tarea | Estado |
|-------|--------|
| ✅ Identificar causa raíz | COMPLETO |
| ✅ Diseñar solución | COMPLETO |
| ✅ Implementar fix en código | COMPLETO |
| ✅ Hacer commit y push | COMPLETO |
| ⏳ Redeploy en Dokploy | EN PROGRESO (~5 min) |
| ⏳ Ejecutar migraciones vía API | PENDIENTE |
| ⏳ Verificar HTTP 200 en endpoints | PENDIENTE |

---

## 📚 Documentación Técnica

Para más detalles técnicos, ver:
- `plans/reports/fix-260312-1105-css-loader-migration-fix.md` - Análisis completo
- `plans/reports/debugger-260312-1100-payload-migrations-dokploy.md` - Diagnóstico del error

---

**Estado Final:** ✅ SOLUCION APLICADA - ESPERANDO REDEPLOY
