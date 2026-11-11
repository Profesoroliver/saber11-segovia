/**
 * Ruta Saber 11 · Sociales y Ciudadanas · I.E. Segovia (Sampués, Sucre)
 * Backend en Google Apps Script:
 *  - Recibe los registros que envía la app (entradas, cierres de sesión, respuestas).
 *  - Envía un correo por cada ENTRADA y por cada CIERRE de sesión (tiempo, aciertos, nivel,
 *    fortaleza, debilidad y ejes por reforzar).
 *  - Consolida todo en la hoja de cálculo: Entradas, Sesiones, Respuestas y Resumen.
 *
 * Crear este proyecto INICIANDO SESIÓN CON LA CUENTA GOOGLE DEL CANAL DE YOUTUBE:
 * los correos se envían desde y hacia esa cuenta.
 */

const CONFIG = {
  CORREO_DESTINO: '',          // vacío = correo de la cuenta dueña del script (la del canal)
  NOTIFICAR_ENTRADAS: true,
  NOTIFICAR_CIERRES: true,
  ZONA: 'America/Bogota',
  GRUPO: 'Décimo 1'
};

const HOJAS = {
  ENTRADAS: ['Recibido', 'Fecha entrada', 'Estudiante', 'Matrícula', 'Dispositivo', 'Conexión al entrar', 'Sesión', 'ID evento'],
  SESIONES: ['Recibido', 'Inicio', 'Fin', 'Estudiante', 'Matrícula', 'Duración (min)', 'Preguntas', 'Aciertos', '% sesión',
             'PS % sesión', 'IAP % sesión', 'PRS % sesión', 'Nivel acumulado', 'Fortaleza', 'Debilidad', 'Ejes a reforzar',
             'Puntos', 'Premios nuevos', 'Cierre recuperado', 'Dispositivo', 'Sesión', 'ID evento'],
  RESPUESTAS: ['Recibido', 'Estudiante', 'Matrícula', 'Sesión', 'Ítem', 'Eje', 'Competencia', 'Marcada', 'Clave', 'Acierto', 'Segundos', 'Modo'],
  RESUMEN: ['Estudiante', 'Matrícula', 'Sesiones', 'Tiempo total (min)', 'Preguntas', 'Aciertos', '% global', 'PS %', 'IAP %', 'PRS %',
            'Nivel estimado', 'Fortaleza', 'Debilidad', 'Ejes a reforzar', 'Última entrada']
};

/* ---------------- Endpoints ---------------- */
function doGet() {
  return json_({ ok: true, servicio: 'Ruta Saber 11 · I.E. Segovia', hora: fecha_(new Date()) });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const datos = JSON.parse(e.postData.contents || '{}');
    const eventos = datos.eventos || [];
    let nuevos = 0;
    eventos.forEach(ev => { if (procesar_(ev)) nuevos++; });
    if (nuevos) actualizarResumen_();
    return json_({ ok: true, recibidos: eventos.length, nuevos: nuevos });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Procesamiento ---------------- */
function procesar_(ev) {
  if (!ev || !ev.id || yaProcesado_(ev.id)) return false;
  const ahora = new Date();
  if (ev.tipo === 'ENTRADA') {
    hoja_('ENTRADAS').appendRow([ahora, new Date(ev.fecha), ev.estudiante, ev.matricula, ev.dispositivo, ev.conexion, ev.sesion, ev.id]);
    if (CONFIG.NOTIFICAR_ENTRADAS) correoEntrada_(ev, ahora);
  } else if (ev.tipo === 'CIERRE') {
    const pc = c => { const v = (ev.sesion_porComp || {})[c] || { n: 0, ok: 0 }; return v.n ? Math.round(v.ok * 100 / v.n) : ''; };
    hoja_('SESIONES').appendRow([ahora, new Date(ev.inicio), new Date(ev.fin), ev.estudiante, ev.matricula,
      Math.round((ev.duracion_seg || 0) / 6) / 10, ev.sesion_preguntas, ev.sesion_aciertos, ev.sesion_pct,
      pc('PS'), pc('IAP'), pc('PRS'), ev.nivel, ev.fortaleza, ev.debilidad, (ev.ejes_a_reforzar || []).join(', '),
      ev.puntos, (ev.premios_nuevos || []).join(', '), ev.recuperada ? 'Sí' : 'No', ev.dispositivo, ev.sesion, ev.id]);
    const filas = (ev.respuestas || []).map(r => [ahora, ev.estudiante, ev.matricula, ev.sesion, r.item, r.eje, r.comp, r.marcada, r.clave, r.ok ? 1 : 0, r.seg, r.modo]);
    if (filas.length) {
      const h = hoja_('RESPUESTAS');
      h.getRange(h.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
    }
    if (CONFIG.NOTIFICAR_CIERRES) correoCierre_(ev);
  } else {
    return false;
  }
  marcar_(ev.id);
  return true;
}

function yaProcesado_(id) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('ev_' + id) !== null;
}
function marcar_(id) {
  PropertiesService.getScriptProperties().setProperty('ev_' + id, '1');
}

/* ---------------- Resumen por estudiante ---------------- */
function actualizarResumen_() {
  const resp = datos_('RESPUESTAS'), ses = datos_('SESIONES'), ent = datos_('ENTRADAS');
  const est = {};
  const get = (m, n) => (est[m] = est[m] || { n: n, m: m, ses: 0, min: 0, tot: 0, ok: 0, c: { PS: [0, 0], IAP: [0, 0], PRS: [0, 0] }, ejes: {}, ult: null });
  ses.forEach(r => { const e = get(r[4], r[3]); e.ses++; e.min += Number(r[5]) || 0; });
  resp.forEach(r => {
    const e = get(r[2], r[1]); const ok = Number(r[9]) === 1; e.tot++; if (ok) e.ok++;
    if (e.c[r[6]]) { e.c[r[6]][0]++; if (ok) e.c[r[6]][1]++; }
    e.ejes[r[5]] = e.ejes[r[5]] || [0, 0]; e.ejes[r[5]][0]++; if (ok) e.ejes[r[5]][1]++;
  });
  ent.forEach(r => { const e = get(r[3], r[2]); const f = new Date(r[1]); if (!e.ult || f > e.ult) e.ult = f; });

  const filas = Object.values(est).sort((a, b) => String(a.n).localeCompare(String(b.n))).map(e => {
    const pct = e.tot ? Math.round(e.ok * 100 / e.tot) : 0;
    const comp = ['PS', 'IAP', 'PRS'].map(c => [c, e.c[c][0] ? Math.round(e.c[c][1] * 100 / e.c[c][0]) : null]).filter(x => x[1] !== null);
    comp.sort((a, b) => b[1] - a[1]);
    const empate = comp.length > 1 && comp[0][1] === comp[comp.length - 1][1];
    const fort = empate ? 'Sin diferencia (' + comp[0][1] + '%)' : comp.length ? comp[0][0] + ' (' + comp[0][1] + '%)' : '—';
    const deb = empate ? 'Sin diferencia (' + comp[0][1] + '%)' : comp.length > 1 ? comp[comp.length - 1][0] + ' (' + comp[comp.length - 1][1] + '%)' : '—';
    const debiles = Object.keys(e.ejes).filter(k => e.ejes[k][1] / e.ejes[k][0] < 0.6).sort().join(', ');
    const pc = c => e.c[c][0] ? Math.round(e.c[c][1] * 100 / e.c[c][0]) : '';
    return [e.n, e.m, e.ses, Math.round(e.min * 10) / 10, e.tot, e.ok, pct, pc('PS'), pc('IAP'), pc('PRS'), nivel_(pct, e.tot), fort, deb, debiles, e.ult || ''];
  });
  const h = hoja_('RESUMEN');
  if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, HOJAS.RESUMEN.length).clearContent();
  if (filas.length) h.getRange(2, 1, filas.length, HOJAS.RESUMEN.length).setValues(filas);
}

function nivel_(pct, n) {
  if (!n) return 'Sin datos';
  if (pct >= 80) return 'Nivel 4';
  if (pct >= 60) return 'Nivel 3';
  if (pct >= 40) return 'Nivel 2';
  return 'Nivel 1';
}

/* ---------------- Correos ---------------- */
function destino_() { return CONFIG.CORREO_DESTINO || Session.getEffectiveUser().getEmail(); }

function correoEntrada_(ev, recibido) {
  const fe = new Date(ev.fecha);
  const diferido = (recibido - fe) > 10 * 60 * 1000;
  MailApp.sendEmail({
    to: destino_(),
    subject: '🟢 Entrada · ' + ev.estudiante + ' · Saber 11 Sociales',
    htmlBody: marco_('Entrada registrada', [
      ['Estudiante', ev.estudiante], ['Matrícula', ev.matricula], ['Grupo', CONFIG.GRUPO],
      ['Hora de entrada', fecha_(fe)], ['Dispositivo', ev.dispositivo], ['Conexión al entrar', ev.conexion],
      ['Observación', diferido ? 'Registro enviado después de reconectarse (entró sin internet).' : 'Registro en tiempo real.']
    ])
  });
}

function correoCierre_(ev) {
  const min = Math.round((ev.duracion_seg || 0) / 6) / 10;
  const linea = c => {
    const s = (ev.sesion_porComp || {})[c] || { n: 0, ok: 0 }, a = (ev.acum_porComp || {})[c] || { n: 0, ok: 0 };
    return [c, 'Sesión ' + s.ok + '/' + s.n + ' · Acumulado ' + a.ok + '/' + a.n + (a.n ? ' (' + Math.round(a.ok * 100 / a.n) + '%)' : '')];
  };
  MailApp.sendEmail({
    to: destino_(),
    subject: '⏱️ ' + ev.estudiante + ' · ' + min + ' min · ' + ev.sesion_aciertos + '/' + ev.sesion_preguntas + ' aciertos · ' + ev.nivel,
    htmlBody: marco_('Sesión finalizada', [
      ['Estudiante', ev.estudiante], ['Matrícula', ev.matricula],
      ['Inicio', fecha_(new Date(ev.inicio))], ['Fin', fecha_(new Date(ev.fin))],
      ['Tiempo activo', min + ' minutos'],
      ['Preguntas en la sesión', ev.sesion_preguntas + ' (' + ev.sesion_aciertos + ' aciertos, ' + ev.sesion_pct + '%)'],
      linea('PS'), linea('IAP'), linea('PRS'),
      ['Nivel estimado (acumulado)', ev.nivel + ' · ' + ev.acum_aciertos + '/' + ev.acum_preguntas + ' (' + ev.acum_pct + '%)'],
      ['Fortaleza', ev.fortaleza], ['Debilidad', ev.debilidad],
      ['Ejes a reforzar (<60%)', (ev.ejes_a_reforzar || []).join(', ') || '—'],
      ['Puntos', ev.puntos], ['Premios nuevos', (ev.premios_nuevos || []).join(', ') || '—'],
      ['Observación', ev.recuperada ? 'La app se cerró sin pulsar «Salir»; el tiempo se recuperó en la siguiente apertura.' : 'Cierre normal.']
    ])
  });
}

function marco_(titulo, filas) {
  const tr = filas.map(f => '<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#555;white-space:nowrap"><b>' + f[0] +
    '</b></td><td style="padding:6px 10px;border-bottom:1px solid #eee">' + f[1] + '</td></tr>').join('');
  return '<div style="font-family:Arial,sans-serif;max-width:620px">' +
    '<div style="background:#B5121B;color:#fff;padding:12px 16px;border-radius:8px 8px 0 0"><b>I.E. Segovia · Ruta Saber 11° Sociales</b><br>' + titulo + '</div>' +
    '<table style="border-collapse:collapse;width:100%;border:1px solid #eee">' + tr + '</table>' +
    '<p style="font-size:12px;color:#777">PS: Pensamiento social · IAP: Interpretación y análisis de perspectivas · PRS: Pensamiento reflexivo y sistémico. ' +
    'El nivel es una estimación interna por porcentaje de aciertos, no equivale al puntaje ICFES.</p></div>';
}

/* ---------------- Utilidades ---------------- */
function hoja_(clave) {
  const nombres = { ENTRADAS: 'Entradas', SESIONES: 'Sesiones', RESPUESTAS: 'Respuestas', RESUMEN: 'Resumen' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName(nombres[clave]);
  if (!h) {
    h = ss.insertSheet(nombres[clave]);
    h.appendRow(HOJAS[clave]);
    h.getRange(1, 1, 1, HOJAS[clave].length).setFontWeight('bold').setBackground('#B5121B').setFontColor('#ffffff');
    h.setFrozenRows(1);
  }
  return h;
}
function datos_(clave) { const h = hoja_(clave); return h.getLastRow() > 1 ? h.getRange(2, 1, h.getLastRow() - 1, HOJAS[clave].length).getValues() : []; }
function fecha_(d) { return Utilities.formatDate(d, CONFIG.ZONA, 'dd/MM/yyyy hh:mm a'); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------------- Ejecutar una vez desde el editor ---------------- */
function configurarYProbar() {
  ['ENTRADAS', 'SESIONES', 'RESPUESTAS', 'RESUMEN'].forEach(hoja_);
  MailApp.sendEmail(destino_(), '✅ Ruta Saber 11 · conexión configurada',
    'Las notificaciones de la app llegarán a este correo. Hojas creadas: Entradas, Sesiones, Respuestas y Resumen.');
}
