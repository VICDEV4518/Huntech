# Huntech Comprobantes

## Publicar en GitHub Pages

La página principal es `index.html`. Sube al repositorio estos elementos conservando sus carpetas:

```
index.html
css/styles.css
js/app.js
```

En GitHub ve a **Settings > Pages**, selecciona la rama que contiene estos archivos y la carpeta `/ (root)`. GitHub Pages usará `index.html` automáticamente.

## Usuarios iniciales

| Usuario | Contraseña | Rol |
| --- | --- | --- |
| `tecnico` | `tecnico123` | Captura tickets y gestiona entregas |
| `administrador` | `admin123` | Configura Google Sheets y usa todo el sistema |

Las credenciales están en `js/app.js`. Este login solo controla el acceso de la interfaz: al ser una aplicación estática, no es un mecanismo de seguridad fuerte. Para proteger datos sensibles se necesita autenticación en un servidor o proveedor externo.

## Conectar Google Sheets

## Paso 1 — Crea la hoja
1. Ve a https://sheets.google.com y crea una hoja nueva.
2. Ponle de nombre a la pestaña inferior exactamente: `Tickets`
3. En la fila 1, pega estos encabezados, uno por columna (de A a O):

```
Folio | Fecha recibido | Cliente | Telefono | Tipo de equipo | Marca | Modelo | Enciende | Falla reportada | Conceptos | Monto total | Anticipo | Saldo pendiente | Entregado | Fecha de entrega
```

## Paso 2 — Agrega el script
1. En tu hoja, ve a **Extensiones > Apps Script**
2. Borra todo el contenido que aparezca por defecto
3. Pega exactamente el código de la sección "CÓDIGO" (más abajo)
4. Guarda (Ctrl+S). Ponle un nombre al proyecto, ej. "Huntech Tickets"

**IMPORTANTE:** esta versión usa peticiones **GET** en vez de POST. Los navegadores a veces bloquean las peticiones POST a Apps Script por un problema de Google con la redirección interna, aunque todo esté bien configurado. Usar GET evita ese problema.

## Paso 3 — Publica el script como aplicación web
1. Botón azul **Implementar > Nueva implementación**
2. Click en el engrane ⚙️ y elige **Aplicación web**
3. Configuración:
   - Ejecutar como: **Yo (tu correo)**
   - Quién tiene acceso: **Cualquier usuario**
4. Click en **Implementar**
5. Autoriza los permisos cuando te lo pida
6. Copia la **URL de la aplicación web** (termina en `/exec`)

**Si ya tenías una implementación anterior:** no basta con guardar el código nuevo. Debes ir a Implementar > Administrar implementaciones > icono de lápiz (editar) > en "Versión" elige "Nueva versión" > Implementar. La URL se mantiene igual.

## Paso 4 — Prueba la URL directo
Antes de usar el formulario, pega la URL (termina en `/exec`) en una pestaña nueva del navegador. Debe mostrarte algo como `{"status":"ok"}`. Si en cambio pide iniciar sesión o da error, el problema está en la implementación, no en el HTML.

## Paso 5 — Pega la URL en el formulario HTML
1. Abre `huntech-comprobantes.html` (recuerda: por `http://localhost:8000/...`, no con doble clic)
2. Pega la URL en el campo de configuración de arriba
3. Listo

---

## CÓDIGO (pegar en Apps Script)

```javascript
function doGet(e) {
  var params = e.parameter;
  var action = params.action;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tickets");

  if (!action) {
    return respond({ status: "ok" });
  }

  if (action === "create") {
    var folio = Utilities.formatDate(new Date(), "America/Mexico_City", "yyMMdd-HHmmss");
    var monto = parseFloat(params.monto) || 0;
    var anticipo = parseFloat(params.anticipo) || 0;
    var saldo = monto - anticipo;
    sheet.appendRow([
      folio, params.fecha, params.cliente, params.telefono, params.tipo,
      params.marca, params.modelo, params.enciende, params.falla,
      params.conceptosText, monto, anticipo, saldo,
      "No", ""
    ]);
    return respond({ success: true, folio: folio });
  }

  if (action === "deliver") {
    var row = findRow(sheet, params.folio);
    if (!row) return respond({ success: false, error: "Folio no encontrado" });
    sheet.getRange(row, 14).setValue("Si");
    sheet.getRange(row, 15).setValue(params.fechaEntrega);
    return respond({ success: true });
  }

  if (action === "get") {
    var row = findRow(sheet, params.folio);
    if (!row) return respond({ success: false, error: "Folio no encontrado" });
    var values = sheet.getRange(row, 1, 1, 15).getValues()[0];
    var headers = sheet.getRange(1, 1, 1, 15).getValues()[0];
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = values[i]; });
    return respond({ success: true, data: obj });
  }

  return respond({ success: false, error: "Accion no reconocida" });
}

function findRow(sheet, folio) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(folio)) return i + 1;
  }
  return null;
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```
