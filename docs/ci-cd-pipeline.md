# 🚀 Pipeline CI/CD - Documentación Completa

**Fecha:** 3 de marzo, 2026  
**Workflow:** `.github/workflows/ci-cd-payload.yml`  
**Prioridad:** ALTA

---

## 📋 Descripción General

El pipeline de CI/CD (Continuous Integration/Continuous Deployment) automatiza el proceso de verificación, migración y despliegue del proyecto Warynessy26. Este pipeline está diseñado con múltiples capas de seguridad para proteger la base de datos y asegurar la calidad del código.

### 🎯 Objetivos del Pipeline

1. **Verificación Automática:** Validar código, tipos y seguridad antes de cada deploy
2. **Migraciones Controladas:** Ejecutar migraciones de base de datos de forma segura
3. **Deploy Seguro:** Prevenir despliegues con errores o cambios peligrosos
4. **Auditoría de Seguridad:** Generar reportes de seguridad en cada ejecución

---

## 🔄 Flujo del Pipeline

### 📦 JOB 1: Verify (Verificación de Código y Tipos)

**Ejecuta en:** Todos los push y pull requests  
**Ramas:** main, develop  
**Tiempo estimado:** 2-3 minutos

#### Pasos:

1. **📥 Checkout del repositorio**
   - Descarga el código del repositorio

2. **🟢 Setup Node.js**
   - Configura Node.js v20
   - Cache de npm para velocidad

3. **📦 Instalar dependencias**
   - `npm ci` (Clean Install - más rápido y seguro)

4. **🔍 Verificar seguridad de scripts**
   - Verifica que `scripts/nuke-db.ts` está marcado como DEPRECATED
   - Verifica que `scripts/nuke-db-dev-only.ts` tiene verificaciones
   - **FAIL si:** Los scripts no están protegidos correctamente

5. **🔬 Verificar tipos TypeScript**
   - Ejecuta `npm run generate:types`
   - Verifica que `src/payload/payload-types.ts` se generó
   - Ejecuta `npx tsc --noEmit`
   - **FAIL si:** Hay errores de TypeScript

6. **🔍 Verificar migraciones seguras**
   - Busca operaciones peligrosas en `src/migrations/*.ts`
   - **Operaciones prohibidas:** `DROP TABLE`, `DROP SCHEMA`, `DELETE FROM`, `TRUNCATE`
   - **FAIL si:** Se encuentran operaciones peligrosas

7. **🏗️ Build de Astro**
   - Ejecuta `npm run build:astro`
   - Verifica que el proyecto compila sin errores
   - **FAIL si:** El build falla

### 🗄️ JOB 2: Migrate (Ejecutar Migraciones)

**Ejecuta en:** Solo push a main  
**Condición:** Solo si verify pasó exitosamente  
**Tiempo estimado:** 1-2 minutos

#### Pasos:

1. **📥 Checkout del repositorio**

2. **🟢 Setup Node.js**

3. **📦 Instalar dependencias**

4. **🔬 Verificar tipos TypeScript**
   - Regenera tipos para asegurar consistencia

5. **🗄️ Verificar archivos de migración**
   - Lista archivos de migración pendientes
   - Muestra archivos `.ts` en `src/migrations/`

6. **⚠️ Advertencia de migraciones en producción**
   - Muestra checklist manual requerido:
     - Backup completo de base de datos
     - Revisión manual de migraciones
     - Verificación de operaciones peligrosas
     - Plan de rollback listo

7. **📊 Ejecutar migraciones de Payload**
   - Ejecuta `npm run migrate`
   - **FAIL si:** Hay errores en migraciones

8. **📋 Reporte de migraciones**
   - Muestra archivos de migración ejecutados
   - Confirma que `payload-types.ts` está actualizado

### 🚀 JOB 3: Deploy (Deploy a Producción)

**Ejecuta en:** Solo push a main  
**Condición:** Solo si verify y migrate pasaron exitosamente  
**Tiempo estimado:** 1 minuto (manual en Dokploy)

#### Pasos:

1. **📥 Checkout del repositorio**

2. **📝 Notificar inicio de deploy**
   - Muestra información del commit, autor y fecha

3. **🔍 Verificar precondiciones de deploy**
   - Verifica que `scripts/nuke-db.ts` NO fue modificado en este commit
   - Verifica que `src/payload/payload-types.ts` existe
   - **FAIL si:** Scripts peligrosos modificados o tipos no encontrados

4. **📋 Checklist de seguridad antes del deploy**
   - Muestra verificaciones automáticas completadas
   - Muestra checklist manual requerido:
     - Backup de base de datos completado
     - Migraciones revisadas manualmente
     - Plan de rollback preparado
     - Equipo notificado del deploy

5. **🚀 Trigger de Dokploy (manual)**
   - **IMPORTANTE:** Este workflow NO hace deploy automático
   - Proporciona instrucciones para deploy manual en Dokploy:
     1. Ir al panel de Dokploy
     2. Navegar al proyecto warynessy26
     3. Hacer pull de los últimos cambios
     4. Ejecutar `npm run migrate` en el servidor
     5. Reiniciar el servidor
     6. Verificar logs de aplicación
   - Nota: Se puede usar el MCP server de Dokploy para deploy automático

6. **✅ Notificar deploy completado** (si éxito)
   - Muestra resumen de verificaciones completadas

7. **❌ Notificar falla del deploy** (si error)
   - Muestra instrucciones para revisar errores
   - **IMPORTANTE:** NO hacer deploy hasta corregir errores

### 🛡️ JOB 4: Security-Report (Reporte de Seguridad)

**Ejecuta en:** Siempre (independientemente del resultado)  
**Condición:** Después del job verify  
**Tiempo estimado:** 1 minuto

#### Pasos:

1. **📥 Checkout del repositorio**

2. **📊 Generar reporte de seguridad**
   - Muestra fecha, commit, autor y rama
   - Muestra checklist de verificación:
     - Seguridad de Scripts
     - Tipos TypeScript
     - Migraciones
     - Configuración
     - Documentación

3. **💾 Guardar reporte**
   - Crea archivo en `.security-reports/security-YYYYMMDD-HHMMSS.txt`
   - Guarda información del commit y estado de verificación

---

## 🔒 Seguridad del Pipeline

### Verificaciones Automáticas

#### 1. **Seguridad de Scripts de Base de Datos**
```bash
# Verifica que nuke-db.ts está DEPRECATED
grep -q "DEPRECATED" scripts/nuke-db.ts

# Verifica que nuke-db-dev-only.ts tiene verificaciones
grep -q "checkEnvironment" scripts/nuke-db-dev-only.ts
```

**FAIL si:** Los scripts no están protegidos correctamente

#### 2. **Verificación de Tipos TypeScript**
```bash
# Generar tipos
npm run generate:types

# Verificar que se generó
test -f "src/payload/payload-types.ts"

# Verificar errores de TypeScript
npx tsc --noEmit
```

**FAIL si:** Hay errores de TypeScript o tipos no generados

#### 3. **Verificación de Migraciones Seguras**
```bash
# Buscar operaciones peligrosas
find src/migrations -name "*.ts" \
  -exec grep -l "DROP TABLE\|DROP SCHEMA\|DELETE FROM\|TRUNCATE" {} \;
```

**FAIL si:** Se encuentran operaciones peligrosas en migraciones

#### 4. **Verificación de Precondiciones de Deploy**
```bash
# Verificar que nuke-db.ts NO fue modificado
git diff --name-only $BEFORE $SHA | grep -q "scripts/nuke-db.ts"

# Verificar que payload-types.ts existe
test -f "src/payload/payload-types.ts"
```

**FAIL si:** Scripts peligrosos modificados o tipos no encontrados

---

## 📊 Scripts de Migración Agregados

### package.json (scripts nuevos)

```json
{
  "migrate": "payload migrate",
  "migrate:create": "payload migrate:create",
  "migrate:rollback": "payload migrate:rollback"
}
```

### Uso de Scripts

#### 1. **npm run migrate**
- **Propósito:** Ejecutar migraciones pendientes
- **Uso:** Desarrollo y producción
- **Cuándo usar:** Después de agregar cambios de schema
- **Precaución:** SIEMPRE hacer backup antes en producción

#### 2. **npm run migrate:create**
- **Propósito:** Crear nueva migración
- **Uso:** Desarrollo
- **Cuándo usar:** Después de modificar colecciones/globals
- **Ejemplo:**
  ```bash
  npm run migrate:create
  # Input: Cambia el tipo de campo precio a varchar
  # Output: src/migrations/20260318_192308_changing_precio_type.ts
  ```

#### 3. **npm run migrate:rollback**
- **Propósito:** Revertir última migración
- **Uso:** Emergencia en producción
- **Cuándo usar:** Si migración falló o causó errores
- **Precaución:** SIEMPRE investigar causa antes de rollback

---

## 🚨 Checklist Manual Antes de Deploy

### ☑️ Verificaciones Automáticas (Pipeline)

- [ ] Tipos TypeScript verificados
- [ ] Scripts de seguridad revisados
- [ ] Migraciones verificadas (sin DROP/DELETE/TRUNCATE)
- [ ] Build exitoso
- [ ] Sin scripts peligrosos modificados

### 🎯 Verificaciones Manuales (Equipo)

- [ ] **Backup de base de datos completado**
  - Backup completo de PostgreSQL
  - Guardado en ubicación segura
  - Verificado que el backup es válido

- [ ] **Migraciones revisadas manualmente**
  - Leer código de cada migración
  - Confirmar que solo usa ADD/ALTER
  - Entender impacto en datos

- [ ] **Plan de rollback preparado**
  - Tener comando de rollback listo
  - Saber qué migración revertir
  - Tener backup accesible

- [ ] **Equipo notificado del deploy**
  - Notificar a desarrolladores
  - Notificar a equipo DevOps
  - Establecer ventanas de mantenimiento si es necesario

---

## 🔄 Flujo de Trabajo Recomendado

### Escenario 1: Agregar Nuevo Campo

```bash
# 1. Modificar colección en src/payload/collections/
# 2. Generar tipos
npm run generate:types

# 3. Crear migración
npm run migrate:create

# 4. Revisar migración manualmente
cat src/migrations/20260318_XXXXXX_*.ts

# 5. Commit cambios
git add src/payload/collections/YourCollection.ts
git add src/payload/payload-types.ts
git add src/migrations/20260318_XXXXXX_*.ts
git commit -m "feat: add new field to collection"

# 6. Push y dejar que CI/CD verifique
git push origin main

# 7. Revisar resultado en GitHub Actions
# 8. Si pasa, hacer deploy manual en Dokploy
```

### Escenario 2: Corregir Error en Producción

```bash
# 1. Hacer backup inmediato
pg_dump warynessy > backup_YYYYMMDD_HHMMSS.sql

# 2. Crear migración de corrección
npm run migrate:create

# 3. Revisar migración cuidadosamente
cat src/migrations/20260318_XXXXXX_*.ts

# 4. Commit y push
git add src/migrations/20260318_XXXXXX_*.ts
git commit -m "fix: correct data migration"
git push origin main

# 5. Esperar que CI/CD verifique
# 6. Revisar resultados en GitHub Actions
# 7. Deploy en Dokploy después de verificación
```

### Escenario 3: Emergency Rollback

```bash
# 1. DETENER aplicación inmediatamente
# 2. Verificar última migración exitosa
npm run payload migrate:status

# 3. Rollback si es necesario
npm run migrate:rollback

# 4. Verificar datos
# 5. Investigar causa del error
# 6. Crear fix
# 7. Probar en desarrollo
# 8. Deploy correcto
```

---

## 📱 Integración con Dokploy

### Opción 1: Deploy Manual (Actual)

1. **Ir a panel de Dokploy**
2. **Navegar al proyecto warynessy26**
3. **Hacer pull:**
   ```bash
   git pull origin main
   ```
4. **Ejecutar migraciones:**
   ```bash
   npm run migrate
   ```
5. **Reiniciar servidor:**
   ```bash
   # En Dokploy: Click en "Restart"
   ```
6. **Verificar logs:**
   - Buscar errores de migración
   - Verificar que aplicación inicia correctamente

### Opción 2: Deploy Automático con MCP

```bash
# Usar el MCP server de Dokploy
# El workflow puede hacer deploy automático si se configura
```

### Opción 3: GitHub Actions + Dokploy Webhook

```yaml
# Agregar a .github/workflows/ci-cd-payload.yml
- name: 🚀 Trigger Dokploy Deploy
  run: |
    curl -X POST "${{ secrets.DOKPLOY_WEBHOOK_URL }}" \
      -H "Content-Type: application/json" \
      -d '{"action": "deploy", "branch": "main"}'
```

---

## 📊 Monitoreo y Logs

### Verificar Estado del Pipeline

1. **GitHub Actions:**
   - Ir al repositorio en GitHub
   - Click en "Actions" tab
   - Seleccionar workflow "CI/CD Pipeline - Payload & Astro"
   - Ver status de jobs

2. **Reportes de Seguridad:**
   - Ubicación: `.security-reports/`
   - Archivos: `security-YYYYMMDD-HHMMSS.txt`
   - Contenido: Estado de verificaciones, commit, autor

### Logs de Errores Comunes

#### Error: TypeScript compilation failed
```
❌ ERROR: Tipos no generados correctamente
```
**Solución:**
- Ejecutar `npm run generate:types` localmente
- Revisar errores de TypeScript
- Corregir errores en código

#### Error: Migrations contain dangerous operations
```
❌ ERROR: Se encontraron operaciones peligrosas en migraciones
```
**Solución:**
- Revisar migraciones en `src/migrations/`
- Reemplazar DROP/DELETE con operaciones seguras
- Usar ALTER en lugar de DROP

#### Error: nuke-db.ts was modified
```
❌ ERROR: nuke-db.ts fue modificado en este commit
```
**Solución:**
- Revertir cambio a nuke-db.ts
- Usar scripts/nuke-db-dev-only.ts en su lugar

#### Error: payload-types.ts not found
```
❌ ERROR: payload-types.ts no encontrado
```
**Solución:**
- Ejecutar `npm run generate:types`
- Commitizar el archivo generado

---

## 🔧 Configuración de Secrets en GitHub

### Required Secrets

1. **DATABASE_URL**
   - **Descripción:** URL de conexión a base de datos PostgreSQL
   - **Formato:** `postgres://user:password@host:port/database`
   - **Cómo agregar:**
     - Ir a Settings → Secrets and variables → Actions
     - Click "New repository secret"
     - Name: `DATABASE_URL`
     - Value: Tu URL de base de datos

### Optional Secrets

2. **DOKPLOY_WEBHOOK_URL** (para deploy automático)
   - **Descripción:** URL de webhook de Dokploy
   - **Formato:** `https://your-dokploy-instance.com/api/webhooks/deploy`
   - **Cómo agregar:** Misma configuración que DATABASE_URL

---

## 📚 Documentación Relacionada

- **Agente CI-CD:** `docs/agents/CI-CD.md`
- **Seguridad de Base de Datos:** `docs/security/SCRIPT-SEGURIDAD-BASE-DATOS.md`
- **Migraciones Payload:** `src/migrations/`
- **Configuración Payload:** `payload.config.ts`

---

## ✅ Estado del Pipeline

| Componente | Estado | Última Verificación |
|------------|--------|---------------------|
| Workflow GitHub Actions | ✅ Configurado | 2026-03-03 |
| Scripts de Migración | ✅ Agregados | 2026-03-03 |
| Verificaciones de Seguridad | ✅ Activas | 2026-03-03 |
| Reportes de Seguridad | ✅ Automáticos | 2026-03-03 |
| Integración Dokploy | ⚠️ Manual | - |

---

## 🎯 Próximas Mejoras

### Prioridad ALTA:
1. **Configurar webhook de Dokploy** para deploy automático
2. **Agregar pruebas unitarias** al pipeline
3. **Configurar notificaciones** (Slack, Email) en caso de fallos

### Prioridad MEDIA:
4. **Agregar stage de staging** antes de producción
5. **Implementar health checks** post-deploy
6. **Configurar rollback automático** en caso de fallos

### Prioridad BAJA:
7. **Agregar métricas de performance** al pipeline
8. **Implementar visualización de logs** en tiempo real
9. **Configurar monitoreo de uptime** de producción

---

**Documento creado por:** Agente CI-CD  
**Última actualización:** 3 de marzo, 2026  
**Próxima revisión:** Mensual o tras cambios del pipeline