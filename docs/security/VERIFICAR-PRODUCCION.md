# ✅ Guía de Verificación de Seguridad en Producción

## 📋 CHECKLIST DE DESPLIEGUE

Después de desplegar los cambios de seguridad a producción, sigue estos pasos de verificación.

---

## 1️⃣ VERIFICAR HEADERS DE SEGURIDAD

### Comando:
```bash
curl -I https://warynessy.es
```

### Resultados Esperados:
```
HTTP/2 200 
x-frame-options: DENY
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' *.googletagmanager.com *.google-analytics.com; style-src 'self' 'unsafe-inline' *.googleapis.com; img-src 'self' data: *.googleapis.com *.gstatic.com; font-src 'self' *.googleapis.com *.gstatic.com; connect-src 'self' *.google-analytics.com *.googletagmanager.com; frame-ancestors 'none';
x-xss-protection: 1; mode=block
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
permissions-policy: geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()
strict-transport-security: max-age=31536000; includeSubDomains; preload
```

### Checklist:
- [ ] X-Frame-Options está presente: `DENY`
- [ ] Content-Security-Policy está presente y es restrictivo
- [ ] X-XSS-Protection está presente: `1; mode=block`
- [ ] X-Content-Type-Options está presente: `nosniff`
- [ ] Referrer-Policy está presente: `strict-origin-when-cross-origin`
- [ ] Permissions-Policy está presente y restringe APIs
- [ ] Strict-Transport-Security está presente (HTTPS enforcement)
- [ ] X-Powered-By NO está presente (ocultado)

---

## 2️⃣ VERIFICAR SANITIZACIÓN XSS

### Comando:
```bash
curl -X POST https://warynessy.es/api/contact \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","nombre":"<img src=x onerror=alert(1)>","mensaje":"<svg/onload=alert(1)>test"}'
```

### Resultados Esperados:
```json
{
  "success": true,
  "message": "Mensaje enviado correctamente."
}
```

### Verificación:
- [ ] La respuesta es `success: true` (el payload XSS fue procesado)
- [ ] Revisar logs de Resend/Email para confirmar que el email NO contiene código HTML
- [ ] El email recibido debería mostrar texto plano: `<img src=x onerror=alert(1)>` (escapado)

---

## 3️⃣ VERIFICAR RATE LIMITING

### Comando:
```bash
# Hacer 6 requests consecutivos
for i in {1..6}; do
  echo "Request #$i:"
  curl -s -X POST https://warynessy.es/api/contact \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test$i@test.com\",\"nombre\":\"Test\",\"mensaje\":\"Test message $i\"}"
  echo ""
done
```

### Resultados Esperados:
```
Request #1:
{"success":true,"message":"Mensaje enviado correctamente."}
...l
Request #5:
{"success":true,"message":"Mensaje enviado correctamente."}
Request #6:
{"error":"Demasiados intentos. Por favor espera 15 minutos antes de intentar de nuevo."}
```

### Checklist:
- [ ] Los primeros 5 requests son exitosos (HTTP 200)
- [ ] El 6to request es rechazado con error HTTP 429
- [ ] El mensaje de error es claro y está en español

---

## 4️⃣ VERIFICAR PAYLOAD CMS ADMIN

### Prueba:
- [ ] Visitar https://warynessy.es/admin funciona
- [ ] Login funciona correctamente
- [ ] No hay errores de conexión a BD

---

## 📊 REPORTE FINAL

### Resultados de Verificación
- [ ] Headers de seguridad HTTP (8/8)
- [ ] Sanitización XSS en /api/contact
- [ ] Rate limiting en /api/contact
- [ ] Payload CMS admin funciona

### Estado del Despliegue
- [ ] Despliegue completado
- [ ] Verificación completada
- [ ] Sin errores críticos

---

**Última actualización**: 2026-02-26  
**Autor**: Sentinel - Agente de Seguridad  
**Estado**: ✅ LISTO PARA USAR EN PRODUCCIÓN