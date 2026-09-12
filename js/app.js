const USERS = {
  tecnico: { password: 'tecnico123', label: 'Técnico', canConfigure: false },
  administrador: { password: 'admin123', label: 'Administrador', canConfigure: true }
};

let currentUser = null;
let sheetUrl = localStorage.getItem('huntech-sheet-url') || '';
let currentFolio = null;
let currentTicketData = null;

const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value || ''; return div.innerHTML; }

function init() {
  $('loginForm').addEventListener('submit', login);
  $('logoutButton').addEventListener('click', logout);
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => cambiarTab(tab.dataset.tab)));
  $('saveUrlButton').addEventListener('click', guardarUrl);
  $('addConceptButton').addEventListener('click', () => agregarConcepto());
  $('ticketForm').addEventListener('submit', (event) => { event.preventDefault(); crearTicket(); });
  $('searchButton').addEventListener('click', () => buscarTicket('e'));
  $('btnEntregar').addEventListener('click', marcarEntregado);
  const savedUser = sessionStorage.getItem('huntech-user');
  if (savedUser && USERS[savedUser]) showApp(savedUser);
  agregarConcepto();
}

function login(event) {
  event.preventDefault();
  const username = $('loginUser').value.trim().toLowerCase();
  const user = USERS[username];
  if (!user || user.password !== $('loginPassword').value) { $('loginError').hidden = false; return; }
  sessionStorage.setItem('huntech-user', username);
  $('loginError').hidden = true;
  showApp(username);
}

function showApp(username) {
  currentUser = username;
  $('loginPanel').hidden = true;
  $('appShell').hidden = false;
  $('userBadge').textContent = USERS[username].label;
  $('configBox').hidden = !USERS[username].canConfigure;
  if (USERS[username].canConfigure) initConfig();
}

function logout() { sessionStorage.removeItem('huntech-user'); currentUser = null; $('appShell').hidden = true; $('loginPanel').hidden = false; $('loginForm').reset(); }
function initConfig() { $('sheetUrl').value = sheetUrl; updateConfigStatus(); }
function updateConfigStatus() { $('configStatus').textContent = sheetUrl ? 'Conectado a Google Sheets.' : 'Configura Google Sheets para guardar los tickets.'; $('configBox').classList.toggle('connected', Boolean(sheetUrl)); }
function guardarUrl() { sheetUrl = $('sheetUrl').value.trim(); localStorage.setItem('huntech-sheet-url', sheetUrl); updateConfigStatus(); }
function cambiarTab(name) { document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === name)); document.querySelectorAll('.tab-content').forEach((tab) => { tab.hidden = !tab.id.endsWith(name); tab.classList.toggle('active', tab.id.endsWith(name)); }); }
async function callSheet(payload) { const query = Object.keys(payload).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(payload[key])}`).join('&'); const response = await fetch(`${sheetUrl}?${query}`); return response.json(); }

function agregarConcepto(desc = '', monto = '') { const row = document.createElement('div'); row.className = 'concepto-row'; row.innerHTML = `<input type="text" class="concepto-desc" placeholder="Ej: Diagnóstico" value="${escapeHtml(desc)}"><input type="number" min="0" step="0.01" class="concepto-monto" placeholder="0.00" value="${monto}" aria-label="Monto del concepto"><button type="button" class="remove-btn" aria-label="Quitar concepto">×</button>`; row.querySelector('.concepto-monto').addEventListener('input', actualizarTotal); row.querySelector('.remove-btn').addEventListener('click', () => { row.remove(); actualizarTotal(); }); $('conceptosList').appendChild(row); actualizarTotal(); }
function getConceptos() { return [...document.querySelectorAll('.concepto-row')].map((row) => ({ desc: row.querySelector('.concepto-desc').value.trim(), monto: parseFloat(row.querySelector('.concepto-monto').value) || 0 })).filter((item) => item.desc && item.monto > 0); }
function actualizarTotal() { $('montoTotalDisplay').textContent = fmt(getConceptos().reduce((total, item) => total + item.monto, 0)); }

async function crearTicket() {
  const cliente = $('r-cliente').value.trim(); const conceptos = getConceptos();
  $('err-r-cliente').hidden = Boolean(cliente); $('err-r-concepto').hidden = conceptos.length > 0; $('err-r-conexion').hidden = Boolean(sheetUrl);
  if (!cliente || !conceptos.length || !sheetUrl) return;
  const monto = conceptos.reduce((total, item) => total + item.monto, 0); const anticipo = parseFloat($('r-anticipo').value) || 0; const data = { action:'create', fecha:new Date().toLocaleDateString('es-MX'), cliente, telefono:$('r-telefono').value.trim(), tipo:$('r-tipo').value, marca:$('r-marca').value.trim(), modelo:$('r-modelo').value.trim(), enciende:$('r-enciende').value, falla:$('r-falla').value.trim(), conceptosText:conceptos.map((item) => `${item.desc}: ${fmt(item.monto)}`).join(' | '), monto, anticipo };
  $('btnCrear').disabled = true; $('btnCrear').textContent = 'Guardando...';
  try { const result = await callSheet(data); if (!result.success) throw new Error(result.error || 'No se pudo guardar'); currentFolio = result.folio; currentTicketData = { ...data, folio:result.folio, conceptos }; renderPreview(currentTicketData); } catch (error) { alert(`No se pudo guardar: ${error.message}`); } finally { $('btnCrear').disabled = false; $('btnCrear').textContent = 'Generar comprobante'; }
}

function renderPreview(ticket) { const saldo = ticket.monto - ticket.anticipo; $('r-preview').innerHTML = `<div class="ticket-outer"><div class="ticket-header"><h2>HUNTECH</h2><div class="sub2">Comprobante de servicio</div></div><div class="ticket-body"><div class="folio-display"><strong>Folio: ${escapeHtml(ticket.folio)}</strong><br>Guarda este folio para dar seguimiento</div><div class="t-row"><span class="t-label">Fecha</span><span>${escapeHtml(ticket.fecha)}</span></div><div class="t-row"><span class="t-label">Cliente</span><span>${escapeHtml(ticket.cliente)}</span></div><div class="t-row"><span class="t-label">Equipo</span><span>${escapeHtml(`${ticket.tipo} ${ticket.marca} ${ticket.modelo}`)}</span></div><div class="t-section">Servicio</div>${ticket.conceptos.map((item) => `<div class="t-row"><span>${escapeHtml(item.desc)}</span><span>${fmt(item.monto)}</span></div>`).join('')}<div class="totales"><div class="t-row"><span>Monto total</span><span>${fmt(ticket.monto)}</span></div><div class="t-row"><span>Anticipo</span><span>${fmt(ticket.anticipo)}</span></div><div class="t-row saldo"><span>Saldo pendiente</span><span>${fmt(saldo)}</span></div></div><hr><div class="footer-note">Gracias por su preferencia.</div></div></div><div class="download-wrap"><button type="button" class="primary-button" id="downloadButton">Descargar comprobante PDF</button></div>`; $('downloadButton').addEventListener('click', () => descargarPDF(currentTicketData)); }

async function buscarTicket(prefix) { const folio = $(`${prefix}-folio`).value.trim(); $(`err-${prefix}-folio`).hidden = true; if (!folio || !sheetUrl) return; try { const result = await callSheet({ action:'get', folio }); if (!result.success) throw new Error('No se encontró ese folio'); const data = result.data; $(`${prefix}-datos`).innerHTML = `<div class="folio-display"><strong>${escapeHtml(data.Cliente)}</strong> - ${escapeHtml(`${data['Tipo de equipo']} ${data.Marca} ${data.Modelo}`)}<br>Recibido: ${escapeHtml(data['Fecha recibido'])} - Saldo pendiente: ${fmt(Number(data['Saldo pendiente']) || 0)}<br>Entregado: ${escapeHtml(data.Entregado)}</div>`; currentFolio = folio; const entregado = data.Entregado === 'Si'; $('btnEntregar').hidden = entregado; $('ok-entregado').hidden = !entregado; if (entregado) $('ok-entregado').textContent = `Este equipo ya fue entregado el ${data['Fecha de entrega']}.`; } catch (error) { $(`err-${prefix}-folio`).hidden = false; $(`${prefix}-datos`).innerHTML = ''; $('btnEntregar').hidden = true; } }
async function marcarEntregado() { const fechaEntrega = new Date().toLocaleDateString('es-MX'); try { const result = await callSheet({ action:'deliver', folio:currentFolio, fechaEntrega }); if (!result.success) throw new Error(result.error || 'No se pudo actualizar'); $('btnEntregar').hidden = true; $('ok-entregado').hidden = false; $('ok-entregado').textContent = `Equipo marcado como entregado el ${fechaEntrega}.`; } catch (error) { alert(`No se pudo actualizar: ${error.message}`); } }

function descargarPDF(ticket) { const { jsPDF } = window.jspdf; const width = 100; const height = 130 + Math.max(0, ticket.conceptos.length - 1) * 5; const doc = new jsPDF({ unit:'mm', format:[width,height] }); const orange=[240,90,40], gray=[85,85,85]; doc.setFillColor(...orange); doc.rect(0,0,width,22,'F'); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text('HUNTECH',width/2,10,{align:'center'}); doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.text('Comprobante de servicio',width/2,16,{align:'center'}); let y=30; doc.setTextColor(...orange); doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text(`Folio: ${ticket.folio}`,width/2,y,{align:'center'}); y+=8; doc.setDrawColor(...orange); doc.line(6,y-4,width-6,y-4); doc.setTextColor(0,0,0); doc.setFont('helvetica','normal'); doc.setFontSize(9); const field=(label,value)=>{doc.setTextColor(...gray);doc.text(label,6,y);doc.setTextColor(0,0,0);doc.text(String(value||''),width-6,y,{align:'right'});y+=5;}; field('Fecha:',ticket.fecha); field('Cliente:',ticket.cliente); field('Equipo:',`${ticket.tipo} ${ticket.marca} ${ticket.modelo}`.trim()); y+=3; doc.setTextColor(...orange); doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.text('SERVICIO',6,y); y+=5; doc.setTextColor(0,0,0); doc.setFont('helvetica','normal'); doc.setFontSize(8.5); ticket.conceptos.forEach((item)=>{const lines=doc.splitTextToSize(item.desc,width-30);doc.text(lines,6,y);doc.text(`$${item.monto.toFixed(2)}`,width-6,y,{align:'right'});y+=4.4*lines.length;}); y+=3; doc.setFillColor(247,247,247); doc.rect(6,y-4,width-12,18,'F'); let by=y; doc.setFontSize(9); doc.text('Monto total',9,by);doc.text(`$${ticket.monto.toFixed(2)}`,width-9,by,{align:'right'});by+=5;doc.text('Anticipo',9,by);doc.text(`$${ticket.anticipo.toFixed(2)}`,width-9,by,{align:'right'});by+=6;doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...orange);doc.text('Saldo pendiente',9,by);doc.text(`$${(ticket.monto-ticket.anticipo).toFixed(2)}`,width-9,by,{align:'right'});y+=22;doc.setDrawColor(220,220,220);doc.line(6,y,width-6,y);y+=8;doc.setFont('helvetica','italic');doc.setFontSize(7.5);doc.setTextColor(...gray);doc.text('Gracias por su preferencia.',width/2,y,{align:'center'});doc.save(`Huntech-Servicio-${ticket.folio}.pdf`); }

init();
