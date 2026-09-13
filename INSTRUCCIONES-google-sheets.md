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

**IMPORTANTE:** esta versión usa peticiones **GET con JSONP**. Esto evita el bloqueo CORS que puede ocurrir cuando GitHub Pages intenta leer directamente la respuesta de Apps Script.

## Paso 3 — Publica el script como aplicación web
1. Botón azul **Implementar > Nueva implementación**
2. Click en el engrane ⚙️ y elige **Aplicación web**
3. Configuración:
   - Ejecutar como: **Yo (tu correo)**
   - Quién tiene acceso: **Cualquier usuario**
4. Click en **Implementar**
5. Autoriza los permisos cuando te lo pida
6. Copia la **URL de la aplicación web** (termina en `/exec`)

**Si ya tenías una implementación anterior:** no basta con guardar el código nuevo. Debes ir a Implementar > Administrar implementaciones > icono de lápiz (editar) > en "Versión" elige "Nueva versión" > Implementar. La URL se mantiene igual. Es necesario actualizar la implementación después de pegar el código de abajo.

## Paso 4 — Prueba la URL directo
Antes de usar el formulario, pega la URL (termina en `/exec`) en una pestaña nueva del navegador. Debe mostrarte algo como `{"status":"ok"}`. Si en cambio pide iniciar sesión o da error, el problema está en la implementación, no en el HTML.

## Paso 5 — Pega la URL en el formulario HTML
1. Abre tu página de GitHub Pages desde `index.html` (por ejemplo, `https://tu-usuario.github.io/huntech-comprobantes/`)
2. Pega la URL en el campo de configuración de arriba
3. Pulsa **Guardar** y después **Probar conexión**. Debe aparecer "Conexión correcta con Google Sheets."
4. Listo

### Si aparece "No se pudo conectar"

- Confirma que pegaste la URL de la aplicación web que termina exactamente en `/exec`, no la URL del editor de Apps Script.
- En la implementación, configura **Ejecutar como: Yo** y **Quién tiene acceso: Cualquier usuario**.
- Después de modificar el código, usa **Implementar > Administrar implementaciones > Editar > Nueva versión > Implementar**.
- Borra la URL guardada y vuelve a pegarla si pertenece a otra hoja o a otra implementación.

---

## CÓDIGO (pegar en Apps Script)

Pega únicamente el código que está entre las líneas de apertura y cierre. **No copies** la palabra `javascript` de la primera línea ni los caracteres de las comillas invertidas. La primera línea dentro del editor debe ser exactamente `function doGet(e) {`.

```javascript
function doGet(e) {
  var params = e.parameter;
  var action = params.action;
  var callback = params.callback;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tickets");

  if (!action) {
    return respond({ status: "ok" }, callback);
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
    return respond({ success: true, folio: folio }, callback);
  }

  if (action === "deliver") {
    var row = findRow(sheet, params.folio);
    if (!row) return respond({ success: false, error: "Folio no encontrado" }, callback);
    sheet.getRange(row, 14).setValue("Si");
    sheet.getRange(row, 15).setValue(params.fechaEntrega);
    return respond({ success: true }, callback);
  }

  if (action === "get") {
    var row = findRow(sheet, params.query || params.folio);
    if (!row) return respond({ success: false, error: "Folio no encontrado" }, callback);
    var values = sheet.getRange(row, 1, 1, 15).getValues()[0];
    var headers = sheet.getRange(1, 1, 1, 15).getValues()[0];
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = values[i]; });
    return respond({ success: true, data: obj }, callback);
  }

  return respond({ success: false, error: "Accion no reconocida" }, callback);
}

function findRow(sheet, query) {
  var values = sheet.getDataRange().getValues();
  var search = normalize(query);
  for (var i = 1; i < values.length; i++) {
    if ([values[i][0], values[i][2], values[i][3]].some(function(value) {
      return normalize(value).indexOf(search) !== -1;
    })) return i + 1;
  }
  return null;
}

function normalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function respond(obj, callback) {
  var json = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + json + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
```
