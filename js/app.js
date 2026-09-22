const USERS = {
  tecnico: { password: 'tecnico123', label: 'Técnico', canConfigure: false },
  administrador: { password: 'admin123', label: 'Administrador', canConfigure: true }
};

let currentUser = null;
let sheetUrl = localStorage.getItem('huntech-sheet-url') || '';
let currentFolio = null;
let currentTicketData = null;
let deliveryFilter = 'pendientes';
let deliveryResults = [];

const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value || ''; return div.innerHTML; }

function init() {
  $('loginForm').addEventListener('submit', login);
  $('logoutButton').addEventListener('click', logout);
  $('passwordToggle').addEventListener('click', togglePassword);
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => cambiarTab(tab.dataset.tab)));
  $('saveUrlButton').addEventListener('click', guardarUrl);
  $('testUrlButton').addEventListener('click', probarConexion);
  $('addConceptButton').addEventListener('click', () => agregarConcepto());
  $('clearFormButton').addEventListener('click', limpiarFormulario);
  $('ticketForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if ($('btnCrear').dataset.mode === 'edit') {
      guardarCambiosTicket();
    } else {
      crearTicket();
    }
  });
  $('searchButton').addEventListener('click', () => buscarTicket('e'));
  document.querySelectorAll('[data-delivery-filter]').forEach((button) => button.addEventListener('click', () => {
    deliveryFilter = button.dataset.deliveryFilter;
    document.querySelectorAll('[data-delivery-filter]').forEach((item) => item.classList.toggle('active', item === button));
    renderDeliveryResults();
  }));
  const savedUser = sessionStorage.getItem('huntech-user');
  if (savedUser && USERS[savedUser]) showApp(savedUser);
  agregarConcepto();
}

function login(event) {
  event.preventDefault();
  const username = $('loginUser').value.trim().toLowerCase();
  const user = USERS[username];
  if (!user || user.password !== $('loginPassword').value) {
    $('loginError').hidden = false;
    $('loginForm').classList.remove('is-error');
    void $('loginForm').offsetWidth;
    $('loginForm').classList.add('is-error');
    return;
  }
  sessionStorage.setItem('huntech-user', username);
  $('loginError').hidden = true;
  showApp(username);
}

function togglePassword() {
  const input = $('loginPassword');
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  $('passwordToggle').textContent = visible ? 'Mostrar' : 'Ocultar';
  $('passwordToggle').setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
}

function showApp(username) {
  currentUser = username;
  $('loginPanel').hidden = true;
  $('appShell').hidden = false;
  $('userBadge').textContent = USERS[username].label;
  $('configBox').hidden = false;
  initConfig();
}

function logout() {
  sessionStorage.removeItem('huntech-user');
  currentUser = null;
  $('appShell').hidden = true;
  $('loginPanel').hidden = false;
  $('loginForm').reset();
}

function initConfig() {
  $('sheetUrl').value = sheetUrl;
  updateConfigStatus();
}

function updateConfigStatus() {
  $('configStatus').textContent = sheetUrl ? 'Conectado a Google Sheets.' : 'Configura Google Sheets para guardar los tickets.';
  $('configBox').classList.toggle('connected', Boolean(sheetUrl));
}

function getSheetUrl() {
  const value = sheetUrl.trim();
  if (!value) throw new Error('Primero pega la URL de la aplicación web de Apps Script.');
  const url = new URL(value);
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url.origin + url.pathname.replace(/\/$/, ''))) {
    throw new Error('La URL debe ser la aplicación web de Apps Script y terminar en /exec.');
  }
  return url.origin + url.pathname.replace(/\/$/, '');
}

function guardarUrl() {
  sheetUrl = $('sheetUrl').value.trim();
  localStorage.setItem('huntech-sheet-url', sheetUrl);
  updateConfigStatus();
}

async function probarConexion() {
  const button = $('testUrlButton');
  button.disabled = true;
  button.textContent = 'Probando...';
  try {
    await callSheet({});
    $('configStatus').textContent = 'Conexión correcta con Google Sheets.';
    $('configBox').classList.add('connected');
  } catch (error) {
    $('configStatus').textContent = error.message;
    $('configBox').classList.remove('connected');
  } finally {
    button.disabled = false;
    button.textContent = 'Probar conexión';
  }
}

function cambiarTab(name) {
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach((tab) => {
    tab.hidden = !tab.id.endsWith(name);
    tab.classList.toggle('active', tab.id.endsWith(name));
  });
}

function callSheet(payload) {
  return new Promise((resolve, reject) => {
    let endpoint;
    try {
      endpoint = getSheetUrl();
    } catch (error) {
      reject(error);
      return;
    }
    const callbackName = `huntechCallback${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const query = Object.keys(payload).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(payload[key])}`).join('&');
    const script = document.createElement('script');
    const cleanup = () => { delete window[callbackName]; script.remove(); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('No hubo respuesta de Google Sheets. Verifica la URL y el despliegue.')); }, 10000);
    window[callbackName] = (result) => { clearTimeout(timeout); cleanup(); resolve(result); };
    script.onerror = () => { clearTimeout(timeout); cleanup(); reject(new Error('No se pudo conectar con Google Sheets. Verifica que la URL termine en /exec, que el acceso sea "Cualquier usuario" y que la implementación esté actualizada.')); };
    script.src = `${endpoint}?${query}${query ? '&' : ''}callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

function agregarConcepto(desc = '', monto = '') {
  const row = document.createElement('div');
  row.className = 'concepto-row';
  row.innerHTML = `<input type="text" class="concepto-desc" placeholder="Ej: Diagnóstico" value="${escapeHtml(desc)}"><input type="number" min="0" step="0.01" class="concepto-monto" placeholder="0.00" value="${monto}" aria-label="Monto del concepto"><button type="button" class="remove-btn" aria-label="Quitar concepto">×</button>`;
  row.querySelector('.concepto-monto').addEventListener('input', actualizarTotal);
  row.querySelector('.remove-btn').addEventListener('click', () => { row.remove(); actualizarTotal(); });
  $('conceptosList').appendChild(row);
  actualizarTotal();
}

function getConceptos() {
  return [...document.querySelectorAll('.concepto-row')].map((row) => ({
    desc: row.querySelector('.concepto-desc').value.trim(),
    monto: parseFloat(row.querySelector('.concepto-monto').value) || 0
  })).filter((item) => item.desc && item.monto > 0);
}

function actualizarTotal() {
  $('montoTotalDisplay').textContent = fmt(getConceptos().reduce((total, item) => total + item.monto, 0));
}

function parseConceptosText(text = '') {
  if (!text) return [];
  return text.split('|').map((item) => item.trim()).filter(Boolean).map((item) => {
    const match = item.match(/^(.*?)(?:\s*:\s*\$?([\d,]+(?:\.\d{1,2})?))?$/);
    if (!match) return { desc: item, monto: 0 };
    const desc = (match[1] || item).trim();
    const monto = Number((match[2] || '0').replace(/,/g, '')) || 0;
    return { desc, monto };
  }).filter((item) => item.desc && item.monto > 0);
}

function normalizeTicketData(data = {}) {
  const conceptos = Array.isArray(data.conceptos) && data.conceptos.length
    ? data.conceptos
    : parseConceptosText(data['Conceptos'] || data.conceptosText || '');
  const monto = Number(data['Monto total'] ?? data.monto ?? conceptos.reduce((total, item) => total + Number(item.monto || 0), 0) ?? 0) || 0;
  const anticipo = Number(data['Anticipo'] ?? data.anticipo ?? 0) || 0;
  const entregado = String(data.Entregado ?? data.entregado ?? 'No').toLowerCase() === 'si';
  const saldo = entregado ? 0 : Math.max(monto - anticipo, 0);

  return {
    folio: data.Folio || data.folio || '',
    fecha: data['Fecha recibido'] || data.fecha || '',
    cliente: data.Cliente || data.cliente || '',
    telefono: data.Telefono || data.telefono || '',
    tipo: data['Tipo de equipo'] || data.tipo || '',
    marca: data.Marca || data.marca || '',
    modelo: data.Modelo || data.modelo || '',
    enciende: data.Enciende || data.enciende || '',
    falla: data['Falla reportada'] || data.falla || '',
    conceptos,
    monto,
    anticipo,
    saldo,
    entregado,
    fechaEntrega: data['Fecha de entrega'] || data.fechaEntrega || ''
  };
}

function getTicketBalanceLabel(ticket) {
  if (ticket.entregado || Number(ticket.saldo || 0) <= 0) return 'Pagado / Liquidado';
  return 'Saldo pendiente';
}

async function crearTicket() {
  const cliente = $('r-cliente').value.trim();
  const conceptos = getConceptos();
  $('err-r-cliente').hidden = Boolean(cliente);
  $('err-r-concepto').hidden = conceptos.length > 0;
  $('err-r-conexion').hidden = Boolean(sheetUrl);
  if (!cliente || !conceptos.length || !sheetUrl) return;

  const monto = conceptos.reduce((total, item) => total + item.monto, 0);
  const anticipo = parseFloat($('r-anticipo').value) || 0;
  const data = {
    action: 'create',
    fecha: new Date().toLocaleDateString('es-MX'),
    cliente,
    telefono: $('r-telefono').value.trim(),
    tipo: $('r-tipo').value,
    marca: $('r-marca').value.trim(),
    modelo: $('r-modelo').value.trim(),
    enciende: $('r-enciende').value,
    falla: $('r-falla').value.trim(),
    conceptosText: conceptos.map((item) => `${item.desc}: ${fmt(item.monto)}`).join(' | '),
    monto,
    anticipo
  };

  $('btnCrear').disabled = true;
  $('btnCrear').textContent = 'Guardando...';
  try {
    const result = await callSheet(data);
    if (!result.success) throw new Error(result.error || 'No se pudo guardar');
    currentFolio = result.folio;
    currentTicketData = { ...data, folio: result.folio, conceptos, entregado: false };
    renderPreview(currentTicketData);
    $('clearFormButton').hidden = false;
  } catch (error) {
    alert(`No se pudo guardar: ${error.message}`);
  } finally {
    $('btnCrear').disabled = false;
    $('btnCrear').textContent = 'Generar comprobante';
  }
}

async function guardarCambiosTicket() {
  const folio = $('btnCrear').dataset.editFolio;
  const cliente = $('r-cliente').value.trim();
  const conceptos = getConceptos();

  $('err-r-cliente').hidden = Boolean(cliente);
  $('err-r-concepto').hidden = conceptos.length > 0;
  $('err-r-conexion').hidden = Boolean(sheetUrl);
  if (!cliente || !conceptos.length || !sheetUrl || !folio) return;

  const monto = conceptos.reduce((total, item) => total + item.monto, 0);
  const anticipo = parseFloat($('r-anticipo').value) || 0;
  const payload = {
    fecha: new Date().toLocaleDateString('es-MX'),
    cliente,
    telefono: $('r-telefono').value.trim(),
    tipo: $('r-tipo').value,
    marca: $('r-marca').value.trim(),
    modelo: $('r-modelo').value.trim(),
    enciende: $('r-enciende').value,
    falla: $('r-falla').value.trim(),
    conceptosText: conceptos.map((item) => `${item.desc}: ${fmt(item.monto)}`).join(' | '),
    conceptos,
    monto,
    anticipo,
    saldo: monto - anticipo
  };

  $('btnCrear').disabled = true;
  $('btnCrear').textContent = 'Guardando cambios...';

  try {
    const row = deliveryResults.find((item) => String(item.Folio) === String(folio));
    const status = row && String(row.Entregado).toLowerCase() === 'si' ? 'Si' : 'No';
    const result = await callSheet({
      action: 'update',
      folio,
      fecha: payload.fecha,
      cliente: payload.cliente,
      telefono: payload.telefono,
      tipo: payload.tipo,
      marca: payload.marca,
      modelo: payload.modelo,
      enciende: payload.enciende,
      falla: payload.falla,
      conceptosText: payload.conceptosText,
      conceptos: JSON.stringify(payload.conceptos),
      monto: payload.monto,
      anticipo: payload.anticipo,
      saldo: payload.saldo,
      entregado: status,
      fechaEntrega: row && row['Fecha de entrega'] ? row['Fecha de entrega'] : ''
    });

    if (!result.success) throw new Error(result.error || 'No se pudo actualizar');

    const updated = {
      ...row,
      Cliente: payload.cliente,
      Telefono: payload.telefono,
      'Tipo de equipo': payload.tipo,
      Marca: payload.marca,
      Modelo: payload.modelo,
      Enciende: payload.enciende,
      'Falla reportada': payload.falla,
      Conceptos: payload.conceptosText,
      'Monto total': payload.monto,
      Anticipo: payload.anticipo,
      'Saldo pendiente': payload.saldo,
      Entregado: status,
      'Fecha de entrega': row && row['Fecha de entrega'] ? row['Fecha de entrega'] : ''
    };

    deliveryResults = deliveryResults.map((item) => String(item.Folio) === String(folio) ? updated : item);
    currentTicketData = { ...payload, folio, entregado: status === 'Si' };
    renderPreview(currentTicketData);
    renderDeliveryResults();
    $('ok-entregado').hidden = true;
    $('clearFormButton').hidden = false;
    $('btnCrear').dataset.editFolio = '';
    $('btnCrear').dataset.mode = '';
    $('btnCrear').textContent = 'Generar comprobante';
  } catch (error) {
    alert(`No se pudo guardar: ${error.message}`);
  } finally {
    $('btnCrear').disabled = false;
  }
}

function limpiarFormulario() {
  $('ticketForm').reset();
  $('conceptosList').innerHTML = '';
  $('r-preview').innerHTML = '';
  $('clearFormButton').hidden = true;
  $('err-r-cliente').hidden = true;
  $('err-r-concepto').hidden = true;
  $('err-r-conexion').hidden = true;
  $('btnCrear').dataset.editFolio = '';
  $('btnCrear').dataset.mode = '';
  $('btnCrear').textContent = 'Generar comprobante';
  currentFolio = null;
  currentTicketData = null;
  agregarConcepto();
  $('r-cliente').focus();
}

function renderPreview(ticket) {
  const saldo = Number(ticket.saldo ?? (ticket.monto - ticket.anticipo) ?? 0);
  const estadoLabel = getTicketBalanceLabel({ ...ticket, saldo, entregado: Boolean(ticket.entregado) });
  $('r-preview').innerHTML = `<div class="ticket-outer"><div class="ticket-header"><div class="ticket-brand"><img class="ticket-logo" src="assets/logo-huntech.png" alt="Huntech"><div><div class="brand-name">HUNTECH</div><div class="sub2">Comprobante de servicio</div></div></div></div><div class="ticket-body"><div class="folio-pill"><span>Folio</span><strong>${escapeHtml(ticket.folio)}</strong></div><div class="ticket-meta"><div class="t-row"><span class="t-label">Fecha</span><span>${escapeHtml(ticket.fecha)}</span></div><div class="t-row"><span class="t-label">Cliente</span><span>${escapeHtml(ticket.cliente)}</span></div><div class="t-row"><span class="t-label">Equipo</span><span>${escapeHtml(`${ticket.tipo} ${ticket.marca} ${ticket.modelo}`)}</span></div></div><div class="t-section">Servicio</div>${(ticket.conceptos || []).map((item) => `<div class="t-row concept"><span>${escapeHtml(item.desc)}</span><span>${fmt(item.monto)}</span></div>`).join('')}<div class="totales"><div class="t-row"><span>Monto total</span><span>${fmt(ticket.monto)}</span></div><div class="t-row"><span>Anticipo</span><span>${fmt(ticket.anticipo)}</span></div><div class="t-row saldo"><span>${estadoLabel}</span><span>${fmt(saldo)}</span></div></div><div class="footer-note"><span>Gracias por su preferencia.</span><small>Huntech · Servicio técnico</small></div></div></div><div class="download-wrap"><button type="button" class="primary-button" id="downloadButton">Descargar comprobante PDF</button></div>`;
  $('downloadButton').addEventListener('click', () => descargarPDF(currentTicketData));
}

function llenarFormularioDesdeTicket(ticket) {
  const normalized = normalizeTicketData(ticket);
  const conceptos = normalized.conceptos.length ? normalized.conceptos : [{ desc: 'Diagnóstico', monto: normalized.monto || 0 }];

  $('ticketForm').reset();
  $('conceptosList').innerHTML = '';
  conceptos.forEach((item) => agregarConcepto(item.desc, item.monto));
  $('r-cliente').value = normalized.cliente || '';
  $('r-telefono').value = normalized.telefono || '';
  $('r-tipo').value = normalized.tipo || 'Laptop';
  $('r-marca').value = normalized.marca || '';
  $('r-modelo').value = normalized.modelo || '';
  $('r-enciende').value = normalized.enciende || 'Si';
  $('r-falla').value = normalized.falla || '';
  $('r-anticipo').value = normalized.anticipo || 0;
  $('btnCrear').dataset.editFolio = normalized.folio || '';
  $('btnCrear').dataset.mode = 'edit';
  $('btnCrear').textContent = 'Guardar cambios';
  actualizarTotal();
}

async function buscarTicket(prefix) {
  const query = $(`${prefix}-folio`).value.trim();
  $(`err-${prefix}-folio`).hidden = true;
  if (!query || !sheetUrl) return;
  try {
    const result = await callSheet({ action: 'get', query });
    if (!result.success) throw new Error('No se encontraron tickets con ese dato');
    deliveryResults = result.data || [];
    renderDeliveryResults();
  } catch (error) {
    $(`err-${prefix}-folio`).hidden = false;
    $(`${prefix}-datos`).innerHTML = '';
    deliveryResults = [];
  }
}

function renderDeliveryResults() {
  const visible = deliveryResults.filter((data) => {
    const ticket = normalizeTicketData(data);
    return deliveryFilter === 'todos' || (deliveryFilter === 'entregados' ? ticket.entregado : !ticket.entregado);
  });

  $('e-datos').innerHTML = visible.length ? visible.map((data) => {
    const ticket = normalizeTicketData(data);
    const saldoLabel = getTicketBalanceLabel(ticket);
    const actions = ticket.entregado
      ? `<div class="delivery-actions"><button type="button" class="secondary-button" data-edit-folio="${escapeHtml(ticket.folio)}">Editar conceptos</button><button type="button" class="secondary-button" data-reprint-folio="${escapeHtml(ticket.folio)}">Reimprimir ticket</button></div>`
      : `<div class="delivery-actions"><button type="button" class="primary-button deliver-result-button" data-folio="${escapeHtml(ticket.folio)}">Marcar como entregado</button><button type="button" class="secondary-button" data-edit-folio="${escapeHtml(ticket.folio)}">Editar conceptos</button><button type="button" class="secondary-button" data-reprint-folio="${escapeHtml(ticket.folio)}">Reimprimir ticket</button></div>`;
    const estadoTexto = ticket.entregado ? `Entregado el ${escapeHtml(ticket.fechaEntrega || '—')}` : 'Pendiente';
    return `<article class="delivery-result"><div class="folio-display"><strong>${escapeHtml(ticket.cliente)}</strong> - ${escapeHtml(`${ticket.tipo} ${ticket.marca} ${ticket.modelo}`)}<br>Folio: ${escapeHtml(ticket.folio)}<br>Teléfono: ${escapeHtml(ticket.telefono)}<br>Recibido: ${escapeHtml(ticket.fecha)} - ${saldoLabel}: ${fmt(ticket.saldo)}<br>Estado: ${estadoTexto}</div>${actions}</article>`;
  }).join('') : '<p class="hint">No hay tickets en este filtro.</p>';

  document.querySelectorAll('.deliver-result-button').forEach((button) => button.addEventListener('click', () => marcarEntregado(button.dataset.folio)));
  document.querySelectorAll('[data-edit-folio]').forEach((button) => button.addEventListener('click', () => editarTicket(button.dataset.editFolio)));
  document.querySelectorAll('[data-reprint-folio]').forEach((button) => button.addEventListener('click', () => reimprimirTicket(button.dataset.reprintFolio)));
}

function editarTicket(folio) {
  const ticket = deliveryResults.find((item) => String(item.Folio) === String(folio));
  if (!ticket) return;
  llenarFormularioDesdeTicket(ticket);
  cambiarTab('recibir');
  $('ok-entregado').hidden = true;
}

function reimprimirTicket(folio) {
  const ticket = deliveryResults.find((item) => String(item.Folio) === String(folio));
  if (!ticket) return;
  const normalized = normalizeTicketData(ticket);
  descargarPDF({
    folio: normalized.folio,
    fecha: normalized.fecha,
    cliente: normalized.cliente,
    tipo: normalized.tipo,
    marca: normalized.marca,
    modelo: normalized.modelo,
    conceptos: normalized.conceptos.length ? normalized.conceptos : [{ desc: 'Servicio', monto: normalized.monto }],
    monto: normalized.monto,
    anticipo: normalized.anticipo,
    saldo: normalized.saldo,
    entregado: normalized.entregado
  });
}

async function marcarEntregado(folio) {
  const fechaEntrega = new Date().toLocaleDateString('es-MX');
  const button = document.querySelector(`[data-folio="${CSS.escape(folio)}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = 'Actualizando...';
  }

  try {
    const result = await callSheet({ action: 'deliver', folio, fechaEntrega });
    if (!result.success) throw new Error(result.error || 'No se pudo actualizar');

    deliveryResults = deliveryResults.map((data) => {
      if (String(data.Folio) !== String(folio)) return data;
      return { ...data, Entregado: 'Si', 'Fecha de entrega': fechaEntrega, 'Saldo pendiente': 0 };
    });

    renderDeliveryResults();
    $('ok-entregado').hidden = false;
    $('ok-entregado').textContent = `El ticket ${folio} fue marcado como entregado y su saldo quedó pagado/liquidado.`;
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = 'Marcar como entregado';
    }
    alert(`No se pudo actualizar: ${error.message}`);
  }
}

function descargarPDF(ticket) {
  const { jsPDF } = window.jspdf;
  const width = 100;
  const height = 130 + Math.max(0, (ticket.conceptos || []).length - 1) * 5;
  const doc = new jsPDF({ unit: 'mm', format: [width, height] });
  const orange = [240, 90, 40];
  const gray = [85, 85, 85];
  const monto = Number(ticket.monto || 0);
  const anticipo = Number(ticket.anticipo || 0);
  const saldo = Number(ticket.saldo ?? Math.max(monto - anticipo, 0));
  const saldoLabel = getTicketBalanceLabel({ ...ticket, saldo, entregado: Boolean(ticket.entregado) });

  doc.setFillColor(...orange);
  doc.rect(0, 0, width, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('HUNTECH', width / 2, 10, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Comprobante de servicio', width / 2, 16, { align: 'center' });

  let y = 30;
  doc.setTextColor(...orange);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Folio: ${ticket.folio}`, width / 2, y, { align: 'center' });
  y += 8;
  doc.setDrawColor(...orange);
  doc.line(6, y - 4, width - 6, y - 4);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const field = (label, value) => {
    doc.setTextColor(...gray);
    doc.text(label, 6, y);
    doc.setTextColor(0, 0, 0);
    doc.text(String(value || ''), width - 6, y, { align: 'right' });
    y += 5;
  };

  field('Fecha:', ticket.fecha);
  field('Cliente:', ticket.cliente);
  field('Equipo:', `${ticket.tipo} ${ticket.marca} ${ticket.modelo}`.trim());
  y += 3;

  doc.setTextColor(...orange);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SERVICIO', 6, y);
  y += 5;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  (ticket.conceptos || []).forEach((item) => {
    const lines = doc.splitTextToSize(item.desc, width - 30);
    doc.text(lines, 6, y);
    doc.text(`$${(Number(item.monto) || 0).toFixed(2)}`, width - 6, y, { align: 'right' });
    y += 4.4 * lines.length;
  });

  y += 3;
  doc.setFillColor(247, 247, 247);
  doc.rect(6, y - 4, width - 12, 18, 'F');
  let by = y;
  doc.setFontSize(9);
  doc.text('Monto total', 9, by);
  doc.text(`$${monto.toFixed(2)}`, width - 9, by, { align: 'right' });
  by += 5;
  doc.text('Anticipo', 9, by);
  doc.text(`$${anticipo.toFixed(2)}`, width - 9, by, { align: 'right' });
  by += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...orange);
  doc.text(saldoLabel, 9, by);
  doc.text(`$${saldo.toFixed(2)}`, width - 9, by, { align: 'right' });

  y += 22;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Gracias por su preferencia.', width / 2, y, { align: 'center' });
  doc.setTextColor(...gray);
  doc.text('Huntech · Servicio técnico', width / 2, y + 5, { align: 'center' });
  doc.save(`ticket-${ticket.folio}.pdf`);
}

init();
