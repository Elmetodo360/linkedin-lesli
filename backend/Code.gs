/**
 * Backend de la app de revisión de posts LinkedIn.
 * Guarda cada decisión (OK / cambios / No) + notas en una hoja de Google Sheets.
 *
 * DESPLIEGUE (una sola vez):
 *  1. Crea una Hoja de cálculo nueva en Google Drive.
 *  2. Extensiones > Apps Script. Pega este archivo completo.
 *  3. Implementar > Nueva implementación > Tipo: Aplicación web.
 *       - Ejecutar como: Yo
 *       - Quién tiene acceso: Cualquier usuario
 *  4. Copia la URL del Web App y pégala en config.js (appsScriptUrl).
 *  Si cambias el código, usa "Administrar implementaciones" > editar > Nueva versión.
 */

var SHEET_NAME = 'Revisiones';
var HEADERS = ['postId', 'week', 'decision', 'notes', 'reviewer', 'ts', 'updatedAt'];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Escritura: la app envía JSON por POST (text/plain). */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var data = JSON.parse(e.postData.contents || '{}');
    var sh = getSheet_();
    var id = String(data.postId || '').trim();
    if (!id) return json_({ ok: false, error: 'postId vacío' });

    var values = sh.getDataRange().getValues();
    var rowIdx = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === id) { rowIdx = i + 1; break; }
    }
    var row = [
      id,
      data.week || '',
      data.decision || '',
      data.notes || '',
      data.reviewer || '',
      data.ts || new Date().toISOString(),
      new Date().toISOString()
    ];
    if (rowIdx === -1) sh.appendRow(row);
    else sh.getRange(rowIdx, 1, 1, HEADERS.length).setValues([row]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Lectura: la app pide la lista por JSONP (?action=list&callback=...). */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var sh = getSheet_();
  var values = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    out.push({
      postId: values[i][0],
      week: values[i][1],
      decision: values[i][2],
      notes: values[i][3],
      reviewer: values[i][4],
      ts: values[i][5]
    });
  }
  if (p.callback) {
    return ContentService
      .createTextOutput(p.callback + '(' + JSON.stringify(out) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(out);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
