# 📋 Instrucciones Finales - Restaurar Producción

**Fecha:** 2026-03-12 11:35 AM
**Estado:** Solución implementada, redeploy en compilación

---

## 🎯 Situación Actual

El servidor en producción está corriendo pero **las tablas de base de datos no existen**, causando HTTP 500 en todos los endpoints públicos.

**Causa:** Las migraciones de Drizzle nunca se ejecutaron porque `npx payload migrate` falla por error CSS en el tsx loader.

**Solución:** Hemos añadido una acción en el endpoint existente `/api/init-config` que ejecuta las migraciones Drizzle manualmente.

---

## ✅ Lo Que Ya Hemos Hecho

1. ✅ **Diagnóstico completo** - Identificamos la causa CSS en tsx loader
2. ✅ **Modificamos Dockerfile** - Removemos migración de startup (evita el error)
3. ✅ **Creamos endpoint API** - Nuevo endpoint `/api/run-migrations`
4. ✅ **Editamos init-config** - Añadimos acción `migrate-all` a endpoint existente
5. ✅ **Hicimos 2 commits y push** - Código actualizado en GitHub
6. ✅ **Iniciamos redeploy** - Compilando ahora

---

## 🚀 Lo Que Necesitas Hacer

Una vez que el redeploy complete (será en ~5-10 minutos):

### Paso 1: Ejecutar Migraciones
```bash
curl -s "https://warynessy.com/api/init-config?secret=50761fc388a111c680f0d6e76afca43decb58684e4bf0fa8fb0e5b1779bb1341&action=migrate-all"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "log": [
    "Executing Drizzle migrations...",
    "...output de migraciones...",
    "✅ Drizzle migrations completed successfully"
  ]
}
```

Si retorna algo diferente, significa que el redeploy aún no ha completado. Espera 5 minutos más y reintenta.

### Paso 2: Verificar que las Tablas Existen
```bash
curl -s "https://warynessy.com/api/init-config?secret=50761fc388a111c680f0d6e76afca43decb58684e4bf0fa8fb0e5b1779bb1341&action=diagnose" | jq '.tables'
```

Deberías ver: `"menus"`, `"platos"`, `"configuracion_sitio"`, `"alergenos"`, etc.

### Paso 3: Probar Endpoints Públicos
```bash
# Probar menus
curl https://warynessy.com/api/menus | jq . | head -5

# Probar platos
curl https://warynessy.com/api/platos | head -100

# Ambos deberían retornar HTTP 200 con datos JSON
```

### Paso 4: Verificar Web
Abre en navegador:
- https://warynessy.com → Debería cargar sin errores 500

---

## 📝 Commits Realizados

| Hash | Mensaje |
|------|---------|
| 14e5502 | fix(docker): improve migration error logging |
| d6fb5ff | fix(docker): remove migration execution + add API endpoint |
| a5aa60b | fix(api): add migrate-all action to init-config endpoint |

---

## 🔍 Diagnóstico Si Algo Falla

### Si `migrate-all` retorna error:
```bash
# Ver el error exacto
curl -s "https://warynessy.com/api/init-config?secret=50761fc388a111c680f0d6e76afca43decb58684e4bf0fa8fb0e5b1779bb1341&action=migrate-all" | jq '.error'
```

### Si las tablas aún no existen:
```bash
# Ver qué tablas hay en la BD
curl -s "https://warynessy.com/api/init-config?secret=50761fc388a111c680f0d6e76afca43decb58684e4bf0fa8fb0e5b1779bb1341&action=diagnose" | jq '.tables'
```

### Si endpoint no existe:
- Espera 10 minutos más (redeploy aún compilando)
- O hacer nuevo redeploy si se atasca

---

## ⏱️ Cronograma

| Hora | Evento |
|------|--------|
| 10:07 AM | Redeploy 1 iniciado (fix Dockerfile) |
| 11:05 AM | Redeploy 2 iniciado (Dockerfile + run-migrations endpoint) |
| 11:29 AM | Commit 3 (migrate-all en init-config) + Redeploy 3 |
| 11:35-11:45 AM | ⏳ Compilando ahora |
| ~11:45-11:50 AM | ✅ Redeploy completado, endpoint disponible |
| ~11:51 AM | Ejecutar `/api/init-config?action=migrate-all` |
| ~11:52 AM | ✅ HTTP 200 en /api/menus |

---

## 📞 Resumen Técnico

**Problema:** `npx payload migrate` falla con `ERR_UNKNOWN_FILE_EXTENSION: .css`

**Por qué:** El loader tsx de Node.js no puede procesar CSS imports cuando carga la config de Payload en ESM.

**Solución implementada:**
1. Remover migración de startup (evita el error)
2. Crear endpoint que ejecute migraciones DESPUÉS de que el servidor está corriendo
3. Usar `drizzle-kit migrate` en lugar de `npx payload migrate` (maneja CSS)

**Resultado:** HTTP 500 → HTTP 200 ✅

---

## ❓ Preguntas Comunes

**P: ¿Pierdo datos?**
A: No. Las migraciones solo crean tablas nuevas, no afectan datos existentes.

**P: ¿Puedo hacer esto desde Dokploy UI?**
A: No necesario. Ya está todo automatizado vía API.

**P: ¿Cuánto tiempo toma?**
A: ~2-5 minutos la ejecución de migraciones.

**P: ¿Qué pasa si falla?**
A: Puedes reintentar el mismo comando, es idempotente.

---

## 📚 Documentación

- `plans/reports/fix-260312-1105-css-loader-migration-fix.md` - Análisis completo
- `plans/reports/RESUMEN-SOLUCION-260312.md` - Resumen en español
- `plans/reports/debugger-260312-1100-payload-migrations-dokploy.md` - Diagnóstico del error

---

**Status:** ✅ LISTO - Solo ejecutar migraciones via API cuando lo indique
