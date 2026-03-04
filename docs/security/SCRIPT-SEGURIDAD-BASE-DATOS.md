# 🛡️ Seguridad de Base de Datos - Documentación de Mejoras

**Fecha:** 3 de marzo, 2026  
**Agente Responsable:** CI-CD  
**Prioridad:** CRÍTICA

---

## 📋 Resumen de Cambios de Seguridad

### 1. ✅ Script Nuke-db Protegido

**Problema Original:**
- El archivo `scripts/nuke-db.ts` podía ejecutarse accidentalmente en producción
- No tenía verificaciones de entorno ni confirmación
- Ejecutaba `DROP SCHEMA public CASCADE` sin prevención
- Riesgo: Pérdida total de datos de producción

**Solución Implementada:**

#### 1.1 Nuevo Script Seguro
- **Archivo:** `scripts/nuke-db-dev-only.ts`
- **Características de seguridad:**
  - ✅ Verificación de entorno (`NODE_ENV`)
  - ✅ Bloqueo automático en producción
  - ✅ Confirmación manual requerida
  - ✅ Confirmación reforzada en no-desarrollo (frase larga específica)
  - ✅ Tipos TypeScript correctos
  - ✅ Lista detallada de colecciones a eliminar
  - ✅ Mensajes claros de advertencia
  - ✅ Guía de pasos siguientes tras el reset

#### 1.2 Script Original Obsoleto
- **Archivo:** `scripts/nuke-db.ts` (reemplazado)
- **Estado:** DEPRECATED
- **Comportamiento:** Bloquea cualquier ejecución y redirige al script seguro
- **Propósito:** Documentación histórica y prevención de errores

### 2. 📊 Verificación de Tipos TypeScript

**Estado:** ✅ CORRECTO
- **Archivo:** `src/payload/payload-types.ts`
- **Contenido:** Interfaces completas para todas las colecciones y globals
- **Última generación:** Actualizado (visible en header del archivo)
- **Recomendación:** Ejecutar `npm run generate:types` después de cambios de schema

### 3. 🔍 Auditoría de Migraciones

**Estado:** ✅ SEGURO
- **Base de datos:** PostgreSQL
- **Migraciones existentes:** 3 archivos
  1. `20260115_120514_initial.*` - Migración inicial
  2. `20260209_191504_add_menus_grupo.*` - Agregó colección menus-grupo
  3. `20260218_192308.*` - Cambió tipo de campo `precio` a varchar

**Verificaciones de Seguridad:**
- ✅ Ninguna migración contiene operaciones destructivas (DROP, DELETE, TRUNCATE)
- ✅ Todas usan ALTER TABLE con ADD/SET DATA TYPE (seguras)
- ✅ Migración `down` reversión implementada correctamente

### 4. ⚙️ Configuración de Payload

**Estado:** ⚠️ REQUIERE ATENCIÓN

**Configuración Actual:**
```typescript
db: postgresAdapter({
  pool: {
    connectionString: process.env.DATABASE_URL || '',
  },
  push: true, // ⚠️ Auto-sync schema on startup
})
```

**Riesgo Identificado:**
- `push: true` permite sincronización automática del schema al iniciar Payload
- Puede aplicar cambios sin migración explícita
- Útil en desarrollo, potencialmente peligroso en producción

**Recomendación:**
- Mantener `push: true` en desarrollo
- Considerar desactivar en producción (`push: false`)
- Usar solo migraciones explícitas en producción

---

## 🚨 Reglas de Seguridad para el Equipo

### Regla #1: Scripts de Base de Datos
- ✅ **SIEMPRE** usar `scripts/nuke-db-dev-only.ts` para reset
- ❌ **NUNCA** ejecutar scripts de reset en producción sin backup previo
- ✅ **SIEMPRE** verificar que `NODE_ENV=development` antes de resetear
- ✅ **SIEMPRE** revisar migraciones antes de aplicarlas

### Regla #2: Cambios de Schema
1. Modificar colección/global en `src/payload/collections/` o `src/payload/globals/`
2. Ejecutar `npm run generate:types`
3. Verificar que `src/payload/payload-types.ts` se actualizó
4. Para PostgreSQL: Generar migración con `payload migrate:create`
5. Revisar manualmente el archivo de migración
6. Confirmar que no contiene DROP/DELETE/TRUNCATE
7. Commitizar cambios: schema + tipos + migración

### Regla #3: Despliegues en Producción
- ✅ Hacer backup completo de la base de datos ANTES de migrar
- ✅ Ejecutar `payload migrate` antes de desplegar código nuevo
- ✅ Verificar logs de migración para detectar errores
- ✅ Tener plan de rollback listo

---

## 📝 Checklist de Seguridad del Agente CI/CD

### Antes de Aprobar Cambios de Payload:
- [ ] **Seguridad:** Ningún comando o migración intenta borrar datos
- [ ] **Schema:** Los cambios en collections/globals están bien definidos
- [ ] **Tipos:** Se ejecutó `npm run generate:types` y `payload-types.ts` se actualizó
- [ ] **Migración:** Se generó la migración correspondiente en `src/migrations/`
- [ ] **Seguridad Migración:** La migración solo contiene operaciones ADD/ALTER
- [ ] **Git:** Todos los archivos modificados están commitizados
- [ ] **Compilación:** Astro compila sin errores de tipos
- [ ] **Producción:** El pipeline de CI/CD ejecutará `payload migrate` antes del despliegue

### Scripts de Seguridad:
- [x] **nuke-db-dev-only.ts** - Script seguro con múltiples capas de protección
- [x] **nuke-db.ts** - Script original bloqueado y obsoleto

---

## 🔄 Proceso de Recuperación de Desastres

### Si se borra accidentalmente la base de datos:

1. **DETENER inmediatamente** cualquier conexión activa
2. **Verificar** si hay backup reciente disponible:
   - Backups automáticos del plugin de backup
   - Snapshots de Payload
   - Backups externos (Bunny Storage, etc.)
3. **Contactar** al equipo técnico
4. **Restaurar** desde el backup más reciente
5. **Investigar** causa del error
6. **Implementar** medidas preventivas adicionales

### Scripts de Backup Disponibles:

**Plugin de Backup Automático:**
- Ubicación: `plugins/backupPlugin.ts`
- Colecciones: alergenos, categorias, platos, menus, menus-grupo, espacios, banners, archivos, paginas, experiencias
- Globals: pagina-inicio, configuracion-sitio
- Retención:
  - Máx. 500 deltas
  - Máx. 30 snapshots incrementales
  - 4 snapshots semanales
  - 12 snapshots mensuales

---

## 📞 Contactos de Emergencia

### Equipo Técnico:
- Desarrollador Principal: [Agregar contacto]
- DevOps: [Agregar contacto]
- Soporte de Base de Datos: [Agregar contacto]

### Canales de Notificación:
- Slack: [Agregar canal]
- Email: [Agregar email]
- GitHub Issues: [Agregar repo]

---

## 📚 Documentación Relacionada

- **Agente CI/CD:** `docs/agents/CI-CD.md`
- **Configuración Payload:** `payload.config.ts`
- **Migraciones:** `src/migrations/`
- **Backups:** `plugins/backupPlugin.ts`

---

## ✅ Estado Actual de Seguridad

| Componente | Estado | Última Verificación |
|------------|--------|---------------------|
| Script Nuke-db | ✅ Protegido | 2026-03-03 |
| Tipos TypeScript | ✅ Vigente | 2026-03-03 |
| Migraciones | ✅ Seguras | 2026-03-03 |
| Configuración Push | ⚠️ Revisión recomendada | 2026-03-03 |
| CI/CD Pipeline | 🔄 Pendiente de configuración | - |
| Backups Automáticos | ✅ Activo | - |

---

## 🎯 Próximos Pasos Recomendados

### Prioridad ALTA:
1. **Configurar pipeline de CI/CD** (Dokploy/GitHub Actions)
   - Incluir etapa de verificación de tipos
   - Incluir etapa de ejecución de migraciones
   - Incluir etapa de backup antes de migración

### Prioridad MEDIA:
2. **Revisar configuración `push: true`**
   - Evaluar necesidad de sincronización automática
   - Documentar cuando es seguro usarla
   - Considerar desactivar en producción

### Prioridad BAJA:
3. **Monitorear ejecución de scripts**
   - Establecer logs de ejecución
   - Configurar alertas para operaciones peligrosas
   - Implementar revisiones periódicas de seguridad

---

**Documento creado por:** Agente CI-CD  
**Última actualización:** 3 de marzo, 2026  
**Próxima revisión:** Semanal o tras cambios de schema