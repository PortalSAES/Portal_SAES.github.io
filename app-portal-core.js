import { initializeApp }  from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAnalytics }   from "https://www.gstatic.com/firebasejs/11.8.1/firebase-analytics.js";
import { getAuth, onAuthStateChanged, signOut }
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import {
getFirestore, collection, addDoc, updateDoc, deleteDoc,
doc, query, orderBy, serverTimestamp, onSnapshot, getDoc, setDoc, getDocs, where
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import {
getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";
const app  = initializeApp({
apiKey:            "AIzaSyD3sNXaKgp-GpU46Lhx6DichJl15nMFTxU",
authDomain:        "sise-portal.firebaseapp.com",
projectId:         "sise-portal",
storageBucket:     "sise-portal.firebasestorage.app",
messagingSenderId: "244183203900",
appId:             "1:244183203900:web:1a524507a77fef8f968339",
measurementId:     "G-851590HRW3"
});
window.__firebaseApp = app;
try { getAnalytics(app); } catch(e) { console.warn('Analytics no disponible (posible ad-blocker):', e); }
const auth = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

// Persistir sesión en localStorage para evitar re-login en recargas
import('https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js').then(({ browserLocalPersistence, setPersistence }) => {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
});
let currentUser    = null;
let currentUserRol = "";          // cargado de Firestore: "Supervisor", "Formador", etc.
let allCasos       = [];
let boEditId       = null;
let allPendientes  = [];
let pendEditId     = null;
let pendViewDay    = new Date();   // día visible en pendientes (navegación día a día)
let pendFilterMode = 'todos';      // 'todos' | 'mios'
let showMisAlertados = false;      // modo filtro mis alertados
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
let TIPIFICACIONES    = [];
let CATEGORIAS_EXTRA  = [];   // categorías vacías (sin tipis) en Firestore
let _tipiActiveCat    = null;
let _tipiEditId       = null;   // null = crear, string docId = editar
let _catEditOld       = null;   // null = crear, string = renombrar
const TIPI_SEMILLA = [
{ categoria: 'ACCESOS', modalidad: 'TODAS', proceso: 'ACCESOS', subProceso: 'MFA',                      asunto: 'Restablecimiento MFA por cambio de celular',                                        aplica: 'Si es un estudiante antiguo que debemos mandar activar su código para que pague su trámite (FECHA NACIMIENTO + DIRECCIÓN + DNI) COLA DE PROCESOS', tipoAtencion: 'Requerimiento', plazo: '' },
{ categoria: 'ACCESOS', modalidad: 'TODAS', proceso: 'ACCESOS', subProceso: 'MFA',                      asunto: 'Desinstalación de app Authenticator',                                                aplica: 'Cuando un estudiante ingresa a la cola de accesos, matrícula o reincorporaciones para consultas generales',                                         tipoAtencion: 'Consulta',      plazo: '' },
{ categoria: 'ACCESOS', modalidad: 'TODAS', proceso: 'ACCESOS', subProceso: 'MFA',                      asunto: 'Desinstalación de app Authenticator para restablecimiento de contraseña',             aplica: '',                                                                                                                                               tipoAtencion: 'Consulta',      plazo: '' },
{ categoria: 'ACCESOS', modalidad: 'TODAS', proceso: 'ACCESOS', subProceso: 'MFA',                      asunto: 'Proceso MFA',                                                                       aplica: 'Cuando se le brinda la información del proceso de autenticación.',                                                                                  tipoAtencion: 'Consulta',      plazo: '' },
{ categoria: 'ACCESOS', modalidad: 'TODAS', proceso: 'ACCESOS', subProceso: 'No le llegan sus accesos', asunto: 'No tiene correo institucional',                                                      aplica: '',                                                                                                                                               tipoAtencion: 'Requerimiento', plazo: '' },
{ categoria: 'ACCESOS', modalidad: 'TODAS', proceso: 'ACCESOS', subProceso: 'No le llegan sus accesos', asunto: 'Venta nueva aún no tiene matrícula',                                                  aplica: 'datos',                                                                                                                                          tipoAtencion: 'Requerimiento', plazo: '' },
{ categoria: 'ACCESOS', modalidad: 'TODAS', proceso: 'ACCESOS', subProceso: 'No le llegan sus accesos', asunto: 'No le llegan sus accesos a su correo personal',                                       aplica: 'Cuando le brindamos la información de sus accesos correctos.',                                                                                      tipoAtencion: 'Consulta',      plazo: '' },
{ categoria: 'ACCESOS', modalidad: 'TODAS', proceso: 'ACCESOS', subProceso: 'No le llegan sus accesos', asunto: 'Error de correo personal',                                                           aplica: 'Cuando el área de ventas crea con el DNI el ID (Código), derivar al back',                                                                          tipoAtencion: 'Queja',         plazo: '' },
{ categoria: 'ACCESOS', modalidad: 'TODAS', proceso: 'ACCESOS', subProceso: 'No le llegan sus accesos', asunto: 'Estudiante antiguo quiere saber su acceso',                                           aplica: 'Cuando a pesar de tener el correo correcto y tiene matrícula indica que no llegó sus accesos. Lo cierra el CONTACT',                               tipoAtencion: 'Queja',         plazo: '' },
{ categoria: 'ACCESOS', modalidad: 'TODAS', proceso: 'ACCESOS', subProceso: 'No le llegan sus accesos', asunto: 'No le figura correo institucional con matrícula',                                     aplica: 'Cuando no le figura correo institucional a pesar de que ya tiene matrícula (EVIDENCIA) - COLA DE BACK',                                            tipoAtencion: 'Queja',         plazo: '' },
];
async function iniciarListenersTipi() {
const snap0 = await getDocs(collection(db, 'tipificaciones'));
if (snap0.empty) {
await Promise.all(TIPI_SEMILLA.map(t =>
addDoc(collection(db, 'tipificaciones'), { ...t, creadoEn: serverTimestamp() })
));
}
onSnapshot(
query(collection(db, 'tipificaciones'), orderBy('creadoEn', 'asc')),
snap => {
try {
TIPIFICACIONES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
refreshTipi();
} catch(e) { console.error('refreshTipi:', e); }
},
err => console.error('onSnapshot tipificaciones:', err)
);
onSnapshot(
collection(db, 'categorias'),
snap => {
try {
CATEGORIAS_EXTRA = snap.docs.map(d => d.data().nombre);
refreshTipi();
} catch(e) { console.error('refreshTipi (categorias):', e); }
},
err => console.error('onSnapshot categorias:', err)
);
}
function escH(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function isFormador() { return (currentUserRol || '').toLowerCase() === 'formador'; }
function tienePermiso() {
const r = (currentUserRol || '').toLowerCase();
return r === 'bo' || r === 'supervisor' || r === 'formador';
}
function tipoClass(tipo) {
if (!tipo) return 'sub';
const t = tipo.toLowerCase();
if (t.includes('consulta') && t.includes('queja')) return 'mixto';
if (t.includes('consulta') && t.includes('requerimiento')) return 'mixto';
if (t.includes('requerimiento') && t.includes('queja')) return 'mixto';
if (t.includes('consulta')) return 'consulta';
if (t.includes('requerimiento')) return 'requerimiento';
if (t.includes('queja')) return 'queja';
return 'sub';
}
function getCategoriasUnicas() {
const fromData = [...new Set(TIPIFICACIONES.map(t => t.categoria))];
const all = [...new Set([...fromData, ...CATEGORIAS_EXTRA])];
return all.sort();
}
function setupTipiFormador() {
const bar = document.getElementById('tipi-formador-bar');
if (isFormador()) {
bar.classList.add('visible');
document.getElementById('tipi-acordeones-container').classList.add('is-formador');
}
document.getElementById('btn-tipi-add-cat').addEventListener('click', () => abrirModalCat(null));
document.getElementById('btn-tipi-add-row').addEventListener('click', () => abrirModalTipi(null));
document.getElementById('btn-tipi-save').addEventListener('click', guardarTipi);
document.getElementById('btn-tipi-cancel').addEventListener('click',  () => cerrarModalTipi());
document.getElementById('modal-tipi-close').addEventListener('click', () => cerrarModalTipi());
document.getElementById('modal-tipi-overlay').addEventListener('click', e => { if (e.target === document.getElementById('modal-tipi-overlay')) cerrarModalTipi(); });
document.getElementById('btn-cat-save').addEventListener('click', guardarCategoria);
document.getElementById('btn-cat-cancel').addEventListener('click',  () => cerrarModalCat());
document.getElementById('modal-cat-close').addEventListener('click', () => cerrarModalCat());
document.getElementById('modal-cat-overlay').addEventListener('click', e => { if (e.target === document.getElementById('modal-cat-overlay')) cerrarModalCat(); });
}
function abrirModalTipi(tipi) {
_tipiEditId = tipi ? tipi.id : null;
document.getElementById('modal-tipi-title').textContent    = tipi ? 'Editar tipificación' : 'Nueva tipificación';
document.getElementById('btn-tipi-save-text').textContent  = tipi ? 'Guardar cambios' : 'Guardar tipificación';
const sel = document.getElementById('ft-categoria');
sel.innerHTML = getCategoriasUnicas().map(c => `<option value="${escH(c)}"${tipi && tipi.categoria===c?' selected':''}>${c}</option>`).join('');
document.getElementById('ft-modalidad').value  = tipi ? (tipi.modalidad  || '') : '';
document.getElementById('ft-subproceso').value = tipi ? (tipi.subProceso || '') : '';
document.getElementById('ft-asunto').value     = tipi ? (tipi.asunto     || '') : '';
document.getElementById('ft-aplica').value     = tipi ? (tipi.aplica     || '') : '';
document.getElementById('ft-plazo').value        = tipi ? (tipi.plazo       || '') : '';
document.getElementById('ft-plazo-web').value    = tipi ? (tipi.plazoWeb    || '') : '';
document.getElementById('ft-plazo-manual').value = tipi ? (tipi.plazoManual || '') : '';
document.getElementById('ft-tipo').value       = tipi ? (tipi.tipoAtencion || '') : '';
document.querySelectorAll('.tipi-tipo-btn').forEach(b => {
b.className = 'tipi-tipo-btn';
if (tipi && tipi.tipoAtencion && b.dataset.tipo === tipi.tipoAtencion) {
b.classList.add('sel-' + tipi.tipoAtencion.toLowerCase());
}
});
resetColaCheckboxes(tipi ? (tipi.colaDer || []) : []);
document.getElementById('ft-cola-nueva').value = '';
document.getElementById('modal-tipi-overlay').classList.add('open');
}
function cerrarModalTipi() {
document.getElementById('modal-tipi-overlay').classList.remove('open');
_tipiEditId = null;
}
window.selTipoAtencion = function(tipo) {
document.getElementById('ft-tipo').value = tipo;
document.querySelectorAll('.tipi-tipo-btn').forEach(b => {
b.className = 'tipi-tipo-btn';
if (b.dataset.tipo === tipo) b.classList.add('sel-' + tipo.toLowerCase());
});
};
window.toggleColaItem = function(label) {
const cb = label.querySelector('input[type=checkbox]');
cb.checked = !cb.checked;
label.classList.toggle('selected', cb.checked);
syncColaHidden();
};
function syncColaHidden() {
const vals = [];
document.querySelectorAll('#ft-cola-grid input[type=checkbox]').forEach(cb => {
if (cb.checked) vals.push(cb.value);
});
document.getElementById('ft-cola').value = JSON.stringify(vals);
}
window.agregarColaNueva = function() {
const inp = document.getElementById('ft-cola-nueva');
const val = inp.value.trim();
if (!val) return;
const existing = [...document.querySelectorAll('#ft-cola-grid input[type=checkbox]')].find(cb => cb.value === val);
if (existing) {
existing.checked = true;
existing.closest('.cola-checkbox-item').classList.add('selected');
syncColaHidden();
inp.value = '';
return;
}
const grid = document.getElementById('ft-cola-grid');
const label = document.createElement('label');
label.className = 'cola-checkbox-item selected';
label.setAttribute('onclick', 'toggleColaItem(this)');
label.innerHTML = `<input type="checkbox" value="${val.replace(/"/g,'&quot;')}" onclick="event.stopPropagation()" checked/> ${val}`;
grid.appendChild(label);
syncColaHidden();
inp.value = '';
};
function resetColaCheckboxes(selected) {
document.querySelectorAll('#ft-cola-grid input[type=checkbox]').forEach(cb => {
cb.checked = false;
cb.closest('.cola-checkbox-item').classList.remove('selected');
});
const grid = document.getElementById('ft-cola-grid');
const allItems = [...grid.querySelectorAll('.cola-checkbox-item')];
const builtIn = ['SISE Sedes','SISE Reclamos','SISE Retención','SISE Procesos, Proyectos y Registros','SISE Contact Center Back Office','SISE Cobranzas','SISE Empleabilidad','SISE Prog y Matrícula FCI y Tit'];
allItems.forEach(item => {
const cb = item.querySelector('input');
if (!builtIn.includes(cb.value)) item.remove();
});
if (selected && Array.isArray(selected)) {
selected.forEach(val => {
const cb = grid.querySelector(`input[value="${val}"]`);
if (cb) {
cb.checked = true;
cb.closest('.cola-checkbox-item').classList.add('selected');
} else {
const label = document.createElement('label');
label.className = 'cola-checkbox-item selected';
label.setAttribute('onclick', 'toggleColaItem(this)');
label.innerHTML = `<input type="checkbox" value="${val}" onclick="event.stopPropagation()" checked/> ${val}`;
grid.appendChild(label);
}
});
}
document.getElementById('ft-cola').value = JSON.stringify(selected || []);
}
async function guardarTipi() {
const cat    = document.getElementById('ft-categoria').value.trim();
const mod    = document.getElementById('ft-modalidad').value.trim();
const sub    = document.getElementById('ft-subproceso').value.trim();
const asunto = document.getElementById('ft-asunto').value.trim();
if (!cat || !mod || !sub || !asunto) { showToast('Completa los campos obligatorios (*)', 'error'); return; }
const btn = document.getElementById('btn-tipi-save');
btn.disabled = true;
const payload = {
categoria:    cat,
modalidad:    mod,
proceso:      cat,
subProceso:   sub,
asunto:       asunto,
aplica:       document.getElementById('ft-aplica').value.trim(),
tipoAtencion: document.getElementById('ft-tipo').value,
plazo:        document.getElementById('ft-plazo').value.trim(),
plazoWeb:     document.getElementById('ft-plazo-web').value.trim(),
plazoManual:  document.getElementById('ft-plazo-manual').value.trim(),
colaDer:      JSON.parse(document.getElementById('ft-cola').value || '[]'),
};
try {
if (_tipiEditId !== null) {
await updateDoc(doc(db, 'tipificaciones', _tipiEditId), payload);
showToast('Tipificación actualizada');
} else {
await addDoc(collection(db, 'tipificaciones'), { ...payload, creadoEn: serverTimestamp() });
showToast('Tipificación añadida');
}
cerrarModalTipi();
} catch (e) {
console.error(e);
showToast('Error al guardar: ' + e.message, 'error');
} finally {
btn.disabled = false;
}
}
function abrirModalCat(oldName) {
_catEditOld = oldName;
document.getElementById('modal-cat-title').textContent     = oldName ? 'Renombrar categoría' : 'Nueva categoría';
document.getElementById('btn-cat-save-text').textContent   = oldName ? 'Renombrar' : 'Crear categoría';
document.getElementById('fc-nombre').value                 = oldName || '';
document.getElementById('modal-cat-overlay').classList.add('open');
}
function cerrarModalCat() {
document.getElementById('modal-cat-overlay').classList.remove('open');
_catEditOld = null;
}
async function guardarCategoria() {
const nombre = document.getElementById('fc-nombre').value.trim().toUpperCase();
if (!nombre) { showToast('Escribe un nombre para la categoría', 'error'); return; }
const btn = document.getElementById('btn-cat-save');
btn.disabled = true;
try {
if (_catEditOld) {
const batch = TIPIFICACIONES
.filter(t => t.categoria === _catEditOld)
.map(t => updateDoc(doc(db, 'tipificaciones', t.id), { categoria: nombre, proceso: nombre }));
const catSnap = await getDocs(query(collection(db, 'categorias'), where('nombre', '==', _catEditOld)));
catSnap.docs.forEach(d => batch.push(updateDoc(doc(db, 'categorias', d.id), { nombre })));
await Promise.all(batch);
showToast(`Categoría renombrada a "${nombre}"`);
} else {
if (getCategoriasUnicas().includes(nombre)) { showToast('Esa categoría ya existe', 'error'); btn.disabled = false; return; }
await addDoc(collection(db, 'categorias'), { nombre, creadoEn: serverTimestamp() });
showToast(`Categoría "${nombre}" creada`);
}
cerrarModalCat();
} catch (e) {
console.error(e);
showToast('Error al guardar categoría: ' + e.message, 'error');
} finally {
btn.disabled = false;
}
}
window.eliminarCategoria = async function(cat) {
const n = TIPIFICACIONES.filter(t => t.categoria === cat).length;
const msg = n > 0
? `¿Eliminar la categoría "${cat}" y sus ${n} tipificación${n!==1?'es':''}? Esta acción no se puede deshacer.`
: `¿Eliminar la categoría vacía "${cat}"?`;
if (!confirmarAccion(msg)) return;
try {
const batch = TIPIFICACIONES
.filter(t => t.categoria === cat)
.map(t => deleteDoc(doc(db, 'tipificaciones', t.id)));
const catSnap = await getDocs(query(collection(db, 'categorias'), where('nombre', '==', cat)));
catSnap.docs.forEach(d => batch.push(deleteDoc(doc(db, 'categorias', d.id))));
await Promise.all(batch);
showToast(`Categoría "${cat}" eliminada`, 'error');
} catch(e) {
console.error(e);
showToast('Error al eliminar categoría: ' + e.message, 'error');
}
};
window.editarTipi = function(id) {
const t = TIPIFICACIONES.find(x => x.id === id);
if (t) abrirModalTipi(t);
};
window.eliminarTipi = async function(id) {
const t = TIPIFICACIONES.find(x => x.id === id);
if (!t) return;
if (!confirmarAccion(`¿Eliminar la tipificación "${t.asunto}"?`)) return;
try {
await deleteDoc(doc(db, 'tipificaciones', id));
showToast('Tipificación eliminada', 'error');
} catch(e) {
console.error(e);
showToast('Error al eliminar: ' + e.message, 'error');
}
};
window.editarCelda = function(id, campo, el) {
if (!isFormador()) return;
const t = TIPIFICACIONES.find(x => x.id === id);
if (!t) return;
const oldVal = el.textContent;
el.contentEditable = 'true';
el.style.outline = '2px solid var(--orange)';
el.style.borderRadius = '4px';
el.focus();
const range = document.createRange(); range.selectNodeContents(el);
window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
async function guardar() {
el.contentEditable = 'false';
el.style.outline = '';
el.style.borderRadius = '';
const newVal = el.textContent.trim();
if (newVal !== oldVal) {
try {
await updateDoc(doc(db, 'tipificaciones', id), { [campo]: newVal });
showToast('Celda actualizada ✓');
} catch(e) {
el.textContent = oldVal;
showToast('Error al guardar celda: ' + e.message, 'error');
}
}
}
el.addEventListener('blur',    guardar, { once: true });
el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } if (e.key === 'Escape') { el.textContent = oldVal; el.blur(); } });
};
function renderTipiChips(activeCat) {
const bar = document.getElementById('tipi-chips-bar');
const cats = getCategoriasUnicas();
const total = TIPIFICACIONES.length;
bar.innerHTML =
`<button class="tipi-chip-btn${!activeCat ? ' active' : ''}" id="tipi-chip-ALL" onclick="filtrarTipiPorChip(null)">
<i class="ti ti-layout-grid"></i><span>TODAS (${total})</span>
</button>` +
cats.map(cat => {
const n = TIPIFICACIONES.filter(t => t.categoria === cat).length;
const safeId = cat.replace(/\s/g, '-');
return `<button class="tipi-chip-btn${activeCat === cat ? ' active' : ''}" id="tipi-chip-${safeId}" onclick="filtrarTipiPorChip('${cat}')">
<span>${cat}</span><span style="opacity:.6;font-size:10px">(${n})</span>
</button>`;
}).join('');
}
function renderTipiAcordeones(activeCat, query) {
const container = document.getElementById('tipi-acordeones-container');
const countEl   = document.getElementById('tipi-count');
const cats = activeCat ? [activeCat] : getCategoriasUnicas();
const q = (query || '').trim();
const formador = isFormador();
container.innerHTML = '';
let totalVisible = 0;
cats.forEach(cat => {
let items = TIPIFICACIONES.filter(t => t.categoria === cat);
if (q) {
items = items.filter(t =>
_smartMatch([t.modalidad||'', t.proceso||'', t.subProceso||'', t.asunto||'', t.aplica||'', t.tipoAtencion||'', t.plazo||''], q)
);
}
if (!items.length && (!formador || q)) return;
totalVisible += items.length;
const catId  = cat.replace(/\s/g, '-');
const isOpen = !!(q || activeCat === cat);
const catActionsHtml = formador ? `
<div class="tipi-cat-formador-actions" onclick="event.stopPropagation()">
<button class="btn-tipi-cat-edit" title="Renombrar categoría" onclick="abrirModalCatGlobal('${cat}')"><i class="ti ti-pencil"></i></button>
<button class="btn-tipi-cat-del"  title="Eliminar categoría"  onclick="eliminarCategoria('${cat}')"><i class="ti ti-trash"></i></button>
</div>` : '';

const cardsHtml = items.map((t, idx) => {
const editA = (campo) => formador
? `onclick="event.stopPropagation();editarCelda('${t.id}','${campo}',this)" title="Clic para editar" style="cursor:text"`
: '';
const aplicaTxt = t.aplica ? (q ? _hlTokens(t.aplica, q) : escH(t.aplica)) : '<span style="color:#ccc">Sin información</span>';
const tipoTxt   = t.tipoAtencion
  ? `<span class="tipi-badge ${tipoClass(t.tipoAtencion)}" ${editA('tipoAtencion')}>${q ? _hlTokens(t.tipoAtencion, q) : escH(t.tipoAtencion)}</span>`
  : `<span style="color:#ccc;font-size:11px" ${editA('tipoAtencion')}>—</span>`;
const plazoTxt       = t.plazo       ? (q ? _hlTokens(t.plazo, q) : escH(t.plazo)) : '—';
const plazoWebTxt    = t.plazoWeb    ? escH(t.plazoWeb)    : '—';
const plazoManualTxt = t.plazoManual ? escH(t.plazoManual) : '—';
const colaHtml = (t.colaDer && Array.isArray(t.colaDer) && t.colaDer.length)
  ? t.colaDer.map(c => `<span class="cola-chip"><i class="ti ti-arrow-right" style="font-size:9px"></i>${escH(c)}</span>`).join('')
  : '<span style="color:#ccc;font-size:11px">—</span>';
const acciones = formador ? `
<div class="tipi-card-actions" onclick="event.stopPropagation()">
<button class="btn-tr-edit" title="Editar" onclick="editarTipi('${t.id}')"><i class="ti ti-pencil"></i></button>
<button class="btn-tr-del"  title="Eliminar" onclick="eliminarTipi('${t.id}')"><i class="ti ti-trash"></i></button>
</div>` : '';

const matchInDetail = !!(q && _smartMatch([t.aplica||'', t.tipoAtencion||'', t.plazoWeb||'', t.plazoManual||'', ...(t.colaDer||[])], q) && !_smartMatch([t.modalidad||'', t.subProceso||'', t.asunto||''], q));

return `<div class="tipi-card${matchInDetail?' tipi-card-open':''}" id="tipi-card-${t.id}" onclick="window.toggleTipiCard('${t.id}')">
<div class="tipi-card-top">
<div style="flex:1;min-width:0">
<div class="tipi-card-tags">
<span class="tipi-card-tag modalidad" ${editA('modalidad')}>${q ? _hlTokens(t.modalidad||'—', q) : escH(t.modalidad||'—')}</span>
<span class="tipi-card-tag sub" ${editA('subProceso')}>${q ? _hlTokens(t.subProceso||'—', q) : escH(t.subProceso||'—')}</span>
</div>
<p class="tipi-card-asunto" ${editA('asunto')}>${q ? _hlTokens(t.asunto||'Sin asunto', q) : escH(t.asunto||'Sin asunto')}</p>
</div>
<i class="ti ti-chevron-down tipi-card-chevron"></i>
</div>
<div class="tipi-card-meta">
<span class="tipi-card-meta-item"><i class="ti ti-clock"></i>${plazoTxt}</span>
${t.plazoWeb ? `<span class="tipi-card-meta-item"><i class="ti ti-world"></i>${plazoWebTxt}</span>` : ''}
${t.colaDer && t.colaDer.length ? `<span class="tipi-card-meta-item"><i class="ti ti-arrow-right"></i>${escH(t.colaDer[0])}${t.colaDer.length>1?` +${t.colaDer.length-1}`:''}</span>` : ''}
</div>
<div class="tipi-card-detail" style="display:${matchInDetail?'block':'none'}">
<div class="tipi-card-detail-row">
<div class="tipi-card-detail-block" style="flex-basis:100%">
<div class="tipi-card-detail-label">En qué casos aplica</div>
<div class="tipi-card-detail-val" ${editA('aplica')}>${aplicaTxt}</div>
</div>
</div>
<div class="tipi-card-detail-row">
<div class="tipi-card-detail-block">
<div class="tipi-card-detail-label">Tipo de atención</div>
<div class="tipi-card-detail-val">${tipoTxt}</div>
</div>
<div class="tipi-card-detail-block">
<div class="tipi-card-detail-label">Plazo Web</div>
<div class="tipi-card-detail-val" ${editA('plazoWeb')}>${plazoWebTxt}</div>
</div>
<div class="tipi-card-detail-block">
<div class="tipi-card-detail-label">Plazo Manual</div>
<div class="tipi-card-detail-val" ${editA('plazoManual')}>${plazoManualTxt}</div>
</div>
</div>
<div class="tipi-card-detail-row">
<div class="tipi-card-detail-block" style="flex-basis:100%">
<div class="tipi-card-detail-label">Cola de derivación</div>
<div class="tipi-card-detail-val">${colaHtml}</div>
</div>
</div>
${acciones}
</div>
</div>`;
}).join('');

const emptyState = formador && !items.length
? `<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">
<i class="ti ti-plus-circle" style="margin-right:5px"></i>Categoría vacía — usa "Nueva tipificación" para añadir.
</div>` : '';

container.innerHTML += `
<div class="tipi-category-accordion${isOpen ? ' open' : ''}" id="tipi-acc-${catId}">
<div class="tipi-category-header" onclick="toggleTipiAcc('${catId}')">
<div class="tipi-category-title">
<i class="ti ti-folder"></i>
<span>${cat}</span>
<span class="tipi-category-counter">${items.length} ítems</span>
</div>
<div style="display:flex;align-items:center;gap:8px">
${catActionsHtml}
<i class="ti ti-chevron-down tipi-category-chevron"></i>
</div>
</div>
<div class="tipi-category-content">
<div class="tipi-cards-wrap">${cardsHtml}${emptyState}</div>
</div>
</div>`;
if (activeCat === cat && !q) {
setTimeout(() => {
const el = document.getElementById(`tipi-acc-${catId}`);
if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}, 50);
}
});
if (!totalVisible && !formador) {
container.innerHTML = `<div class="tipi-empty"><i class="ti ti-tags"></i><p>No se encontraron tipificaciones para esta búsqueda.</p></div>`;
}
countEl.textContent = `${totalVisible} tipificación${totalVisible !== 1 ? 'es' : ''}`;
}
window.toggleTipiCard = function(id) {
const card = document.getElementById(`tipi-card-${id}`);
if (!card) return;
const detail = card.querySelector('.tipi-card-detail');
const open = card.classList.toggle('tipi-card-open');
detail.style.display = open ? 'block' : 'none';
};
window.toggleTipiAcc = function(catId) {
const el = document.getElementById(`tipi-acc-${catId}`);
if (el) el.classList.toggle('open');
};
window.filtrarTipiPorChip = function(cat) {
_tipiActiveCat = cat;
renderTipiChips(cat);
renderTipiAcordeones(cat, document.getElementById('search-tipi').value);
};
window.abrirModalCatGlobal = function(oldName) { abrirModalCat(oldName); };
function refreshTipi() {
renderTipiChips(_tipiActiveCat);
renderTipiAcordeones(_tipiActiveCat, document.getElementById('search-tipi').value);
}
// Registro de búsqueda (sin Firestore, solo DOM — OK en nivel raíz)
document.getElementById('search-tipi').addEventListener('input', function() {
renderTipiAcordeones(_tipiActiveCat, this.value);
});
function showToast(msg, type = 'success') {
const t = document.getElementById('toast');
t.textContent = (type === 'success' ? '✓ ' : '✗ ') + msg;
t.className = `toast ${type} show`;
setTimeout(() => t.classList.remove('show'), 3500);
}
let _tipiListenersStarted    = false;
let _pltListenersStarted     = false;
let _tipiFormadorSetupDone   = false;
// ── Splash de carga mientras Firebase verifica sesión ────────
const _splashEl = document.getElementById('app-splash');
let _authResolved = false;

// Si Firebase tarda más de 8s en responder, mostrar error con retry
const _authTimeout = setTimeout(() => {
  if (!_authResolved) {
    if (_splashEl) {
      _splashEl.innerHTML = `
        <div style="text-align:center">
          <div style="font-size:40px;margin-bottom:16px">⚠️</div>
          <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:8px">Problema de conexión</div>
          <div style="font-size:13px;color:rgba(255,255,255,.6);margin-bottom:24px">Verifica tu internet e intenta de nuevo</div>
          <button onclick="window.location.reload()" style="padding:12px 28px;background:#C41E3A;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Reintentar</button>
        </div>`;
    }
  }
}, 8000);

onAuthStateChanged(auth, async user => {
_authResolved = true;
clearTimeout(_authTimeout);

if (!user) {
  // Esperar 800ms antes de redirigir — evita falsos negativos en conexiones lentas
  setTimeout(() => { window.location.href = 'index.html'; }, 800);
  return;
}

// Ocultar splash con fade
if (_splashEl) {
  _splashEl.style.transition = 'opacity .35s';
  _splashEl.style.opacity = '0';
  setTimeout(() => { _splashEl.style.display = 'none'; }, 380);
}

currentUser = user;
window.currentUser = user;
try {
const avEl = document.getElementById('user-av');
const nameEl = document.getElementById('user-name');
if (avEl) avEl.textContent   = user.email.substring(0, 2).toUpperCase();
if (nameEl) nameEl.textContent = user.email.split('@')[0];
} catch(e) { console.error('user header:', e); }
try {
const snap = await getDoc(doc(db, 'asesores_autorizados', user.email.toLowerCase()));
if (snap.exists()) {
  currentUserRol = snap.data().Rol || '';
  window.currentUserNombre = snap.data().Nombre || '';
}
} catch(e) { console.error('asesores_autorizados:', e); currentUserRol = ''; window.currentUserNombre = ''; }
window.currentUserRol = currentUserRol;
// Expose firebase modules for satisfaccion module
if (!window._fbModules) window._fbModules = { getFirestore, collection, onSnapshot, addDoc, query, where, orderBy, serverTimestamp, getDocs, deleteDoc, doc, updateDoc, setDoc, getDoc };
try { if (window._initSatFirebase) window._initSatFirebase(); } catch(e) { console.error('_initSatFirebase:', e); }
try { window.dispatchEvent(new CustomEvent('sise:rolCargado', { detail: { rol: currentUserRol, nombre: window.currentUserNombre } })); } catch(e) { console.error('rolCargado event:', e); }
// Iniciar listeners de Firestore AHORA que hay sesión activa
try {
  if (!_tipiListenersStarted) { _tipiListenersStarted = true; await iniciarListenersTipi(); }
  else refreshTipi();
} catch(e) { console.error('iniciarListenersTipi:', e); }
// Configurar barra de formador con el rol ya cargado
try {
  if (!_tipiFormadorSetupDone) { _tipiFormadorSetupDone = true; setupTipiFormador(); }
  if (isFormador()) {
    const tfb = document.getElementById('tipi-formador-bar');
    if (tfb) tfb.classList.add('visible');
  }
} catch(e) { console.error('setupTipiFormador:', e); }
try { if (!_pltListenersStarted) { _pltListenersStarted = true; iniciarListenersPlantillas(); } } catch(e) { console.error('iniciarListenersPlantillas:', e); }
try { setupPltFormador(); } catch(e) { console.error('setupPltFormador:', e); }
try { setupProtoEditor(); } catch(e) { console.error('setupProtoEditor:', e); }
try { loadCasos(); } catch(e) { console.error('loadCasos:', e); }
try { loadPendientes(); } catch(e) { console.error('loadPendientes:', e); }
try { if (window._loadFaqs) window._loadFaqs(); } catch(e) { console.error('_loadFaqs:', e); }
setTimeout(() => { try { if (window._rerenderFaqs) window._rerenderFaqs(); } catch(e) { console.error('_rerenderFaqs:', e); } }, 1500);
});
document.getElementById('btn-logout').addEventListener('click', async () => {
await signOut(auth);
window.location.href = 'index.html';
});
document.querySelectorAll('.nav-item[data-view]').forEach(item => {
item.addEventListener('click', () => {
try {
document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
item.classList.add('active');
const target = document.getElementById('view-' + item.dataset.view);
if (target) target.classList.add('active');
} catch(e) {
console.error('Error al cambiar de vista (capturado):', e);
}
});
});
const boOverlay = document.getElementById('modal-bo-overlay');
function setPrioridad(val) {
['bajo','medio','alto'].forEach(p => {
const el = document.getElementById('prio-' + p);
el.classList.remove('sel-bajo','sel-medio','sel-alto');
const radio = el.querySelector('input');
radio.checked = (p === val);
if (p === val) el.classList.add('sel-' + p);
});
}
['bajo','medio','alto'].forEach(p => {
document.getElementById('prio-' + p).addEventListener('click', () => setPrioridad(p));
});
function getPrioridad() {
const sel = document.querySelector('#prioridad-selector input[type=radio]:checked');
return sel ? sel.value : null;
}
function openBoModal(modo, data) {
boEditId = data ? data.id : null;
const isEdit = !!data;
document.getElementById('modal-bo-title').textContent   = isEdit ? 'Editar caso' : 'Registrar caso para llamada';
document.getElementById('btn-bo-save-text').textContent = isEdit ? 'Guardar cambios' : 'Crear caso';
document.getElementById('f-codigo').value     = data ? (data.codigo    || '') : '';
document.getElementById('f-nombre').value     = data ? (data.nombre    || '') : '';
document.getElementById('f-celular').value    = data ? (data.celular   || '') : '';
document.getElementById('f-asesor-wsp').value = data ? (data.asesorWsp || '') : '';
document.getElementById('f-motivo').value     = data ? (data.motivo    || '') : '';
setPrioridad(data ? (data.prioridad || 'medio') : 'medio');
boOverlay.classList.add('open');
}
function closeBoModal() { boOverlay.classList.remove('open'); boEditId = null; }
document.getElementById('btn-nuevo-registro').addEventListener('click', () => openBoModal('nuevo', null));
document.getElementById('modal-bo-close').addEventListener('click', closeBoModal);
document.getElementById('btn-bo-cancel').addEventListener('click', closeBoModal);
boOverlay.addEventListener('click', e => { if (e.target === boOverlay) closeBoModal(); });
document.getElementById('btn-bo-save').addEventListener('click', async () => {
const required = ['f-codigo','f-nombre','f-celular','f-asesor-wsp','f-motivo'];
for (const id of required) {
if (!document.getElementById(id).value.trim()) { showToast('Completa todos los campos (*)', 'error'); return; }
}
const prioridad = getPrioridad();
if (!prioridad) { showToast('Selecciona una prioridad', 'error'); return; }
const btn = document.getElementById('btn-bo-save');
const txt = document.getElementById('btn-bo-save-text');
btn.disabled = true; txt.textContent = 'Guardando...';
const ahora = new Date();
const ahoraLima = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
const payload = {
codigo:        document.getElementById('f-codigo').value.trim(),
nombre:        document.getElementById('f-nombre').value.trim(),
celular:       document.getElementById('f-celular').value.trim(),
asesorWsp:     document.getElementById('f-asesor-wsp').value.trim(),
motivo:        document.getElementById('f-motivo').value.trim(),
prioridad:     prioridad,
fechaRegistro: ahoraLima.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
horaRegistro:  ahoraLima.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }),
};
try {
if (boEditId) {
await updateDoc(doc(db, 'bo_llamadas', boEditId), { ...payload, actualizadoPor: currentUser.email, actualizadoEn: serverTimestamp() });
showToast('Caso actualizado');
} else {
await addDoc(collection(db, 'bo_llamadas'), { ...payload, estadoLlamada: 'pendiente', descripcionBo: '', creadoPor: currentUser.email, creadoEn: serverTimestamp() });
showToast('Caso registrado correctamente');
boViewDay = new Date();
document.getElementById('filter-estado').value = '';
updateBoDayLabel();
}
closeBoModal();
} catch (err) {
console.error(err); showToast('Error al guardar. Inténtalo de nuevo.', 'error');
} finally {
btn.disabled = false;
txt.textContent = boEditId ? 'Guardar cambios' : 'Crear caso';
}
});
function confirmarAccion(msg) {
const pref = localStorage.getItem('pref_confirmar');
const activo = pref === null ? true : pref === 'true';
if (!activo) return true;
return confirm(msg);
}
window.confirmarAccion = confirmarAccion;
async function eliminarCaso(id) {
if (!tienePermiso()) { showToast('Solo BO, Supervisor o Formador pueden eliminar casos', 'error'); return; }
if (!confirmarAccion('¿Eliminar este caso?')) return;
try { await deleteDoc(doc(db, 'bo_llamadas', id)); showToast('Caso eliminado'); }
catch (err) { showToast('Error al eliminar', 'error'); }
}
async function actualizarEstado(id, estado) {
try { await updateDoc(doc(db, 'bo_llamadas', id), { estadoLlamada: estado, actualizadoPorBo: currentUser.email, actualizadoEn: serverTimestamp() }); }
catch (err) { showToast('Error al actualizar estado', 'error'); }
}
async function actualizarDescripcion(id, texto) {
try { await updateDoc(doc(db, 'bo_llamadas', id), { descripcionBo: texto, actualizadoPorBo: currentUser.email, actualizadoEn: serverTimestamp() }); showToast('Descripción guardada'); }
catch (err) { showToast('Error al guardar descripción', 'error'); }
}
let boViewDay = new Date();
function fechaHoyLima() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}
function fechaLimaDe(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}
function updateBoDayLabel() {
const today = fechaHoyLima();
const viewStr = fechaLimaDe(boViewDay);
const isToday = viewStr === today;
const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const d = boViewDay;
document.getElementById('bo-day-label').textContent =
(isToday ? 'Hoy · ' : '') + dias[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
}
document.getElementById('bo-prev').addEventListener('click',  () => { const d = new Date(boViewDay); d.setDate(d.getDate()-1); boViewDay = d; updateBoDayLabel(); applyBoFilters(); });
document.getElementById('bo-next').addEventListener('click',  () => { const d = new Date(boViewDay); d.setDate(d.getDate()+1); boViewDay = d; updateBoDayLabel(); applyBoFilters(); });
document.getElementById('bo-today').addEventListener('click', () => { boViewDay = new Date(); updateBoDayLabel(); applyBoFilters(); });
function loadCasos() {
const q = query(collection(db, 'bo_llamadas'), orderBy('creadoEn', 'asc'));
onSnapshot(q, snap => {
try {
allCasos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
updateBoDayLabel();
applyBoFilters();
} catch(e) { console.error('bo_llamadas render:', e); }
}, err => {
console.error(err);
const el = document.getElementById('cards-container');
if (el) el.innerHTML = '<div class="empty-state"><i class="ti ti-wifi-off"></i><p>Error al cargar.</p></div>';
});
}
function applyBoFilters() {
const q       = document.getElementById('search-bo').value.trim();
const viewStr = fechaLimaDe(boViewDay);

// ── MODO BÚSQUEDA GLOBAL (hay texto) ──────────────────────────────────────
if (q) {
  const matches = allCasos.filter(r =>
    _smartMatch([r.nombre||'', r.codigo||'', r.celular||'', r.asesorWsp||'', r.motivo||''], q)
  );
  renderSearchResults(matches, q);
  updateBoBadge();
  return;
}

// ── MODO NORMAL (sin búsqueda, filtra por día) ────────────────────────────
renderSearchResults(null, '');           // limpia el panel de búsqueda si lo hubiera
const todosDia = allCasos.filter(r => (r.fechaRegistro || '') === viewStr);
let pendientes = todosDia.filter(r => (r.estadoLlamada || 'pendiente') === 'pendiente');
const prioOrder = { alto: 0, medio: 1, bajo: 2 };
pendientes.sort((a, b) => {
const pa = prioOrder[a.prioridad || 'medio'];
const pb = prioOrder[b.prioridad || 'medio'];
if (pa !== pb) return pa - pb;
const ta = a.creadoEn?.toDate?.() || new Date(a.horaRegistro || 0);
const tb = b.creadoEn?.toDate?.() || new Date(b.horaRegistro || 0);
return ta - tb;
});
renderCards(pendientes);
updateBoBadge();
renderLlamadosHoy(viewStr);
}

// Renderiza resultados de búsqueda global agrupados por fecha
function renderSearchResults(matches, q) {
const navRow      = document.getElementById('cards-container').parentElement.querySelector('.pend-filters');
const container   = document.getElementById('cards-container');
const gestionados = document.getElementById('llamados-hoy-section');

if (!matches) {
  // Salir del modo búsqueda: restaurar vistas normales
  const srPanel = document.getElementById('sr-panel');
  if (srPanel) srPanel.remove();
  container.style.display = '';
  // gestionados lo controla renderLlamadosHoy, no lo forzamos aquí
  return;
}

// Ocultar sección gestionados (se incluye en los grupos de fecha)
if (gestionados) gestionados.style.display = 'none';

// Banner de resultados (reemplaza cards-container)
let srPanel = document.getElementById('sr-panel');
if (!srPanel) {
  srPanel = document.createElement('div');
  srPanel.id = 'sr-panel';
  container.parentElement.insertBefore(srPanel, container);
}
container.style.display = 'none';

if (!matches.length) {
  srPanel.innerHTML = `<div class="empty-state"><i class="ti ti-search-off"></i><p>Sin resultados para <strong>"${q}"</strong></p><p class="empty-hint">Prueba con otro nombre, código o celular.</p></div>`;
  return;
}

// Agrupar por fecha, más reciente primero
const byDate = {};
matches.forEach(r => {
  const f = r.fechaRegistro || '—';
  if (!byDate[f]) byDate[f] = [];
  byDate[f].push(r);
});
const fechas = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

const isBO = tienePermiso();
const prioBadge = (p) => {
  const cfg = { bajo: ['Bajo','ti-flag'], medio: ['Medio','ti-flag-2'], alto: ['Alto 🔴','ti-flag-3'] };
  const [label, icon] = cfg[p] || cfg['medio'];
  return `<span class="prioridad-badge ${p||'medio'}"><i class="ti ${icon}" style="font-size:10px"></i>${label}</span>`;
};
const estadoLabel = (est) => {
  if (est === 'atendida')    return '<span style="display:inline-flex;align-items:center;gap:4px;background:var(--success-bg);color:var(--success);border-radius:99px;padding:3px 10px;font-size:11px;font-weight:700"><i class="ti ti-phone-check" style="font-size:12px"></i>Atendida</span>';
  if (est === 'no_contesta') return '<span style="display:inline-flex;align-items:center;gap:4px;background:var(--danger-bg);color:var(--danger);border-radius:99px;padding:3px 10px;font-size:11px;font-weight:700"><i class="ti ti-phone-off" style="font-size:12px"></i>No contesta</span>';
  return '<span style="display:inline-flex;align-items:center;gap:4px;background:#F3EDFF;color:#7C3AED;border-radius:99px;padding:3px 10px;font-size:11px;font-weight:700"><i class="ti ti-clock" style="font-size:12px"></i>Pendiente</span>';
};
const estadoBtnS = (r, estado, label, icon, cls) => {
  const active = (r.estadoLlamada||'pendiente') === estado;
  if (isBO) return `<button class="estado-btn ${active?cls:''}" onclick="window._boEstado('${r.id}','${estado}')"><i class="ti ${icon}"></i><span>${label}</span></button>`;
  return `<button class="estado-btn ${active?cls:''}" disabled style="opacity:${active?'1':'0.4'};cursor:default"><i class="ti ${icon}"></i><span>${label}</span></button>`;
};

const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
function fmtFecha(str) {
  if (!str || str === '—') return str;
  const [y,m,d] = str.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const hoy = fechaHoyLima();
  const ayer = (() => { const a = new Date(); a.setDate(a.getDate()-1); return fechaLimaDe(a); })();
  if (str === hoy)  return `Hoy · ${dias[dt.getDay()]} ${d} ${MESES[m-1]} ${y}`;
  if (str === ayer) return `Ayer · ${dias[dt.getDay()]} ${d} ${MESES[m-1]} ${y}`;
  return `${dias[dt.getDay()]} ${d} ${MESES[m-1]} ${y}`;
}

let html = `<div style="margin-bottom:10px;padding:10px 14px;background:var(--surface-2,#f5f5f5);border-radius:10px;font-size:12px;color:var(--text-2,#888);display:flex;align-items:center;gap:8px"><i class="ti ti-search" style="color:var(--orange)"></i><span><strong>${matches.length} resultado${matches.length!==1?'s':''}</strong> para "<strong>${q}</strong>" en todos los días</span></div>`;

fechas.forEach(fecha => {
  const casos = byDate[fecha];
  html += `
  <div style="margin-bottom:28px">
    <div class="pend-day-header" style="margin-bottom:14px">
      <div class="pend-day-pill today" style="background:var(--surface-2,#f0f0f0);color:var(--text-1,#333)"><i class="ti ti-calendar" style="font-size:12px"></i>${fmtFecha(fecha)}</div>
      <div class="pend-day-line"></div>
      <span class="pend-day-count">${casos.length} caso${casos.length!==1?'s':''}</span>
    </div>
    <div class="cards-grid">`;
  casos.forEach((r, i) => {
    const est  = r.estadoLlamada || 'pendiente';
    const prio = r.prioridad || 'medio';
    const borderColor = prio==='alto'?'#E03131':prio==='medio'?'#B87000':'#1A7A45';
    const descArea = isBO
      ? `<textarea class="bo-desc-textarea" id="srdesc-${r.id}" placeholder="Comentario de gestión BO..." onblur="window._boDescSr('${r.id}')">${r.descripcionBo||''}</textarea>`
      : (r.descripcionBo ? `<div class="bo-desc-readonly">${r.descripcionBo}</div>` : '');
    html += `<div class="caso-card" style="border-top:3px solid ${borderColor}">
      <div class="card-header">
        <div class="card-header-left">
          <div class="card-case-num" style="display:flex;align-items:center;gap:6px">Cód. ${_hlTokens(r.codigo||'—', q)} ${prioBadge(prio)}</div>
          <div class="card-alumno-name">${_hlTokens(r.nombre||'—', q)}</div>
          <div class="card-meta">
            <span class="card-meta-item"><i class="ti ti-phone"></i>${_hlTokens(r.celular||'—', q)}</span>
            <span class="card-meta-item"><i class="ti ti-calendar"></i>${r.fechaRegistro||'—'}${r.horaRegistro?' · '+r.horaRegistro:''}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          ${estadoLabel(est)}
          <div class="card-wsp-badge"><i class="ti ti-brand-whatsapp"></i>${_hlTokens(r.asesorWsp||'—', q)}</div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-motivo-label">Motivo de derivación</div>
        <div class="card-motivo">${_hlTokens(r.motivo||'—', q)}</div>
      </div>
      <div class="card-bo-section">
        <div class="bo-section-title"><i class="ti ti-headset"></i>Gestión BO — Estado de llamada${isBO?'':' <span style="font-weight:400;color:#bbb">(solo lectura)</span>'}</div>
        <div class="estado-options">
          ${estadoBtnS(r,'pendiente',  'Pendiente',   'ti-clock',       'pendiente-active')}
          ${estadoBtnS(r,'no_contesta','No contesta', 'ti-phone-off',   'no-contesta-active')}
          ${estadoBtnS(r,'atendida',   'Atendida',    'ti-phone-check', 'atendida-active')}
        </div>
        ${descArea}
      </div>
      <div class="card-footer">
        <span class="card-date"><i class="ti ti-user"></i>${r.creadoPor?r.creadoPor.split('@')[0]:'—'}</span>
        <div class="row-actions">
          <button class="btn-row edit" onclick="window._boEdit('${r.id}')"><i class="ti ti-pencil"></i></button>
          ${isBO
            ? `<button class="btn-row del" onclick="window._boDel('${r.id}')"><i class="ti ti-trash"></i></button>`
            : `<button class="btn-row del" disabled style="opacity:0.3;cursor:not-allowed"><i class="ti ti-trash"></i></button>`}
        </div>
      </div>
    </div>`;
  });
  html += `</div></div>`;
});

srPanel.innerHTML = html;
}

window._boDescSr = (id) => {
if (!tienePermiso()) return;
const v    = document.getElementById('srdesc-'+id)?.value||'';
const orig = allCasos.find(c=>c.id===id)?.descripcionBo||'';
if (v !== orig) actualizarDescripcion(id, v);
};
function renderCards(data) {
const container = document.getElementById('cards-container');
const isBO = tienePermiso();
if (!data.length) {
container.innerHTML = '<div class="empty-state"><i class="ti ti-phone-off"></i><p>No hay casos pendientes para este día.</p><p class="empty-hint">Usa \"Registrar caso\" o navega a otro día.</p></div>';
return;
}
const estadoBtn = (r, estado, label, icon, cls) => {
const active = (r.estadoLlamada||'pendiente') === estado;
if (isBO) {
return `<button class="estado-btn ${active?cls:''}" onclick="window._boEstado('${r.id}','${estado}')"><i class="ti ${icon}"></i><span>${label}</span></button>`;
} else {
return `<button class="estado-btn ${active?cls:''}" disabled style="opacity:${active?'1':'0.4'};cursor:default"><i class="ti ${icon}"></i><span>${label}</span></button>`;
}
};
const prioBadge = (p) => {
const cfg = { bajo: ['Bajo','ti-flag'], medio: ['Medio','ti-flag-2'], alto: ['Alto 🔴','ti-flag-3'] };
const [label, icon] = cfg[p] || cfg['medio'];
return `<span class="prioridad-badge ${p||'medio'}"><i class="ti ${icon}" style="font-size:10px"></i>${label}</span>`;
};
container.innerHTML = '<div class="cards-grid">' + data.map((r,i) => {
const est  = r.estadoLlamada || 'pendiente';
const prio = r.prioridad || 'medio';
const descArea = isBO
? `<textarea class="bo-desc-textarea" id="desc-${r.id}" placeholder="Comentario de gestión BO..." onblur="window._boDesc('${r.id}')">${r.descripcionBo||''}</textarea>`
: `<div class="bo-desc-readonly">${r.descripcionBo || '<span style=\"color:#ccc;font-style:italic\">Sin comentario BO aún</span>'}</div>`;
return `<div class="caso-card" style="border-top: 3px solid ${prio==='alto'?'#E03131':prio==='medio'?'#B87000':'#1A7A45'}">
<div class="card-header">
<div class="card-header-left">
<div class="card-case-num" style="display:flex;align-items:center;gap:6px">
Caso #${String(i+1).padStart(3,'0')} · Cód. ${r.codigo||'—'}
${prioBadge(prio)}
</div>
<div class="card-alumno-name">${r.nombre||'—'}</div>
<div class="card-meta">
<span class="card-meta-item"><i class="ti ti-phone"></i>${r.celular||'—'}</span>
<span class="card-meta-item"><i class="ti ti-calendar"></i>${r.fechaRegistro||'—'}${r.horaRegistro?' · '+r.horaRegistro:''}</span>
</div>
</div>
<div class="card-wsp-badge"><i class="ti ti-brand-whatsapp"></i>${r.asesorWsp||'—'}</div>
</div>
<div class="card-body">
<div class="card-motivo-label">Motivo de derivación</div>
<div class="card-motivo">${r.motivo||'—'}</div>
</div>
<div class="card-bo-section">
<div class="bo-section-title"><i class="ti ti-headset"></i>Gestión BO — Estado de llamada${isBO?'':' <span style=\"font-weight:400;color:#bbb\">(solo lectura)</span>'}</div>
<div class="estado-options">
${estadoBtn(r,'pendiente',  'Pendiente',   'ti-clock',       'pendiente-active')}
${estadoBtn(r,'no_contesta','No contesta', 'ti-phone-off',   'no-contesta-active')}
${estadoBtn(r,'atendida',   'Atendida',    'ti-phone-check', 'atendida-active')}
</div>
${descArea}
</div>
<div class="card-footer">
<span class="card-date"><i class="ti ti-user"></i>${r.creadoPor?r.creadoPor.split('@')[0]:'—'}</span>
<div class="row-actions">
<button class="btn-row edit" onclick="window._boEdit('${r.id}')"><i class="ti ti-pencil"></i></button>
${isBO
? `<button class="btn-row del" onclick="window._boDel('${r.id}')"><i class="ti ti-trash"></i></button>`
: `<button class="btn-row del" disabled style="opacity:0.3;cursor:not-allowed" title="Solo BO, Supervisor o Formador pueden eliminar"><i class="ti ti-trash"></i></button>`
}
</div>
</div>
</div>`;
}).join('') + '</div>';
}
function renderLlamadosHoy(viewStr) {
if (!viewStr) viewStr = fechaLimaDe(boViewDay);
const todayStr = fechaHoyLima();
const isToday = viewStr === todayStr;
const llamados = allCasos.filter(r =>
(r.fechaRegistro || '') === viewStr &&
(r.estadoLlamada === 'no_contesta' || r.estadoLlamada === 'atendida')
);
const section   = document.getElementById('llamados-hoy-section');
const container = document.getElementById('llamados-hoy-container');
const countEl   = document.getElementById('llamados-hoy-count');
const pill      = document.getElementById('llamados-hoy-pill');
if (!llamados.length) {
section.style.display = 'none';
return;
}
section.style.display = '';
countEl.textContent = llamados.length + ' llamada' + (llamados.length !== 1 ? 's' : '');
if (pill) {
pill.innerHTML = '<i class="ti ti-phone-check" style="font-size:13px"></i>' +
(isToday ? 'Gestionados hoy' : 'Gestionados · ' + viewStr);
}
const estadoLabel = (est) => {
if (est === 'atendida')    return '<span style="display:inline-flex;align-items:center;gap:4px;background:var(--success-bg);color:var(--success);border-radius:99px;padding:3px 10px;font-size:11px;font-weight:700"><i class="ti ti-phone-check" style="font-size:12px"></i>Atendida</span>';
if (est === 'no_contesta') return '<span style="display:inline-flex;align-items:center;gap:4px;background:var(--danger-bg);color:var(--danger);border-radius:99px;padding:3px 10px;font-size:11px;font-weight:700"><i class="ti ti-phone-off" style="font-size:12px"></i>No contesta</span>';
return '';
};
container.innerHTML = '<div class="cards-grid">' + llamados.map((r, i) => {
const prio = r.prioridad || 'medio';
const prioBorderColor = prio==='alto'?'#E03131':prio==='medio'?'#B87000':'#1A7A45';
const isBO = tienePermiso();
const estadoBtnG = (estado, label, icon, cls) => {
const active = (r.estadoLlamada||'pendiente') === estado;
if (isBO) {
return `<button class="estado-btn ${active?cls:''}" onclick="window._boEstado('${r.id}','${estado}')"><i class="ti ${icon}"></i><span>${label}</span></button>`;
}
return `<button class="estado-btn ${active?cls:''}" disabled style="opacity:${active?'1':'0.4'};cursor:default"><i class="ti ${icon}"></i><span>${label}</span></button>`;
};
const descSection = isBO
? `<textarea class="bo-desc-textarea" id="gdesc-${r.id}" placeholder="Comentario de gestión BO..." onblur="window._boDesc2('${r.id}')">${r.descripcionBo||''}</textarea>`
: (r.descripcionBo ? `<div class="bo-desc-readonly">${r.descripcionBo}</div>` : '');
return `<div class="caso-card" style="border-top:3px solid ${prioBorderColor}">
<div class="card-header">
<div class="card-header-left">
<div class="card-case-num">Cód. ${r.codigo||'—'} · ${r.horaRegistro||'—'}</div>
<div class="card-alumno-name">${r.nombre||'—'}</div>
<div class="card-meta">
<span class="card-meta-item"><i class="ti ti-phone"></i>${r.celular||'—'}</span>
<span class="card-meta-item"><i class="ti ti-brand-whatsapp"></i>${r.asesorWsp||'—'}</span>
</div>
</div>
<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
${estadoLabel(r.estadoLlamada)}
</div>
</div>
<div class="card-body" style="padding-bottom:0">
<div class="card-motivo-label">Motivo</div>
<div class="card-motivo">${r.motivo||'—'}</div>
</div>
<div class="card-bo-section">
<div class="bo-section-title"><i class="ti ti-headset"></i>Actualizar estado${isBO?'':' <span style="font-weight:400;color:#bbb">(solo lectura)</span>'}</div>
<div class="estado-options">
${estadoBtnG('pendiente',   'Pendiente',   'ti-clock',       'pendiente-active')}
${estadoBtnG('no_contesta','No contesta','ti-phone-off','no-contesta-active')}
${estadoBtnG('atendida',   'Atendida',   'ti-phone-check','atendida-active')}
</div>
${descSection}
</div>
</div>`;
}).join('') + '</div>';
}
window._boEstado = (id, estado) => {
if (!tienePermiso()) { showToast('Solo BO, Supervisor o Formador pueden cambiar el estado', 'error'); return; }
// Solo persiste en Firestore; onSnapshot actualizará la UI en tiempo real para todos
actualizarEstado(id, estado);
};
window._boDesc = (id) => {
if (!tienePermiso()) return;
const v    = document.getElementById('desc-'+id)?.value||'';
const orig = allCasos.find(c=>c.id===id)?.descripcionBo||'';
if (v !== orig) actualizarDescripcion(id, v);
};
window._boDesc2 = (id) => {
if (!tienePermiso()) return;
const v    = document.getElementById('gdesc-'+id)?.value||'';
const orig = allCasos.find(c=>c.id===id)?.descripcionBo||'';
if (v !== orig) actualizarDescripcion(id, v);
};
window._boEdit = (id) => { const r = allCasos.find(x=>x.id===id); if (r) openBoModal('editar', r); };
window._boDel  = (id) => eliminarCaso(id);
document.getElementById('search-bo').addEventListener('input', applyBoFilters);
document.getElementById('filter-estado').addEventListener('change', applyBoFilters);
document.getElementById('btn-bo-export-excel').addEventListener('click', () => {
const viewStr = fechaLimaDe(boViewDay);
const d = boViewDay;
let data = allCasos.filter(r => (r.fechaRegistro||'') === viewStr);
if (!data.length) { showToast('No hay casos para exportar', 'error'); return; }

const MES_X = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fechaStr = d.getDate() + ' de ' + MES_X[d.getMonth()] + ' de ' + d.getFullYear();
const generado = new Date().toLocaleDateString('es-PE');

const pendientes = data.filter(r=>(r.estadoLlamada||'pendiente')==='pendiente').length;
const atendidas  = data.filter(r=>r.estadoLlamada==='atendida').length;
const noCont     = data.filter(r=>r.estadoLlamada==='no_contesta').length;
const nivel      = data.length > 0 ? Math.round((atendidas/data.length)*100) : 0;
const alto       = data.filter(r=>(r.prioridad||'medio')==='alto').length;
const med        = data.filter(r=>(r.prioridad||'medio')==='medio').length;
const bajo       = data.filter(r=>(r.prioridad||'medio')==='bajo').length;

const eLabel = e => e==='atendida'?'Atendida':e==='no_contesta'?'No contesta':'Pendiente';
const pLabel = p => p?p.charAt(0).toUpperCase()+p.slice(1):'Medio';

const wb = XLSX.utils.book_new();

// ══════════════════════════════════════════
// HOJA 1 — DETALLE DE LLAMADAS
// ══════════════════════════════════════════
// Fila 1: Titulo del reporte
// Fila 2: Info del reporte
// Fila 3: Vacia
// Fila 4: Headers de tabla  (con AutoFilter)
// Fila 5+: Datos

const wsRows = [
  // Fila 1: Titulo
  ['REPORTE BO - LLAMADAS', '', '', '', '', '', '', '', '', '', ''],
  // Fila 2: Info
  [
    'Fecha de gestion: ' + fechaStr,
    '', '', '',
    'Generado: ' + generado,
    '', '',
    'Total casos: ' + data.length,
    '', '', ''
  ],
  // Fila 3: Vacia
  ['', '', '', '', '', '', '', '', '', '', ''],
  // Fila 4: Headers
  ['#', 'Fecha Registro', 'Nombre Alumno', 'Codigo', 'Celular', 'Asesor WSP', 'Prioridad', 'Estado', 'Motivo de Derivacion', 'Gestion BO', 'Observaciones'],
];

// Filas de datos
data.forEach((r, i) => {
  wsRows.push([
    i + 1,
    fmtDate(r.fechaRegistro || ''),
    (r.nombre || '').toUpperCase(),
    r.codigo || '',
    r.celular || '',
    r.asesorWsp || '',
    pLabel(r.prioridad),
    eLabel(r.estadoLlamada),
    r.motivo || '',
    r.descripcionBo || '',
    '',
  ]);
});

const ws = XLSX.utils.aoa_to_sheet(wsRows);

// Anchos de columna
ws['!cols'] = [
  {wch: 5},   // #
  {wch: 16},  // Fecha Registro
  {wch: 28},  // Nombre Alumno
  {wch: 12},  // Codigo
  {wch: 14},  // Celular
  {wch: 16},  // Asesor WSP
  {wch: 12},  // Prioridad
  {wch: 14},  // Estado
  {wch: 46},  // Motivo
  {wch: 44},  // Gestion BO
  {wch: 22},  // Observaciones
];

// Alturas de filas
ws['!rows'] = [
  {hpt: 22},  // Fila 1: titulo
  {hpt: 16},  // Fila 2: info
  {hpt: 6},   // Fila 3: vacia
  {hpt: 20},  // Fila 4: headers
];
data.forEach(() => ws['!rows'].push({hpt: 18}));

// Merges: titulo (A1:K1) e info parciales
ws['!merges'] = [
  {s:{r:0,c:0}, e:{r:0,c:10}},  // Titulo ocupa toda la fila 1
  {s:{r:1,c:0}, e:{r:1,c:3}},   // "Fecha de gestion: ..."
  {s:{r:1,c:4}, e:{r:1,c:6}},   // "Generado: ..."
  {s:{r:1,c:7}, e:{r:1,c:10}},  // "Total casos: ..."
];

// AutoFilter en fila 4 (row index 3), columnas A:K
ws['!autofilter'] = { ref: 'A4:K4' };

// Rango total
const lastRow = 4 + data.length;
ws['!ref'] = 'A1:K' + lastRow;

XLSX.utils.book_append_sheet(wb, ws, 'Detalle de Llamadas');

// ══════════════════════════════════════════
// HOJA 2 — RESUMEN
// ══════════════════════════════════════════
const wsResRows = [
  ['RESUMEN DEL DIA', ''],
  ['Fecha de gestion', fechaStr],
  ['Generado el',      generado],
  ['', ''],
  ['ESTADO DE LLAMADAS', ''],
  ['Total Casos',      data.length],
  ['Atendidas',        atendidas],
  ['No contesta',      noCont],
  ['Pendientes',       pendientes],
  ['Nivel de Atencion',nivel + '%'],
  ['', ''],
  ['PRIORIDAD', ''],
  ['Alta',             alto],
  ['Media',            med],
  ['Baja',             bajo],
];

const wsRes = XLSX.utils.aoa_to_sheet(wsResRows);
wsRes['!cols']   = [{wch:22},{wch:18}];
wsRes['!merges'] = [
  {s:{r:0,c:0},  e:{r:0,c:1}},
  {s:{r:4,c:0},  e:{r:4,c:1}},
  {s:{r:11,c:0}, e:{r:11,c:1}},
];
wsRes['!ref'] = 'A1:B' + wsResRows.length;

XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');

XLSX.writeFile(wb, 'ReporteBO_Llamadas_' + d.getDate() + '_' + MESES[d.getMonth()] + '_' + d.getFullYear() + '.xlsx');
showToast('Excel descargado ✓');
});
document.getElementById('btn-bo-export-pdf').addEventListener('click', () => {
const { jsPDF } = window.jspdf;
const viewStr = fechaLimaDe(boViewDay);
const d = boViewDay;
let data = allCasos.filter(r => (r.fechaRegistro||'') === viewStr);
if (!data.length) { showToast('No hay casos para exportar', 'error'); return; }

// Colores SISE
const NEGRO   = [13, 13, 13];
const ROJO    = [196, 30, 58];
const ROJOCL  = [255, 235, 238];
const BLANCO  = [255, 255, 255];
const GRIS1   = [245, 245, 245];
const GRIS2   = [220, 220, 220];
const GRIS3   = [140, 140, 140];
const GRIS4   = [60, 60, 60];
const VERDE   = [26, 122, 69];
const VERDECL = [232, 250, 240];
const NARANJA = [220, 100, 0];
const NARCL   = [255, 243, 224];
const PURPURA = [91, 33, 182];
const PURCL   = [245, 240, 255];

const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
const pw = pdf.internal.pageSize.width;
const ph = pdf.internal.pageSize.height;

const pendientes   = data.filter(r=>(r.estadoLlamada||'pendiente')==='pendiente').length;
const atendidas    = data.filter(r=>r.estadoLlamada==='atendida').length;
const noContesta   = data.filter(r=>r.estadoLlamada==='no_contesta').length;
const nivelAtencion = data.length > 0 ? Math.round((atendidas/data.length)*100) : 0;

const MESES_N = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fechaGestion = d.getDate() + ' de ' + MESES_N[d.getMonth()] + ' de ' + d.getFullYear();
const now = new Date();
const fechaEmision = now.getDate() + ' de ' + MESES_N[now.getMonth()] + ' de ' + now.getFullYear();
const fechaGen     = now.toLocaleDateString('es-PE');

const estadoStr = (est) => {
  if (est === 'atendida')    return 'Atendida';
  if (est === 'no_contesta') return 'No contesta';
  return 'Pendiente';
};
const prioStr = (p) => p ? p.charAt(0).toUpperCase()+p.slice(1) : 'Medio';

// Helpers de dibujo
function lineaRoja(x, y, w) {
  pdf.setFillColor(...ROJO);
  pdf.rect(x, y, w, 0.7, 'F');
}

function tituloSeccion(texto, y) {
  pdf.setFillColor(...NEGRO);
  pdf.roundedRect(10, y, 3.5, 8, 0.8, 0.8, 'F');
  pdf.setTextColor(...NEGRO);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(texto, 16.5, y + 5.8);
  lineaRoja(10, y + 10, pw - 20);
  return y + 15;
}

function badge(x, y, w, h, bg, textColor, texto) {
  pdf.setFillColor(...bg);
  pdf.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
  pdf.setTextColor(...textColor);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.text(texto, x + w/2, y + h/2 + 2, { align: 'center' });
}

function drawFooterAll() {
  const pgs = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pgs; i++) {
    pdf.setPage(i);
    pdf.setFillColor(...GRIS1);
    pdf.rect(0, ph - 13, pw, 13, 'F');
    pdf.setFillColor(...ROJO);
    pdf.rect(0, ph - 13, pw, 0.8, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.setTextColor(...GRIS3);
    pdf.text('Documento de uso interno y confidencial', 13, ph - 7.5);
    pdf.text('SISE - Portal SAES', 13, ph - 3.5);
    pdf.text('Pagina ' + i + ' de ' + pgs, pw - 12, ph - 5.5, { align: 'right' });
  }
}

// ============================================================
// CABECERA
// ============================================================
pdf.setFillColor(...NEGRO);
pdf.rect(0, 0, pw, 30, 'F');
pdf.setFillColor(...ROJO);
pdf.rect(0, 30, pw, 2.5, 'F');

// Logo: rectangulo negro con borde blanco + texto SISE
pdf.setFillColor(40, 40, 40);
pdf.roundedRect(10, 5, 22, 12, 1.5, 1.5, 'F');
pdf.setDrawColor(...BLANCO);
pdf.setLineWidth(0.4);
pdf.roundedRect(10, 5, 22, 12, 1.5, 1.5, 'S');
pdf.setTextColor(...BLANCO);
pdf.setFont('helvetica', 'bold');
pdf.setFontSize(9);
pdf.text('SISE', 21, 12.5, { align: 'center' });
// Subtitulo logo
pdf.setTextColor(...ROJO);
pdf.setFont('helvetica', 'bold');
pdf.setFontSize(5);
pdf.text('PORTAL SAES', 21, 21, { align: 'center' });

// Titulo
pdf.setTextColor(...BLANCO);
pdf.setFont('helvetica', 'bold');
pdf.setFontSize(13.5);
pdf.text('REPORTE DE GESTION BO - LLAMADAS', 38, 12);
pdf.setFont('helvetica', 'normal');
pdf.setFontSize(7);
pdf.setTextColor(180, 180, 180);
pdf.text('Gestion del Canal de Atencion al Estudiante - Area BackOffice', 38, 19);

// Fecha cabecera
pdf.setTextColor(...ROJO);
pdf.setFont('helvetica', 'bold');
pdf.setFontSize(8.5);
pdf.text(fechaGestion, pw - 12, 12, { align: 'right' });
pdf.setFont('helvetica', 'normal');
pdf.setFontSize(6.5);
pdf.setTextColor(180, 180, 180);
pdf.text('Generado: ' + fechaGen, pw - 12, 18.5, { align: 'right' });

// ============================================================
// META INFO
// ============================================================
const metaY = 35;
pdf.setFillColor(...GRIS1);
pdf.rect(0, metaY, pw, 20, 'F');
pdf.setFillColor(...GRIS2);
pdf.rect(0, metaY + 20, pw, 0.4, 'F');

const metaCols = [
  { label: 'Fecha de gestion',   val: fechaGestion },
  { label: 'Fecha de emision',   val: fechaEmision },
  { label: 'Area',               val: 'Servicio de Atencion al Estudiante (SAE)' },
  { label: 'Elaborado por',      val: 'BO - Seguimiento y Calidad' },
];
const mcW = pw / 4;
metaCols.forEach((m, i) => {
  const mx = i * mcW + 6;
  if (i > 0) {
    pdf.setDrawColor(...GRIS2);
    pdf.setLineWidth(0.3);
    pdf.line(i * mcW, metaY + 3, i * mcW, metaY + 17);
  }
  pdf.setTextColor(...ROJO);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.text(m.label, mx, metaY + 8.5);
  pdf.setTextColor(...GRIS4);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  const valLines = pdf.splitTextToSize(m.val, mcW - 8);
  pdf.text(valLines, mx, metaY + 14);
});

// ============================================================
// RESUMEN EJECUTIVO
// ============================================================
let curY = metaY + 24;
curY = tituloSeccion('RESUMEN EJECUTIVO', curY);

const kpis = [
  { label: 'Total Casos',       val: String(data.length),    bg: NEGRO,   text: BLANCO,   bdr: NEGRO   },
  { label: 'Pendientes',        val: String(pendientes),      bg: PURCL,   text: PURPURA,  bdr: PURPURA },
  { label: 'Atendidas',         val: String(atendidas),       bg: VERDECL, text: VERDE,    bdr: VERDE   },
  { label: 'No Contesta',       val: String(noContesta),      bg: ROJOCL,  text: ROJO,     bdr: ROJO    },
  { label: 'Nivel de Atencion', val: nivelAtencion + '%',     bg: NEGRO,   text: BLANCO,   bdr: NEGRO   },
];

const kpiGap = 3;
const kpiW   = (pw - 20 - kpiGap * (kpis.length - 1)) / kpis.length;
const kpiH   = 22;

kpis.forEach((k, i) => {
  const kx = 10 + i * (kpiW + kpiGap);
  const ky = curY;
  pdf.setFillColor(...k.bg);
  pdf.roundedRect(kx, ky, kpiW, kpiH, 2, 2, 'F');
  pdf.setDrawColor(...k.bdr);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(kx, ky, kpiW, kpiH, 2, 2, 'S');
  pdf.setTextColor(...k.text);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(k.val, kx + kpiW/2, ky + 13.5, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  pdf.text(k.label, kx + kpiW/2, ky + 19, { align: 'center' });
});
curY += kpiH + 8;

// ============================================================
// DETALLE DE LLAMADAS
// ============================================================
curY = tituloSeccion('DETALLE DE LLAMADAS GESTIONADAS', curY);

pdf.autoTable({
  startY: curY,
  head: [['#','Alumno','Codigo','Celular','Asesor WSP','Prioridad','Estado','Motivo','Gestion BO']],
  body: data.map((r, i) => [
    i + 1,
    (r.nombre || '—').toUpperCase(),
    r.codigo || '—',
    r.celular || '—',
    r.asesorWsp || '—',
    prioStr(r.prioridad),
    estadoStr(r.estadoLlamada),
    r.motivo || '—',
    r.descripcionBo || '—'
  ]),
  styles: {
    font: 'helvetica', fontSize: 7,
    cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    lineColor: GRIS2, lineWidth: 0.2, overflow: 'linebreak', textColor: GRIS4,
  },
  headStyles: {
    fillColor: NEGRO, textColor: BLANCO,
    fontStyle: 'bold', fontSize: 7.5, halign: 'left',
    cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
  },
  columnStyles: {
    0: { cellWidth: 7,  halign: 'center' },
    1: { cellWidth: 27 },
    2: { cellWidth: 15 },
    3: { cellWidth: 18 },
    4: { cellWidth: 16 },
    5: { cellWidth: 14 },
    6: { cellWidth: 17 },
    7: { cellWidth: 40 },
    8: { cellWidth: 'auto' },
  },
  alternateRowStyles: { fillColor: [249, 249, 249] },
  margin: { left: 10, right: 10 },
  didDrawCell: (hk) => {
    if (hk.section !== 'body') return;
    if (hk.column.index === 6) {
      const val = hk.cell.raw;
      const cx = hk.cell.x + 2, cy = hk.cell.y + 2, cw = hk.cell.width - 4, ch = hk.cell.height - 4;
      if (val === 'Atendida')       { pdf.setFillColor(...VERDECL); pdf.roundedRect(cx,cy,cw,ch,1.5,1.5,'F'); pdf.setTextColor(...VERDE); }
      else if (val === 'No contesta') { pdf.setFillColor(...ROJOCL); pdf.roundedRect(cx,cy,cw,ch,1.5,1.5,'F'); pdf.setTextColor(...ROJO); }
      else                           { pdf.setFillColor(...PURCL);  pdf.roundedRect(cx,cy,cw,ch,1.5,1.5,'F'); pdf.setTextColor(...PURPURA); }
      pdf.setFontSize(6.5); pdf.setFont('helvetica','bold');
      pdf.text(val, cx+cw/2, cy+ch/2+2, { align: 'center' });
    }
    if (hk.column.index === 5) {
      const val = (hk.cell.raw||'').toLowerCase();
      const cx = hk.cell.x+2, cy = hk.cell.y+2, cw = hk.cell.width-4, ch = hk.cell.height-4;
      if (val==='alto')       { pdf.setFillColor(...ROJOCL); pdf.roundedRect(cx,cy,cw,ch,1.5,1.5,'F'); pdf.setTextColor(...ROJO); }
      else if (val==='bajo')  { pdf.setFillColor(...VERDECL); pdf.roundedRect(cx,cy,cw,ch,1.5,1.5,'F'); pdf.setTextColor(...VERDE); }
      else                    { pdf.setFillColor(...NARCL);  pdf.roundedRect(cx,cy,cw,ch,1.5,1.5,'F'); pdf.setTextColor(...NARANJA); }
      pdf.setFontSize(6.5); pdf.setFont('helvetica','bold');
      pdf.text(hk.cell.raw||'', cx+cw/2, cy+ch/2+2, { align: 'center' });
    }
  },
});

curY = (pdf.lastAutoTable && pdf.lastAutoTable.finalY) ? pdf.lastAutoTable.finalY + 8 : curY + 30;

// ============================================================
// DETALLE POR CASO
// ============================================================
data.forEach((r, idx) => {
  if (curY + 68 > ph - 18) { pdf.addPage(); curY = 16; }

  const est = r.estadoLlamada;
  const estLabel  = estadoStr(est);
  const estColor  = est==='atendida' ? VERDE : est==='no_contesta' ? ROJO : PURPURA;
  const estFondo  = est==='atendida' ? VERDECL : est==='no_contesta' ? ROJOCL : PURCL;

  // Franja cabecera del caso
  pdf.setFillColor(...NEGRO);
  pdf.roundedRect(10, curY, pw-20, 8, 1.5, 1.5, 'F');
  pdf.setTextColor(...ROJO);
  pdf.setFont('helvetica','bold');
  pdf.setFontSize(7.5);
  pdf.text('CASO #' + (idx+1), 14, curY+5.5);
  pdf.setTextColor(200,200,200);
  pdf.setFont('helvetica','normal');
  pdf.setFontSize(7);
  pdf.text((r.nombre||'').toUpperCase() + '   Cod: ' + (r.codigo||'—') + '   ' + (r.asesorWsp||'—'), 42, curY+5.5);
  curY += 11;

  const colW3  = (pw - 24) / 3;
  const col1x  = 10;
  const col2x  = 10 + colW3 + 2;
  const col3x  = 10 + 2*(colW3 + 2);
  const cardH  = 50;

  // ── Col 1: Detalle del caso
  pdf.setFillColor(...GRIS1);
  pdf.roundedRect(col1x, curY, colW3, cardH, 1.5, 1.5, 'F');
  pdf.setFillColor(...NEGRO);
  pdf.roundedRect(col1x, curY, colW3, 7, 1.5, 0, 'F');
  pdf.rect(col1x, curY+5, colW3, 2, 'F');
  pdf.setTextColor(...BLANCO);
  pdf.setFont('helvetica','bold');
  pdf.setFontSize(6.5);
  pdf.text('DETALLE DEL CASO', col1x + colW3/2, curY+5, {align:'center'});

  const campos = [
    ['Alumno',      (r.nombre||'—').toUpperCase()],
    ['Codigo',      r.codigo||'—'],
    ['Celular',     r.celular||'—'],
    ['Asesor WSP',  r.asesorWsp||'—'],
    ['Prioridad',   prioStr(r.prioridad)],
    ['Estado',      estLabel],
  ];
  let fy = curY + 13;
  campos.forEach(([lb, vl]) => {
    pdf.setFont('helvetica','bold'); pdf.setFontSize(5.5); pdf.setTextColor(...GRIS3);
    pdf.text(lb, col1x+4, fy);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(...NEGRO);
    const lines = pdf.splitTextToSize(vl, colW3-8);
    pdf.text(lines[0], col1x+4, fy+4.5);
    fy += 8.5;
    if (fy > curY + cardH - 4) return;
  });

  // ── Col 2: Gestion realizada
  pdf.setFillColor(...GRIS1);
  pdf.roundedRect(col2x, curY, colW3, cardH, 1.5, 1.5, 'F');
  pdf.setFillColor(180, 80, 0);
  pdf.roundedRect(col2x, curY, colW3, 7, 1.5, 0, 'F');
  pdf.rect(col2x, curY+5, colW3, 2, 'F');
  pdf.setTextColor(...BLANCO);
  pdf.setFont('helvetica','bold');
  pdf.setFontSize(6.5);
  pdf.text('GESTION REALIZADA', col2x + colW3/2, curY+5, {align:'center'});

  const gests = r.descripcionBo && r.descripcionBo.trim()
    ? r.descripcionBo.split('.').filter(s=>s.trim()).slice(0,4)
    : [
        'Se realizo llamada telefonica a la estudiante',
        'Se explico el estado del caso y proceso de validacion',
        'Se indico que la respuesta sera brindada por los canales oficiales',
        'No fue posible completar la atencion por falta de comunicacion',
      ];

  let gy = curY + 13;
  gests.forEach(g => {
    const gs = g.trim();
    if (!gs) return;
    if (gy > curY + cardH - 4) return;
    // punto de lista (circulo pequeno)
    pdf.setFillColor(...VERDE);
    pdf.circle(col2x+5.5, gy-1.5, 1.2, 'F');
    const lines = pdf.splitTextToSize(gs.charAt(0).toUpperCase()+gs.slice(1) + '.', colW3-13);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(...GRIS4);
    pdf.text(lines, col2x+9, gy);
    gy += lines.length * 4 + 2;
  });

  // ── Col 3: Resultado
  pdf.setFillColor(...GRIS1);
  pdf.roundedRect(col3x, curY, colW3, cardH, 1.5, 1.5, 'F');
  pdf.setFillColor(...VERDE);
  pdf.roundedRect(col3x, curY, colW3, 7, 1.5, 0, 'F');
  pdf.rect(col3x, curY+5, colW3, 2, 'F');
  pdf.setTextColor(...BLANCO);
  pdf.setFont('helvetica','bold');
  pdf.setFontSize(6.5);
  pdf.text('RESULTADO DE LA GESTION', col3x + colW3/2, curY+5, {align:'center'});

  // Badge estado
  pdf.setFillColor(...estFondo);
  pdf.roundedRect(col3x+4, curY+10, colW3-8, 9, 2, 2, 'F');
  pdf.setDrawColor(...estColor);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(col3x+4, curY+10, colW3-8, 9, 2, 2, 'S');
  pdf.setTextColor(...estColor);
  pdf.setFont('helvetica','bold');
  pdf.setFontSize(8);
  pdf.text(estLabel, col3x + colW3/2, curY+16.5, {align:'center'});

  // Separador
  pdf.setDrawColor(...GRIS2);
  pdf.setLineWidth(0.3);
  pdf.line(col3x+4, curY+22, col3x+colW3-4, curY+22);

  // Observacion
  pdf.setTextColor(...NEGRO);
  pdf.setFont('helvetica','bold');
  pdf.setFontSize(6);
  pdf.text('Observacion:', col3x+4, curY+27);
  const obs = est==='no_contesta'
    ? 'La estudiante mantiene situacion pendiente. Se recomienda nuevo intento de contacto o seguimiento por otros canales.'
    : est==='atendida'
    ? 'Caso atendido satisfactoriamente. El seguimiento fue completado con exito.'
    : 'Caso pendiente de resolucion. Requiere seguimiento por el area correspondiente.';
  const obsLines = pdf.splitTextToSize(obs, colW3-8);
  pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(...GRIS4);
  pdf.text(obsLines, col3x+4, curY+32.5);

  curY += cardH + 3;

  // Franja motivo completo
  pdf.setFillColor(...GRIS1);
  pdf.roundedRect(10, curY, pw-20, 14, 1.5, 1.5, 'F');
  pdf.setTextColor(...ROJO);
  pdf.setFont('helvetica','bold');
  pdf.setFontSize(6);
  pdf.text('Motivo:', 14, curY+5);
  const motivoLines = pdf.splitTextToSize(r.motivo||'—', pw-46);
  pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(...GRIS4);
  pdf.text(motivoLines, 30, curY+5);
  curY += 18;
});

// ============================================================
// CONCLUSIONES
// ============================================================
if (curY + 40 > ph - 18) { pdf.addPage(); curY = 16; }
curY = tituloSeccion('CONCLUSIONES', curY);

const concls = [
  { titulo: 'Casos gestionados', desc: 'Se gestionaron ' + data.length + ' caso(s) durante la jornada.' },
  { titulo: 'Resumen de estados', desc: atendidas + ' atendidas / ' + noContesta + ' sin contacto / ' + pendientes + ' pendiente(s).' },
  { titulo: 'Nivel de atencion', desc: 'Nivel de atencion efectivo: ' + nivelAtencion + '%.' },
  { titulo: 'Seguimiento', desc: noContesta + ' caso(s) requieren nuevo intento de contacto.' },
];

const cN = concls.length;
const cGap = 3;
const cW = (pw - 20 - cGap*(cN-1)) / cN;
const cH = 22;

concls.forEach((c, i) => {
  const cx = 10 + i*(cW+cGap);
  pdf.setFillColor(...GRIS1);
  pdf.roundedRect(cx, curY, cW, cH, 2, 2, 'F');
  pdf.setDrawColor(...GRIS2);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(cx, curY, cW, cH, 2, 2, 'S');
  // Icono: circulo negro solido
  pdf.setFillColor(...NEGRO);
  pdf.circle(cx + cW/2, curY + 7, 4, 'F');
  // Inicial del titulo dentro del circulo
  pdf.setTextColor(...BLANCO);
  pdf.setFont('helvetica','bold');
  pdf.setFontSize(7);
  pdf.text(c.titulo.charAt(0).toUpperCase(), cx + cW/2, curY + 8.8, {align:'center'});
  // Texto
  pdf.setTextColor(...GRIS4);
  pdf.setFont('helvetica','normal');
  pdf.setFontSize(6);
  const lines = pdf.splitTextToSize(c.desc, cW-4);
  pdf.text(lines, cx+2, curY+15.5);
});
curY += cH + 6;

// ============================================================
// NOTA
// ============================================================
if (curY + 14 > ph - 18) { pdf.addPage(); curY = 16; }
pdf.setFillColor(240, 244, 255);
pdf.roundedRect(10, curY, pw-20, 12, 1.5, 1.5, 'F');
pdf.setDrawColor(...ROJO);
pdf.setLineWidth(0.4);
pdf.roundedRect(10, curY, pw-20, 12, 1.5, 1.5, 'S');
// Cuadrado "i" como icono
pdf.setFillColor(...ROJO);
pdf.roundedRect(13, curY+3.5, 6, 6, 1, 1, 'F');
pdf.setTextColor(...BLANCO);
pdf.setFont('helvetica','bold');
pdf.setFontSize(7.5);
pdf.text('i', 16, curY+7.5, {align:'center'});
// Texto
pdf.setTextColor(...NEGRO);
pdf.setFont('helvetica','bold');
pdf.setFontSize(7);
pdf.text('Nota:', 23, curY+7.5);
pdf.setTextColor(...GRIS4);
pdf.setFont('helvetica','normal');
pdf.text('Este reporte muestra el detalle de las llamadas gestionadas por el area BO.', 36, curY+7.5);

// ============================================================
// FOOTER EN TODAS LAS PAGINAS
// ============================================================
drawFooterAll();

pdf.save('ReporteBO_Llamadas_' + d.getDate() + '_' + MESES[d.getMonth()] + '_' + d.getFullYear() + '.pdf');
showToast('PDF descargado \u2713');
});


const PLANTILLAS_SEMILLA = [
{ orden: 1,  nombre: 'Plantilla de uso general destinada a la atención de casos que no cuentan con una plantilla específica o que no se encuentran contemplados en las categorías existentes.', desc: 'Para casos que deban ser derivados a un área especializada fuera del canal de WhatsApp, así como para consultas simples o requerimientos que hayan sido resueltos y cerrados por el asesor.', icon: 'ti-building',      color: '#EBF2FF', texto: `📢 Bríndame la siguiente información:\n\nCarrera/Curso extensión/Titulación:\nSede/Modalidad:\nTurno:\nCorreo personal:\nCelular:`, imgB64: '' },
{ orden: 2,  nombre: 'Ingreso manual de retiro', desc: 'Para solicitar el retiro de ciclo o definitivo de un alumno de forma manual.', icon: 'ti-user-minus', color: '#FFF0F0', texto: `📢 Bríndame la siguiente información:\n\nCarrera/Curso extensión/Titulación:\nSede/Modalidad:\nTipo de retiro: Ciclo o definitivo (elige según retiro)\nCorreo personal:\nCelular:`, imgB64: '' },
{ orden: 3,  nombre: 'Regularización de notas', desc: 'Para regularizar calificaciones de un alumno en un curso o ciclo específico.', icon: 'ti-edit',         color: '#FFF7E6', texto: `📢 Bríndame la siguiente información:\n\nMotivo de la regularización:\nCurso:\nCiclo lectivo:\nCalificaciones (EA1, EA2, EP, EF) o promedio final:\nCorreo personal:\nCelular:\nAdjuntar sustentos`, imgB64: '' },
{ orden: 4,  nombre: 'Búsqueda de notas Carrera CPEX y Titulación', desc: 'Para localizar calificaciones de alumnos antiguos o egresados de carrera.', icon: 'ti-search',       color: '#E8FAF0', texto: `📢 Bríndame la siguiente información:\n\nCarrera/Curso extensión/Titulación:\nSede/Modalidad:\nAño ingreso/egreso aproximado:\nHasta qué ciclo estudió:\nCorreo personal:\nCelular:`, imgB64: '' },
{ orden: 5,  nombre: 'Reportar incidencia con docente', desc: 'Para registrar una incidencia puntual con un docente en un curso.', icon: 'ti-alert-triangle', color: '#FFF7E6', texto: `📢 Bríndame la siguiente información:\n\nCarrera/Curso extensión/Titulación:\nSede/Modalidad:\nCurso:\nDocente:\nCorreo personal:\nCelular:`, imgB64: '' },
{ orden: 6,  nombre: 'Queja con docente', desc: 'Para registrar una queja formal sobre la conducta o desempeño de un docente.', icon: 'ti-mood-sad',     color: '#FFF0F0', texto: `📢 Bríndame la siguiente información:\n\nCarrera/Curso extensión/Titulación:\nSede/Modalidad:\nTurno:\nCiclo/Bloque:\nCurso:\nDocente:\nCorreo personal:\nCelular:\nMotivo de la queja:`, imgB64: '' },
{ orden: 7,  nombre: 'Certificado FCI', desc: 'Para solicitar el certificado de finalización de curso de extensión (FCI).', icon: 'ti-certificate',  color: '#F5F0FF', texto: `📢 Bríndame la siguiente información:\n\nNombre del Curso de Extensión:\nSede:\nModalidad:\nFecha de inicio:\nFecha que culminó:\nCorreo personal:\nNivel de módulo obtenido: (Aplica para estudiantes que ingresaron por examen de clasificación)`, imgB64: '' },
{ orden: 8,  nombre: 'Alumnos antiguos que no figuran en PeopleSoft', desc: 'Para alumnos antiguos que no figuran en PeopleSoft y requieren la creación de una cuenta en Salesforce para la gestión de su caso.', icon: 'ti-users', color: '#EBF2FF', texto: `📢 Bríndame la siguiente información:\n\nNombres y Apellidos:\nDNI:\nCarrera:\nSede/Modalidad:\nAño ingreso/egreso:\nCiclo/Bloque que estudió:\nCorreo personal:\nCelular:`, imgB64: '' },
{ orden: 9,  nombre: 'Matrícula administrativa FCI', desc: 'Para matricular administrativamente a un alumno en un curso de extensión.', icon: 'ti-school',       color: '#E8FAF0', texto: `📢 Bríndame la siguiente información:\n\nCurso:\nHorario:\nGrupo:\nDocente:\nCorreo personal:\nCelular:`, imgB64: '' },
{ orden: 10, nombre: 'Creación de ID para pago', desc: 'Para generar un ID de pago a alumnos antiguos que no cuentan con uno.', icon: 'ti-id-badge',    color: '#FFF0E8', texto: `📢 Bríndame la siguiente información:\n\nCarrera/Curso extensión/Titulación:\nSede/Modalidad:\nNúmero de DNI/CE/PS:\nCorreo personal:\nCelular:\nDirección:\nFecha de Nacimiento:\nAdjuntar imagen de DNI/CE/PASAPORTE`, imgB64: '' },
];
let PLANTILLAS       = [];       // array en tiempo real desde Firestore
let _pltEditId       = null;     // null = crear, string = editar
async function iniciarListenersPlantillas() {
const snap0 = await getDocs(collection(db, 'plantillas'));
if (snap0.empty) {
await Promise.all(PLANTILLAS_SEMILLA.map(p =>
addDoc(collection(db, 'plantillas'), { ...p, creadoEn: serverTimestamp() })
));
}
onSnapshot(
query(collection(db, 'plantillas'), orderBy('orden', 'asc')),
snap => { try { PLANTILLAS = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderPlantillas(); } catch(e) { console.error('renderPlantillas:', e); } },
err => console.error('onSnapshot plantillas:', err)
);
}
// iniciarListenersPlantillas() se llama dentro de onAuthStateChanged
// ── Utilidades de búsqueda mejorada ──────────────────────────────────────────
function _normalizar(s) {
  return (s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
// ── Búsqueda inteligente compartida ──────────────────────────────────────────
// Levenshtein para tolerancia tipográfica
function _lev(a,b){if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;const dp=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)dp[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);return dp[a.length][b.length];}
// ¿Coincide un token con alguna palabra del texto? (exacta, prefijo, typo)
function _tokenMatch(tok, textNorm) {
  if (!tok || tok.length < 2) return false;
  if (textNorm.includes(tok)) return true;
  const words = textNorm.split(/\s+/);
  for (const w of words) {
    if (w === tok) return true;
    if (w.startsWith(tok) || tok.startsWith(w)) return true;
    if (tok.length >= 4 && _lev(tok, w) <= 1) return true;
    if (tok.length >= 6 && _lev(tok, w) <= 2) return true;
  }
  return false;
}
// ¿Coincide una query (multi-token) con un conjunto de campos?
function _smartMatch(fields, query) {
  const qNorm = _normalizar(query);
  if (!qNorm) return true;
  const tokens = qNorm.split(/\s+/).filter(t => t.length >= 2);
  if (!tokens.length) return true;
  const combined = fields.map(f => _normalizar(f)).join(' ');
  return tokens.every(tok => _tokenMatch(tok, combined));
}
// Highlight en HTML escapado — resalta tokens en el texto original
function _hlTokens(text, query) {
  if (!query || !query.trim()) return escH(text);
  const tokens = _normalizar(query).split(/\s+/).filter(t => t.length >= 2);
  if (!tokens.length) return escH(text);
  // Trabajar sobre el texto sin escapar para encontrar posiciones reales
  const sorted = [...tokens].sort((a,b) => b.length - a.length);
  // Normalizar el texto para buscar, pero aplicar highlight en el original
  const normText = _normalizar(text);
  // Marcar rangos a resaltar (sobre normText)
  const ranges = [];
  sorted.forEach(tok => {
    let idx = 0;
    while ((idx = normText.indexOf(tok, idx)) !== -1) {
      ranges.push([idx, idx + tok.length]);
      idx += tok.length;
    }
  });
  if (!ranges.length) return escH(text);
  // Fusionar rangos solapados
  ranges.sort((a,b) => a[0]-b[0]);
  const merged = [ranges[0]];
  for (let i=1;i<ranges.length;i++){
    const last = merged[merged.length-1];
    if (ranges[i][0] <= last[1]) last[1] = Math.max(last[1], ranges[i][1]);
    else merged.push(ranges[i]);
  }
  // Reconstruir HTML con marks
  let out = '';
  let pos = 0;
  merged.forEach(([s,e]) => {
    out += escH(text.slice(pos, s));
    out += '<mark class="plt-hl">' + escH(text.slice(s, e)) + '</mark>';
    pos = e;
  });
  out += escH(text.slice(pos));
  return out;
}
// Exponer globalmente para módulos
window._smartMatch = _smartMatch;
window._hlTokens   = _hlTokens;
// ─────────────────────────────────────────────────────────────────────────────
function _highlight(text, tokens) {
  if (!tokens || !tokens.length) return escH(text);
  let safe = escH(text);
  tokens.forEach(tok => {
    const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    // Match normalized positions: we do a simple inline approach
    const re = new RegExp('(' + escaped + ')', 'gi');
    safe = safe.replace(re, '<mark class="plt-hl">$1</mark>');
  });
  return safe;
}
function _scoreMatch(p, tokens) {
  const fields = [
    { text: _normalizar(p.nombre), weight: 10 },
    { text: _normalizar(p.desc),   weight: 5  },
    { text: _normalizar(p.texto),  weight: 1  },
  ];
  let score = 0;
  for (const tok of tokens) {
    let matched = false;
    for (const f of fields) {
      if (f.text.includes(tok)) { score += f.weight; matched = true; }
    }
    if (!matched) return -1; // all tokens must match
  }
  return score;
}
function renderPlantillas(q) {
const grid = document.getElementById('plantillas-grid');
if (!grid) return;
const rawQ = (q !== undefined ? q : (document.getElementById('search-plantillas').value || '')).trim();
const normQ = _normalizar(rawQ);
const tokens = normQ ? normQ.split(/\s+/).filter(Boolean) : [];
const formador = isFormador();
if (formador) grid.classList.add('is-formador-plt');
else grid.classList.remove('is-formador-plt');
// Filter + score
let filtered = PLANTILLAS.map(p => ({ p, score: tokens.length ? _scoreMatch(p, tokens) : 0 }))
  .filter(x => x.score >= 0)
  .sort((a,b) => tokens.length ? (b.score - a.score) : 0);
// Update counter and clear button
const countEl = document.getElementById('plt-search-count');
const clearEl = document.getElementById('plt-search-clear');
if (tokens.length) {
  if (countEl) { countEl.style.display=''; countEl.textContent = filtered.length + '/' + PLANTILLAS.length; }
  if (clearEl) clearEl.style.display='';
} else {
  if (countEl) countEl.style.display='none';
  if (clearEl) clearEl.style.display='none';
}
if (!filtered.length) {
  grid.innerHTML = `<div class="plt-empty"><i class="ti ti-file-off"></i><p>No se encontraron plantillas${rawQ ? ` para "<strong>${escH(rawQ)}</strong>"` : ''}.</p><p style="font-size:12px;color:var(--muted);margin-top:6px">Intenta con otras palabras clave.</p></div>`;
  return;
}
// Build highlight tokens in original casing (for display)
const displayTokens = rawQ ? rawQ.trim().split(/\s+/).filter(Boolean) : [];
grid.innerHTML = filtered.map(({ p }, idx) => {
const rowActs = formador ? `
<div class="plt-row-actions" onclick="event.stopPropagation()">
<button class="btn-plt-edit" title="Editar" onclick="abrirModalPlt('${p.id}')"><i class="ti ti-pencil"></i></button>
<button class="btn-plt-del"  title="Eliminar" onclick="eliminarPlt('${p.id}')"><i class="ti ti-trash"></i></button>
</div>` : '';
const hlNombre = _highlight(p.nombre, displayTokens);
const hlDesc   = _highlight(p.desc,   displayTokens);
// Show snippet of texto only when searching and matches in content
let textoSnippet = '';
if (tokens.length) {
  const normTexto = _normalizar(p.texto||'');
  const matchInTexto = tokens.some(t => normTexto.includes(t) && !_normalizar(p.nombre||'').includes(t) && !_normalizar(p.desc||'').includes(t));
  if (matchInTexto) {
    // Find best snippet around first token match
    const firstTok = tokens.find(t => normTexto.includes(t));
    const idx2 = normTexto.indexOf(firstTok);
    const start = Math.max(0, idx2 - 40);
    const end   = Math.min((p.texto||'').length, idx2 + 80);
    const snippet = (start > 0 ? '…' : '') + (p.texto||'').slice(start, end).replace(/\n/g,' ') + (end < (p.texto||'').length ? '…' : '');
    textoSnippet = `<div class="plt-snippet"><i class="ti ti-file-text" style="font-size:10px;opacity:0.5"></i> ${_highlight(snippet, displayTokens)}</div>`;
  }
}
return `
<div class="plt-row" onclick="window._verPlantilla('${p.id}')">
<div class="plt-num-bar">
<span class="plt-num-label">Nº</span>
<span class="plt-num-val">${String(idx + 1).padStart(2,'0')}</span>
</div>
<div class="plt-icon-wrap" style="background:${p.color||'#EBF2FF'}40">
<i class="ti ${p.icon||'ti-file-text'}" style="color:var(--orange)"></i>
</div>
<div class="plt-body">
<div class="plt-name">${hlNombre}</div>
<div class="plt-desc">${hlDesc}</div>
${textoSnippet}
</div>
${rowActs}
<div class="plt-actions" onclick="event.stopPropagation()">
<button class="plt-btn-copy" onclick="window._copiarPlantillaId('${p.id}')">
<i class="ti ti-copy"></i>Copiar
</button>
<button class="plt-btn-view" title="Ver completa" onclick="window._verPlantilla('${p.id}')">
<i class="ti ti-eye"></i>
</button>
</div>
</div>`;
}).join('');
}
document.getElementById('search-plantillas').addEventListener('input', function() { renderPlantillas(this.value); });
const pltClearBtn = document.getElementById('plt-search-clear');
if (pltClearBtn) pltClearBtn.addEventListener('click', function() {
  const inp = document.getElementById('search-plantillas');
  inp.value = ''; inp.focus(); renderPlantillas('');
});
const mpOverlay = document.getElementById('modal-plantilla-overlay');
document.getElementById('mp-close').addEventListener('click',  () => mpOverlay.classList.remove('open'));
document.getElementById('mp-cancel').addEventListener('click', () => mpOverlay.classList.remove('open'));
mpOverlay.addEventListener('click', e => { if (e.target === mpOverlay) mpOverlay.classList.remove('open'); });
document.getElementById('mp-copy').addEventListener('click', () => {
const txt = document.getElementById('mp-body').textContent;
_copiarTexto(txt, 'Plantilla copiada al portapapeles');
});
window._verPlantilla = (id) => {
const p = PLANTILLAS.find(x => x.id === id);
if (!p) return;
document.getElementById('mp-title').textContent = p.nombre;
document.getElementById('mp-desc').textContent  = p.desc;
document.getElementById('mp-body').textContent  = p.texto;
const wrap = document.getElementById('mp-img-wrap');
const img  = document.getElementById('mp-img');
if (p.imgB64) {
img.src = p.imgB64; wrap.style.display = 'flex';
wrap.onclick = () => openZoom(p.imgB64);
} else { wrap.style.display = 'none'; }
mpOverlay.classList.add('open');
};
function _aplicarVarsPersonalizacion(texto) {
const nombreUsuario = (document.getElementById('pvar-nombre-usuario') || {}).value || '';
const nombreAsesor  = (document.getElementById('pvar-nombre-asesor')  || {}).value || '';
const nCaso         = (document.getElementById('pvar-ncaso')           || {}).value || '';
const dias          = (document.getElementById('pvar-dias')            || {}).value || '';
let t = texto;
if (nombreUsuario) t = t.replace(/\[NOMBRE_USUARIO\]/g, nombreUsuario);
if (nombreAsesor)  t = t.replace(/\[NOMBRE_ASESOR\]/g,  nombreAsesor);
if (nCaso)         t = t.replace(/\[N°_CASO\]/g,        nCaso);
if (dias)          t = t.replace(/__\s*días hábiles/g,  dias + ' días hábiles');
return t;
}
function _copiarTexto(texto, msg) {
msg = msg || 'Copiado al portapapeles';
const txt = _aplicarVarsPersonalizacion(texto);
const _doSound = () => {
const sonidoOn = (localStorage.getItem('pref_sonido') || 'false') === 'true';
if (sonidoOn) {
try {
const ctx = new (window.AudioContext || window.webkitAudioContext)();
const osc = ctx.createOscillator(); const gain = ctx.createGain();
osc.connect(gain); gain.connect(ctx.destination);
osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
gain.gain.setValueAtTime(0.15, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.18);
} catch(e) {}
}
};
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(txt).then(() => { showToast(msg); _doSound(); }).catch(() => {
_fallbackCopy(txt); showToast(msg); _doSound();
});
} else { _fallbackCopy(txt); showToast(msg); _doSound(); }
}
function _fallbackCopy(txt) {
const ta = document.createElement('textarea');
ta.value = txt; ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
document.body.appendChild(ta); ta.focus(); ta.select();
try { document.execCommand('copy'); } catch(e) {}
document.body.removeChild(ta);
}
window._copiarPlantillaId = (id) => {
const p = PLANTILLAS.find(x => x.id === id);
if (!p) return;
_copiarTexto(p.texto, 'Plantilla copiada al portapapeles');
};
const pltFormOverlay = document.getElementById('modal-plt-form-overlay');
function abrirModalPltNueva() { abrirModalPlt(null); }
window.abrirModalPlt = function(id) {
const p = id ? PLANTILLAS.find(x => x.id === id) : null;
_pltEditId = id || null;
document.getElementById('modal-plt-form-title').textContent   = p ? 'Editar plantilla' : 'Nueva plantilla';
document.getElementById('btn-plt-form-save-text').textContent = p ? 'Guardar cambios' : 'Guardar plantilla';
document.getElementById('fplt-nombre').value = p ? (p.nombre || '') : '';
document.getElementById('fplt-desc').value   = p ? (p.desc   || '') : '';
document.getElementById('fplt-texto').value  = p ? (p.texto  || '') : '';
const iconVal = p ? (p.icon || 'ti-file-text') : 'ti-file-text';
document.getElementById('fplt-icon').value = iconVal;
document.querySelectorAll('.plt-icon-opt').forEach(el => {
el.classList.toggle('selected', el.dataset.icon === iconVal);
});
const colorVal = p ? (p.color || '#EBF2FF') : '#EBF2FF';
document.getElementById('fplt-color').value = colorVal;
document.querySelectorAll('.plt-color-swatch').forEach(el => {
el.classList.toggle('selected', el.dataset.color === colorVal);
});
const preview = document.getElementById('fplt-img-preview');
const b64 = p ? (p.imgB64 || '') : '';
document.getElementById('fplt-img-b64').value = b64;
document.getElementById('fplt-img-file').value = '';
if (b64) { preview.src = b64; preview.style.display = 'block'; }
else { preview.src = ''; preview.style.display = 'none'; }
pltFormOverlay.classList.add('open');
};
function cerrarModalPlt() { pltFormOverlay.classList.remove('open'); _pltEditId = null; }
document.getElementById('modal-plt-form-close').addEventListener('click', cerrarModalPlt);
document.getElementById('btn-plt-form-cancel').addEventListener('click', cerrarModalPlt);
pltFormOverlay.addEventListener('click', e => { if (e.target === pltFormOverlay) cerrarModalPlt(); });
document.getElementById('btn-plt-nueva').addEventListener('click', abrirModalPltNueva);
window.selPltIcon = function(el) {
document.querySelectorAll('.plt-icon-opt').forEach(o => o.classList.remove('selected'));
el.classList.add('selected');
document.getElementById('fplt-icon').value = el.dataset.icon;
};
window.selPltColor = function(el) {
document.querySelectorAll('.plt-color-swatch').forEach(o => o.classList.remove('selected'));
el.classList.add('selected');
document.getElementById('fplt-color').value = el.dataset.color;
};
document.getElementById('fplt-img-file').addEventListener('change', function() {
const file = this.files[0];
if (!file) return;
if (file.size > 2.5 * 1024 * 1024) { showToast('La imagen no debe superar 2 MB', 'error'); return; }
const reader = new FileReader();
reader.onload = e => {
const b64 = e.target.result;
document.getElementById('fplt-img-b64').value = b64;
const prev = document.getElementById('fplt-img-preview');
prev.src = b64; prev.style.display = 'block';
};
reader.readAsDataURL(file);
});
document.getElementById('btn-plt-form-save').addEventListener('click', async () => {
const nombre = document.getElementById('fplt-nombre').value.trim();
const desc   = document.getElementById('fplt-desc').value.trim();
const texto  = document.getElementById('fplt-texto').value.trim();
if (!nombre || !desc || !texto) { showToast('Completa los campos obligatorios (*)', 'error'); return; }
const btn = document.getElementById('btn-plt-form-save');
btn.disabled = true;
const payload = {
nombre, desc, texto,
icon:   document.getElementById('fplt-icon').value,
color:  document.getElementById('fplt-color').value,
imgB64: document.getElementById('fplt-img-b64').value,
};
try {
if (_pltEditId) {
await updateDoc(doc(db, 'plantillas', _pltEditId), payload);
showToast('Plantilla actualizada');
} else {
const maxOrden = PLANTILLAS.length ? Math.max(...PLANTILLAS.map(p => p.orden || 0)) : 0;
await addDoc(collection(db, 'plantillas'), { ...payload, orden: maxOrden + 1, creadoEn: serverTimestamp() });
showToast('Plantilla añadida');
}
cerrarModalPlt();
} catch (e) {
console.error(e);
showToast('Error al guardar: ' + e.message, 'error');
} finally { btn.disabled = false; }
});
window.eliminarPlt = async function(id) {
const p = PLANTILLAS.find(x => x.id === id);
if (!p) return;
if (!confirmarAccion(`¿Eliminar la plantilla "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
try {
await deleteDoc(doc(db, 'plantillas', id));
showToast('Plantilla eliminada', 'error');
} catch (e) { showToast('Error al eliminar: ' + e.message, 'error'); }
};
function setupPltFormador() {
if (isFormador()) {
document.getElementById('plt-formador-bar').classList.add('visible');
renderPlantillas();
}
}
window.switchPltTab = function(tab) {
document.getElementById('tab-plantillas-btn').classList.toggle('active', tab === 'plantillas');
document.getElementById('tab-protocolo-btn').classList.toggle('active', tab === 'protocolo');
document.getElementById('plt-panel-plantillas').classList.toggle('active', tab === 'plantillas');
document.getElementById('plt-panel-protocolo').classList.toggle('active', tab === 'protocolo');
document.getElementById('search-plt-wrap').style.display   = tab === 'plantillas' ? '' : 'none';
document.getElementById('search-proto-wrap').style.display = tab === 'protocolo'  ? '' : 'none';
};
const PROTOCOLO_SEMILLA = [
{ paso: 1, proceso: 'Saludo (ASESOR)', nombre: 'Saludo inicial', color: '#F26522', glosas: [
'👋 Hola [NOMBRE_USUARIO], mi nombre es [NOMBRE_ASESOR] y estoy feliz de tenerte por aquí. ¿En qué puedo ayudarte? 😉',
'👋 Hola, gracias por escribirnos, mi nombre es [NOMBRE_ASESOR], espero te encuentres muy bien. ¿En qué puedo ayudarte? 😉',
'[NOMBRE_USUARIO], para poder ayudarte me confirmas tu código de estudiante o número de documento de identidad.'
]},
{ paso: 2, proceso: 'Estudiante molesto (ASESOR)', nombre: 'Empatía / disculpa', color: '#E03131', glosas: [
'Te entiendo y lamento las molestias generadas, pero no te preocupes, te ayudaré a resolverlo a la brevedad posible.'
]},
{ paso: 3, proceso: 'Tiempo de espera (ASESOR)', nombre: 'Solicitar tiempo para verificar', color: '#1D5FBD', glosas: [
'Por favor, permíteme unos minutos para validar la información brindada 🔍'
]},
{ paso: 4, proceso: 'Extender espera (ASESOR)', nombre: 'Ganar tiempo extra (máx. 5 min)', color: '#B87000', glosas: [
'Todavía estoy validando la información con el área correspondiente 🕵️‍♀️ Te pido un poco más de tiempo, por favor ⏳ Gracias por tu paciencia 🙏',
'Aún estoy revisando el detalle de tu consulta pero me tomará un poco más de tiempo. ⏱️'
]},
{ paso: 5, proceso: 'Retomar conversación (ASESOR)', nombre: 'Retomar y entregar información', color: '#1A7A45', glosas: [
'[NOMBRE_USUARIO], muchas gracias por la espera. ¿Ha quedado todo claro con la información brindada? 😊',
'¿Quedó todo claro o hay algo más en lo que pueda ayudarte? 🙌',
'¿Hay algo más en lo que te pueda ayudar? 😁',
'¿Tienes alguna duda adicional? Estoy aquí para ayudarte 📱'
]},
{ paso: 7, proceso: 'Sin solución en primer contacto (ASESOR)', nombre: 'Derivar caso sin solución', color: '#5B21B6', glosas: [
'Lamento no haber podido resolver tu consulta y/o inconveniente, pero te apoyaré en gestionarlo y priorizarlo cuanto antes. Tu caso ha sido derivado al área correspondiente y recibirás respuesta a tu correo institucional. Gracias por tu confianza.'
]},
{ paso: 8, proceso: 'Invitación a encuesta (ASESOR)', nombre: 'Invitar a calificar atención', color: '#F26522', glosas: [
'Antes de poder finalizar, te comento que te estaría llegando una pequeña encuesta para que puedas calificar mi atención 💓.'
]},
{ paso: 9, proceso: 'Despedida (ASESOR)', nombre: 'Despedida y ecosistema SISE', color: '#1A7A45', glosas:['Muchas gracias por escribirnos; ha sido un placer atenderte 😊 recuerda que estamos para ayudarte, que tengas un excelente día 💓. ¡Gracias! 🤝🤩\n\nTe invitamos a conocer el ecosistema digital SISE:\n✔ Conecta SISE Estudiantes 👉 conecta.sise.edu.pe\n✔ Conecta SISE Docentes 👉 conectadocentes.sise.edu.pe\n✔ Portal del estudiante 👉 miportal.sise.edu.pe\n✔ Portal de trámites 👉 tramites-estudiante.sise.edu.pe\n✔ Aula virtual 👉 aulavirtual.sise.edu.pe\n✔ Instagram oficial 👉 https://www.instagram.com/comunidadsise/'
]},
{ paso: 10, proceso: 'Falta de respeto (ASESOR)', nombre: 'Protocolo ante conducta inapropiada', color: '#E03131', glosas: [
'1️⃣ Comentario leve: redirigir hacia la consulta sin abordar el comportamiento.',
'2️⃣ Si persiste: "Para continuar con la atención, te agradecería que mantengamos una comunicación respetuosa."',
'3️⃣ Si continúa: aplicar speech de indisciplina y generar cierre de chat detallando lo sucedido.'
]},
{ paso: 11, proceso: 'Llamada posterior (ASESOR)', nombre: 'Comunicar llamada en 24 h', color: '#1D5FBD', glosas: [
'[NOMBRE_USUARIO], para mayor entendimiento y solución de tu caso un asesor se estará comunicando contigo en un plazo máximo de 24 horas. Para facilitar la llamada, ¿podrías proporcionarnos tu número de celular?'
]},
{ paso: 12, proceso: 'Derivación a área resolutora', nombre: 'Derivar a área especializada', color: '#5B21B6', glosas: [
'Hola 👋 Hemos recibido tu caso, es necesario derivarlo al área encargada para ser evaluado y brindarte alternativas de solución.\n\n❗ Tu caso es muy importante para nosotros, ten la seguridad que está siendo atendido y tendrás una respuesta en__días hábiles.\n\n¡Gracias por confiar en nosotros! 👉 https://conecta.sise.edu.pe/'
]},
];
let PROTOCOLO      = [];
let _protoEditId   = null;
async function iniciarListenersProtocolo() {
const snap0 = await getDocs(collection(db, 'protocolo_atencion'));
if (snap0.empty) {
await Promise.all(PROTOCOLO_SEMILLA.map(p =>
addDoc(collection(db, 'protocolo_atencion'), { ...p, creadoEn: serverTimestamp() })
));
}
onSnapshot(
query(collection(db, 'protocolo_atencion'), orderBy('paso', 'asc')),
snap => { try { PROTOCOLO = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderProtocolo(); } catch(e) { console.error('renderProtocolo:', e); } },
err => console.error('onSnapshot protocolo:', err)
);
}
iniciarListenersProtocolo();
window._GLOSA_MAP = {};
function renderProtocolo(q) {
const list = document.getElementById('proto-list');
if (!list) return;
const query2 = (q || document.getElementById('search-protocolo').value || '').trim();
const editor = tienePermiso();
let filtered = PROTOCOLO;
if (query2) {
filtered = PROTOCOLO.filter(p =>
_smartMatch([p.nombre||'', p.proceso||'', ...(p.glosas||[])], query2)
);
}
if (!filtered.length) {
list.innerHTML = `<div class="plt-empty"><i class="ti ti-file-off"></i><p>No se encontraron pasos${query2 ? ` para "<strong>${query2}</strong>"` : ''}.</p></div>`;
return;
}
window._GLOSA_MAP = {};
list.innerHTML = filtered.map(p => {
const color = p.color || '#F26522';
const glosaHtml = (p.glosas || []).map((g, gi) => {
const key = p.id + '_' + gi;
window._GLOSA_MAP[key] = g;
return `
<div class="proto-glosa-item">
${query2 ? _hlTokens(g, query2) : escH(g)}
<button class="proto-glosa-copy" title="Copiar glosa" onclick="event.stopPropagation();window._copiarGlosa('${key}')">
<i class="ti ti-copy"></i>
</button>
</div>`;
}).join('');
const actHtml = editor ? `
<button class="btn-proto-edit" title="Editar" onclick="event.stopPropagation();window.abrirModalProto('${p.id}')"><i class="ti ti-pencil"></i></button>
<button class="btn-proto-del"  title="Eliminar" onclick="event.stopPropagation();window.eliminarProto('${p.id}')"><i class="ti ti-trash"></i></button>` : '';
return `
<div class="proto-card${editor ? ' is-editor' : ''}" id="proto-card-${p.id}">
<div class="proto-card-header" onclick="toggleProtoCard('${p.id}')">
<span class="proto-step-badge" style="background:${color}">P-${String(p.paso).padStart(2,'0')}</span>
<div class="proto-card-info">
<div class="proto-card-title">${query2 ? _hlTokens(p.nombre, query2) : escH(p.nombre)}</div>
<div class="proto-card-subtitle">${query2 ? _hlTokens(p.proceso||'', query2) : escH(p.proceso || '')}</div>
</div>
<div class="proto-card-actions" onclick="event.stopPropagation()">${actHtml}</div>
<i class="ti ti-chevron-down proto-card-chevron"></i>
</div>
<div class="proto-card-body">
<div class="proto-glosas">${glosaHtml || '<span style="color:var(--muted);font-size:12px">Sin glosas registradas.</span>'}</div>
</div>
</div>`;
}).join('');
}
window.toggleProtoCard = function(id) {
const card = document.getElementById('proto-card-' + id);
if (card) card.classList.toggle('open');
};
window._copiarGlosa = function(key) {
const texto = window._GLOSA_MAP[key];
if (texto === undefined) return;
_copiarTexto(texto, 'Glosa copiada al portapapeles ✓');
};
document.getElementById('search-protocolo').addEventListener('input', function() { renderProtocolo(this.value); });
const protoOverlay = document.getElementById('modal-proto-overlay');
let _glosaEditors  = [];
function cerrarModalProto() {
protoOverlay.classList.remove('open');
_protoEditId = null;
_glosaEditors = [];
}
function addGlosaEditor(text) {
const idx = _glosaEditors.length;
const wrap = document.createElement('div');
wrap.className = 'glosa-editor-item';
wrap.dataset.idx = idx;
wrap.innerHTML = `
<textarea placeholder="Texto de la glosa…">${escH(text || '')}</textarea>
<button class="btn-rm-glosa" type="button" title="Eliminar glosa" onclick="this.closest('.glosa-editor-item').remove()"><i class="ti ti-trash"></i></button>`;
document.getElementById('glosa-list-editor').appendChild(wrap);
_glosaEditors.push(wrap);
}
window.abrirModalProto = function(id) {
if (!tienePermiso()) { showToast('Solo BO, Supervisor o Formador pueden editar el protocolo', 'error'); return; }
_protoEditId = id || null;
const p = id ? PROTOCOLO.find(x => x.id === id) : null;
document.getElementById('modal-proto-title').textContent = p ? 'Editar paso' : 'Nuevo paso';
document.getElementById('fproto-paso').value     = p ? (p.paso || '') : '';
document.getElementById('fproto-proceso').value  = p ? (p.proceso || '') : '';
document.getElementById('fproto-nombre').value   = p ? (p.nombre || '') : '';
const color = p ? (p.color || '#F26522') : '#F26522';
document.getElementById('fproto-color').value = color;
document.querySelectorAll('#fproto-color-picker .plt-color-swatch').forEach(sw => {
sw.classList.toggle('selected', sw.dataset.color === color);
});
document.getElementById('glosa-list-editor').innerHTML = '';
_glosaEditors = [];
(p ? (p.glosas || []) : ['']).forEach(g => addGlosaEditor(g));
protoOverlay.classList.add('open');
};
document.getElementById('btn-proto-nuevo').addEventListener('click', () => window.abrirModalProto(null));
document.getElementById('modal-proto-close').addEventListener('click', cerrarModalProto);
document.getElementById('modal-proto-cancel').addEventListener('click', cerrarModalProto);
protoOverlay.addEventListener('click', e => { if (e.target === protoOverlay) cerrarModalProto(); });
document.getElementById('btn-add-glosa').addEventListener('click', () => addGlosaEditor(''));
window.selProtoColor = function(el) {
document.querySelectorAll('#fproto-color-picker .plt-color-swatch').forEach(o => o.classList.remove('selected'));
el.classList.add('selected');
document.getElementById('fproto-color').value = el.dataset.color;
};
document.getElementById('modal-proto-save').addEventListener('click', async () => {
const paso    = parseInt(document.getElementById('fproto-paso').value);
const nombre  = document.getElementById('fproto-nombre').value.trim();
const proceso = document.getElementById('fproto-proceso').value.trim();
const color   = document.getElementById('fproto-color').value;
const glosas  = Array.from(document.querySelectorAll('#glosa-list-editor textarea'))
.map(t => t.value.trim()).filter(Boolean);
if (!paso || !nombre || !glosas.length) {
showToast('Completa Nº paso, nombre y al menos una glosa', 'error'); return;
}
const btn = document.getElementById('modal-proto-save');
btn.disabled = true;
const payload = { paso, nombre, proceso, color, glosas };
try {
if (_protoEditId) {
await updateDoc(doc(db, 'protocolo_atencion', _protoEditId), payload);
showToast('Paso actualizado ✓');
} else {
await addDoc(collection(db, 'protocolo_atencion'), { ...payload, creadoEn: serverTimestamp() });
showToast('Paso añadido ✓');
}
cerrarModalProto();
} catch(e) {
showToast('Error al guardar: ' + e.message, 'error');
} finally { btn.disabled = false; }
});
window.eliminarProto = async function(id) {
const p = PROTOCOLO.find(x => x.id === id);
if (!p) return;
if (!confirmarAccion(`¿Eliminar el paso "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
try {
await deleteDoc(doc(db, 'protocolo_atencion', id));
showToast('Paso eliminado', 'error');
} catch(e) { showToast('Error: ' + e.message, 'error'); }
};
function setupProtoEditor() {
if (tienePermiso()) {
document.getElementById('proto-editor-bar').classList.add('visible');
renderProtocolo();
}
}
const pendOverlay = document.getElementById('modal-pend-overlay');
let _pendTipoSelected = '';
window.selPendTipo = function(tipo) {
const supBtn = document.getElementById('fp-tipo-supervisor');
const boBtn  = document.getElementById('fp-tipo-bo');
_pendTipoSelected = tipo;
document.getElementById('fp-tipo').value = tipo;
supBtn.classList.toggle('supervisor-active', tipo === 'supervisor');
boBtn.classList.toggle('bo-active', tipo === 'backoffice');
};
function openPendModal(data) {
pendEditId = data ? data.id : null;
const isEdit = !!data;
_pendTipoSelected = data ? (data.tipoCaso || '') : '';
document.getElementById('modal-pend-title').textContent   = isEdit ? 'Editar caso pendiente' : 'Registrar caso pendiente';
document.getElementById('btn-pend-save-text').textContent = isEdit ? 'Guardar cambios' : 'Registrar caso pendiente';
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
document.getElementById('fp-numero').value      = data ? (data.numeroCaso  || '') : '';
document.getElementById('fp-fecha').value       = data ? (data.fechaCaso   || today) : '';
document.getElementById('fp-descripcion').value = data ? (data.descripcion || '') : '';
document.getElementById('fp-asesor').value      = data ? (data.asesor      || '') : '';
document.getElementById('fp-tipo').value        = _pendTipoSelected;
const supBtn = document.getElementById('fp-tipo-supervisor');
const boBtn  = document.getElementById('fp-tipo-bo');
supBtn.classList.toggle('supervisor-active', _pendTipoSelected === 'supervisor');
boBtn.classList.toggle('bo-active', _pendTipoSelected === 'backoffice');
const puedeModTipo = tienePermiso(); // BO, Supervisor, Formador
const yaSeleccionado = isEdit && !!data.tipoCaso;
if (yaSeleccionado && !puedeModTipo) {
supBtn.disabled = true; boBtn.disabled = true;
document.getElementById('fp-tipo-locked-msg').style.display = '';
} else {
supBtn.disabled = false; boBtn.disabled = false;
document.getElementById('fp-tipo-locked-msg').style.display = 'none';
}
pendOverlay.classList.add('open');
}
function closePendModal() { pendOverlay.classList.remove('open'); pendEditId = null; _pendTipoSelected = ''; }
document.getElementById('btn-nuevo-pendiente').addEventListener('click', () => openPendModal(null));
document.getElementById('modal-pend-close').addEventListener('click', closePendModal);
document.getElementById('btn-pend-cancel').addEventListener('click', closePendModal);
pendOverlay.addEventListener('click', e => { if (e.target === pendOverlay) closePendModal(); });
document.getElementById('btn-pend-save').addEventListener('click', async () => {
const numero = document.getElementById('fp-numero').value.trim();
const fecha  = document.getElementById('fp-fecha').value;
const desc   = document.getElementById('fp-descripcion').value.trim();
const asesor = document.getElementById('fp-asesor').value.trim();
const tipo   = document.getElementById('fp-tipo').value;
if (!numero || !fecha || !desc || !asesor) { showToast('Completa todos los campos obligatorios', 'error'); return; }
if (!tipo) { showToast('Selecciona el tipo de escalamiento (Supervisor o Back Office)', 'error'); return; }
const btn = document.getElementById('btn-pend-save');
const txt = document.getElementById('btn-pend-save-text');
btn.disabled = true; txt.textContent = 'Guardando...';
const payload = { numeroCaso: numero, fechaCaso: fecha, fechaRegistro: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }), descripcion: desc, asesor, tipoCaso: tipo };
try {
if (pendEditId) {
await updateDoc(doc(db, 'casos_pendientes', pendEditId), { ...payload, actualizadoPor: currentUser.email, actualizadoEn: serverTimestamp() });
showToast('Caso actualizado');
} else {
await addDoc(collection(db, 'casos_pendientes'), { ...payload, creadoPor: currentUser.email, creadoEn: serverTimestamp() });
showToast('Caso pendiente registrado');
}
closePendModal();
} catch (err) {
console.error('FIRESTORE ERROR CODE:', err.code);
console.error('FIRESTORE ERROR MSG:', err.message);
showToast('Error: ' + (err.code || err.message), 'error');
} finally {
btn.disabled = false;
txt.textContent = pendEditId ? 'Guardar cambios' : 'Registrar caso pendiente';
}
});
async function eliminarPendiente(id) {
if (!tienePermiso()) {
showToast('Solo BO, Supervisor o Formador pueden eliminar casos', 'error'); return;
}
if (!confirmarAccion('¿Eliminar este caso pendiente?')) return;
try { await deleteDoc(doc(db, 'casos_pendientes', id)); showToast('Caso eliminado'); }
catch (err) { showToast('Error al eliminar', 'error'); }
}
window._pendEdit = (id) => { const r = allPendientes.find(x=>x.id===id); if (r) openPendModal(r); };
window._pendDel  = (id) => eliminarPendiente(id);
function loadPendientes() {
const q = query(collection(db, 'casos_pendientes'));
onSnapshot(q, snap => {
try {
allPendientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
allPendientes.sort((a,b) => (b.fechaRegistro||b.fecha||'') > (a.fechaRegistro||a.fecha||'') ? 1 : -1);
updatePendBadge();
renderPendientes();
} catch(e) { console.error('renderPendientes:', e); }
}, err => { console.error('pendientes error:', err); });
}
function updatePendBadge() {
const sinCheck = allPendientes.filter(r => !r.alertado).length;
const badge = document.getElementById('badge-pendientes');
badge.textContent = sinCheck;
badge.style.display = sinCheck > 0 ? '' : 'none';
}
function updateBoBadge() {
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const pendientesHoy = allCasos.filter(r =>
(r.fechaRegistro || '') === today &&
(r.estadoLlamada || 'pendiente') === 'pendiente'
).length;
const badge = document.getElementById('badge-bo-llamadas');
badge.textContent = pendientesHoy;
badge.style.display = pendientesHoy > 0 ? '' : 'none';
}
document.getElementById('pend-prev').addEventListener('click', () => { const d = new Date(pendViewDay); d.setDate(d.getDate()-1); pendViewDay = d; renderPendientes(); });
document.getElementById('pend-next').addEventListener('click', () => { const d = new Date(pendViewDay); d.setDate(d.getDate()+1); pendViewDay = d; renderPendientes(); });
document.getElementById('pend-today').addEventListener('click', () => { pendViewDay = new Date(); renderPendientes(); });
document.getElementById('search-pend').addEventListener('input', renderPendientes);
document.getElementById('pend-filter-todos').addEventListener('click', () => {
pendFilterMode = 'todos';
showMisAlertados = false;
document.getElementById('pend-filter-todos').classList.add('active');
document.getElementById('pend-filter-mios').classList.remove('active');
document.getElementById('btn-mis-alertados').classList.remove('active');
renderPendientes();
});
document.getElementById('pend-filter-mios').addEventListener('click', () => {
pendFilterMode = 'mios';
showMisAlertados = false;
document.getElementById('pend-filter-mios').classList.add('active');
document.getElementById('pend-filter-todos').classList.remove('active');
document.getElementById('btn-mis-alertados').classList.remove('active');
renderPendientes();
});
document.getElementById('btn-mis-alertados').addEventListener('click', () => {
showMisAlertados = !showMisAlertados;
document.getElementById('btn-mis-alertados').classList.toggle('active', showMisAlertados);
if (showMisAlertados) {
document.getElementById('pend-filter-todos').classList.remove('active');
document.getElementById('pend-filter-mios').classList.remove('active');
pendFilterMode = 'todos';
}
renderPendientes();
});
function fmtDate(f) { if (!f) return '—'; const [y,m,d] = f.split('-'); return d+'/'+m+'/'+y; }
function renderPendientes() {
const container = document.getElementById('pend-calendar-container');
const viewDateStr = pendViewDay.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const today       = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const isToday     = viewDateStr === today;
const dias   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MESES_C= ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const d = pendViewDay;
const dayLabel = (isToday ? 'Hoy · ' : '') + dias[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
document.getElementById('pend-month-label').textContent = dayLabel;
const q = document.getElementById('search-pend').value.trim();

// ── MODO BÚSQUEDA GLOBAL (hay texto) ──────────────────────────────────────
if (q) {
  let matches = allPendientes.filter(r =>
    _smartMatch([r.numeroCaso||'', r.descripcion||'', r.asesor||'', r.creadoPor||''], q)
  );
  if (pendFilterMode === 'mios') {
    matches = matches.filter(r => r.creadoPor === currentUser?.email);
  }
  renderPendSearchResults(matches, q);
  return;
}

// ── MODO NORMAL (sin búsqueda, filtra por día) ────────────────────────────
renderPendSearchResults(null, '');
let data = allPendientes.filter(r => (r.fechaRegistro || r.fecha || '') === viewDateStr && !r.resuelto);
let resueltos = allPendientes.filter(r => (r.fechaRegistro || r.fecha || '') === viewDateStr && r.resuelto);
if (showMisAlertados) {
data = allPendientes.filter(r => r.alertado && r.alertadoPor === currentUser?.email);
resueltos = [];
} else if (pendFilterMode === 'mios') {
data = data.filter(r => r.creadoPor === currentUser?.email);
resueltos = resueltos.filter(r => r.creadoPor === currentUser?.email);
}
const isSupervisor = tienePermiso();
const delBtn = (id) => isSupervisor
? '<button class="btn-row del" onclick="window._pendDel(\'' + id + '\')"><i class="ti ti-trash"></i></button>'
: '<button class="btn-row del" disabled style="opacity:0.3;cursor:not-allowed" title="Solo BO, Supervisor o Formador pueden eliminar"><i class="ti ti-trash"></i></button>';
const alertadoBtn = (r) => {
const active = !!r.alertado;
if (isSupervisor) {
return '<button class="btn-alertado' + (active?' alertado-active':'') + '" onclick="window._pendAlertado(\'' + r.id + '\',' + (!active) + ')" title="' + (active?'Marcar como no alertado':'Marcar como alertado') + '">' +
'<i class="ti ' + (active?'ti-check':'ti-bell') + '"></i>' +
(active ? 'Alertado' : 'Alertar') +
'</button>';
} else {
return active
? '<span class="btn-alertado alertado-active" style="cursor:default" title="Caso alertado por supervisor"><i class="ti ti-check"></i>Alertado</span>'
: '<span class="btn-alertado" style="cursor:default;opacity:0.4" title="Pendiente de alerta"><i class="ti ti-bell"></i>Sin alertar</span>';
}
};
const resueltoBtn = (r) => {
if (!isSupervisor) return '';
return r.resuelto
? '<button class="btn-alertado" style="border-color:var(--success);color:var(--success);background:var(--success-bg)" onclick="window._pendResuelto(\'' + r.id + '\',false)"><i class="ti ti-rotate-clockwise"></i>Reabrir</button>'
: '<button class="btn-alertado" style="border-color:var(--success);color:var(--success)" onclick="window._pendResuelto(\'' + r.id + '\',true)"><i class="ti ti-check-circle"></i>Resolver</button>';
};
const tipoBadge = (r) => {
if (!r.tipoCaso) return '';
if (r.tipoCaso === 'supervisor') return '<span class="pend-tipo-badge supervisor"><i class="ti ti-shield-check" style="font-size:10px"></i>Supervisor</span>';
return '<span class="pend-tipo-badge backoffice"><i class="ti ti-headset" style="font-size:10px"></i>Back Office</span>';
};
const tipoClass = (r) => {
if (r.tipoCaso === 'supervisor') return ' tipo-supervisor';
if (r.tipoCaso === 'backoffice') return ' tipo-backoffice';
return '';
};
const renderCard = (r, isResolved = false) => {
const comments = (r.comentarios || []);
const commentsHtml = comments.map(c => {
const rolClass = (c.rol||'').toLowerCase() === 'supervisor' ? 'supervisor' : (c.rol||'').toLowerCase() === 'bo' ? 'bo' : (c.rol||'').toLowerCase() === 'formador' ? 'formador' : '';
const initials = (c.autor || '??').substring(0,2).toUpperCase();
return '<div class="pend-comment-item">' +
'<div class="pend-comment-av ' + rolClass + '">' + initials + '</div>' +
'<div class="pend-comment-bubble">' +
'<div class="pend-comment-meta"><strong>' + escH(c.autor||'?') + '</strong><span>' + escH(c.rol||'Asesor') + '</span><span>' + escH(c.hora||'') + '</span></div>' +
'<div class="pend-comment-text">' + escH(c.texto||'') + '</div>' +
'</div>' +
'</div>';
}).join('');
const canComment = !!currentUser;
const addCommentHtml = canComment && !isResolved ? (
'<div class="pend-add-comment">' +
'<textarea id="comment-ta-' + r.id + '" placeholder="Escribe un comentario o respuesta…" rows="1" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\'"></textarea>' +
'<button class="btn-send-comment" onclick="window._pendAddComment(\'' + r.id + '\')"><i class="ti ti-send"></i>Enviar</button>' +
'</div>'
) : '';
return '<div class="pend-case-wrapper">' +
'<div class="pend-case-card' + (r.alertado?' alertado':'') + tipoClass(r) + '">' +
'<div class="pend-num-badge"><i class="ti ti-alert-triangle" style="font-size:11px;margin-right:3px"></i>Caso ' + escH(r.numeroCaso||'—') + '</div>' +
'<div class="pend-case-body">' +
'<div class="pend-case-desc">' + escH(r.descripcion||'—') + '</div>' +
'<div class="pend-case-meta">' +
'<span class="pend-case-meta-item"><i class="ti ti-user"></i>' + escH(r.asesor||'—') + '</span>' +
(r.fechaCaso ? '<span class="pend-case-meta-item"><i class="ti ti-calendar-x"></i>Caso desde: ' + fmtDate(r.fechaCaso) + '</span>' : '') +
(r.creadoPor ? '<span class="pend-case-meta-item"><i class="ti ti-mail"></i>' + escH(r.creadoPor.split('@')[0]) + '</span>' : '') +
tipoBadge(r) +
(r.alertado && r.alertadoPor ? '<span class="pend-case-meta-item" style="color:var(--success);font-weight:600"><i class="ti ti-check-circle"></i>Alertado por ' + escH(r.alertadoPor.split('@')[0]) + (r.alertadoEn ? ' · ' + r.alertadoEn : '') + '</span>' : '') +
(comments.length ? '<span class="pend-case-meta-item" style="color:var(--info)"><i class="ti ti-message-circle"></i>' + comments.length + ' comentario' + (comments.length!==1?'s':'') + '</span>' : '') +
'</div>' +
'</div>' +
'<div class="pend-case-actions" style="align-items:center">' +
alertadoBtn(r) +
resueltoBtn(r) +
'<button class="btn-row edit" onclick="window._pendEdit(\'' + r.id + '\')"><i class="ti ti-pencil"></i></button>' +
delBtn(r.id) +
'</div>' +
'</div>' +
'<div class="pend-comments-area">' +
'<div class="pend-comments-title"><i class="ti ti-message-circle" style="font-size:12px"></i>Comentarios' + (comments.length ? ' (' + comments.length + ')' : '') + '</div>' +
(commentsHtml || '<div style="font-size:11px;color:var(--muted);font-style:italic;padding-bottom:4px">Sin comentarios aún.</div>') +
addCommentHtml +
'</div>' +
'</div>';
};
if (!data.length && !showMisAlertados) {
container.innerHTML = '<div class="empty-state"><i class="ti ti-calendar-off"></i><p>No hay casos el ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' ' + d.getFullYear() + '.</p><p class="empty-hint">Usa &quot;Nuevo caso&quot; para registrar uno.</p></div>';
} else if (!data.length && showMisAlertados) {
container.innerHTML = '<div class="empty-state"><i class="ti ti-bell-off"></i><p>No tienes casos alertados por ti.</p></div>';
} else {
container.innerHTML =
'<div class="pend-day-block">' +
'<div class="pend-day-header">' +
'<div class="pend-day-pill' + (isToday?' today':'') + '">' +
'<i class="ti ti-calendar-event" style="font-size:13px"></i>' +
(showMisAlertados ? 'Mis alertados' : (isToday ? 'Hoy — ' : '') + dias[d.getDay()] + ' ' + d.getDate() + ' ' + MESES_C[d.getMonth()]) +
'</div>' +
'<div class="pend-day-line"></div>' +
'<span class="pend-day-count">' + data.length + ' caso' + (data.length!==1?'s':'') + '</span>' +
'</div>' +
data.map(r => renderCard(r)).join('') +
'</div>';
}
const secResueltos = document.getElementById('pend-atendidos-section');
const contResueltos = document.getElementById('pend-atendidos-container');
if (resueltos.length && !showMisAlertados) {
secResueltos.style.display = '';
document.getElementById('pend-atendidos-count').textContent = resueltos.length + ' caso' + (resueltos.length!==1?'s':'');
contResueltos.innerHTML = resueltos.map(r => renderCard(r, true)).join('');
} else {
secResueltos.style.display = 'none';
}
}
// Renderiza resultados de búsqueda global en pendientes (igual a renderSearchResults de BO)
function renderPendSearchResults(matches, q) {
const container    = document.getElementById('pend-calendar-container');
const secResueltos = document.getElementById('pend-atendidos-section');

if (!matches) {
  const srPanel = document.getElementById('pend-sr-panel');
  if (srPanel) srPanel.remove();
  container.style.display = '';
  return;
}

// Ocultar sección resueltos y el contenedor normal
if (secResueltos) secResueltos.style.display = 'none';

let srPanel = document.getElementById('pend-sr-panel');
if (!srPanel) {
  srPanel = document.createElement('div');
  srPanel.id = 'pend-sr-panel';
  container.parentElement.insertBefore(srPanel, container);
}
container.style.display = 'none';

if (!matches.length) {
  srPanel.innerHTML = '<div class="empty-state"><i class="ti ti-search-off"></i><p>Sin resultados para <strong>"' + q + '"</strong></p><p class="empty-hint">Prueba con otro número de caso, descripción o asesor.</p></div>';
  return;
}

// Agrupar por fecha, más reciente primero
const byDate = {};
matches.forEach(r => {
  const f = r.fechaRegistro || r.fecha || '—';
  if (!byDate[f]) byDate[f] = [];
  byDate[f].push(r);
});
const fechas = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
const diasS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES_S = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function fmtFechaPend(str) {
  if (!str || str === '—') return str;
  const [y,m,d] = str.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const hoy  = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const ayerD = new Date(); ayerD.setDate(ayerD.getDate()-1);
  const ayer = ayerD.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  if (str === hoy)  return 'Hoy · ' + diasS[dt.getDay()] + ' ' + d + ' ' + MESES_S[m-1] + ' ' + y;
  if (str === ayer) return 'Ayer · ' + diasS[dt.getDay()] + ' ' + d + ' ' + MESES_S[m-1] + ' ' + y;
  return diasS[dt.getDay()] + ' ' + d + ' ' + MESES_S[m-1] + ' ' + y;
}

// Reutilizar renderCard definida en renderPendientes (no disponible aquí), así que reconstruimos inline
const isSupervisor = tienePermiso();
const delBtnSr = (id) => isSupervisor
  ? '<button class="btn-row del" onclick="window._pendDel(\'' + id + '\')"><i class="ti ti-trash"></i></button>'
  : '<button class="btn-row del" disabled style="opacity:0.3;cursor:not-allowed"><i class="ti ti-trash"></i></button>';
const alertadoBtnSr = (r) => {
  const active = !!r.alertado;
  if (isSupervisor) {
    return '<button class="btn-alertado' + (active?' alertado-active':'') + '" onclick="window._pendAlertado(\'' + r.id + '\',' + (!active) + ')">' +
      '<i class="ti ' + (active?'ti-check':'ti-bell') + '"></i>' + (active?'Alertado':'Alertar') + '</button>';
  }
  return active
    ? '<span class="btn-alertado alertado-active" style="cursor:default"><i class="ti ti-check"></i>Alertado</span>'
    : '<span class="btn-alertado" style="cursor:default;opacity:0.4"><i class="ti ti-bell"></i>Sin alertar</span>';
};
const resueltoBtnSr = (r) => {
  if (!isSupervisor) return '';
  return r.resuelto
    ? '<button class="btn-alertado" style="border-color:var(--success);color:var(--success);background:var(--success-bg)" onclick="window._pendResuelto(\'' + r.id + '\',false)"><i class="ti ti-rotate-clockwise"></i>Reabrir</button>'
    : '<button class="btn-alertado" style="border-color:var(--success);color:var(--success)" onclick="window._pendResuelto(\'' + r.id + '\',true)"><i class="ti ti-check-circle"></i>Resolver</button>';
};
const tipoBadgeSr = (r) => {
  if (!r.tipoCaso) return '';
  if (r.tipoCaso === 'supervisor') return '<span class="pend-tipo-badge supervisor"><i class="ti ti-shield-check" style="font-size:10px"></i>Supervisor</span>';
  return '<span class="pend-tipo-badge backoffice"><i class="ti ti-headset" style="font-size:10px"></i>Back Office</span>';
};
const tipoClassSr = (r) => {
  if (r.tipoCaso === 'supervisor') return ' tipo-supervisor';
  if (r.tipoCaso === 'backoffice') return ' tipo-backoffice';
  return '';
};
const renderCardSr = (r) => {
  const comments = (r.comentarios || []);
  const commentsHtml = comments.map(c => {
    const rolClass = (c.rol||'').toLowerCase() === 'supervisor' ? 'supervisor' : (c.rol||'').toLowerCase() === 'bo' ? 'bo' : (c.rol||'').toLowerCase() === 'formador' ? 'formador' : '';
    const initials = (c.autor||'??').substring(0,2).toUpperCase();
    return '<div class="pend-comment-item"><div class="pend-comment-av ' + rolClass + '">' + initials + '</div>' +
      '<div class="pend-comment-bubble"><div class="pend-comment-meta"><strong>' + escH(c.autor||'?') + '</strong><span>' + escH(c.rol||'Asesor') + '</span><span>' + escH(c.hora||'') + '</span></div>' +
      '<div class="pend-comment-text">' + escH(c.texto||'') + '</div></div></div>';
  }).join('');
  const canComment = !!currentUser;
  const addCommentHtml = canComment && !r.resuelto
    ? '<div class="pend-add-comment"><textarea id="comment-ta-' + r.id + '" placeholder="Escribe un comentario…" rows="1" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\'"></textarea><button class="btn-send-comment" onclick="window._pendAddComment(\'' + r.id + '\')"><i class="ti ti-send"></i>Enviar</button></div>'
    : '';
  return '<div class="pend-case-wrapper">' +
    '<div class="pend-case-card' + (r.alertado?' alertado':'') + tipoClassSr(r) + '">' +
    '<div class="pend-num-badge"><i class="ti ti-alert-triangle" style="font-size:11px;margin-right:3px"></i>Caso ' + _hlTokens(r.numeroCaso||'—', q) + '</div>' +
    '<div class="pend-case-body">' +
    '<div class="pend-case-desc">' + _hlTokens(r.descripcion||'—', q) + '</div>' +
    '<div class="pend-case-meta">' +
    '<span class="pend-case-meta-item"><i class="ti ti-user"></i>' + _hlTokens(r.asesor||'—', q) + '</span>' +
    (r.fechaCaso ? '<span class="pend-case-meta-item"><i class="ti ti-calendar-x"></i>Caso desde: ' + fmtDate(r.fechaCaso) + '</span>' : '') +
    (r.creadoPor ? '<span class="pend-case-meta-item"><i class="ti ti-mail"></i>' + escH(r.creadoPor.split('@')[0]) + '</span>' : '') +
    (r.resuelto ? '<span class="pend-case-meta-item" style="color:var(--success);font-weight:600"><i class="ti ti-check-circle"></i>Resuelto</span>' : '') +
    tipoBadgeSr(r) +
    (r.alertado && r.alertadoPor ? '<span class="pend-case-meta-item" style="color:var(--success);font-weight:600"><i class="ti ti-check-circle"></i>Alertado por ' + escH(r.alertadoPor.split('@')[0]) + (r.alertadoEn?' · '+r.alertadoEn:'') + '</span>' : '') +
    (comments.length ? '<span class="pend-case-meta-item" style="color:var(--info)"><i class="ti ti-message-circle"></i>' + comments.length + ' comentario' + (comments.length!==1?'s':'') + '</span>' : '') +
    '</div></div>' +
    '<div class="pend-case-actions" style="align-items:center">' + alertadoBtnSr(r) + resueltoBtnSr(r) +
    '<button class="btn-row edit" onclick="window._pendEdit(\'' + r.id + '\')"><i class="ti ti-pencil"></i></button>' +
    delBtnSr(r.id) + '</div></div>' +
    '<div class="pend-comments-area">' +
    '<div class="pend-comments-title"><i class="ti ti-message-circle" style="font-size:12px"></i>Comentarios' + (comments.length?' ('+comments.length+')':'') + '</div>' +
    (commentsHtml || '<div style="font-size:12px;color:#bbb;padding:4px 0">Sin comentarios aún.</div>') +
    addCommentHtml + '</div></div>';
};

let html = '<div style="margin-bottom:10px;padding:10px 14px;background:var(--surface-2,#f5f5f5);border-radius:10px;font-size:12px;color:var(--text-2,#888);display:flex;align-items:center;gap:8px"><i class="ti ti-search" style="color:var(--orange)"></i><span><strong>' + matches.length + ' resultado' + (matches.length!==1?'s':'') + '</strong> para "<strong>' + escH(q) + '</strong>" en todos los días</span></div>';

fechas.forEach(fecha => {
  const casos = byDate[fecha];
  html += '<div style="margin-bottom:28px">' +
    '<div class="pend-day-header" style="margin-bottom:14px">' +
    '<div class="pend-day-pill today" style="background:var(--surface-2,#f0f0f0);color:var(--text-1,#333)"><i class="ti ti-calendar" style="font-size:12px"></i>' + fmtFechaPend(fecha) + '</div>' +
    '<div class="pend-day-line"></div>' +
    '<span class="pend-day-count">' + casos.length + ' caso' + (casos.length!==1?'s':'') + '</span>' +
    '</div>' +
    casos.map(r => renderCardSr(r)).join('') +
    '</div>';
});

srPanel.innerHTML = html;
}

window._pendAlertado = async (id, valor) => {
if (!tienePermiso()) { showToast('Solo BO, Supervisor o Formador pueden marcar alertas', 'error'); return; }
try {
const ahora = new Date();
const hora  = ahora.toTimeString().slice(0,5);
if (valor) {
await updateDoc(doc(db, 'casos_pendientes', id), {
alertado: true,
alertadoPor: currentUser.email,
alertadoEn: hora
});
showToast('Caso marcado como alertado ✓');
} else {
await updateDoc(doc(db, 'casos_pendientes', id), {
alertado: false,
alertadoPor: '',
alertadoEn: ''
});
showToast('Alerta removida');
}
} catch(e) { showToast('Error al actualizar', 'error'); }
};
window._pendResuelto = async (id, valor) => {
if (!tienePermiso()) { showToast('Solo BO, Supervisor o Formador pueden resolver casos', 'error'); return; }
try {
await updateDoc(doc(db, 'casos_pendientes', id), {
resuelto: valor,
resueltoPor: valor ? currentUser.email : '',
resueltoEn: valor ? new Date().toTimeString().slice(0,5) : ''
});
showToast(valor ? 'Caso marcado como resuelto ✓' : 'Caso reabierto');
} catch(e) { showToast('Error al actualizar', 'error'); }
};
window._pendAddComment = async (id) => {
const ta = document.getElementById('comment-ta-' + id);
if (!ta) return;
const texto = ta.value.trim();
if (!texto) { showToast('Escribe un comentario antes de enviar', 'error'); return; }
const ahora = new Date();
const hora  = ahora.toTimeString().slice(0,5);
const r = allPendientes.find(x => x.id === id);
const comentarios = [...(r?.comentarios || []), {
texto,
autor: currentUser?.email?.split('@')[0] || '?',
rol: currentUserRol || 'Asesor',
hora,
fecha: ahora.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}];
try {
await updateDoc(doc(db, 'casos_pendientes', id), { comentarios });
ta.value = '';
ta.style.height = 'auto';
showToast('Comentario enviado ✓');
} catch(e) { showToast('Error al guardar comentario', 'error'); }
};
document.getElementById('btn-export-excel').addEventListener('click', () => {
const viewDateStr = pendViewDay.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const d = pendViewDay;
const q = document.getElementById('search-pend').value.trim();
let data = allPendientes.filter(r => (r.fechaRegistro||r.fecha||'') === viewDateStr);
if (q) data = data.filter(r => _smartMatch([r.numeroCaso||'', r.descripcion||'', r.asesor||''], q));
if (!data.length) { showToast('No hay casos para exportar', 'error'); return; }

const MES_P = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fechaStr = d.getDate() + ' de ' + MES_P[d.getMonth()] + ' de ' + d.getFullYear();
const generado = new Date().toLocaleDateString('es-PE');

data = data.sort((a,b)=>(a.fechaRegistro||a.fecha)<(b.fechaRegistro||b.fecha)?-1:1);

const total    = data.length;
const resueltos  = data.filter(r=>r.resuelto).length;
const pendientes = data.filter(r=>!r.resuelto).length;
const alertados  = data.filter(r=>r.alertado).length;

const wsRows = [
  // Fila 1: Titulo
  ['REPORTE DE CASOS PENDIENTES', '', '', '', '', '', '', ''],
  // Fila 2: Info
  ['Fecha de gestion: ' + fechaStr, '', '', 'Generado: ' + generado, '', '', 'Total casos: ' + total, ''],
  // Fila 3: Vacia
  ['', '', '', '', '', '', '', ''],
  // Fila 4: Headers
  ['#', 'Fecha Registro', 'Caso desde', 'N° Caso', 'Descripcion del caso', 'Asesor', 'Estado', 'Alertado'],
];

data.forEach((r, i) => {
  wsRows.push([
    i + 1,
    fmtDate(r.fechaRegistro || r.fecha || ''),
    fmtDate(r.fechaCaso || ''),
    r.numeroCaso || '',
    r.descripcion || '',
    r.asesor || '',
    r.resuelto ? 'Resuelto' : 'Pendiente',
    r.alertado ? 'Si' : 'No',
  ]);
});

// Fila vacia + resumen
wsRows.push([]);
wsRows.push(['RESUMEN', '', '', '', '', '', '', '']);
wsRows.push(['Total casos', total, '', 'Resueltos', resueltos, '', 'Pendientes', pendientes]);
wsRows.push(['Alertados', alertados, '', '', '', '', '', '']);

const ws = XLSX.utils.aoa_to_sheet(wsRows);

ws['!cols'] = [
  {wch: 5},   // #
  {wch: 16},  // Fecha Registro
  {wch: 16},  // Caso desde
  {wch: 14},  // N Caso
  {wch: 60},  // Descripcion
  {wch: 22},  // Asesor
  {wch: 12},  // Estado
  {wch: 10},  // Alertado
];

ws['!rows'] = [
  {hpt: 22},  // Titulo
  {hpt: 16},  // Info
  {hpt: 6},   // Vacia
  {hpt: 20},  // Headers
];
data.forEach(() => ws['!rows'].push({hpt: 18}));

ws['!merges'] = [
  {s:{r:0,c:0}, e:{r:0,c:7}},  // Titulo
  {s:{r:1,c:0}, e:{r:1,c:2}},  // Fecha gestion
  {s:{r:1,c:3}, e:{r:1,c:5}},  // Generado
  {s:{r:1,c:6}, e:{r:1,c:7}},  // Total casos
  {s:{r:2,c:0}, e:{r:2,c:7}},  // Vacia
];

const resRow = 4 + data.length + 1;
ws['!merges'].push({s:{r:resRow,c:0}, e:{r:resRow,c:7}});

ws['!autofilter'] = { ref: 'A4:H4' };
ws['!ref'] = 'A1:H' + (resRow + 3);

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Casos Pendientes');
XLSX.writeFile(wb, 'CasosPendientes_' + d.getDate() + '_' + MESES[d.getMonth()] + '_' + d.getFullYear() + '.xlsx');
showToast('Excel descargado ✓');
});
document.getElementById('btn-export-pdf').addEventListener('click', () => {
const { jsPDF } = window.jspdf;
const viewDateStr = pendViewDay.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const d = pendViewDay;
const q = document.getElementById('search-pend').value.trim();
let data = allPendientes.filter(r => (r.fechaRegistro||r.fecha||'') === viewDateStr);
if (q) data = data.filter(r => _smartMatch([r.numeroCaso||'', r.descripcion||'', r.asesor||''], q));
if (!data.length) { showToast('No hay casos para exportar', 'error'); return; }

data = data.sort((a,b)=>(a.fechaRegistro||a.fecha)<(b.fechaRegistro||b.fecha)?-1:1);

const MES_P = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fechaStr = d.getDate() + ' de ' + MES_P[d.getMonth()] + ' de ' + d.getFullYear();
const generado = new Date().toLocaleDateString('es-PE');

const total     = data.length;
const resueltos  = data.filter(r=>r.resuelto).length;
const pendientes = data.filter(r=>!r.resuelto).length;
const alertados  = data.filter(r=>r.alertado).length;

// Colores
const NEGRO  = [13, 13, 13];
const ROJO   = [196, 30, 58];
const BLANCO = [255, 255, 255];
const GRIS1  = [245, 245, 245];
const GRIS2  = [220, 220, 220];
const GRIS3  = [140, 140, 140];
const GRIS4  = [60, 60, 60];
const VERDE  = [26, 122, 69];
const VERDECL= [232, 250, 240];
const ROJOCL = [255, 235, 238];
const PURCL  = [245, 240, 255];
const PURPURA= [91, 33, 182];

const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
const pw = pdf.internal.pageSize.width;
const ph = pdf.internal.pageSize.height;

function lineaRoja(x, y, w) {
  pdf.setFillColor(...ROJO); pdf.rect(x, y, w, 0.7, 'F');
}
function tituloSeccion(texto, y) {
  pdf.setFillColor(...NEGRO); pdf.roundedRect(10, y, 3.5, 8, 0.8, 0.8, 'F');
  pdf.setTextColor(...NEGRO); pdf.setFont('helvetica','bold'); pdf.setFontSize(10);
  pdf.text(texto, 16.5, y + 5.8);
  lineaRoja(10, y + 10, pw - 20);
  return y + 15;
}

// ── CABECERA ──────────────────────────────────────────────────
pdf.setFillColor(...NEGRO); pdf.rect(0, 0, pw, 30, 'F');
pdf.setFillColor(...ROJO);  pdf.rect(0, 30, pw, 2.5, 'F');

pdf.setFillColor(40,40,40); pdf.roundedRect(10, 5, 22, 12, 1.5, 1.5, 'F');
pdf.setDrawColor(...BLANCO); pdf.setLineWidth(0.4);
pdf.roundedRect(10, 5, 22, 12, 1.5, 1.5, 'S');
pdf.setTextColor(...BLANCO); pdf.setFont('helvetica','bold'); pdf.setFontSize(9);
pdf.text('SISE', 21, 12.5, {align:'center'});
pdf.setTextColor(...ROJO); pdf.setFont('helvetica','bold'); pdf.setFontSize(5);
pdf.text('PORTAL SAES', 21, 21, {align:'center'});

pdf.setTextColor(...BLANCO); pdf.setFont('helvetica','bold'); pdf.setFontSize(13);
pdf.text('REPORTE DE CASOS PENDIENTES', 38, 12);
pdf.setFont('helvetica','normal'); pdf.setFontSize(7);
pdf.setTextColor(180,180,180);
pdf.text('Control de casos fuera de plazo - Seguimiento y Calidad', 38, 19);

pdf.setTextColor(...ROJO); pdf.setFont('helvetica','bold'); pdf.setFontSize(8.5);
pdf.text(fechaStr, pw - 12, 12, {align:'right'});
pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(180,180,180);
pdf.text('Generado: ' + generado, pw - 12, 18.5, {align:'right'});

// ── META INFO ─────────────────────────────────────────────────
const metaY = 35;
pdf.setFillColor(...GRIS1); pdf.rect(0, metaY, pw, 18, 'F');
pdf.setFillColor(...GRIS2); pdf.rect(0, metaY+18, pw, 0.4, 'F');

const metaCols = [
  {label:'Fecha de gestion', val: fechaStr},
  {label:'Generado el',      val: generado},
  {label:'Area',             val: 'Seguimiento y Calidad - BO'},
  {label:'Total casos',      val: String(total)},
];
const mcW = pw / 4;
metaCols.forEach((m, i) => {
  const mx = i * mcW + 6;
  if (i>0) { pdf.setDrawColor(...GRIS2); pdf.setLineWidth(0.3); pdf.line(i*mcW, metaY+3, i*mcW, metaY+15); }
  pdf.setTextColor(...ROJO); pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5);
  pdf.text(m.label, mx, metaY+8.5);
  pdf.setTextColor(...GRIS4); pdf.setFont('helvetica','normal'); pdf.setFontSize(7);
  pdf.text(m.val, mx, metaY+14);
});

// ── RESUMEN KPIs ──────────────────────────────────────────────
let curY = metaY + 22;
curY = tituloSeccion('RESUMEN EJECUTIVO', curY);

const kpis = [
  {label:'Total Casos',   val:String(total),     bg:NEGRO,   text:BLANCO,  bdr:NEGRO},
  {label:'Pendientes',    val:String(pendientes), bg:ROJOCL,  text:ROJO,    bdr:ROJO},
  {label:'Resueltos',     val:String(resueltos),  bg:VERDECL, text:VERDE,   bdr:VERDE},
  {label:'Alertados',     val:String(alertados),  bg:PURCL,   text:PURPURA, bdr:PURPURA},
];
const kpiGap = 4;
const kpiW   = (pw - 20 - kpiGap*(kpis.length-1)) / kpis.length;
const kpiH   = 20;

kpis.forEach((k, i) => {
  const kx = 10 + i*(kpiW+kpiGap);
  pdf.setFillColor(...k.bg); pdf.roundedRect(kx, curY, kpiW, kpiH, 2, 2, 'F');
  pdf.setDrawColor(...k.bdr); pdf.setLineWidth(0.4);
  pdf.roundedRect(kx, curY, kpiW, kpiH, 2, 2, 'S');
  pdf.setTextColor(...k.text); pdf.setFont('helvetica','bold'); pdf.setFontSize(15);
  pdf.text(k.val, kx+kpiW/2, curY+13.5, {align:'center'});
  pdf.setFont('helvetica','normal'); pdf.setFontSize(6);
  pdf.text(k.label, kx+kpiW/2, curY+18.5, {align:'center'});
});
curY += kpiH + 8;

// ── TABLA DETALLE ─────────────────────────────────────────────
curY = tituloSeccion('DETALLE DE CASOS PENDIENTES', curY);

pdf.autoTable({
  startY: curY,
  head: [['#', 'Registrado', 'Caso desde', 'N° Caso', 'Descripcion del caso', 'Asesor', 'Estado']],
  body: data.map((r, i) => [
    i+1,
    fmtDate(r.fechaRegistro || r.fecha || ''),
    fmtDate(r.fechaCaso || ''),
    r.numeroCaso || '-',
    r.descripcion || '-',
    r.asesor || '-',
    r.resuelto ? 'Resuelto' : 'Pendiente',
  ]),
  styles: {
    font:'helvetica', fontSize:7,
    cellPadding:{top:3,bottom:3,left:3,right:3},
    lineColor:GRIS2, lineWidth:0.2, overflow:'linebreak', textColor:GRIS4,
  },
  headStyles: {
    fillColor:NEGRO, textColor:BLANCO,
    fontStyle:'bold', fontSize:7.5, halign:'left',
    cellPadding:{top:4,bottom:4,left:3,right:3},
  },
  columnStyles: {
    0:{cellWidth:7,  halign:'center'},
    1:{cellWidth:20},
    2:{cellWidth:20},
    3:{cellWidth:20},
    4:{cellWidth:'auto'},
    5:{cellWidth:28},
    6:{cellWidth:18},
  },
  alternateRowStyles: { fillColor:[249,249,249] },
  margin:{left:10, right:10},
  didDrawCell: (hk) => {
    if (hk.section!=='body' || hk.column.index!==6) return;
    const val = hk.cell.raw;
    const cx=hk.cell.x+2, cy=hk.cell.y+2, cw=hk.cell.width-4, ch=hk.cell.height-4;
    if (val==='Resuelto')  { pdf.setFillColor(...VERDECL); pdf.roundedRect(cx,cy,cw,ch,1.5,1.5,'F'); pdf.setTextColor(...VERDE); }
    else                   { pdf.setFillColor(...ROJOCL);  pdf.roundedRect(cx,cy,cw,ch,1.5,1.5,'F'); pdf.setTextColor(...ROJO); }
    pdf.setFontSize(6.5); pdf.setFont('helvetica','bold');
    pdf.text(val, cx+cw/2, cy+ch/2+2, {align:'center'});
  },
});

// ── FOOTER ────────────────────────────────────────────────────
const pages = pdf.internal.getNumberOfPages();
for (let i=1; i<=pages; i++) {
  pdf.setPage(i);
  pdf.setFillColor(...GRIS1); pdf.rect(0, ph-13, pw, 13, 'F');
  pdf.setFillColor(...ROJO);  pdf.rect(0, ph-13, pw, 0.8, 'F');
  pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(...GRIS3);
  pdf.text('Documento de uso interno y confidencial', 13, ph-7.5);
  pdf.text('SISE - Portal SAES', 13, ph-3.5);
  pdf.text('Pagina ' + i + ' de ' + pages, pw-12, ph-5.5, {align:'right'});
}

pdf.save('CasosPendientes_' + d.getDate() + '_' + MESES[d.getMonth()] + '_' + d.getFullYear() + '.pdf');
showToast('PDF descargado ✓');
});
const zoomOverlay = document.getElementById('zoom-overlay');
const zoomImg     = document.getElementById('zoom-img');
let zScale = 1, zX = 0, zY = 0;
let dragging = false, startX = 0, startY = 0, startZX = 0, startZY = 0;
function openZoom(src) { zoomImg.src = src; zScale = 1; zX = 0; zY = 0; applyZoom(); zoomOverlay.classList.add('open'); }
function closeZoom() { zoomOverlay.classList.remove('open'); }
function applyZoom() { zoomImg.style.transform = `translate(${zX}px, ${zY}px) scale(${zScale})`; }
function clampPan() {
const rect = zoomImg.getBoundingClientRect();
const vw = window.innerWidth, vh = window.innerHeight;
const maxX = Math.max(0, (rect.width  - vw) / 2);
const maxY = Math.max(0, (rect.height - vh) / 2);
zX = Math.min(maxX, Math.max(-maxX, zX));
zY = Math.min(maxY, Math.max(-maxY, zY));
}
document.getElementById('zoom-close').addEventListener('click', e => { e.stopPropagation(); closeZoom(); });
zoomOverlay.addEventListener('click', e => { if (e.target === zoomOverlay) closeZoom(); });
document.getElementById('zoom-in').addEventListener('click',    e => { e.stopPropagation(); zScale = Math.min(zScale + 0.4, 5); applyZoom(); });
document.getElementById('zoom-out').addEventListener('click',   e => { e.stopPropagation(); zScale = Math.max(zScale - 0.4, 0.5); clampPan(); applyZoom(); });
document.getElementById('zoom-reset').addEventListener('click', e => { e.stopPropagation(); zScale = 1; zX = 0; zY = 0; applyZoom(); });
zoomOverlay.addEventListener('wheel', e => { e.preventDefault(); zScale = Math.min(Math.max(zScale - e.deltaY * 0.002, 0.5), 5); clampPan(); applyZoom(); }, { passive: false });
zoomImg.addEventListener('mousedown', e => { e.preventDefault(); dragging = true; startX = e.clientX; startY = e.clientY; startZX = zX; startZY = zY; zoomImg.classList.add('dragging'); });
window.addEventListener('mousemove', e => { if (!dragging) return; zX = startZX + (e.clientX - startX); zY = startZY + (e.clientY - startY); clampPan(); applyZoom(); });
window.addEventListener('mouseup', () => { dragging = false; zoomImg.classList.remove('dragging'); });
let lastTouchDist = 0;
zoomImg.addEventListener('touchstart', e => { if (e.touches.length === 1) { dragging = true; startX = e.touches[0].clientX; startY = e.touches[0].clientY; startZX = zX; startZY = zY; } else if (e.touches.length === 2) { dragging = false; const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; lastTouchDist = Math.sqrt(dx*dx + dy*dy); } }, { passive: true });
zoomImg.addEventListener('touchmove', e => { e.preventDefault(); if (e.touches.length === 1 && dragging) { zX = startZX + (e.touches[0].clientX - startX); zY = startZY + (e.touches[0].clientY - startY); clampPan(); applyZoom(); } else if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; const dist = Math.sqrt(dx*dx + dy*dy); zScale = Math.min(Math.max(zScale * (dist / lastTouchDist), 0.5), 5); lastTouchDist = dist; clampPan(); applyZoom(); } }, { passive: false });
zoomImg.addEventListener('touchend', () => { dragging = false; });
zoomImg.addEventListener('dblclick', e => { e.stopPropagation(); if (zScale > 1.2) { zScale = 1; zX = 0; zY = 0; } else { zScale = 2.5; } applyZoom(); });
function _updateHeroGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Buenos dias' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
  const nombre = window.currentUserNombre || '';
  const rol    = window.currentUserRol   || '';
  const el = document.querySelector('.home-hero-title');
  if (!el) return;
  // Nombre part: first name only
  const firstName = nombre ? nombre.split(' ')[0] : '';
  const nameHtml  = firstName
    ? ', <span style="color:var(--orange)">' + firstName + '</span>'
    : '';
  // Role badge
  const rolHtml = rol
    ? ' <span style="font-size:13px;font-weight:600;color:var(--text-muted,#9B8F88);vertical-align:middle">· ' + rol + '</span>'
    : '';
  el.innerHTML = '¡' + greet + nameHtml + '!' + rolHtml;
}
_updateHeroGreeting();
window.addEventListener('sise:rolCargado', _updateHeroGreeting);
(function() {
const sesionInicio = new Date();
let statPlantillas = 0, statCasos = 0, statVistas = 0;
function actualizarPerfilCfg() {
if (!currentUser) return;
const email = currentUser.email || '';
const nombre = email.split('@')[0];
document.getElementById('cfg-av').textContent        = nombre.substring(0,2).toUpperCase();
document.getElementById('cfg-nombre').textContent    = nombre;
document.getElementById('cfg-email').textContent     = email;
document.getElementById('cfg-rol-text').textContent  = currentUserRol || 'Asesor WSP';
document.getElementById('cfg-sesion-hora').textContent = sesionInicio.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});
}
setInterval(() => {
const mins = Math.floor((new Date() - sesionInicio) / 60000);
const el = document.getElementById('cfg-stat-tiempo');
if (el) el.textContent = mins < 60 ? mins + 'm' : Math.floor(mins/60) + 'h ' + (mins%60) + 'm';
}, 30000);
document.querySelectorAll('.nav-item[data-view]').forEach(item => {
item.addEventListener('click', () => {
statVistas++;
const el = document.getElementById('cfg-stat-vistas');
if (el) el.textContent = statVistas;
});
});
const origAddDoc = window._origAddDoc || null;
document.addEventListener('click', e => {
if (e.target.closest('.plt-btn-copy')) {
statPlantillas++;
const el = document.getElementById('cfg-stat-plantillas');
if (el) el.textContent = statPlantillas;
}
});
document.querySelector('[data-view="config"]')?.addEventListener('click', () => {
actualizarPerfilCfg();
const el = document.getElementById('cfg-stat-casos');
if (el) el.textContent = document.querySelectorAll('.caso-card').length;
});
const savedTema = localStorage.getItem('sise_tema') || 'orange';
function aplicarTema(tema) {
document.body.classList.remove('tema-blue','tema-green','tema-purple','tema-red','tema-pink','tema-teal');
if (tema !== 'orange') document.body.classList.add('tema-' + tema);
document.querySelectorAll('.cfg-tema-btn').forEach(b => {
b.classList.toggle('active', b.dataset.tema === tema);
});
localStorage.setItem('sise_tema', tema);
}
aplicarTema(savedTema);
document.getElementById('cfg-temas')?.addEventListener('click', e => {
const btn = e.target.closest('.cfg-tema-btn');
if (btn) aplicarTema(btn.dataset.tema);
});
const savedDen = localStorage.getItem('sise_den') || 'normal';
function aplicarDen(den) {
document.body.classList.remove('den-compact','den-spacious');
if (den !== 'normal') document.body.classList.add('den-' + den);
document.querySelectorAll('.cfg-den-btn').forEach(b => {
b.classList.toggle('active', b.dataset.den === den);
});
localStorage.setItem('sise_den', den);
}
aplicarDen(savedDen);
document.getElementById('cfg-densidad')?.addEventListener('click', e => {
const btn = e.target.closest('.cfg-den-btn');
if (btn) aplicarDen(btn.dataset.den);
});
function applyToggleEffect(key, on) {
if (key === 'pref_resaltar')    document.body.classList.toggle('resaltar-alto', on);
if (key === 'pref_animaciones') document.body.classList.toggle('no-animations', !on);
if (key === 'pref_sidebar_mini') document.body.classList.toggle('sidebar-mini', on);
}
function initToggle(id, key, defaultVal) {
const tog = document.getElementById(id);
if (!tog) return;
const val = localStorage.getItem(key);
const active = val === null ? defaultVal : val === 'true';
tog.classList.toggle('active', active);
applyToggleEffect(key, active);
tog.addEventListener('click', () => {
const now = tog.classList.toggle('active');
localStorage.setItem(key, String(now));
applyToggleEffect(key, now);
});
}
initToggle('tog-sonido',       'pref_sonido',       false);
initToggle('tog-confirmar',    'pref_confirmar',    true);
initToggle('tog-resaltar',     'pref_resaltar',     true);
initToggle('tog-animaciones',  'pref_animaciones',  true);
initToggle('tog-sidebar-mini', 'pref_sidebar_mini', false);
const savedFontSize = localStorage.getItem('sise_fontsize') || 'medium';
const fontSizes = ['small','medium','large','xlarge'];
function aplicarFontSize(size) {
fontSizes.forEach(s => document.body.classList.remove('fs-' + s));
document.body.classList.add('fs-' + size);
document.querySelectorAll('.cfg-font-btn[data-size]').forEach(b => b.classList.toggle('active', b.dataset.size === size));
localStorage.setItem('sise_fontsize', size);
}
aplicarFontSize(savedFontSize);
document.getElementById('cfg-fontsize')?.addEventListener('click', e => {
const btn = e.target.closest('.cfg-font-btn[data-size]');
if (btn) aplicarFontSize(btn.dataset.size);
});
const savedRadius = localStorage.getItem('sise_radius') || 'normal';
function aplicarRadius(r) {
document.body.classList.toggle('radius-sharp', r === 'sharp');
document.getElementById('cfg-radius-normal')?.classList.toggle('active', r === 'normal');
document.getElementById('cfg-radius-sharp')?.classList.toggle('active', r === 'sharp');
localStorage.setItem('sise_radius', r);
}
aplicarRadius(savedRadius);
document.querySelectorAll('[data-radius]').forEach(btn => {
btn.addEventListener('click', () => aplicarRadius(btn.dataset.radius));
});
function actualizarReloj() {
const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
const h = ahora.getHours();
const m = ahora.getMinutes().toString().padStart(2, '0');
const s = ahora.getSeconds().toString().padStart(2, '0');
const ampm = h >= 12 ? 'p.m.' : 'a.m.';
const h12 = (h % 12 || 12).toString().padStart(2, '0');
const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const dia = dias[ahora.getDay()];
const fecha = `${dia} ${ahora.getDate()} de ${meses[ahora.getMonth()]}`;
const timeEl = document.getElementById('clock-time');
const ampmEl = document.getElementById('clock-ampm');
const dateEl = document.getElementById('clock-date');
if (timeEl) timeEl.textContent = `${h12}:${m}`;
if (ampmEl) ampmEl.textContent = ampm;
if (dateEl) dateEl.textContent = fecha;
}
actualizarReloj();
setInterval(actualizarReloj, 1000);
document.addEventListener('keydown', e => {
if (!e.altKey) return;
const mapa = { p:'plantillas', t:'tipificaciones', b:'bo-llamadas', c:'pendientes', i:'inicio' };
const vista = mapa[e.key.toLowerCase()];
if (vista) {
e.preventDefault();
document.querySelector(`[data-view="${vista}"]`)?.click();
}
});
})();
(function() {
let allFaqs = [];
let faqEditId = null;
let activeFaqCat = null;
const CAT_COLORS = ['faq-color-0','faq-color-1','faq-color-2','faq-color-3','faq-color-4','faq-color-5','faq-color-6','faq-color-7'];
const catColorMap = {};
let catColorIdx = 0;
function getCatColor(cat) {
if (!catColorMap[cat]) { catColorMap[cat] = CAT_COLORS[catColorIdx % CAT_COLORS.length]; catColorIdx++; }
return catColorMap[cat];
}
function puedeGestionar() {
const r = (currentUserRol || '').toLowerCase();
return r === 'bo' || r === 'supervisor' || r === 'formador';
}
function ytId(url) {
if (!url) return null;
const m = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
return m ? m[1] : null;
}
function loadFaqs() {
function suscribir(conOrden) {
const q = conOrden
? query(collection(db, 'faqs'), orderBy('creadoEn', 'asc'))
: collection(db, 'faqs');
return onSnapshot(q, snap => {
try {
allFaqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
allFaqs.sort((a, b) => {
const ta = a.creadoEn?.seconds ?? a.orden ?? 0;
const tb = b.creadoEn?.seconds ?? b.orden ?? 0;
return ta - tb;
});
allFaqs.forEach(f => getCatColor(f.categoria || 'General'));
renderFaqView();
const btnFaq = document.getElementById('btn-faq-nueva');
if (puedeGestionar() && btnFaq) btnFaq.style.display = '';
} catch(e) { console.error('renderFaqView:', e); }
}, err => {
console.error('faqs error:', err);
if (conOrden && (err.code === 'failed-precondition' || err.message?.includes('index'))) {
console.warn('Índice no disponible, cargando sin orderBy…');
suscribir(false);
} else if (!snap || snap.empty) {
seedFaqs();
}
});
}
suscribir(true);
}
async function seedFaqs() {
const ejemplos = [
{
categoria: 'Derivaciones',
pregunta: '¿A qué cola se deriva cuando le hicieron caso manual de pago de uniforme y vuelven con el boucher al canal?',
respuesta: 'Se deriva a la cola SISE Sede.',
videoUrl: '',
imgUrl: '',
creadoPor: 'sistema',
creadoEn: serverTimestamp(),
orden: 1
},
{
categoria: 'Derivaciones',
pregunta: '¿A qué área se escala cuando un alumno reporta que su pago no se ve reflejado después de 48 horas?',
respuesta: 'Se debe escalar al área de Tesorería mediante la cola SISE Tesorería, adjuntando el voucher de pago del alumno y el número de operación.',
videoUrl: '',
imgUrl: '',
creadoPor: 'sistema',
creadoEn: serverTimestamp(),
orden: 2
}
];
for (const e of ejemplos) {
try { await addDoc(collection(db, 'faqs'), e); } catch(err) { console.error(err); }
}
loadFaqs();
}
// ── Búsqueda inteligente v2 ───────────────────────────────────────────────────
// Normaliza texto: quita acentos, pasa a minúsculas, elimina puntuación extra
function normText(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Diccionario ampliado de sinónimos / variantes para Contact Center SISE ───
const SINONIMOS = {
  'pago': ['pago','pagar','cancelar','cuota','deuda','abono','cobro','factura','boleta','recibo','costo','precio','monto','valor','fee','arancel','mensualidad','pensionista','pension','tarifa','importe','cobrar','debo','me cobran','cuanto vale','cuanto cuesta'],
  'matricula': ['matricula','matricular','inscripcion','inscribirse','registro','registrar','enrolamiento','postulacion','postular','admision','admitirse','proceso de ingreso','inscripcion de cursos'],
  'derivacion': ['derivacion','derivar','derivado','escalar','escalamiento','transferir','transferencia','redirigir','pasar','pasa a','deriva a','quien atiende','quien resuelve','a quien llamo'],
  'llamada': ['llamada','llamar','telefono','contacto','comunicacion','celular','numero','llame','me llamen','retrollamada','devuelvan la llamada','callback','llamadas','linea'],
  'whatsapp': ['whatsapp','wsp','wsap','chat','mensaje','mensajeria','ws','whats','wapp','wasap'],
  'alumno': ['alumno','estudiante','cliente','usuario','persona','postulante','egresado','exalumno','ex alumno','nuevo alumno','alumno nuevo','aspirante'],
  'proceso': ['proceso','tramite','procedimiento','gestion','gestionar','gestiones','tramitar','hacer','como se hace','como hago','que hago','que debo hacer','pasos','requisitos'],
  'error': ['error','problema','falla','fallo','inconveniente','dificultad','ayuda','no puedo','no funciona','no me deja','no me permite','tengo problema','tuve problema','me sale error','fallo'],
  'documento': ['documento','documentos','archivo','archivos','carta','constancia','certificado','formulario','pdf','archivo','adjunto','subir','cargar','enviar documento','mando'],
  'acceso': ['acceso','acceder','ingresar','ingreso','login','entrar','contraseña','clave','password','usuario','user','cuenta','no puedo entrar','no entra','bloqueado','olvide contraseña','recuperar contraseña','reset','restablecer'],
  'canvas': ['canvas','aula virtual','aulavirtual','plataforma virtual','lms','aula en linea','plataforma de estudio','sistema academico','campus virtual'],
  'campus': ['campus','sede','sede fisica','instalaciones','direccion','donde queda','localizacion','ubicacion'],
  'nota': ['nota','calificacion','promedio','evaluacion','examen','nota final','curso aprobado','reprobo','jale','jalado','desaprobo','desaprobado','nota desaprobatoria'],
  'horario': ['horario','hora','clases','turno','horarios','cuando es la clase','que dia','dias de clase','malla horaria','schedule','dias'],
  'malla': ['malla','plan de estudios','curricula','cursos','materias','asignaturas','plan curricular','que llevo','que estoy llevando','ramos','silabo'],
  'credito': ['credito','creditos','prestamo','financiamiento','facilidades de pago','financiar','cuotas','plan de pago'],
  'descuento': ['descuento','beca','becas','reduccion','precio especial','beneficio','bonificacion','gratuidad','beca integral','media beca','exoneracion'],
  'retiro': ['retiro','retirarse','baja','abandono','desercion','dar de baja','darse de baja','quiero retirarme','voy a retirar'],
  'traslado': ['traslado','transferencia','cambio de sede','cambio de carrera','cambio de horario','traslado externo','traslado interno','transferencia externa'],
  'carnet': ['carnet','dni','identificacion','id','carne','carnet de estudiante','documento de identidad','identificacion estudiantil'],
  'certificado': ['certificado','constancia','diploma','titulo','grado','bachiller','licenciatura','constancia de estudios','constancia de notas','record academico','historial'],
  'practicas': ['practicas','practica','practica pre profesional','practica profesional','pasantia','internship','empresa','convenio de practicas'],
  'graduacion': ['graduacion','graduarse','titularse','titulo profesional','grado academico','bachillerato','sustentacion','tesis','proyecto de investigacion'],
  'reincorporacion': ['reincorporacion','reincorporarse','volver','regresar','retornar','retomar estudios','regularizacion'],
  'convalidacion': ['convalidacion','convalidar','reconocer','reconocimiento','homologacion','homologar','cursos aprobados','cursos llevados'],
  'presencial': ['presencial','ir al campus','ir a la sede','ir en persona','asistir','clases presenciales','modalidad presencial'],
  'virtual': ['virtual','online','remoto','a distancia','clases virtuales','modalidad virtual','zoom','teams','meet','videollamada'],
  'hibrido': ['hibrido','semipresencial','mixto','clases hibridas','modalidad hibrida'],
  'ciclo': ['ciclo','periodo academico','semestre','bimestre','trimestre','ciclo de estudios','nuevo ciclo','apertura de ciclo','inicio de ciclo'],
  'inscripcion': ['inscripcion de cursos','matricula de cursos','cargar cursos','seleccionar cursos','eleccion de cursos','inscribir cursos'],
  'recarga': ['recarga','reingreso','adicionar curso','curso adicional','sobrecarga','llevar curso adicional'],
  'retiro_curso': ['retiro de curso','retirar curso','bajar curso','drop','dar de baja curso'],
  'estado_cuenta': ['estado de cuenta','deuda','cuanto debo','ver mis deudas','consultar deuda','saldo pendiente','saldo'],
  'voucher': ['voucher','comprobante de pago','recibo de pago','constancia de pago','pago registrado'],
  'reembolso': ['reembolso','devolucion','devolver dinero','me devuelven','reintegro'],
  'soporte': ['soporte','ayuda tecnica','asistencia tecnica','help desk','servicio al cliente','atencion al alumno','sac','centro de atencion'],
  'sise': ['sise','instituto sise','instituto','institucion','colegio','escuela'],
  'portal': ['portal','portal saes','saes','sistema saes','portal del alumno','portal estudiantil'],
  'turnitin': ['turnitin','plagio','antiplagio','similitud','porcentaje de similitud'],
  'biblioteca': ['biblioteca','libros','recursos digitales','base de datos','proquest','ebsco'],
  'boleto': ['boleto de estudios','constancia de pagos','recibo de matricula'],
};

// Mapas de frases completas (búsqueda exacta de frase → amplifica puntaje)
const FRASES_CLAVE = [
  ['no puedo ingresar', 'acceso'],
  ['olvidé mi contraseña', 'acceso'],
  ['olvide contraseña', 'acceso'],
  ['recuperar contraseña', 'acceso'],
  ['no recuerdo mi clave', 'acceso'],
  ['canvas no abre', 'canvas'],
  ['no entra al aula virtual', 'canvas'],
  ['aula virtual caida', 'canvas'],
  ['cuanto me cuesta', 'pago'],
  ['cuanto cuesta la matricula', 'pago'],
  ['como pago', 'pago'],
  ['donde pago', 'pago'],
  ['formas de pago', 'pago'],
  ['cambio de carrera', 'traslado'],
  ['cambio de sede', 'traslado'],
  ['quiero cambiarme', 'traslado'],
  ['quiero retirarme', 'retiro'],
  ['dar de baja', 'retiro'],
  ['como me matriculo', 'matricula'],
  ['proceso de matricula', 'matricula'],
  ['inscripcion de cursos', 'inscripcion'],
  ['retirar curso', 'retiro_curso'],
  ['estado de cuenta', 'estado_cuenta'],
  ['cuanto debo', 'estado_cuenta'],
  ['constancia de estudios', 'certificado'],
  ['certificado de estudios', 'certificado'],
  ['record de notas', 'nota'],
  ['historial academico', 'nota'],
  ['practicas pre profesionales', 'practicas'],
  ['practicas profesionales', 'practicas'],
];

// Expande un término a sus sinónimos conocidos
function expandirTerminos(termino) {
  const t = normText(termino);
  for (const [_key, grupo] of Object.entries(SINONIMOS)) {
    if (grupo.some(s => normText(s) === t || normText(s).startsWith(t) || t.startsWith(normText(s)))) {
      return grupo.map(s => normText(s));
    }
  }
  return [t];
}

// Distancia de edición (Levenshtein) — para tolerancia tipográfica
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({length: a.length + 1}, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

// Comprueba si dos términos son fonéticamente similares (heurística simple)
function similarFonetico(a, b) {
  if (a === b) return true;
  // Misma raíz de 4+ caracteres
  if (a.length >= 4 && b.length >= 4) {
    const raiz = Math.min(4, Math.min(a.length, b.length));
    if (a.substring(0, raiz) === b.substring(0, raiz)) return true;
  }
  // b/v, ll/y, s/z/c intercambiables
  const normalF = s => s.replace(/v/g,'b').replace(/y/g,'ll').replace(/z/g,'s').replace(/c([ei])/g,'s$1');
  if (normalF(a) === normalF(b)) return true;
  return false;
}

// Puntúa qué tan bien coincide una palabra de búsqueda con palabras del texto
function puntajePalabra(termino, texto) {
  const variantes = expandirTerminos(termino);
  const textoNorm = normText(texto);
  const palabrasTexto = textoNorm.split(' ').filter(p => p.length > 1);
  let maxScore = 0;

  // Bonus si el término aparece como frase exacta en el texto
  if (textoNorm.includes(normText(termino))) {
    maxScore = Math.max(maxScore, termino.length > 4 ? 95 : 80);
  }

  for (const variante of variantes) {
    if (!variante || variante.length < 2) continue;

    // Coincidencia de frase exacta
    if (textoNorm.includes(variante)) {
      maxScore = Math.max(maxScore, 90);
      continue;
    }

    for (const pal of palabrasTexto) {
      if (pal === variante) { maxScore = Math.max(maxScore, 100); continue; }
      if (pal.startsWith(variante) || variante.startsWith(pal)) { maxScore = Math.max(maxScore, 88); continue; }
      if (pal.includes(variante) || variante.includes(pal)) { maxScore = Math.max(maxScore, 75); continue; }
      // Similitud fonética
      if (variante.length >= 4 && similarFonetico(variante, pal)) { maxScore = Math.max(maxScore, 70); continue; }
      // Tolerancia tipográfica (hasta 2 errores)
      if (variante.length >= 4) {
        const dist = levenshtein(variante, pal);
        if (dist === 1) { maxScore = Math.max(maxScore, 65); continue; }
        if (dist === 2 && variante.length >= 6) { maxScore = Math.max(maxScore, 45); continue; }
      }
      // Prefijo largo compartido (stem heurístico)
      if (variante.length >= 5 && pal.length >= 5) {
        const stem = Math.min(5, variante.length - 1);
        if (pal.substring(0, stem) === variante.substring(0, stem)) { maxScore = Math.max(maxScore, 55); continue; }
      }
    }
  }
  return maxScore;
}

// Detecta si la query contiene una frase clave conocida y retorna la clave del grupo
function detectarFraseClave(queryNorm) {
  const claves = [];
  for (const [frase, grupo] of FRASES_CLAVE) {
    if (queryNorm.includes(normText(frase))) {
      claves.push(grupo);
    }
  }
  return claves;
}

// Puntúa un FAQ frente a una query completa
function puntajeFaq(faq, query) {
  const queryNorm = normText(query);
  const terminos = queryNorm.split(' ').filter(t => t.length >= 2);
  if (!terminos.length) return 0;

  const campos = [
    { texto: faq.pregunta,  peso: 3 },
    { texto: faq.respuesta, peso: 2 },
    { texto: faq.categoria, peso: 1 },
  ];

  // Bonus por frases clave detectadas en la query
  let bonusFrase = 0;
  const clavesFrase = detectarFraseClave(queryNorm);
  if (clavesFrase.length) {
    const textoTotal = normText([faq.pregunta, faq.respuesta, faq.categoria].join(' '));
    for (const clave of clavesFrase) {
      const variantes = SINONIMOS[clave] || [];
      if (variantes.some(v => textoTotal.includes(normText(v)))) {
        bonusFrase += 25; // bonificación por coincidencia de frase
      }
    }
  }

  // Bonus por coincidencia exacta de la query completa en algún campo
  let bonusExacto = 0;
  if (queryNorm.length >= 4) {
    for (const { texto, peso } of campos) {
      if (normText(texto).includes(queryNorm)) {
        bonusExacto = Math.max(bonusExacto, 30 * peso);
      }
    }
  }

  let total = 0, posibles = 0;
  for (const termino of terminos) {
    let mejorCampo = 0;
    for (const { texto, peso } of campos) {
      const p = puntajePalabra(termino, texto) * peso;
      mejorCampo = Math.max(mejorCampo, p);
    }
    total += mejorCampo;
    posibles += 300; // max: 100 * peso_max(3)
  }

  const base = Math.round((total / posibles) * 100);
  return Math.min(100, base + bonusFrase + bonusExacto);
}

// Umbral mínimo para mostrar un resultado (0-100)
const UMBRAL_BUSQUEDA = 15;
// ─────────────────────────────────────────────────────────────────────────────

function renderFaqView() {
const q   = (document.getElementById('faq-search')?.value || '').trim();
const cat = activeFaqCat;
let data = [...allFaqs];
if (cat) data = data.filter(f => f.categoria === cat);
if (q) {
  // Búsqueda inteligente con puntuación
  const scoredData = data
    .map(f => ({ f, score: puntajeFaq(f, q) }))
    .filter(({ score }) => score >= UMBRAL_BUSQUEDA)
    .sort((a, b) => b.score - a.score);
  data = scoredData.map(({ f }) => f);
}
document.getElementById('faq-count').textContent = data.length + ' respuesta' + (data.length !== 1 ? 's' : '');
const valEl = document.getElementById('faq-count-val');
if (valEl) valEl.textContent = allFaqs.length;
const cats = [...new Set(allFaqs.map(f => f.categoria || 'General'))];
const catsEl = document.getElementById('faq-cats-val');
if (catsEl) catsEl.textContent = cats.length;
renderFaqChips();
renderFaqCatSelect();
const grid = document.getElementById('faq-grid');
if (!data.length) {
grid.innerHTML = '<div class="empty-state"><i class="ti ti-help-off"></i><p>No se encontraron preguntas.</p><p class="empty-hint">Intenta con otras palabras, sinónimos o frases más cortas.<br>Ej: en vez de "inscripción de asignaturas" prueba "matricula cursos".</p></div>';
return;
}
// Paleta de colores para lomos de libros
const SPINE_COLORS = [
  '#E03131','#C94E0A','#B87000','#1A7A45',
  '#1D5FBD','#7C3AED','#DB2777','#0D9488',
  '#6B7280','#92400E','#065F46','#1E3A5F',
];
function spineColor(cat) {
  let h=0; for(let i=0;i<cat.length;i++) h=(h*31+cat.charCodeAt(i))&0xFFFF;
  return SPINE_COLORS[h % SPINE_COLORS.length];
}

grid.innerHTML = data.map((f, idx) => {
const color = getCatColor(f.categoria || 'General');
const hasImg   = !!(f.imgUrl || f.imgB64);
const hasVideo = !!ytId(f.videoUrl);
const gestor   = puedeGestionar();
const spine    = spineColor(f.categoria || 'General');
const isMatch  = !!q;
return `<div class="faq-card${isMatch?' search-match':''}" onclick="window._faqVer('${f.id}')" style="border-top:5px solid ${spine}">
<div class="faq-card-top">
  <div class="faq-card-cat ${color}" style="margin-bottom:10px">
    <i class="ti ti-folder" style="font-size:11px"></i>
    ${q ? _hlTokens(f.categoria||'General', q) : escH(f.categoria||'General')}
  </div>
  <div class="faq-card-q" style="font-size:13px;font-weight:700;color:#1a1a1a;line-height:1.55;margin-bottom:8px">
    ${q ? _hlTokens(f.pregunta||'', q) : escH(f.pregunta||'')}
  </div>
  <div class="faq-card-a-preview" style="font-size:12px;color:#666;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
    ${q ? _hlTokens(f.respuesta||'', q) : escH(f.respuesta||'')}
  </div>
</div>
<div class="faq-card-footer">
  <div class="faq-card-icons">
    ${hasImg   ? '<span class="faq-card-icon-badge"><i class="ti ti-photo" style="font-size:12px"></i>Imagen</span>' : ''}
    ${hasVideo ? '<span class="faq-card-icon-badge"><i class="ti ti-brand-youtube" style="font-size:12px;color:#E03131"></i>Video</span>' : ''}
    ${!hasImg && !hasVideo ? '<span class="faq-card-icon-badge"><i class="ti ti-align-left" style="font-size:12px"></i>Solo texto</span>' : ''}
  </div>
  <div style="display:flex;align-items:center;gap:8px">
    ${gestor ? `<button class="btn-row edit" title="Editar" onclick="event.stopPropagation();window._faqEditar('${f.id}')"><i class="ti ti-pencil"></i></button>
    <button class="btn-row del" title="Eliminar" onclick="event.stopPropagation();window._faqEliminar('${f.id}')"><i class="ti ti-trash"></i></button>` : ''}
    <span class="faq-card-meta">${f.creadoPor && f.creadoPor !== 'sistema' ? f.creadoPor.split('@')[0] : ''}</span>
  </div>
</div>
</div>`;
}).join('');
}
function renderFaqChips() {
const cats = [...new Set(allFaqs.map(f => f.categoria || 'General'))];
const bar = document.getElementById('faq-chips-bar');
const total = allFaqs.length;
bar.innerHTML =
`<button class="faq-chip${!activeFaqCat ? ' active' : ''}" onclick="window._faqChip(null)">
<i class="ti ti-layout-grid" style="font-size:13px"></i>Todas
<span class="faq-chip-n">${total}</span>
</button>` +
cats.map(cat => {
const n = allFaqs.filter(f => (f.categoria||'General') === cat).length;
return `<button class="faq-chip${activeFaqCat===cat?' active':''}" onclick="window._faqChip('${cat.replace(/'/g,"\\'")}')">
${escH(cat)}<span class="faq-chip-n">${n}</span>
</button>`;
}).join('');
}
function renderFaqCatSelect() {
const cats = [...new Set(allFaqs.map(f => f.categoria || 'General'))];
const sel = document.getElementById('faq-cat-filter');
const current = sel.value;
sel.innerHTML = '<option value="">Todas las categorías</option>' +
cats.map(c => `<option value="${escH(c)}"${c===current?' selected':''}>${escH(c)}</option>`).join('');
}
window._faqChip = (cat) => { activeFaqCat = cat; renderFaqView(); };

// Búsqueda con debounce para mejor rendimiento
let faqSearchTimer = null;
document.getElementById('faq-search')?.addEventListener('input', function() {
  clearTimeout(faqSearchTimer);
  const inp = this;
  const clearBtn = document.getElementById('faq-search-clear');
  if (clearBtn) clearBtn.style.display = inp.value.trim() ? 'inline-block' : 'none';
  // Feedback visual inmediato: leve opacidad mientras espera
  const grid = document.getElementById('faq-grid');
  if (grid) { grid.style.opacity = '0.6'; grid.innerHTML = '<div class="bib-searching" style="grid-column:1/-1;text-align:center;padding:48px 24px"><span class="bib-searching-icon">🔍</span><div style="font-size:16px;font-weight:700;color:#555;margin-bottom:6px">Buscando en la biblioteca…</div><div style="font-size:12px;color:#999">Revisando ' + allFaqs.length + ' respuestas</div></div>'; }
  faqSearchTimer = setTimeout(function() {
    if (grid) grid.style.opacity = '1';
    renderFaqView();
    // Mostrar badge de "búsqueda activa" si hay texto
    const badge = document.querySelector('.faq-search-badge');
    if (badge) badge.style.display = inp.value.trim() ? 'inline-flex' : 'none';
  }, 280);
});
document.getElementById('faq-cat-filter')?.addEventListener('change', function() {
activeFaqCat = this.value || null;
renderFaqView();
});
const viewOverlay = document.getElementById('modal-faq-view-overlay');
window._faqVer = (id) => {
const f = allFaqs.find(x => x.id === id);
if (!f) return;
const color = getCatColor(f.categoria || 'General');
document.getElementById('fmv-num').textContent = 'Pregunta frecuente';
document.getElementById('fmv-pregunta').textContent  = f.pregunta || '';
document.getElementById('fmv-respuesta').textContent = f.respuesta || '';
document.getElementById('fmv-cat').textContent       = f.categoria || 'General';
document.getElementById('fmv-cat').className         = 'faq-cat-badge ' + color;
const por = f.creadoPor && f.creadoPor !== 'sistema' ? 'Agregado por ' + f.creadoPor.split('@')[0] : 'Pregunta base';
document.getElementById('fmv-meta').textContent = por;
const imgWrap = document.getElementById('fmv-img-wrap');
const imgEl   = document.getElementById('fmv-img');
const imgSrc = f.imgUrl || f.imgB64 || ''; if (imgSrc) { imgEl.src = imgSrc; imgWrap.style.display = ''; imgEl.onclick = () => window.open(imgSrc,'_blank'); }
else { imgWrap.style.display = 'none'; }
const vidWrap  = document.getElementById('fmv-video-wrap');
const vidEmbed = document.getElementById('fmv-video-embed');
const vidLink  = document.getElementById('fmv-video-link');
const vid = ytId(f.videoUrl);
if (vid) {
vidEmbed.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen style="display:block"></iframe>`;
vidLink.href = f.videoUrl;
vidWrap.style.display = '';
} else { vidWrap.style.display = 'none'; }
const editBtn = document.getElementById('fmv-edit-btn');
if (puedeGestionar()) {
editBtn.style.display = '';
editBtn.onclick = () => { viewOverlay.classList.remove('open'); window._faqEditar(id); };
} else { editBtn.style.display = 'none'; }
viewOverlay.classList.add('open');
};
document.getElementById('fmv-close')?.addEventListener('click',  () => viewOverlay.classList.remove('open'));
document.getElementById('fmv-cancel')?.addEventListener('click', () => viewOverlay.classList.remove('open'));
viewOverlay.addEventListener('click', e => { if (e.target === viewOverlay) viewOverlay.classList.remove('open'); });
const formOverlay = document.getElementById('modal-faq-form-overlay');
function abrirModalFaq(id) {
faqEditId = id || null;
const f = id ? allFaqs.find(x => x.id === id) : null;
document.getElementById('modal-faq-form-title').textContent   = f ? 'Editar pregunta' : 'Nueva pregunta';
document.getElementById('btn-faq-form-save-text').textContent = f ? 'Guardar cambios' : 'Guardar pregunta';
document.getElementById('ffaq-cat').value       = f ? (f.categoria  || '') : '';
document.getElementById('ffaq-pregunta').value  = f ? (f.pregunta   || '') : '';
document.getElementById('ffaq-respuesta').value = f ? (f.respuesta  || '') : '';
document.getElementById('ffaq-video').value     = f ? (f.videoUrl   || '') : '';
document.getElementById('ffaq-img-b64').value   = '';  // no longer used
const prev = document.getElementById('ffaq-img-preview');
if (f?.imgUrl) { prev.src = f.imgUrl; prev.style.display = 'block'; }
else           { prev.src = ''; prev.style.display = 'none'; }
document.getElementById('ffaq-img-file').value = '';
const cats = [...new Set(allFaqs.map(f => f.categoria || 'General').filter(Boolean))];
document.getElementById('ffaq-cat-sugerencias').innerHTML = cats.map(c =>
`<button type="button" style="padding:3px 10px;border-radius:99px;border:1.5px solid var(--border);background:var(--surface);font-size:11px;font-weight:600;color:var(--muted);cursor:pointer;font-family:var(--font)"
onclick="document.getElementById('ffaq-cat').value='${escH(c)}'">
${escH(c)}
</button>`
).join('');
formOverlay.classList.add('open');
}
function cerrarModalFaq() { formOverlay.classList.remove('open'); faqEditId = null; }
document.getElementById('btn-faq-nueva')?.addEventListener('click', () => abrirModalFaq(null));
document.getElementById('modal-faq-form-close')?.addEventListener('click', cerrarModalFaq);
document.getElementById('btn-faq-form-cancel')?.addEventListener('click', cerrarModalFaq);
formOverlay.addEventListener('click', e => { if (e.target === formOverlay) cerrarModalFaq(); });
window._faqEditar   = (id) => abrirModalFaq(id);
window._faqEliminar = async (id) => {
if (!puedeGestionar()) { showToast('Sin permiso para eliminar preguntas', 'error'); return; }
if (!confirmarAccion('¿Eliminar esta pregunta de la biblioteca?')) return;
try { await deleteDoc(doc(db, 'faqs', id)); showToast('Pregunta eliminada'); }
catch(e) { showToast('Error al eliminar', 'error'); }
};
document.getElementById('ffaq-img-drop')?.addEventListener('click', () =>
document.getElementById('ffaq-img-file').click()
);
document.getElementById('ffaq-img-file')?.addEventListener('change', function() {
const file = this.files[0];
if (!file) return;
if (file.size > 2.5 * 1024 * 1024) { showToast('La imagen no debe superar 2 MB', 'error'); return; }
const reader = new FileReader();
reader.onload = e => {
const b64 = e.target.result;
document.getElementById('ffaq-img-b64').value = b64;
const prev = document.getElementById('ffaq-img-preview');
prev.src = b64; prev.style.display = 'block';
};
reader.readAsDataURL(file);
});
function comprimirImagen(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = e => {
const img = new Image();
img.onload = () => {
const MAX = 900;
let w = img.width, h = img.height;
if (w > MAX || h > MAX) {
if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
else       { w = Math.round(w * MAX / h); h = MAX; }
}
const canvas = document.createElement('canvas');
canvas.width = w; canvas.height = h;
canvas.getContext('2d').drawImage(img, 0, 0, w, h);
resolve(canvas.toDataURL('image/jpeg', 0.65));
};
img.onerror = reject;
img.src = e.target.result;
};
reader.onerror = reject;
reader.readAsDataURL(file);
});
}
document.getElementById('btn-faq-form-save')?.addEventListener('click', async () => {
if (!puedeGestionar()) { showToast('Sin permiso para gestionar la biblioteca', 'error'); return; }
const cat       = document.getElementById('ffaq-cat').value.trim();
const pregunta  = document.getElementById('ffaq-pregunta').value.trim();
const respuesta = document.getElementById('ffaq-respuesta').value.trim();
if (!cat || !pregunta || !respuesta) { showToast('Completa los campos obligatorios (*)', 'error'); return; }
const btn = document.getElementById('btn-faq-form-save');
const resetBtn = () => { btn.disabled = false; btn.innerHTML = '<i class="ti ti-device-floppy"></i> Guardar'; };
btn.disabled = true;
btn.innerHTML = '<i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> Guardando…';
try {
const fileInput = document.getElementById('ffaq-img-file');
const file = fileInput?.files?.[0];
let imgUrl  = '';
let imgB64  = '';
if (file) {
let storageOk = false;
try {
const ext  = file.name.split('.').pop().replace(/[^a-z0-9]/gi,'').toLowerCase() || 'jpg';
const path = `faqs/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
const sRef = storageRef(storage, path);
const snap = await uploadBytes(sRef, file);
imgUrl = await getDownloadURL(snap.ref);
storageOk = true;
} catch(storageErr) {
console.warn('Storage no disponible, usando base64:', storageErr.message);
}
if (!storageOk) {
try {
imgB64 = await comprimirImagen(file);
if (imgB64.length > 900000) {
showToast('Imagen demasiado grande. Usa una de menos de 1 MB.', 'error');
resetBtn();
return;
}
} catch(b64Err) {
console.error('Error al comprimir imagen:', b64Err);
showToast('No se pudo procesar la imagen. Intenta con otra.', 'error');
resetBtn();
return;
}
}
} else if (faqEditId) {
const existing = allFaqs.find(x => x.id === faqEditId);
imgUrl = existing?.imgUrl || '';
imgB64 = existing?.imgB64 || '';
}
const payload = {
categoria: cat,
pregunta, respuesta,
videoUrl: (document.getElementById('ffaq-video').value || '').trim(),
imgUrl,
imgB64,
};
if (faqEditId) {
await updateDoc(doc(db, 'faqs', faqEditId), {
...payload,
actualizadoPor: currentUser.email,
actualizadoEn: serverTimestamp()
});
showToast('Pregunta actualizada ✓');
} else {
const maxOrden = allFaqs.length ? Math.max(...allFaqs.map(f => f.orden || 0)) : 0;
await addDoc(collection(db, 'faqs'), {
...payload,
orden: maxOrden + 1,
creadoPor: currentUser.email,
creadoEn: serverTimestamp()
});
showToast('Pregunta añadida a la biblioteca ✓');
}
cerrarModalFaq();
} catch(e) {
console.error('Error al guardar FAQ:', e);
showToast('Error al guardar: ' + (e.message || 'Error desconocido'), 'error');
} finally {
resetBtn();
}
});
document.querySelector('[data-view="preguntas"]')?.addEventListener('click', () => {
if (!allFaqs.length) loadFaqs();
});
if (document.getElementById('view-preguntas')?.classList.contains('active')) loadFaqs();
window._loadFaqs = loadFaqs;
window._rerenderFaqs = () => {
renderFaqView();
const btn = document.getElementById('btn-faq-nueva');
if (btn) btn.style.display = puedeGestionar() ? '' : 'none';
};


// ══════════════════════════════════════════════════════════════════
// REPORTE MENSUAL — BO LLAMADAS
// ══════════════════════════════════════════════════════════════════
document.getElementById('btn-bo-export-mensual').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  if (!allCasos || !allCasos.length) { showToast('No hay datos para generar el reporte', 'error'); return; }

  // Mes actual de la vista
  const ref   = boViewDay;
  const mes   = ref.getMonth();
  const anio  = ref.getFullYear();
  const MESES_N = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesNombre = MESES_N[mes];
  const generado  = new Date().toLocaleDateString('es-PE');

  // Filtrar datos del mes
  const data = allCasos.filter(r => {
    const f = r.fechaRegistro || '';
    if (!f) return false;
    const parts = f.split('-');
    return parseInt(parts[0]) === anio && parseInt(parts[1]) - 1 === mes;
  });

  if (!data.length) { showToast('No hay casos en ' + mesNombre + ' ' + anio, 'error'); return; }

  // ── Estadísticas ──────────────────────────────────────────────
  const total      = data.length;
  const atendidas  = data.filter(r => r.estadoLlamada === 'atendida').length;
  const noContesta = data.filter(r => r.estadoLlamada === 'no_contesta').length;
  const pendientes = data.filter(r => (r.estadoLlamada||'pendiente') === 'pendiente').length;
  const nivel      = total > 0 ? Math.round((atendidas / total) * 100) : 0;
  const alto       = data.filter(r => (r.prioridad||'medio') === 'alto').length;
  const medio      = data.filter(r => (r.prioridad||'medio') === 'medio').length;
  const bajo       = data.filter(r => (r.prioridad||'medio') === 'bajo').length;

  // Casos por día
  const porDia = {};
  data.forEach(r => {
    const f = r.fechaRegistro || '';
    if (!porDia[f]) porDia[f] = { total:0, atendida:0, no_contesta:0, pendiente:0 };
    porDia[f].total++;
    porDia[f][r.estadoLlamada || 'pendiente']++;
  });
  const dias = Object.keys(porDia).sort();

  // Asesores
  const porAsesor = {};
  data.forEach(r => {
    const a = r.asesorWsp || 'Sin asignar';
    if (!porAsesor[a]) porAsesor[a] = { total:0, atendida:0, no_contesta:0, pendiente:0 };
    porAsesor[a].total++;
    porAsesor[a][r.estadoLlamada || 'pendiente']++;
  });

  // ── Colores ───────────────────────────────────────────────────
  const NEGRO   = [13,13,13];
  const ROJO    = [196,30,58];
  const ROJOCL  = [255,235,238];
  const BLANCO  = [255,255,255];
  const GRIS1   = [245,245,245];
  const GRIS2   = [220,220,220];
  const GRIS3   = [140,140,140];
  const GRIS4   = [60,60,60];
  const VERDE   = [26,122,69];
  const VERDECL = [232,250,240];
  const NARANJA = [234,140,0];
  const NARCL   = [255,243,220];
  const PURPURA = [91,33,182];
  const PURCL   = [245,240,255];
  const AZUL    = [30,80,160];

  const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const pw  = pdf.internal.pageSize.width;
  const ph  = pdf.internal.pageSize.height;

  // ── Helpers ───────────────────────────────────────────────────
  const lineaRoja = (x,y,w) => { pdf.setFillColor(...ROJO); pdf.rect(x,y,w,0.7,'F'); };
  const seccion = (texto, y) => {
    pdf.setFillColor(...NEGRO); pdf.roundedRect(10,y,3.5,8,0.8,0.8,'F');
    pdf.setTextColor(...NEGRO); pdf.setFont('helvetica','bold'); pdf.setFontSize(10);
    pdf.text(texto, 16.5, y+5.8);
    lineaRoja(10, y+10, pw-20);
    return y+15;
  };
  const nuevaPagina = (curY, needed) => {
    if (curY + needed > ph - 18) { pdf.addPage(); return 16; }
    return curY;
  };

  // ════════════════════════════════════════════════════════════
  // PÁGINA 1
  // ════════════════════════════════════════════════════════════

  // ── CABECERA ──────────────────────────────────────────────────
  pdf.setFillColor(...NEGRO); pdf.rect(0,0,pw,30,'F');
  pdf.setFillColor(...ROJO);  pdf.rect(0,30,pw,2.5,'F');
  pdf.setFillColor(40,40,40); pdf.roundedRect(10,5,22,12,1.5,1.5,'F');
  pdf.setDrawColor(...BLANCO); pdf.setLineWidth(0.4);
  pdf.roundedRect(10,5,22,12,1.5,1.5,'S');
  pdf.setTextColor(...BLANCO); pdf.setFont('helvetica','bold'); pdf.setFontSize(9);
  pdf.text('SISE', 21, 12.5, {align:'center'});
  pdf.setTextColor(...ROJO); pdf.setFontSize(5);
  pdf.text('PORTAL SAES', 21, 21, {align:'center'});
  pdf.setTextColor(...BLANCO); pdf.setFont('helvetica','bold'); pdf.setFontSize(13);
  pdf.text('REPORTE MENSUAL BO - LLAMADAS', 38, 11);
  pdf.setTextColor(...ROJO); pdf.setFontSize(10);
  pdf.text(mesNombre.toUpperCase() + ' ' + anio, 38, 19);
  pdf.setTextColor(180,180,180); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
  pdf.text('Generado: ' + generado, pw-12, 18.5, {align:'right'});

  // ── META INFO ─────────────────────────────────────────────────
  const mY = 35;
  pdf.setFillColor(...GRIS1); pdf.rect(0,mY,pw,18,'F');
  pdf.setFillColor(...GRIS2); pdf.rect(0,mY+18,pw,0.4,'F');
  const meta = [
    {label:'Periodo',         val: mesNombre + ' ' + anio},
    {label:'Total dias',      val: dias.length + ' dias con registros'},
    {label:'Area',            val: 'BO - Seguimiento y Calidad'},
    {label:'Nivel de atencion', val: nivel + '%'},
  ];
  const mW = pw/4;
  meta.forEach((m,i) => {
    const mx = i*mW+6;
    if(i>0){ pdf.setDrawColor(...GRIS2); pdf.setLineWidth(0.3); pdf.line(i*mW,mY+3,i*mW,mY+15); }
    pdf.setTextColor(...ROJO); pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5);
    pdf.text(m.label, mx, mY+8.5);
    pdf.setTextColor(...GRIS4); pdf.setFont('helvetica','normal'); pdf.setFontSize(7);
    pdf.text(m.val, mx, mY+14);
  });

  // ── KPI CARDS ─────────────────────────────────────────────────
  let curY = mY + 24;
  curY = seccion('RESUMEN EJECUTIVO', curY);

  const kpis = [
    {label:'Total Casos',    val:String(total),      bg:NEGRO,  text:BLANCO,  bdr:NEGRO},
    {label:'Atendidas',      val:String(atendidas),  bg:VERDECL,text:VERDE,   bdr:VERDE},
    {label:'No Contesta',    val:String(noContesta), bg:ROJOCL, text:ROJO,    bdr:ROJO},
    {label:'Pendientes',     val:String(pendientes), bg:PURCL,  text:PURPURA, bdr:PURPURA},
    {label:'Nivel Atencion', val:nivel+'%',          bg:NEGRO,  text:BLANCO,  bdr:NEGRO},
  ];
  const kW = (pw-20-4*3)/5, kH = 22;
  kpis.forEach((k,i) => {
    const kx = 10+i*(kW+3);
    pdf.setFillColor(...k.bg); pdf.roundedRect(kx,curY,kW,kH,2,2,'F');
    pdf.setDrawColor(...k.bdr); pdf.setLineWidth(0.4); pdf.roundedRect(kx,curY,kW,kH,2,2,'S');
    pdf.setTextColor(...k.text); pdf.setFont('helvetica','bold'); pdf.setFontSize(15);
    pdf.text(k.val, kx+kW/2, curY+13.5, {align:'center'});
    pdf.setFont('helvetica','normal'); pdf.setFontSize(5.5);
    pdf.text(k.label, kx+kW/2, curY+19, {align:'center'});
  });
  curY += kH + 8;

  // ── GRÁFICA 1: BARRAS POR ESTADO ─────────────────────────────
  curY = seccion('DISTRIBUCION POR ESTADO', curY);
  const barData = [
    {label:'Atendidas',  val:atendidas,  color:VERDE,   pct: total>0?atendidas/total:0},
    {label:'No Contesta',val:noContesta, color:ROJO,    pct: total>0?noContesta/total:0},
    {label:'Pendientes', val:pendientes, color:PURPURA,  pct: total>0?pendientes/total:0},
  ];
  const bX=10, bY=curY, bH=32, bMaxW=pw-90;
  barData.forEach((b,i) => {
    const y = bY + i*12;
    // Label
    pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(...GRIS4);
    pdf.text(b.label, bX, y+5);
    // Barra fondo
    pdf.setFillColor(230,230,230); pdf.roundedRect(bX+38,y,bMaxW,7,1,1,'F');
    // Barra valor
    const bw = Math.max(b.pct*bMaxW, 2);
    pdf.setFillColor(...b.color); pdf.roundedRect(bX+38,y,bw,7,1,1,'F');
    // Valor y %
    pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(...b.color);
    pdf.text(b.val+' ('+Math.round(b.pct*100)+'%)', bX+38+bw+3, y+5.5);
  });
  curY += bH + 6;

  // ── GRÁFICA 2: BARRAS POR PRIORIDAD ──────────────────────────
  curY = seccion('DISTRIBUCION POR PRIORIDAD', curY);
  const prioData = [
    {label:'Alta',  val:alto,  color:ROJO,    pct:total>0?alto/total:0},
    {label:'Media', val:medio, color:NARANJA,  pct:total>0?medio/total:0},
    {label:'Baja',  val:bajo,  color:VERDE,    pct:total>0?bajo/total:0},
  ];
  prioData.forEach((b,i) => {
    const y = curY + i*11;
    pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(...GRIS4);
    pdf.text(b.label, bX, y+5);
    pdf.setFillColor(230,230,230); pdf.roundedRect(bX+28,y,bMaxW+10,7,1,1,'F');
    const bw = Math.max(b.pct*(bMaxW+10),2);
    pdf.setFillColor(...b.color); pdf.roundedRect(bX+28,y,bw,7,1,1,'F');
    pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(...b.color);
    pdf.text(b.val+' ('+Math.round(b.pct*100)+'%)', bX+28+bw+3, y+5.5);
  });
  curY += 40;

  // ── GRÁFICA 3: TENDENCIA DIARIA (línea simulada con barras) ──
  curY = nuevaPagina(curY, 60);
  curY = seccion('EVOLUCION DIARIA DE CASOS', curY);

  const maxDia = Math.max(...dias.map(d => porDia[d].total), 1);
  const grafW  = pw - 20;
  const grafH  = 45;
  const grafX  = 10;
  const grafY  = curY;
  const barW   = Math.min(grafW / Math.max(dias.length,1) - 1, 10);

  // Fondo del gráfico
  pdf.setFillColor(...GRIS1); pdf.rect(grafX,grafY,grafW,grafH,'F');
  pdf.setDrawColor(...GRIS2); pdf.setLineWidth(0.3); pdf.rect(grafX,grafY,grafW,grafH,'S');

  // Líneas de referencia
  [0.25,0.5,0.75,1].forEach(frac => {
    const ly = grafY + grafH - grafH*frac;
    pdf.setDrawColor(210,210,210); pdf.setLineWidth(0.2);
    pdf.line(grafX, ly, grafX+grafW, ly);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(5); pdf.setTextColor(...GRIS3);
    pdf.text(String(Math.round(maxDia*frac)), grafX-1, ly+1.5, {align:'right'});
  });

  // Barras por día
  dias.forEach((dia, i) => {
    const d = porDia[dia];
    const x  = grafX + 4 + i*(grafW-8)/Math.max(dias.length,1);
    const drawBar = (val, color, offsetH) => {
      const h = Math.max((val/maxDia)*grafH*0.9, 0.5);
      pdf.setFillColor(...color);
      pdf.rect(x, grafY+grafH-offsetH-h, barW/3, h, 'F');
    };
    drawBar(d.atendida||0, VERDE, 0);
    drawBar(d.no_contesta||0, ROJO, 0);
    drawBar(d.pendiente||0, PURPURA, 0);

    // Total encima
    pdf.setFont('helvetica','bold'); pdf.setFontSize(5); pdf.setTextColor(...GRIS4);
    pdf.text(String(d.total), x+barW/6, grafY+grafH-(d.total/maxDia*grafH*0.9)-1.5, {align:'center'});

    // Etiqueta día
    const dayNum = dia.split('-')[2];
    pdf.setFont('helvetica','normal'); pdf.setFontSize(5); pdf.setTextColor(...GRIS3);
    pdf.text(dayNum, x+barW/6, grafY+grafH+4, {align:'center'});
  });

  // Leyenda de la gráfica
  const leyY = grafY + grafH + 8;
  [[VERDE,'Atendidas'],[ROJO,'No contesta'],[PURPURA,'Pendientes']].forEach(([c,l],i) => {
    const lx = grafX + i*50;
    pdf.setFillColor(...c); pdf.rect(lx,leyY,4,3,'F');
    pdf.setFont('helvetica','normal'); pdf.setFontSize(6); pdf.setTextColor(...GRIS4);
    pdf.text(l, lx+6, leyY+2.5);
  });
  curY = leyY + 12;

  // ── GRÁFICA 4: RANKING DE ASESORES ───────────────────────────
  curY = nuevaPagina(curY, 60);
  curY = seccion('RANKING DE ASESORES WSP', curY);

  const asesoresList = Object.entries(porAsesor)
    .sort((a,b) => b[1].total - a[1].total)
    .slice(0, 8);

  const maxAsesor = Math.max(...asesoresList.map(([,v])=>v.total), 1);
  asesoresList.forEach(([nombre, vals], i) => {
    const y   = curY + i*11;
    const pct = vals.total / maxAsesor;
    const nivelAse = vals.total>0 ? Math.round((vals.atendida||0)/vals.total*100) : 0;

    pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5); pdf.setTextColor(...GRIS4);
    pdf.text((i+1)+'. '+nombre, bX, y+5);

    // Barra fondo
    pdf.setFillColor(230,230,230); pdf.roundedRect(bX+42,y,bMaxW-4,7,1,1,'F');
    // Barra verde atendidas
    if((vals.atendida||0)>0){
      const bw = Math.max((vals.atendida/maxAsesor)*(bMaxW-4),1);
      pdf.setFillColor(...VERDE); pdf.roundedRect(bX+42,y,bw,7,1,1,'F');
    }
    // Barra roja no contesta encima
    if((vals.no_contesta||0)>0){
      const bwA = (vals.atendida||0)/maxAsesor*(bMaxW-4);
      const bwR = Math.max((vals.no_contesta/maxAsesor)*(bMaxW-4),1);
      pdf.setFillColor(...ROJO); pdf.roundedRect(bX+42+bwA,y,bwR,7,0,0,'F');
    }

    // Texto valores
    pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5); pdf.setTextColor(...GRIS4);
    pdf.text('Total:'+vals.total+'  Ate:'+nivelAse+'%', bX+42+pct*(bMaxW-4)+5, y+5.5);
  });
  curY += asesoresList.length * 11 + 8;

  // ── TABLA RESUMEN DIARIO ──────────────────────────────────────
  curY = nuevaPagina(curY, 50);
  curY = seccion('RESUMEN POR DIA', curY);

  pdf.autoTable({
    startY: curY,
    head: [['Fecha','Total','Atendidas','No Contesta','Pendientes','% Atencion']],
    body: dias.map(dia => {
      const d = porDia[dia];
      const pctDia = d.total>0 ? Math.round((d.atendida||0)/d.total*100) : 0;
      const [y,m,dd] = dia.split('-');
      return [dd+'/'+m+'/'+y, d.total, d.atendida||0, d.no_contesta||0, d.pendiente||0, pctDia+'%'];
    }),
    styles:{font:'helvetica',fontSize:7.5,cellPadding:{top:3,bottom:3,left:3,right:3},lineColor:GRIS2,lineWidth:0.2,textColor:GRIS4},
    headStyles:{fillColor:NEGRO,textColor:BLANCO,fontStyle:'bold',fontSize:7.5},
    columnStyles:{
      0:{cellWidth:28},1:{cellWidth:16,halign:'center'},2:{cellWidth:22,halign:'center'},
      3:{cellWidth:25,halign:'center'},4:{cellWidth:22,halign:'center'},5:{cellWidth:22,halign:'center'},
    },
    alternateRowStyles:{fillColor:[249,249,249]},
    margin:{left:10,right:10},
    didDrawCell:(hk)=>{
      if(hk.section!=='body') return;
      if(hk.column.index===5){
        const pctVal = parseInt(hk.cell.raw)||0;
        const color = pctVal>=70 ? VERDE : pctVal>=40 ? NARANJA : ROJO;
        const isAlt = hk.row.index%2===1;
        pdf.setFillColor(isAlt?249:255,isAlt?249:255,isAlt?249:255);
        pdf.rect(hk.cell.x+0.2,hk.cell.y+0.2,hk.cell.width-0.4,hk.cell.height-0.4,'F');
        pdf.setTextColor(...color); pdf.setFont('helvetica','bold'); pdf.setFontSize(7.5);
        pdf.text(hk.cell.raw, hk.cell.x+hk.cell.width/2, hk.cell.y+hk.cell.height/2+2.5, {align:'center'});
      }
    }
  });
  curY = (pdf.lastAutoTable&&pdf.lastAutoTable.finalY) ? pdf.lastAutoTable.finalY+8 : curY+40;

  // ── TABLA DETALLE COMPLETO ────────────────────────────────────
  curY = nuevaPagina(curY, 40);
  curY = seccion('DETALLE COMPLETO DE LLAMADAS', curY);

  const prioStr = p => p?p.charAt(0).toUpperCase()+p.slice(1):'Medio';
  const estStr  = e => e==='atendida'?'Atendida':e==='no_contesta'?'No contesta':'Pendiente';

  pdf.autoTable({
    startY: curY,
    head: [['#','Fecha','Alumno','Codigo','Asesor WSP','Prioridad','Estado','Motivo']],
    body: data.map((r,i)=>[
      i+1,
      fmtDate(r.fechaRegistro||''),
      (r.nombre||'-').toUpperCase(),
      r.codigo||'-',
      r.asesorWsp||'-',
      prioStr(r.prioridad),
      estStr(r.estadoLlamada),
      r.motivo||'-',
    ]),
    styles:{font:'helvetica',fontSize:6.5,cellPadding:{top:2.5,bottom:2.5,left:3,right:3},lineColor:GRIS2,lineWidth:0.2,overflow:'linebreak',textColor:GRIS4},
    headStyles:{fillColor:NEGRO,textColor:BLANCO,fontStyle:'bold',fontSize:7},
    columnStyles:{
      0:{cellWidth:6,halign:'center'},1:{cellWidth:18},2:{cellWidth:26},
      3:{cellWidth:14},4:{cellWidth:18},5:{cellWidth:14},6:{cellWidth:18},7:{cellWidth:'auto'},
    },
    alternateRowStyles:{fillColor:[249,249,249]},
    margin:{left:10,right:10},
    didDrawCell:(hk)=>{
      if(hk.section!=='body') return;
      if(hk.column.index===6){
        const val=hk.cell.raw;
        const cx=hk.cell.x+1.5,cy=hk.cell.y+1.5,cw=hk.cell.width-3,ch=hk.cell.height-3;
        if(val==='Atendida'){pdf.setFillColor(...VERDECL);pdf.roundedRect(cx,cy,cw,ch,1,1,'F');pdf.setTextColor(...VERDE);}
        else if(val==='No contesta'){pdf.setFillColor(...ROJOCL);pdf.roundedRect(cx,cy,cw,ch,1,1,'F');pdf.setTextColor(...ROJO);}
        else{pdf.setFillColor(...PURCL);pdf.roundedRect(cx,cy,cw,ch,1,1,'F');pdf.setTextColor(...PURPURA);}
        pdf.setFontSize(6); pdf.setFont('helvetica','bold');
        pdf.text(val, cx+cw/2, cy+ch/2+2, {align:'center'});
      }
      if(hk.column.index===5){
        const val=(hk.cell.raw||'').toLowerCase();
        const cx=hk.cell.x+1.5,cy=hk.cell.y+1.5,cw=hk.cell.width-3,ch=hk.cell.height-3;
        if(val==='alto'){pdf.setFillColor(...ROJOCL);pdf.roundedRect(cx,cy,cw,ch,1,1,'F');pdf.setTextColor(...ROJO);}
        else if(val==='bajo'){pdf.setFillColor(...VERDECL);pdf.roundedRect(cx,cy,cw,ch,1,1,'F');pdf.setTextColor(...VERDE);}
        else{pdf.setFillColor(...NARCL);pdf.roundedRect(cx,cy,cw,ch,1,1,'F');pdf.setTextColor(...NARANJA);}
        pdf.setFontSize(6); pdf.setFont('helvetica','bold');
        pdf.text(hk.cell.raw||'', cx+cw/2, cy+ch/2+2, {align:'center'});
      }
    }
  });

  // ── FOOTER ────────────────────────────────────────────────────
  const pgs = pdf.internal.getNumberOfPages();
  for(let i=1;i<=pgs;i++){
    pdf.setPage(i);
    pdf.setFillColor(...GRIS1); pdf.rect(0,ph-13,pw,13,'F');
    pdf.setFillColor(...ROJO);  pdf.rect(0,ph-13,pw,0.8,'F');
    pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(...GRIS3);
    pdf.text('Documento de uso interno y confidencial', 13, ph-7.5);
    pdf.text('SISE - Portal SAES', 13, ph-3.5);
    pdf.setTextColor(...ROJO); pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5);
    pdf.text('REPORTE MENSUAL - ' + mesNombre.toUpperCase() + ' ' + anio, pw/2, ph-5.5, {align:'center'});
    pdf.setTextColor(...GRIS3); pdf.setFont('helvetica','normal');
    pdf.text('Pagina ' + i + ' de ' + pgs, pw-12, ph-5.5, {align:'right'});
  }

  pdf.save('ReporteMensualBO_' + mesNombre + '_' + anio + '.pdf');
  showToast('Reporte mensual descargado ✓');
});

// ══════════════════════════════════════════════════════════════════
// REPORTE MENSUAL — CASOS PENDIENTES
// ══════════════════════════════════════════════════════════════════
document.getElementById('btn-pend-export-mensual').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  if (!allPendientes || !allPendientes.length) { showToast('No hay datos para generar el reporte', 'error'); return; }

  const ref   = pendViewDay;
  const mes   = ref.getMonth();
  const anio  = ref.getFullYear();
  const MESES_N = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesNombre = MESES_N[mes];
  const generado  = new Date().toLocaleDateString('es-PE');

  const data = allPendientes.filter(r => {
    const f = r.fechaRegistro || r.fecha || '';
    if (!f) return false;
    const parts = f.split('-');
    return parseInt(parts[0]) === anio && parseInt(parts[1]) - 1 === mes;
  });

  if (!data.length) { showToast('No hay casos en ' + mesNombre + ' ' + anio, 'error'); return; }

  const total     = data.length;
  const resueltos  = data.filter(r=>r.resuelto).length;
  const pendientes = data.filter(r=>!r.resuelto).length;
  const alertados  = data.filter(r=>r.alertado).length;
  const sinAlertar = data.filter(r=>!r.alertado&&!r.resuelto).length;

  const porDia = {};
  data.forEach(r => {
    const f = r.fechaRegistro || r.fecha || '';
    if(!porDia[f]) porDia[f] = {total:0,resuelto:0,pendiente:0,alertado:0};
    porDia[f].total++;
    if(r.resuelto) porDia[f].resuelto++;
    else porDia[f].pendiente++;
    if(r.alertado) porDia[f].alertado++;
  });
  const dias = Object.keys(porDia).sort();

  const porAsesor = {};
  data.forEach(r => {
    const a = r.asesor || 'Sin asignar';
    if(!porAsesor[a]) porAsesor[a] = {total:0,resuelto:0,alertado:0};
    porAsesor[a].total++;
    if(r.resuelto) porAsesor[a].resuelto++;
    if(r.alertado) porAsesor[a].alertado++;
  });

  const NEGRO=[13,13,13],ROJO=[196,30,58],ROJOCL=[255,235,238],BLANCO=[255,255,255];
  const GRIS1=[245,245,245],GRIS2=[220,220,220],GRIS3=[140,140,140],GRIS4=[60,60,60];
  const VERDE=[26,122,69],VERDECL=[232,250,240];
  const NARANJA=[234,140,0],NARCL=[255,243,220];
  const PURPURA=[91,33,182],PURCL=[245,240,255];

  const pdf = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const pw=pdf.internal.pageSize.width, ph=pdf.internal.pageSize.height;

  const lineaRoja=(x,y,w)=>{pdf.setFillColor(...ROJO);pdf.rect(x,y,w,0.7,'F');};
  const seccion=(texto,y)=>{
    pdf.setFillColor(...NEGRO); pdf.roundedRect(10,y,3.5,8,0.8,0.8,'F');
    pdf.setTextColor(...NEGRO); pdf.setFont('helvetica','bold'); pdf.setFontSize(10);
    pdf.text(texto, 16.5, y+5.8);
    lineaRoja(10, y+10, pw-20);
    return y+15;
  };
  const nuevaPagina=(curY,needed)=>{
    if(curY+needed>ph-18){pdf.addPage();return 16;}
    return curY;
  };

  // CABECERA
  pdf.setFillColor(...NEGRO); pdf.rect(0,0,pw,30,'F');
  pdf.setFillColor(...ROJO);  pdf.rect(0,30,pw,2.5,'F');
  pdf.setFillColor(40,40,40); pdf.roundedRect(10,5,22,12,1.5,1.5,'F');
  pdf.setDrawColor(...BLANCO); pdf.setLineWidth(0.4); pdf.roundedRect(10,5,22,12,1.5,1.5,'S');
  pdf.setTextColor(...BLANCO); pdf.setFont('helvetica','bold'); pdf.setFontSize(9);
  pdf.text('SISE', 21, 12.5, {align:'center'});
  pdf.setTextColor(...ROJO); pdf.setFontSize(5);
  pdf.text('PORTAL SAES', 21, 21, {align:'center'});
  pdf.setTextColor(...BLANCO); pdf.setFont('helvetica','bold'); pdf.setFontSize(13);
  pdf.text('REPORTE MENSUAL - CASOS PENDIENTES', 38, 11);
  pdf.setTextColor(...ROJO); pdf.setFontSize(10);
  pdf.text(mesNombre.toUpperCase() + ' ' + anio, 38, 19);
  pdf.setTextColor(180,180,180); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
  pdf.text('Generado: ' + generado, pw-12, 18.5, {align:'right'});

  // META INFO
  const mY=35;
  pdf.setFillColor(...GRIS1); pdf.rect(0,mY,pw,18,'F');
  pdf.setFillColor(...GRIS2); pdf.rect(0,mY+18,pw,0.4,'F');
  const tasaRe = total>0 ? Math.round(resueltos/total*100) : 0;
  const meta=[
    {label:'Periodo',         val:mesNombre+' '+anio},
    {label:'Dias con casos',  val:dias.length+' dias registrados'},
    {label:'Area',            val:'Seguimiento y Calidad - BO'},
    {label:'Tasa resolucion', val:tasaRe+'%'},
  ];
  const mW=pw/4;
  meta.forEach((m,i)=>{
    const mx=i*mW+6;
    if(i>0){pdf.setDrawColor(...GRIS2);pdf.setLineWidth(0.3);pdf.line(i*mW,mY+3,i*mW,mY+15);}
    pdf.setTextColor(...ROJO); pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5);
    pdf.text(m.label, mx, mY+8.5);
    pdf.setTextColor(...GRIS4); pdf.setFont('helvetica','normal'); pdf.setFontSize(7);
    pdf.text(m.val, mx, mY+14);
  });

  // KPI CARDS
  let curY = mY+24;
  curY = seccion('RESUMEN EJECUTIVO', curY);
  const kpis=[
    {label:'Total Casos',   val:String(total),     bg:NEGRO,  text:BLANCO,  bdr:NEGRO},
    {label:'Resueltos',     val:String(resueltos),  bg:VERDECL,text:VERDE,   bdr:VERDE},
    {label:'Pendientes',    val:String(pendientes), bg:ROJOCL, text:ROJO,    bdr:ROJO},
    {label:'Alertados',     val:String(alertados),  bg:PURCL,  text:PURPURA, bdr:PURPURA},
    {label:'Sin gestionar', val:String(sinAlertar), bg:NARCL,  text:NARANJA, bdr:NARANJA},
  ];
  const kW=(pw-20-4*3)/5, kH=22;
  kpis.forEach((k,i)=>{
    const kx=10+i*(kW+3);
    pdf.setFillColor(...k.bg); pdf.roundedRect(kx,curY,kW,kH,2,2,'F');
    pdf.setDrawColor(...k.bdr); pdf.setLineWidth(0.4); pdf.roundedRect(kx,curY,kW,kH,2,2,'S');
    pdf.setTextColor(...k.text); pdf.setFont('helvetica','bold'); pdf.setFontSize(15);
    pdf.text(k.val, kx+kW/2, curY+13.5, {align:'center'});
    pdf.setFont('helvetica','normal'); pdf.setFontSize(5.5);
    pdf.text(k.label, kx+kW/2, curY+19, {align:'center'});
  });
  curY += kH+8;

  // GRAFICA ESTADO
  curY = seccion('DISTRIBUCION POR ESTADO', curY);
  const bX=10, bMaxW=pw-90;
  [
    {label:'Resueltos',     val:resueltos,  color:VERDE},
    {label:'Pendientes',    val:pendientes, color:ROJO},
    {label:'Alertados',     val:alertados,  color:PURPURA},
    {label:'Sin gestionar', val:sinAlertar, color:NARANJA},
  ].forEach((b,i)=>{
    const y=curY+i*11;
    const pct=total>0?b.val/total:0;
    pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(...GRIS4);
    pdf.text(b.label, bX, y+5);
    pdf.setFillColor(230,230,230); pdf.roundedRect(bX+36,y,bMaxW+4,7,1,1,'F');
    const bw=Math.max(pct*(bMaxW+4),2);
    pdf.setFillColor(...b.color); pdf.roundedRect(bX+36,y,bw,7,1,1,'F');
    pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(...b.color);
    pdf.text(b.val+' ('+Math.round(pct*100)+'%)', bX+36+bw+3, y+5.5);
  });
  curY += 52;

  // GRAFICA EVOLUCION DIARIA
  curY = nuevaPagina(curY, 65);
  curY = seccion('EVOLUCION DIARIA', curY);
  const maxDia=Math.max(...dias.map(d=>porDia[d].total),1);
  const grafW=pw-20, grafH=45, grafX=10, grafY=curY;
  pdf.setFillColor(...GRIS1); pdf.rect(grafX,grafY,grafW,grafH,'F');
  pdf.setDrawColor(...GRIS2); pdf.setLineWidth(0.3); pdf.rect(grafX,grafY,grafW,grafH,'S');
  [0.25,0.5,0.75,1].forEach(frac=>{
    const ly=grafY+grafH-grafH*frac;
    pdf.setDrawColor(210,210,210); pdf.setLineWidth(0.2); pdf.line(grafX,ly,grafX+grafW,ly);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(5); pdf.setTextColor(...GRIS3);
    pdf.text(String(Math.round(maxDia*frac)), grafX-1, ly+1.5, {align:'right'});
  });
  const barW2=Math.min((grafW-8)/Math.max(dias.length,1)-1,12);
  dias.forEach((dia,i)=>{
    const dd=porDia[dia];
    const x=grafX+4+i*(grafW-8)/Math.max(dias.length,1);
    [[dd.resuelto||0,VERDE],[dd.pendiente||0,ROJO]].forEach(([val,color],j)=>{
      const h=Math.max((val/maxDia)*grafH*0.9,0.5);
      pdf.setFillColor(...color);
      pdf.rect(x+j*(barW2/2), grafY+grafH-h, barW2/2, h, 'F');
    });
    pdf.setFont('helvetica','bold'); pdf.setFontSize(5); pdf.setTextColor(...GRIS4);
    pdf.text(String(dd.total), x+barW2/2, grafY+grafH-(dd.total/maxDia*grafH*0.9)-1.5, {align:'center'});
    const dNum=dia.split('-')[2];
    pdf.setFont('helvetica','normal'); pdf.setFontSize(5); pdf.setTextColor(...GRIS3);
    pdf.text(dNum, x+barW2/2, grafY+grafH+4, {align:'center'});
  });
  const leyY=grafY+grafH+8;
  [[VERDE,'Resueltos'],[ROJO,'Pendientes']].forEach(([c,l],i)=>{
    const lx=grafX+i*45;
    pdf.setFillColor(...c); pdf.rect(lx,leyY,4,3,'F');
    pdf.setFont('helvetica','normal'); pdf.setFontSize(6); pdf.setTextColor(...GRIS4);
    pdf.text(l, lx+6, leyY+2.5);
  });
  curY = leyY+12;

  // RANKING ASESORES
  curY = nuevaPagina(curY, 60);
  curY = seccion('RANKING DE ASESORES', curY);
  const asesores=Object.entries(porAsesor).sort((a,b)=>b[1].total-a[1].total).slice(0,8);
  const maxAse=Math.max(...asesores.map(([,v])=>v.total),1);
  asesores.forEach(([nombre,vals],i)=>{
    const y=curY+i*11;
    const pct=vals.total/maxAse;
    const tasa=vals.total>0?Math.round(vals.resuelto/vals.total*100):0;
    pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5); pdf.setTextColor(...GRIS4);
    pdf.text((i+1)+'. '+nombre, bX, y+5);
    pdf.setFillColor(230,230,230); pdf.roundedRect(bX+42,y,bMaxW-4,7,1,1,'F');
    const bwTot=Math.max(pct*(bMaxW-4),2);
    pdf.setFillColor(...ROJO); pdf.roundedRect(bX+42,y,bwTot,7,1,1,'F');
    if(vals.resuelto>0){
      const bwR=Math.max((vals.resuelto/maxAse)*(bMaxW-4),1);
      pdf.setFillColor(...VERDE); pdf.roundedRect(bX+42,y,bwR,7,1,1,'F');
    }
    pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5); pdf.setTextColor(...GRIS4);
    pdf.text('Total:'+vals.total+'  Resueltos:'+tasa+'%', bX+42+bwTot+5, y+5.5);
  });
  curY += asesores.length*11+8;

  // TABLA RESUMEN DIARIO
  curY = nuevaPagina(curY, 50);
  curY = seccion('RESUMEN POR DIA', curY);
  pdf.autoTable({
    startY:curY,
    head:[['Fecha','Total','Resueltos','Pendientes','Alertados','% Resolucion']],
    body:dias.map(dia=>{
      const d=porDia[dia];
      const pctDia=d.total>0?Math.round(d.resuelto/d.total*100):0;
      const [y,m,dd]=dia.split('-');
      return [dd+'/'+m+'/'+y, d.total, d.resuelto||0, d.pendiente||0, d.alertado||0, pctDia+'%'];
    }),
    styles:{font:'helvetica',fontSize:7.5,cellPadding:{top:3,bottom:3,left:3,right:3},lineColor:GRIS2,lineWidth:0.2,textColor:GRIS4},
    headStyles:{fillColor:NEGRO,textColor:BLANCO,fontStyle:'bold',fontSize:7.5},
    columnStyles:{0:{cellWidth:28},1:{cellWidth:16,halign:'center'},2:{cellWidth:22,halign:'center'},3:{cellWidth:22,halign:'center'},4:{cellWidth:20,halign:'center'},5:{cellWidth:26,halign:'center'}},
    alternateRowStyles:{fillColor:[249,249,249]},
    margin:{left:10,right:10},
    didDrawCell:(hk)=>{
      if(hk.section!=='body'||hk.column.index!==5) return;
      const v=parseInt(hk.cell.raw)||0;
      const c=v>=70?VERDE:v>=40?NARANJA:ROJO;
      const isAlt=hk.row.index%2===1;
      pdf.setFillColor(isAlt?249:255,isAlt?249:255,isAlt?249:255);
      pdf.rect(hk.cell.x+0.2,hk.cell.y+0.2,hk.cell.width-0.4,hk.cell.height-0.4,'F');
      pdf.setTextColor(...c); pdf.setFont('helvetica','bold'); pdf.setFontSize(7.5);
      pdf.text(hk.cell.raw, hk.cell.x+hk.cell.width/2, hk.cell.y+hk.cell.height/2+2.5, {align:'center'});
    }
  });
  curY=(pdf.lastAutoTable&&pdf.lastAutoTable.finalY)?pdf.lastAutoTable.finalY+8:curY+40;

  // TABLA DETALLE COMPLETO
  curY = nuevaPagina(curY, 40);
  curY = seccion('DETALLE COMPLETO DE CASOS', curY);
  pdf.autoTable({
    startY:curY,
    head:[['#','Fecha Reg.','Caso desde','N Caso','Descripcion','Asesor','Estado','Alertado']],
    body:data.sort((a,b)=>(a.fechaRegistro||a.fecha)<(b.fechaRegistro||b.fecha)?-1:1).map((r,i)=>[
      i+1,
      fmtDate(r.fechaRegistro||r.fecha||''),
      fmtDate(r.fechaCaso||''),
      r.numeroCaso||'-',
      r.descripcion||'-',
      r.asesor||'-',
      r.resuelto?'Resuelto':'Pendiente',
      r.alertado?'Si':'No',
    ]),
    styles:{font:'helvetica',fontSize:6.5,cellPadding:{top:2.5,bottom:2.5,left:3,right:3},lineColor:GRIS2,lineWidth:0.2,overflow:'linebreak',textColor:GRIS4},
    headStyles:{fillColor:NEGRO,textColor:BLANCO,fontStyle:'bold',fontSize:7},
    columnStyles:{0:{cellWidth:6,halign:'center'},1:{cellWidth:18},2:{cellWidth:18},3:{cellWidth:18},4:{cellWidth:'auto'},5:{cellWidth:22},6:{cellWidth:16},7:{cellWidth:12,halign:'center'}},
    alternateRowStyles:{fillColor:[249,249,249]},
    margin:{left:10,right:10},
    didDrawCell:(hk)=>{
      if(hk.section!=='body'||hk.column.index!==6) return;
      const val=hk.cell.raw;
      const cx=hk.cell.x+1.5,cy=hk.cell.y+1.5,cw=hk.cell.width-3,ch=hk.cell.height-3;
      if(val==='Resuelto'){pdf.setFillColor(...VERDECL);pdf.roundedRect(cx,cy,cw,ch,1,1,'F');pdf.setTextColor(...VERDE);}
      else{pdf.setFillColor(...ROJOCL);pdf.roundedRect(cx,cy,cw,ch,1,1,'F');pdf.setTextColor(...ROJO);}
      pdf.setFontSize(6); pdf.setFont('helvetica','bold');
      pdf.text(val, cx+cw/2, cy+ch/2+2, {align:'center'});
    }
  });

  // FOOTER
  const pgs=pdf.internal.getNumberOfPages();
  for(let i=1;i<=pgs;i++){
    pdf.setPage(i);
    pdf.setFillColor(...GRIS1); pdf.rect(0,ph-13,pw,13,'F');
    pdf.setFillColor(...ROJO);  pdf.rect(0,ph-13,pw,0.8,'F');
    pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(...GRIS3);
    pdf.text('Documento de uso interno y confidencial', 13, ph-7.5);
    pdf.text('SISE - Portal SAES', 13, ph-3.5);
    pdf.setTextColor(...ROJO); pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5);
    pdf.text('REPORTE MENSUAL - CASOS PENDIENTES - '+mesNombre.toUpperCase()+' '+anio, pw/2, ph-5.5, {align:'center'});
    pdf.setTextColor(...GRIS3); pdf.setFont('helvetica','normal');
    pdf.text('Pagina '+i+' de '+pgs, pw-12, ph-5.5, {align:'right'});
  }

  pdf.save('ReporteMensualPendientes_' + mesNombre + '_' + anio + '.pdf');
  showToast('Reporte mensual descargado \u2713');
});


// ══════════════════════════════════════════════════════
// TIP DEL ASESOR — popup cada 3 horas (solo rol Asesor)
// ══════════════════════════════════════════════════════
(function() {
  const TIPS = [
    { icon:"ti-coffee",        cat:"Bienestar",    txt:"Tómate un break de 5 minutos y ve al baño cuando lo necesites. No esperes a estar incómodo." },
    { icon:"ti-book",          cat:"Atención",     txt:"Lee todo el mensaje antes de responder. Muchas incidencias se resuelven entendiendo bien el contexto." },
    { icon:"ti-mood-happy",    cat:"Actitud",      txt:"No respondas en caliente. Si el estudiante está molesto, mantén siempre la calma." },
    { icon:"ti-template",      cat:"Herramientas", txt:"Utiliza plantillas, pero personalízalas. Evita que parezcan respuestas automáticas." },
    { icon:"ti-pencil",        cat:"Calidad",      txt:"Revisa la ortografía antes de enviar. Una buena redacción transmite profesionalismo." },
    { icon:"ti-brain",         cat:"Eficiencia",   txt:"Aprende los procedimientos más frecuentes de memoria. Ahorrarás mucho tiempo." },
    { icon:"ti-device-laptop", cat:"Enfoque",      txt:"Mantén abiertas solo las pestañas necesarias. Menos distracciones, más velocidad." },
    { icon:"ti-keyboard",      cat:"Productividad",txt:"Usa atajos de teclado. Te harán ganar minutos todos los días." },
    { icon:"ti-hand-stop",     cat:"Compromiso",   txt:"No prometas algo que no depende de ti. Indica siempre los plazos y procesos reales." },
    { icon:"ti-ear",           cat:"Escucha",      txt:"Confirma que entendiste la consulta antes de responder." },
    { icon:"ti-checklist",     cat:"Organización", txt:"Organiza tus casos pendientes. Lleva un control de seguimientos y escalamientos." },
    { icon:"ti-heart",         cat:"Empatía",      txt:"Mantén una actitud empática. Un estudiante frustrado suele calmarse cuando se siente escuchado." },
    { icon:"ti-armchair",      cat:"Bienestar",    txt:"No descuides tu postura. Pasar horas frente a la computadora puede afectar tu espalda." },
    { icon:"ti-droplet",       cat:"Bienestar",    txt:"Ten agua cerca. La hidratación ayuda a mantener la concentración." },
    { icon:"ti-help-circle",   cat:"Aprendizaje",  txt:"Pregunta cuando tengas dudas. Es mejor consultar que brindar información incorrecta." },
    { icon:"ti-news",          cat:"Información",  txt:"Lee los comunicados internos diariamente. Muchos errores ocurren por desconocer actualizaciones." },
    { icon:"ti-flag",          cat:"Mentalidad",   txt:"No te obsesiones con los casos difíciles. Haz la gestión correcta y continúa." },
    { icon:"ti-school",        cat:"Crecimiento",  txt:"Aprovecha los tiempos bajos para capacitarte. Aprende nuevos procesos y herramientas." },
    { icon:"ti-users",         cat:"Equipo",       txt:"Mantén una buena relación con coordinadores y compañeros. Te ayudarán a resolver casos complejos más rápido." },
    { icon:"ti-star",          cat:"Propósito",    txt:"Recuerda que detrás de cada chat hay una persona. Trata a cada estudiante como te gustaría que te atendieran a ti." },
  ];

  let tipIdx = Math.floor(Math.random() * TIPS.length);

  // ── Estilos ───────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #tip-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 99999;
      opacity: 0; transition: opacity 0.3s;
      pointer-events: none;
    }
    #tip-overlay.visible { opacity: 1; pointer-events: all; }

    #tip-card {
      width: 420px; max-width: calc(100vw - 32px);
      background: #fff;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06);
      transform: translateY(28px) scale(0.96);
      transition: transform 0.38s cubic-bezier(.22,.68,0,1.2);
    }
    #tip-overlay.visible #tip-card { transform: translateY(0) scale(1); }

    /* Cabecera negra SISE */
    #tip-head {
      background: #0D0D0D;
      padding: 20px 24px 18px;
      display: flex; align-items: center; gap: 16px;
      position: relative;
    }
    #tip-head::after {
      content: '';
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, #C41E3A, #ff6b6b);
    }
    #tip-logo-box {
      width: 48px; height: 48px; border-radius: 14px;
      background: #fff;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      font-weight: 900; font-size: 13px; color: #0D0D0D;
      letter-spacing: -0.5px; font-family: inherit;
      line-height: 1;
      flex-direction: column; gap: 0;
    }
    #tip-logo-box span.logo-sise { font-size: 14px; font-weight: 900; color:#0D0D0D; }
    #tip-logo-box span.logo-sub  { font-size: 7px;  font-weight: 700; color:#C41E3A; letter-spacing:0.05em; }
    #tip-head-text { flex: 1; min-width: 0; }
    #tip-label {
      font-size: 10px; font-weight: 800; letter-spacing: 0.12em;
      color: #C41E3A; text-transform: uppercase; margin-bottom: 3px;
    }
    #tip-title {
      font-size: 17px; font-weight: 800; color: #fff;
      line-height: 1.2; margin-bottom: 2px;
    }
    #tip-counter { font-size: 11px; color: rgba(255,255,255,0.45); }

    /* Barra de progreso */
    #tip-prog-wrap {
      background: #0D0D0D;
      padding: 0 24px 14px;
      display: flex; gap: 3px;
    }
    .tip-prog-seg {
      flex: 1; height: 3px; border-radius: 99px;
      background: rgba(255,255,255,0.12);
      transition: background 0.3s;
    }
    .tip-prog-seg.done   { background: rgba(196,30,58,0.5); }
    .tip-prog-seg.active { background: #C41E3A; }

    /* Categoría badge */
    #tip-cat-row {
      padding: 18px 24px 0;
      display: flex; align-items: center; gap: 8px;
    }
    #tip-cat-icon-wrap {
      width: 36px; height: 36px; border-radius: 10px;
      background: #C41E3A;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    #tip-cat-icon-wrap i { font-size: 18px; color: #fff; }
    #tip-cat-badge {
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase;
      background: #fff0f3; color: #C41E3A;
      border: 1px solid rgba(196,30,58,0.2);
      border-radius: 99px; padding: 3px 10px;
    }

    /* Texto del tip */
    #tip-body {
      margin: 14px 24px 20px;
      padding: 18px 20px;
      background: #fafafa;
      border: 1px solid #f0f0f0;
      border-left: 4px solid #C41E3A;
      border-radius: 0 14px 14px 0;
      font-size: 15px; line-height: 1.7;
      color: #1a1a1a; font-weight: 500;
    }

    /* Footer */
    #tip-footer {
      padding: 0 24px 24px;
      display: flex; gap: 10px;
    }
    #tip-btn-next {
      flex: 1; padding: 12px 0;
      border-radius: 12px;
      font-size: 13px; font-weight: 700;
      cursor: pointer;
      background: #f5f5f5; color: #333;
      border: 1.5px solid #e5e5e5;
      transition: all 0.18s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    #tip-btn-next:hover { background: #eee; border-color: #ccc; }
    #tip-btn-close {
      flex: 1.4; padding: 12px 0;
      border-radius: 12px;
      font-size: 13px; font-weight: 700;
      cursor: pointer;
      background: #C41E3A; color: #fff;
      border: none;
      transition: all 0.18s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    #tip-btn-close:hover { background: #a01830; }
  `;
  document.head.appendChild(style);

  // ── Markup ────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'tip-overlay';
  overlay.innerHTML = `
    <div id="tip-card">
      <div id="tip-head">
        <div id="tip-logo-box">
          <span class="logo-sise">SISE</span>
          <span class="logo-sub">SAES</span>
        </div>
        <div id="tip-head-text">
          <div id="tip-label">Consejo del día</div>
          <div id="tip-title">Para ti, asesor</div>
          <div id="tip-counter">Tip 1 de ${TIPS.length}</div>
        </div>
      </div>
      <div id="tip-prog-wrap">
        ${TIPS.map((_,i) => `<div class="tip-prog-seg" id="tps${i}"></div>`).join('')}
      </div>
      <div id="tip-cat-row">
        <div id="tip-cat-icon-wrap"><i id="tip-cat-icon" class="ti ti-star"></i></div>
        <span id="tip-cat-badge">Categoría</span>
      </div>
      <div id="tip-body"></div>
      <div id="tip-footer">
        <button id="tip-btn-close" style="flex:1"><i class="ti ti-check" style="font-size:14px"></i> Entendido</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  function renderTip() {
    const t = TIPS[tipIdx];
    document.getElementById('tip-body').textContent     = t.txt;
    document.getElementById('tip-cat-icon').className   = 'ti ' + t.icon;
    document.getElementById('tip-cat-badge').textContent= t.cat;
    document.getElementById('tip-counter').textContent  = 'Tip ' + (tipIdx+1) + ' de ' + TIPS.length;
    TIPS.forEach((_,i) => {
      const seg = document.getElementById('tps'+i);
      if (!seg) return;
      seg.className = 'tip-prog-seg' + (i < tipIdx ? ' done' : i === tipIdx ? ' active' : '');
    });
  }

  function showTip() {
    const rol = (window.currentUserRol || '').toLowerCase();
    if (rol && rol !== 'asesor' && rol !== 'asesor wsp') return;
    renderTip();
    overlay.classList.add('visible');
  }

  function hideTip()  { overlay.classList.remove('visible'); }

  function nextTip()  {
    tipIdx = (tipIdx + 1) % TIPS.length;
    renderTip();
  }

  document.getElementById('tip-btn-close').addEventListener('click', hideTip);
  const tipBtnNext = document.getElementById('tip-btn-next');
  if (tipBtnNext) tipBtnNext.addEventListener('click', nextTip);
  overlay.addEventListener('click', e => { if (e.target === overlay) hideTip(); });

  function iniciarTimer() {
    const rol = (window.currentUserRol || '').toLowerCase();
    if (rol && rol !== 'asesor' && rol !== 'asesor wsp') return;

    // Tips a las 9:00, 11:00, 17:00, 19:30 — solo 4 al día
    const HORAS_TIP  = [[9,0],[11,0],[17,0],[19,30]];
    const MIN_LIMITE = 19 * 60 + 30; // 19:30

    function msHastaProximo() {
      const ahora = new Date();
      const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
      for (const [h,m] of HORAS_TIP) {
        const minTip = h * 60 + m;
        if (minTip > minAhora && minTip <= MIN_LIMITE) {
          const target = new Date();
          target.setHours(h, m, 0, 0);
          return target - ahora;
        }
      }
      // Todos pasaron hoy -> mañana a las 9:00
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      manana.setHours(9, 0, 0, 0);
      return manana - ahora;
    }

    function programar() {
      setTimeout(() => {
        const minAhora = new Date().getHours() * 60 + new Date().getMinutes();
        if (minAhora >= 8 * 60 && minAhora <= MIN_LIMITE) {
          tipIdx = (tipIdx + 1) % TIPS.length;
          showTip();
        }
        programar();
      }, msHastaProximo());
    }

    programar();
  }

  if (window.currentUserRol !== undefined && window.currentUserRol !== '') {
    iniciarTimer();
  } else {
    window.addEventListener('sise:rolCargado', iniciarTimer, { once: true });
  }
})();


// ══════════════════════════════════════════════════════
// ALARMAS DE FIN DE TURNO + BUENOS DÍAS — estilo SISE
// ══════════════════════════════════════════════════════
(function() {

  const FRASES_MANANA = [
    "Cada alumno que ayudes hoy es una historia que cambia. ¡Tú puedes!",
    "Un nuevo día, una nueva oportunidad de hacer la diferencia.",
    "El mejor canal del equipo empieza con tu energía de hoy. ¡Vamos!",
    "Hoy es un buen día para ser la voz amable que alguien necesita.",
    "Tu actitud de hoy construye la experiencia del alumno. ¡A darlo todo!",
    "Arranca con fuerza. El equipo cuenta contigo. ¡Buenos días!",
  ];
  const FRASES_TARDE = [
    "Terminaste el día con energía y dedicación. Ahora ve a casa y descansa bien.",
    "Cada llamada de hoy fue un alumno ayudado. Misión cumplida.",
    "El equipo está orgulloso de tu trabajo. ¡Hasta mañana, campeón!",
    "Diste lo mejor de ti. Ahora es tu turno de descansar y recargar.",
    "Fuiste la voz amable que alguien necesitaba hoy. Gracias por eso.",
    "Hoy cumpliste. Mañana vuelves más fuerte. ¡Descansa bien!",
  ];
  const FRASES_NOCHE = [
    "Noche productiva completada. ¡Ve a descansar, lo mereces!",
    "El turno noche ya terminó. Gracias por estar hasta el final.",
    "Eres de los que no se rinden ni en la noche. ¡Hasta mañana!",
    "Misión nocturna cumplida. Descansa y recarga energías.",
  ];

  const FRASES_BIENVENIDA_TARDE = [
    "El turno PM acaba de empezar. Trae tu mejor energía y hagámoslo increíble.",
    "Bienvenido al turno tarde. Los mejores momentos del día todavía están por llegar.",
    "Arrancas el PM con todo. El equipo sabe que puedes con esto.",
    "Segundo turno, misma energía. Cada alumno que llegue hoy está en buenas manos.",
    "El turno tarde es tuyo. ¡Demuéstrale al equipo de qué estás hecho!",
    "Ya estás aquí y eso es lo más importante. ¡Vamos con todo el PM!",
  ];

  // ── CSS del modal ─────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #turno-modal-overlay {
      display:none; position:fixed; inset:0;
      background:rgba(0,0,0,.75); backdrop-filter:blur(8px);
      z-index:999995; align-items:center; justify-content:center; padding:20px;
    }
    #turno-modal-overlay.open { display:flex; }
    #turno-modal-card {
      background:#0D0D0D;
      border-radius:24px; overflow:hidden;
      max-width:420px; width:100%;
      box-shadow:0 32px 80px rgba(0,0,0,.9);
      animation:turno-pop .4s cubic-bezier(.22,.68,0,1.2);
    }
    @keyframes turno-pop {
      from { transform:scale(.85) translateY(20px); opacity:0; }
      to   { transform:scale(1)   translateY(0);    opacity:1; }
    }
    .turno-header {
      padding:28px 28px 20px;
      position:relative; overflow:hidden;
      display:flex; flex-direction:column; align-items:center; text-align:center;
    }
    .turno-header::before {
      content:''; position:absolute; inset:0;
      background:radial-gradient(circle at 50% 0%,var(--th-glow,.4) 0%,transparent 70%);
      pointer-events:none;
    }
    .turno-logo-wrap {
      width:64px; height:64px; border-radius:18px;
      background:var(--th-icon-bg,#1a0a00);
      display:flex; align-items:center; justify-content:center;
      font-size:30px; margin-bottom:14px; position:relative; z-index:1;
      box-shadow:0 4px 20px var(--th-glow,.3);
    }
    .turno-tag {
      display:inline-flex; align-items:center; gap:6px;
      border-radius:99px; padding:4px 14px;
      font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.1em;
      background:var(--th-tag-bg); color:var(--th-color);
      margin-bottom:12px; position:relative; z-index:1;
    }
    .turno-title {
      font-size:22px; font-weight:900; color:#fff;
      line-height:1.25; margin-bottom:6px;
      position:relative; z-index:1;
    }
    .turno-time {
      font-size:12px; color:rgba(255,255,255,.35);
      font-weight:600; position:relative; z-index:1;
    }
    .turno-body {
      background:rgba(255,255,255,.03);
      border-top:1px solid rgba(255,255,255,.06);
      padding:20px 28px 24px;
    }
    .turno-frase {
      font-size:14px; color:rgba(255,255,255,.55);
      line-height:1.7; text-align:center;
      font-style:italic; margin-bottom:20px;
    }
    .turno-frase::before { content:'" '; color:var(--th-color); }
    .turno-frase::after  { content:' "'; color:var(--th-color); }
    .turno-btn {
      display:block; width:100%; padding:14px;
      background:var(--th-btn-bg);
      color:#fff; border:none; border-radius:12px;
      font-size:15px; font-weight:800; cursor:pointer;
      font-family:inherit; letter-spacing:.01em;
      box-shadow:0 4px 20px var(--th-glow,.3);
      transition:opacity .15s, transform .1s;
    }
    .turno-btn:hover  { opacity:.88; }
    .turno-btn:active { transform:scale(.98); }
    .turno-sise-strip {
      display:flex; align-items:center; justify-content:center; gap:8px;
      padding:10px 0 0; margin-top:12px;
      border-top:1px solid rgba(255,255,255,.05);
      font-size:10px; font-weight:700; color:rgba(255,255,255,.2);
      text-transform:uppercase; letter-spacing:.1em;
    }
    .turno-sise-logo {
      width:20px; height:20px; border-radius:5px;
      background:#fff; display:flex; align-items:center; justify-content:center;
      font-size:7px; font-weight:900; color:#0D0D0D; letter-spacing:-.5px;
    }
  `;
  document.head.appendChild(style);

  // ── HTML del modal ────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'turno-modal-overlay';
  overlay.innerHTML = `
    <div id="turno-modal-card">
      <div class="turno-header" id="turno-header">
        <div class="turno-logo-wrap" id="turno-icon">⏰</div>
        <div class="turno-tag" id="turno-tag">Turno</div>
        <div class="turno-title" id="turno-title">Título</div>
        <div class="turno-time"  id="turno-time-label">00:00</div>
      </div>
      <div class="turno-body">
        <div class="turno-frase" id="turno-frase">Frase motivacional aquí.</div>
        <button class="turno-btn" id="turno-btn" onclick="document.getElementById('turno-modal-overlay').classList.remove('open')">
          ¡Entendido!
        </button>
        <div class="turno-sise-strip">
          <div class="turno-sise-logo">S</div>
          SISE · Portal SAES
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if(e.target===overlay) overlay.classList.remove('open'); });

  // ── Mostrar modal ─────────────────────────────────────────────
  function mostrarTurno(cfg) {
    const card   = document.getElementById('turno-modal-card');
    const header = document.getElementById('turno-header');
    card.style.setProperty('--th-color',       cfg.color);
    card.style.setProperty('--th-glow',        cfg.glow);
    card.style.setProperty('--th-icon-bg',     cfg.iconBg);
    card.style.setProperty('--th-tag-bg',      cfg.tagBg);
    card.style.setProperty('--th-btn-bg',      cfg.btnBg);

    document.getElementById('turno-icon').textContent       = cfg.icon;
    document.getElementById('turno-tag').textContent        = cfg.tag;
    document.getElementById('turno-title').textContent      = cfg.title;
    document.getElementById('turno-time-label').textContent = cfg.timeLabel;
    document.getElementById('turno-frase').textContent      = cfg.frase;
    document.getElementById('turno-btn').textContent        = cfg.btnText;

    overlay.classList.add('open');

    // Sonido suave
    try {
      const ctx  = new (window.AudioContext||window.webkitAudioContext)();
      cfg.notes.forEach((f,i) => {
        const osc=ctx.createOscillator(), g=ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value=f; osc.type='sine';
        const t=ctx.currentTime+i*.18;
        g.gain.setValueAtTime(0,t);
        g.gain.linearRampToValueAtTime(.15,t+.06);
        g.gain.linearRampToValueAtTime(0,t+.45);
        osc.start(t); osc.stop(t+.5);
      });
    } catch(e){}
  }

  // ── Configs de cada alarma ────────────────────────────────────
  function cfgBuenosDias() {
    const nombre = (window.currentUserNombre||'').split(' ')[0] || 'asesor';
    return {
      icon:'☀️', tag:'¡Buenos días!',
      title:`¡Arranca con todo, ${nombre}!`,
      timeLabel:'08:00 · Inicio de turno mañana',
      frase: FRASES_MANANA[Math.floor(Math.random()*FRASES_MANANA.length)],
      btnText:'¡Listo para empezar! 💪',
      color:'#F59E0B', glow:'rgba(245,158,11,.35)',
      iconBg:'rgba(245,158,11,.15)', tagBg:'rgba(245,158,11,.12)',
      btnBg:'linear-gradient(135deg,#F59E0B,#D97706)',
      notes:[523,659,784,1047],
    };
  }
  function cfgFinManana() {
    return {
      icon:'🌅', tag:'Turno Mañana',
      title:'¡Buen trabajo! Es hora de descansar',
      timeLabel:'17:30 · Fin de turno mañana',
      frase: FRASES_TARDE[Math.floor(Math.random()*FRASES_TARDE.length)],
      btnText:'¡Hasta mañana! 🏠',
      color:'#F26522', glow:'rgba(242,101,34,.35)',
      iconBg:'rgba(242,101,34,.15)', tagBg:'rgba(242,101,34,.12)',
      btnBg:'linear-gradient(135deg,#F26522,#C94E0A)',
      notes:[659,523,440],
    };
  }
  function cfgBienvenidaTarde() {
    const nombre = (window.currentUserNombre||'').split(' ')[0] || 'asesor';
    return {
      icon:'🌤️', tag:'¡Bienvenido al turno PM!',
      title:`¡${nombre}, el turno tarde es tuyo!`,
      timeLabel:'11:30 · Inicio de turno tarde',
      frase: FRASES_BIENVENIDA_TARDE[Math.floor(Math.random()*FRASES_BIENVENIDA_TARDE.length)],
      btnText:'¡A darle con todo! 🚀',
      color:'#0EA5E9', glow:'rgba(14,165,233,.35)',
      iconBg:'rgba(14,165,233,.15)', tagBg:'rgba(14,165,233,.12)',
      btnBg:'linear-gradient(135deg,#0EA5E9,#0284C7)',
      notes:[440,523,659,784],
    };
  }

  function cfgFinTarde() {
    return {
      icon:'🌙', tag:'Turno Tarde',
      title:'¡Fue un gran día! Es hora de ir a casa',
      timeLabel:'21:00 · Fin de turno tarde',
      frase: FRASES_NOCHE[Math.floor(Math.random()*FRASES_NOCHE.length)],
      btnText:'¡A casa a descansar! 🏠',
      color:'#7C3AED', glow:'rgba(124,58,237,.35)',
      iconBg:'rgba(124,58,237,.15)', tagBg:'rgba(124,58,237,.12)',
      btnBg:'linear-gradient(135deg,#7C3AED,#5B21B6)',
      notes:[440,392,349],
    };
  }

  // ── Verificación cada minuto ──────────────────────────────────
  const _shown = {};
  function checkAlarmas() {
    const rol = (window.currentUserRol||'').toLowerCase();
    if (rol === 'supervisor' || rol === 'formador') return;

    const now  = new Date();
    const hhmm = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    const key  = hhmm.replace(':','') + '_' + now.toDateString();

    if (hhmm === '08:00' && !_shown['buenos_'+key]) {
      _shown['buenos_'+key] = true;
      mostrarTurno(cfgBuenosDias());
    }
    if (hhmm === '11:30' && !_shown['bientarde_'+key]) {
      _shown['bientarde_'+key] = true;
      mostrarTurno(cfgBienvenidaTarde());
    }
    if (hhmm === '17:30' && !_shown['manana_'+key]) {
      _shown['manana_'+key] = true;
      mostrarTurno(cfgFinManana());
    }
    if (hhmm === '21:00' && !_shown['tarde_'+key]) {
      _shown['tarde_'+key] = true;
      mostrarTurno(cfgFinTarde());
    }
  }

  setInterval(checkAlarmas, 30000);
  checkAlarmas();

})();



// ══════════════════════════════════════════════════════════════
// SATISFACCIÓN — ranking gamificado v3
// ══════════════════════════════════════════════════════════════
(function() {

  // ── Rangos con nombres de gemas/metales ───────────────────────
  function getNivel(pct) {
    if (pct >= 95) return {
      label:'Diamante', icon:'💎', color:'#1a6fbf', bg:'linear-gradient(135deg,#E8F4FF,#C0DCFF)',
      bdr:'#4A90D9', glow:'rgba(74,144,217,0.5)', shine:'rgba(100,180,255,0.3)'
    };
    if (pct >= 80) return {
      label:'Esmeralda', icon:'💚', color:'#0e7a45', bg:'linear-gradient(135deg,#D4F7E8,#A8EEC8)',
      bdr:'#2ECC71', glow:'rgba(46,204,113,0.45)', shine:'rgba(46,204,113,0.2)'
    };
    if (pct >= 60) return {
      label:'Oro', icon:'🥇', color:'#9A6700', bg:'linear-gradient(135deg,#FFF3C0,#FFE270)',
      bdr:'#F0C040', glow:'rgba(240,192,64,0.45)', shine:'rgba(255,220,50,0.25)'
    };
    if (pct >= 40) return {
      label:'Plata', icon:'🥈', color:'#5A5A6A', bg:'linear-gradient(135deg,#F0F0F5,#D8D8E8)',
      bdr:'#A0A0C0', glow:'rgba(160,160,192,0.4)', shine:'rgba(200,200,220,0.25)'
    };
    return {
      label:'Bronce', icon:'🥉', color:'#7A4A20', bg:'linear-gradient(135deg,#F5E8D8,#E8C8A0)',
      bdr:'#CD8B5A', glow:'rgba(205,139,90,0.4)', shine:'rgba(205,139,90,0.2)'
    };
  }

  // ── Frases por posición ───────────────────────────────────────
  const FRASES_TOP1_RACHA = [
    "¡Eres imparable! El podio tiene dueño y se llama {nombre} 👑",
    "¡{nombre} en modo bestia! Semana tras semana en la cima 🔥",
    "¿Alguien puede detener a {nombre}? ¡El equipo está mirando! 💎",
    "¡{nombre} está escribiendo historia este mes! Nivel Diamante real 🏆",
    "¡Racha épica de {nombre}! Así se demuestra la excelencia 🚀",
  ];
  const FRASES_BOTTOM = [
    "Cada encuesta cuenta. Un punto más y empiezas a escalar 💪",
    "Los campeones también empezaron desde aquí. ¡Tu turno de subir! ⬆️",
    "El podio no está tan lejos como crees. ¡Hoy puede ser el día! 🎯",
    "Una buena atención puede cambiar todo. ¡Tú puedes! 🌟",
    "Los mejores también tuvieron días difíciles. ¡Sigue adelante! 🔥",
    "Cada chat es una oportunidad de subir en el ranking. ¡Aprovéchala! 💡",
  ];

  function getFraseTop1(nombre, racha) {
    if (racha < 2) return null;
    const f = FRASES_TOP1_RACHA[Math.floor(Math.random()*FRASES_TOP1_RACHA.length)];
    return f.replace('{nombre}', nombre.split(' ')[0]);
  }
  function getFraseBottom() {
    return FRASES_BOTTOM[Math.floor(Math.random()*FRASES_BOTTOM.length)];
  }

  // ── CSS ───────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    
    /* Podio */
    #sat-podio {
      display:flex; align-items:flex-end; justify-content:center;
      gap:12px; padding:0 16px; min-height:200px; position:relative;
    }
    .sat-podio-col { display:flex; flex-direction:column; align-items:center; flex:1; max-width:170px; }

    /* Avatar con anillo */
    .sat-av {
      border-radius:50%; display:flex; align-items:center; justify-content:center;
      font-weight:900; color:#fff; flex-shrink:0; position:relative;
      transition:transform .25s cubic-bezier(.22,.68,0,1.5);
    }
    .sat-av:hover { transform:scale(1.1) rotate(-3deg); }
    .sat-av-ring {
      position:absolute; inset:-4px; border-radius:50%;
      border:3px solid transparent;
      animation:sat-ring-spin 4s linear infinite;
    }
    @keyframes sat-ring-spin {
      from { transform:rotate(0deg); }
      to   { transform:rotate(360deg); }
    }

    /* Pedestal */
    .sat-pedestal {
      width:100%; border-radius:16px 16px 0 0;
      display:flex; flex-direction:column; align-items:center;
      justify-content:flex-start; padding-top:18px;
      margin-top:12px; position:relative; overflow:hidden;
    }
    .sat-pedestal::after {
      content:''; position:absolute; top:0; left:-50%; width:200%; height:100%;
      background:linear-gradient(90deg,transparent 30%,rgba(255,255,255,.15) 50%,transparent 70%);
      background-size:200% auto;
      animation:sat-pedestal-shine 3s linear infinite;
    }
    @keyframes sat-pedestal-shine {
      0%  { background-position:200% center; }
      100%{ background-position:-200% center; }
    }

    /* Nivel badge */
    .sat-badge {
      display:inline-flex; align-items:center; gap:4px;
      border-radius:99px; padding:3px 11px;
      font-size:10px; font-weight:800; letter-spacing:.04em;
      border:1.5px solid; white-space:nowrap; backdrop-filter:blur(4px);
      transition:transform .2s;
    }
    .sat-badge:hover { transform:scale(1.05); }

    /* Ranking rows */
    .sat-row {
      display:flex; align-items:center; gap:14px;
      padding:12px 20px; border-bottom:1px solid var(--border);
      transition:background .15s, transform .15s, box-shadow .15s;
      position:relative; overflow:hidden;
    }
    .sat-row:last-child { border-bottom:none; }
    .sat-row:hover {
      transform:translateX(4px);
      background:var(--orange-light) !important;
      box-shadow:inset 3px 0 0 var(--orange);
    }

    /* Shine en top 3 */
    .sat-row-shine::after {
      content:''; position:absolute; inset:0; pointer-events:none;
      background:linear-gradient(90deg,transparent 35%,rgba(255,255,255,.07) 50%,transparent 65%);
      background-size:300% auto;
      animation:sat-row-sh 4s linear infinite;
    }
    @keyframes sat-row-sh {
      0%  { background-position:200% center; }
      100%{ background-position:-200% center; }
    }

    /* Barra */
    .sat-bar-track { height:8px; border-radius:99px; background:#F0EEE9; overflow:hidden; margin-top:5px; }
    .sat-bar-fill  { height:100%; border-radius:99px; transition:width .9s cubic-bezier(.22,.68,0,1.2); }

    /* Racha */
    .sat-racha {
      display:inline-flex; align-items:center; gap:3px;
      background:linear-gradient(135deg,#FF6B35,#FF3A00);
      color:#fff; border-radius:99px; padding:2px 8px;
      font-size:10px; font-weight:800;
      box-shadow:0 2px 8px rgba(255,58,0,.4);
      animation:sat-racha-pulse 1.8s ease-in-out infinite;
    }
    @keyframes sat-racha-pulse {
      0%,100%{ box-shadow:0 2px 8px rgba(255,58,0,.4); }
      50%{ box-shadow:0 2px 18px rgba(255,58,0,.7); }
    }

    /* Badge "Tú" */
    .sat-yo { display:inline-flex; align-items:center; background:var(--orange); color:#fff; border-radius:99px; padding:2px 9px; font-size:10px; font-weight:800; }

    /* Frase motivacional */
    .sat-frase {
      margin:4px 20px 12px; padding:12px 16px;
      border-radius:12px; font-size:12.5px; font-weight:600;
      line-height:1.55; display:flex; align-items:flex-start; gap:10px;
    }
    .sat-frase-top { background:linear-gradient(135deg,#FFF9E6,#FFF3C0); border:1.5px solid #F0C040; color:#7A5800; }
    .sat-frase-bot { background:linear-gradient(135deg,#EBF2FF,#D0E4FF); border:1.5px solid #A0C0F0; color:#1D4080; }

    /* Stat cards */
    .sat-stat { background:var(--white); border:1px solid var(--border); border-radius:14px; padding:14px 20px; text-align:center; min-width:120px; transition:box-shadow .2s,transform .2s; }
    .sat-stat:hover { box-shadow:0 6px 24px rgba(0,0,0,.1); transform:translateY(-3px); }

    /* Efecto diamante en 1er lugar */
    @keyframes sat-diamond {
      0%,100%{ filter:drop-shadow(0 0 6px rgba(74,144,217,.6)); }
      50%{ filter:drop-shadow(0 0 18px rgba(74,144,217,.9)); }
    }
    .sat-av-diamond { animation:sat-diamond 2s ease-in-out infinite; }

    /* Corona animada para el #1 */
    .sat-corona {
      position:absolute; top:-18px; left:50%; transform:translateX(-50%);
      font-size:26px; line-height:1;
      animation:sat-corona-bounce .8s ease-in-out infinite alternate;
    }
    @keyframes sat-corona-bounce {
      from { transform:translateX(-50%) translateY(0) rotate(-5deg); }
      to   { transform:translateX(-50%) translateY(-4px) rotate(5deg); }
    }

    /* Partículas del 1er puesto */
    .sat-particles { position:relative; }
    .sat-particle {
      position:absolute; width:6px; height:6px; border-radius:50%;
      animation:sat-float linear infinite;
      pointer-events:none;
    }
    @keyframes sat-float {
      0%  { transform:translateY(0) scale(1); opacity:.8; }
      100%{ transform:translateY(-40px) scale(0); opacity:0; }
    }

    /* Dark Kahoot theme overrides */
    @keyframes sat-blink {
      0%,100%{ opacity:1; box-shadow:0 0 8px #4ade80; }
      50%{ opacity:.5; box-shadow:0 0 3px #4ade80; }
    }

    #view-satisfaccion .sat-row {
      border-bottom:1px solid rgba(255,255,255,.06) !important;
      color:#fff;
    }
    #view-satisfaccion .sat-row:hover {
      background:rgba(255,255,255,.07) !important;
      box-shadow:inset 3px 0 0 #a78bfa !important;
    }
    #view-satisfaccion .sat-bar-track {
      background:rgba(255,255,255,.1) !important;
    }
    #view-satisfaccion .sat-frase-top {
      background:rgba(240,192,64,.12) !important;
      border-color:rgba(240,192,64,.35) !important;
      color:#fde68a !important;
    }
    #view-satisfaccion .sat-frase-bot {
      background:rgba(124,58,237,.12) !important;
      border-color:rgba(124,58,237,.35) !important;
      color:#c4b5fd !important;
    }
    #view-satisfaccion .sat-stat {
      background:rgba(255,255,255,.06) !important;
      border-color:rgba(255,255,255,.1) !important;
      color:#fff !important;
    }
    #view-satisfaccion .sat-stat div { color:rgba(255,255,255,.5); }
    #view-satisfaccion .sat-stat div:nth-child(2) { color:#fff !important; }

    /* Rank number color in dark */
    #view-satisfaccion .sat-row > div:first-child span:last-child {
      color:rgba(255,255,255,.4) !important;
    }

    /* Name text in dark */
    #view-satisfaccion [style*="color:var(--text)"] {
      color:#fff !important;
    }
  `;
  document.head.appendChild(style);

  function fmtTMO(t) { return t||'—'; }
  function mesActual() {
    const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  }
  const MESES_N=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  function initSatNav() {
    const el=document.getElementById('nav-satisfaccion');
    if(el) el.style.display='';
  }
  window.addEventListener('sise:rolCargado', initSatNav);
  if(window.currentUserRol) initSatNav();

  let satData=[], satUnsub=null;

  // ── Podio ─────────────────────────────────────────────────────
  function renderPodio(ranking) {
    const el=document.getElementById('sat-podio');
    if(!el) return;
    if(!ranking.length){ el.innerHTML=''; return; }

    const top3=ranking.slice(0,3);
    const vis  = top3[1] ? [top3[1],top3[0],top3[2]] : [top3[0]];
    const poses = top3[1] ? [1,0,2] : [0];
    const heights=[150,200,120];
    const medals=['🥇','🥈','🥉'];
    const pedStyles=[
      'linear-gradient(180deg,#C8C8D8,#A0A0B8)', // plata 2do
      'linear-gradient(180deg,#FFD700,#E8A800)',  // oro 1ro
      'linear-gradient(180deg,#CD8B5A,#A06030)',  // bronce 3ro
    ];
    const avSizes=[66,84,58];

    el.innerHTML = vis.filter(Boolean).map((r,vi) => {
      const pos=poses[vi], niv=getNivel(r.pct), h=heights[pos];
      const sz=avSizes[pos];
      const initials=r.asesor.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
      const isFirst=pos===0;
      const rachaHtml=r.racha>1?`<div class="sat-racha" style="margin-top:6px;font-size:11px">🔥 ${r.racha} semanas</div>`:'';
      const coronaHtml=isFirst?`<div class="sat-corona">👑</div>`:'';

      // Avatar style según posición
      const avBg=isFirst
        ? `linear-gradient(135deg,#1a6fbf,#0a4a8f)` // diamante azul para el 1ro
        : pos===1 ? `linear-gradient(135deg,#888,#555)`
        : `linear-gradient(135deg,#CD8B5A,#8B5020)`;
      const avShadow=isFirst
        ? `0 8px 32px rgba(74,144,217,.6), 0 0 0 3px rgba(74,144,217,.3)`
        : pos===1 ? `0 4px 16px rgba(0,0,0,.25)`
        : `0 4px 16px rgba(205,139,90,.4)`;
      const ringColor=isFirst?'#4A90D9':pos===1?'#A0A0C0':'#CD8B5A';

      return `
        <div class="sat-podio-col sat-particles" style="z-index:${isFirst?2:1}">
          <div style="position:relative;margin-bottom:6px;margin-top:${isFirst?0:20}px">
            ${coronaHtml}
            <div class="sat-av${isFirst?' sat-av-diamond':''}" style="width:${sz}px;height:${sz}px;background:${avBg};box-shadow:${avShadow};font-size:${isFirst?28:20}px;color:#fff">
              ${initials}
              <div style="position:absolute;inset:-5px;border-radius:50%;border:2px solid ${ringColor};opacity:.5;animation:sat-ring-spin ${isFirst?3:5}s linear infinite"></div>
              <div style="position:absolute;top:-4px;right:-2px;font-size:${isFirst?22:16}px;line-height:1">${medals[pos]}</div>
            </div>
          </div>
          <div style="font-size:${isFirst?14:12}px;font-weight:800;color:var(--text);text-align:center;line-height:1.3;max-width:150px;margin-bottom:4px">${r.asesor}</div>
          <div style="font-size:${isFirst?30:22}px;font-weight:900;color:${niv.color};line-height:1">${r.pct}%</div>
          <div class="sat-badge" style="color:${niv.color};border-color:${niv.bdr};background:${niv.bg};margin-top:4px">${niv.icon} ${niv.label}</div>
          ${rachaHtml}
          <div class="sat-pedestal" style="height:${h}px;background:${pedStyles[pos]};box-shadow:0 -8px 32px ${isFirst?'rgba(255,215,0,.3)':'rgba(0,0,0,.1)'}">
            <span style="font-size:${isFirst?40:28}px;opacity:.9;position:relative;z-index:1">${medals[pos]}</span>
          </div>
        </div>`;
    }).join('');
  }

  // ── Ranking ───────────────────────────────────────────────────
  function renderRanking(ranking) {
    const el=document.getElementById('sat-ranking-list');
    const emp=document.getElementById('sat-empty-state');
    if(!el) return;
    if(!ranking.length){ el.innerHTML=''; if(emp) emp.style.display='block'; return; }
    if(emp) emp.style.display='none';

    const miNombre=(window.currentUserNombre||'').toLowerCase();
    const miPos=miNombre ? ranking.findIndex(r=>r.asesor.toLowerCase().includes(miNombre.split(' ')[0])) : -1;
    const total=ranking.length;

    let html='';

    ranking.forEach((r,i) => {
      const niv=getNivel(r.pct);
      const isMe=miNombre&&r.asesor.toLowerCase().includes(miNombre.split(' ')[0]);
      const isTop=i<3;
      const initials=r.asesor.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();

      // Colores barra
      const barColor=i===0?'linear-gradient(90deg,#1a6fbf,#4A90D9)'
                    :i===1?'linear-gradient(90deg,#888,#C0C0C0)'
                    :i===2?'linear-gradient(90deg,#8B5020,#CD8B5A)'
                    :`linear-gradient(90deg,${niv.color},${niv.bdr})`;

      const posHtml=i===0?'<span style="font-size:24px">🥇</span>'
                   :i===1?'<span style="font-size:20px">🥈</span>'
                   :i===2?'<span style="font-size:18px">🥉</span>'
                   :`<span style="font-size:13px;font-weight:800;color:var(--muted)">${i+1}</span>`;

      const rachaHtml=r.racha>1?`<span class="sat-racha">🔥 ${r.racha}sem</span>`:'';
      const yoHtml=isMe?`<span class="sat-yo">Tú 👋</span>`:'';
      const tmoHtml=r.tmo?`<span style="font-size:11px;color:var(--muted)">⏱ ${fmtTMO(r.tmo)}</span>`:'';

      const rowBg=isMe?'background:linear-gradient(90deg,rgba(242,101,34,.08),rgba(242,101,34,.02));'
                 :isTop?`background:linear-gradient(90deg,${niv.shine||'rgba(0,0,0,0)'},transparent);`:'';

      html+=`
        <div class="sat-row${isTop?' sat-row-shine':''}" style="${rowBg}">
          <div style="width:32px;text-align:center;flex-shrink:0">${posHtml}</div>
          <div style="width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;flex-shrink:0;background:${niv.bg};border:2px solid ${niv.bdr};box-shadow:0 2px 10px ${niv.glow};color:${niv.color};position:relative">
            ${initials}
            ${r.racha>=3?`<div style="position:absolute;top:-5px;right:-5px;font-size:13px">🔥</div>`:''}
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
              <span data-asesor="${r.asesor}" style="font-size:13px;font-weight:800;color:#fff;cursor:pointer;border-bottom:1.5px solid rgba(255,255,255,.2);transition:border-color .15s" onmouseover="this.style.borderColor='rgba(167,139,250,.8)'" onmouseout="this.style.borderColor='rgba(255,255,255,.2)'" onclick="window._satVerHistorial(this.dataset.asesor)">${r.asesor}</span>
              <div class="sat-badge" style="color:${niv.color};border-color:${niv.bdr};background:${niv.bg};font-size:9px;padding:2px 8px">${niv.icon} ${niv.label}</div>
              ${yoHtml}${rachaHtml}${tmoHtml}
            </div>
            <div class="sat-bar-track">
              <div class="sat-bar-fill" style="width:${Math.max(r.pct,2)}%;background:${barColor}"></div>
            </div>
          </div>
          <div style="font-size:20px;font-weight:900;color:${niv.color};flex-shrink:0;min-width:54px;text-align:right;line-height:1">${r.pct}%</div>
          ${_esSupervisorSat() ? `<button onclick="event.stopPropagation();_satEliminarAsesor('${r.asesor.replace(/'/g,"\\'")}','${r.semana}')" title="Quitar del ranking" style="width:28px;height:28px;border-radius:8px;background:rgba(196,30,58,.12);border:1px solid rgba(196,30,58,.3);color:#f87171;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s" onmouseover="this.style.background='rgba(196,30,58,.3)'" onmouseout="this.style.background='rgba(196,30,58,.12)'">✕</button>` : ''}
        </div>`;

      // ── Frase motivacional ───────────────────────────────────
      // Top 1 con racha
      if(i===0 && r.racha>=2) {
        const frase=getFraseTop1(r.asesor, r.racha);
        if(frase) html+=`
          <div class="sat-frase sat-frase-top">
            <span style="font-size:20px;flex-shrink:0">👑</span>
            <span>${frase}</span>
          </div>`;
      }
      // Últimos 3 (bottom) — frase motivacional solo si es el propio asesor
      if(isMe && i >= total-3 && total > 5) {
        html+=`
          <div class="sat-frase sat-frase-bot">
            <span style="font-size:20px;flex-shrink:0">💪</span>
            <span>${getFraseBottom()}</span>
          </div>`;
      }
    });

    el.innerHTML=html;
  }

  // ── Stats ─────────────────────────────────────────────────────
  // ── Meta del mes ─────────────────────────────────────────────
  window._satMeta = null;

  function _loadMeta() {
    const {getFirestore,doc,onSnapshot} = window._fbModules||{};
    if (!getFirestore) return;
    onSnapshot(doc(getFirestore(),'satisfaccion_config','meta'), snap => {
      try {
        window._satMeta = snap.exists() ? (snap.data().meta || null) : null;
        renderStats(window._satLastRanking||[]);
      } catch(e) { console.error('_loadMeta snapshot:', e); }
    }, e => console.warn('_loadMeta onSnapshot error:', e));
  }

  window._satEditarMeta = async function() {
    const actual = window._satMeta || '';
    const val = prompt('Meta de satisfacción del mes (%). Ejemplo: 80', actual);
    if (val === null) return;
    const num = parseInt(val);
    if (isNaN(num) || num < 1 || num > 100) { showToast('Valor inválido. Ingresa un número entre 1 y 100','error'); return; }
    const {getFirestore,doc,setDoc,serverTimestamp} = window._fbModules||{};
    if (!getFirestore) return;
    try {
      await setDoc(doc(getFirestore(),'satisfaccion_config','meta'), {meta:num, actualizado:serverTimestamp()}, {merge:true});
      window._satMeta = num;
      renderStats(window._satLastRanking||[]);
      showToast('Meta actualizada a ' + num + '% ✓');
    } catch(e) { showToast('Error: '+e.message,'error'); }
  };

  function _satDiaActual() {
    const data = window._satData || [];
    if (!data.length) return '—';
    const mes = mesActual();
    const semanas = [...new Set(data.filter(r=>r.mes===mes).map(r=>r.semana||''))].filter(Boolean).sort();
    const ultima = semanas[semanas.length-1] || '';
    if (!ultima) return '—';
    return _formatSemana(ultima);
  }

  function _formatSemana(semana) {
    if (!semana) return '—';
    const DIAS_S2 = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const MESES_S2 = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    // Format YYYY-MM-DD
    const dp = semana.split('-');
    if (dp.length === 3 && dp[1].length === 2 && !semana.includes('W')) {
      const fd = new Date(parseInt(dp[0]), parseInt(dp[1])-1, parseInt(dp[2]));
      return DIAS_S2[fd.getDay()] + ' ' + dp[2] + ' ' + MESES_S2[fd.getMonth()];
    }
    // Format YYYY-W##
    const wMatch = semana.match(/(\d{4})-W(\d+)/);
    if (wMatch) {
      const [,year,week] = wMatch;
      const jan4 = new Date(parseInt(year),0,4);
      const mon = new Date(jan4);
      mon.setDate(jan4.getDate() - ((jan4.getDay()||7)-1) + (parseInt(week)-1)*7);
      const sun = new Date(mon); sun.setDate(mon.getDate()+6);
      return mon.getDate()+'/'+('0'+(mon.getMonth()+1)).slice(-2)+' – '+sun.getDate()+'/'+('0'+(sun.getMonth()+1)).slice(-2);
    }
    return semana;
  }

  function renderStats(ranking) {
    const el=document.getElementById('sat-global-stats');
    if(!el||!ranking.length) return;
    const rolSup=(window.currentUserRol||'').toLowerCase();
    const esSup=['supervisor','bo','formador'].includes(rolSup);
    const avg=Math.round(ranking.reduce((s,r)=>s+r.pct,0)/ranking.length);
    const niv=getNivel(avg);
    const best=ranking[0], bestNiv=getNivel(best.pct);
    el.innerHTML=`
      <div class="sat-stat">
        <div style="font-size:9.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Promedio equipo</div>
        <div style="font-size:28px;font-weight:900;color:${niv.color};line-height:1">${avg}%</div>
        <div class="sat-badge" style="color:${niv.color};border-color:${niv.bdr};background:${niv.bg};margin-top:6px">${niv.icon} ${niv.label}</div>
      </div>
      <div class="sat-stat">
        <div style="font-size:9.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Asesores activos</div>
        <div style="font-size:28px;font-weight:900;color:var(--text);line-height:1">${ranking.length}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px;font-weight:600">en ranking</div>
      </div>
      <div class="sat-stat" style="background:linear-gradient(135deg,#E8F4FF,#C0DCFF);border-color:#4A90D9">
        <div style="font-size:9.5px;font-weight:700;color:#1D5FBD;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Líder del mes</div>
        <div style="font-size:14px;font-weight:800;color:#0D2A5E;line-height:1.3;margin-bottom:4px">${best.asesor.split(' ')[0]}</div>
        <div style="font-size:24px;font-weight:900;color:#1a6fbf">${best.pct}%</div>
        <div class="sat-badge" style="color:${bestNiv.color};border-color:${bestNiv.bdr};background:${bestNiv.bg};margin-top:4px;font-size:9px">${bestNiv.icon} ${bestNiv.label}</div>
      </div>
      <div class="sat-stat" style="position:relative">
        <div style="font-size:9.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Meta del mes</div>
        <div style="display:flex;align-items:baseline;gap:4px">
          <div id="sat-meta-val" style="font-size:28px;font-weight:900;color:#F26522;line-height:1">${window._satMeta||'—'}</div>
          <div style="font-size:14px;color:#F26522;font-weight:700">${window._satMeta?'%':''}</div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px;font-weight:600">objetivo mensual</div>
        ${esSup ? '<button onclick="window._satEditarMeta()" style="position:absolute;top:8px;right:8px;background:rgba(242,101,34,.1);border:1px solid rgba(242,101,34,.2);color:#F26522;border-radius:7px;width:24px;height:24px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;font-family:inherit" title="Editar meta">✏️</button>' : ''}
      </div>
      <div class="sat-stat">
        <div style="font-size:9.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Datos del día</div>
        <div style="font-size:16px;font-weight:900;color:var(--text);line-height:1.2">${_satDiaActual()}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px;font-weight:600">última carga</div>
      </div>`;
  }

  // ── Ranking calc ──────────────────────────────────────────────
  function calcRanking(registros) {
    const mes=mesActual();
    const delMes=registros.filter(r=>r.mes===mes);
    if(!delMes.length) return [];
    const mapa={};
    delMes.forEach(r=>{
      if(!mapa[r.asesor]) mapa[r.asesor]={asesor:r.asesor,semanas:[],tmo:r.tmo};
      mapa[r.asesor].semanas.push({semana:r.semana,pct:r.pct,fecha:r.semana});
      mapa[r.asesor].tmo=r.tmo||mapa[r.asesor].tmo;
    });
    return Object.values(mapa).map(a=>{
      a.semanas.sort((x,y)=>x.semana.localeCompare(y.semana));
      const ultima=a.semanas[a.semanas.length-1];
      let racha=0;
      for(let i=a.semanas.length-1;i>=0;i--){ if(a.semanas[i].pct>=70) racha++; else break; }
      return {asesor:a.asesor,pct:ultima.pct,tmo:a.tmo,racha,semana:ultima.semana};
    }).sort((a,b)=>b.pct-a.pct);
  }
  function calcRankingRaw(registros) {
    const mapa={};
    registros.forEach(r=>{
      if(!mapa[r.asesor]) mapa[r.asesor]={asesor:r.asesor,total:0,count:0};
      mapa[r.asesor].total+=r.pct; mapa[r.asesor].count++;
    });
    return Object.values(mapa).map(a=>({asesor:a.asesor,pct:Math.round(a.total/a.count)})).sort((a,b)=>b.pct-a.pct);
  }

  // ── Firebase ──────────────────────────────────────────────────
  function initSatFirebase() {
    try {
      const {getFirestore,collection,onSnapshot,addDoc,query,where,orderBy,serverTimestamp,getDocs,doc,updateDoc}=window._fbModules||{};
      if(!getFirestore) return;
      const db=getFirestore();
      try { _loadMeta(); } catch(e) { console.error('_loadMeta:', e); }
      try { window._lgNotifInit && window._lgNotifInit(); } catch(e) { console.error('_lgNotifInit:', e); }
      if(satUnsub) satUnsub();
      satUnsub=onSnapshot(
        query(collection(db,'satisfaccion'),orderBy('creadoEn','asc')),
        snap=>{
          try {
          satData=snap.docs.map(d=>({id:d.id,...d.data()})); window._satData=satData;
          const ranking=calcRanking(satData);
          try { renderPodio(ranking); } catch(e) { console.error('renderPodio:', e); }
          try { renderRanking(ranking); } catch(e) { console.error('renderRanking:', e); }
          try { renderStats(ranking); } catch(e) { console.error('renderStats:', e); }
          try { renderFilterBar(ranking); } catch(e) { console.error('renderFilterBar:', e); }
          if(window._satNotifComparar) {
            try {
              window._satPrevRanking = window._satLastRanking || [];
              window._satLastRanking = ranking;
              window._satNotifComparar(ranking);
            } catch(e) { console.error('_satNotifComparar:', e); }
          }

          const mes=mesActual(), [y,m]=mes.split('-');
          const periodoEl = document.getElementById('sat-periodo-label');
          if (periodoEl) periodoEl.textContent='Mes en curso: '+MESES_N[parseInt(m)-1]+' '+y;

          // Actualizar calendario con fecha de hoy
          const hoy = new Date();
          const DIAS_S = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
          const MESES_C = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
          const calMes = document.getElementById('sat-cal-mes');
          const calDia = document.getElementById('sat-cal-dia');
          const calAño = document.getElementById('sat-cal-año');
          if(calMes) calMes.textContent = DIAS_S[hoy.getDay()]+' · '+MESES_C[hoy.getMonth()];
          if(calDia) calDia.textContent = hoy.getDate();
          if(calAño) calAño.textContent = hoy.getFullYear();

          // Última carga
          const ultima=satData.filter(r=>r.mes===mes).sort((a,b)=>b.semana.localeCompare(a.semana))[0];
          if(ultima) {
            const label = typeof _formatSemana === 'function' ? _formatSemana(ultima.semana) : ultima.semana;
            const semanaEl = document.getElementById('sat-semana-label');
            if (semanaEl) semanaEl.textContent='Última carga: '+label;
          }
          try { checkReinicio(db,collection,getDocs,mes); } catch(e) { console.error('checkReinicio:', e); }
          } catch(e) { console.error('sat onSnapshot callback:', e); }
        },
        err=>console.warn('sat:',err)
      );
      window._satGuardar=async(registros,semana)=>{
        const mes=mesActual();
        for(const r of registros){
          const q=query(collection(db,'satisfaccion'),where('asesor','==',r.asesor),where('semana','==',semana),where('mes','==',mes));
          const ex=await getDocs(q);
          if(!ex.empty){ await updateDoc(doc(db,'satisfaccion',ex.docs[0].id),{pct:r.pct,tmo:r.tmo}); }
          else{ await addDoc(collection(db,'satisfaccion'),{asesor:r.asesor,pct:r.pct,tmo:r.tmo||'',semana,mes,creadoEn:serverTimestamp()}); }
        }
      };
    } catch(e){ console.warn('sat firebase:',e); }
  }

  // ── Lógica de fin de mes: borrado automático + popup ─────────
  // Se ejecuta al entrar al portal, no por horario fijo.
  // El borrado lo hace el primer supervisor que entre en el nuevo mes.
  // El popup lo ve TODOS (asesores y supervisores) el día 1.

  async function checkReinicio(db, collection, getDocs, mes) {
    const hoy = new Date();
    const dia  = hoy.getDate();
    const uid  = window.currentUser?.uid || 'x';
    const rol  = (window.currentUserRol||'').toLowerCase();
    const esSup = ['supervisor','bo','formador'].includes(rol);

    // ── Calcular mes anterior ─────────────────────────────────
    const [y,m] = mes.split('-');
    const pm = parseInt(m)-1;
    const py = pm===0 ? parseInt(y)-1 : parseInt(y);
    const pMes = py+'-'+String(pm===0?12:pm).padStart(2,'0');

    // ── POPUP día 1: todos lo ven una vez por mes ────────────
    if (dia === 1) {
      const KEY_POPUP = 'sat_popup_'+uid+'_'+mes;
      if (!localStorage.getItem(KEY_POPUP)) {
        localStorage.setItem(KEY_POPUP, '1');
        // Cargar datos del mes anterior para mostrar podio
        try {
          const {query,where} = window._fbModules||{};
          const snap = await getDocs(query(collection(db,'satisfaccion'),where('mes','==',pMes)));
          if (!snap.empty) {
            const rank = calcRankingRaw(snap.docs.map(d=>d.data()));
            if (rank.length) {
              setTimeout(()=>showCelebracion(rank.slice(0,3), MESES_N[pm===0?11:pm-1]+' '+py, mes), 1500);
            }
          }
        } catch(e) { console.warn('popup celebración:', e); }
      }
    }

    // ── BORRADO: solo supervisores, solo una vez por mes ─────
    // Se ejecuta cuando un supervisor entra en el nuevo mes
    // y detecta que el mes anterior aún tiene datos
    if (!esSup) return;

    const KEY_RESET = 'sat_reset_'+pMes; // clave global en Firebase para evitar doble borrado
    try {
      const {getFirestore,doc,getDoc,setDoc,serverTimestamp,query,where,deleteDoc} = window._fbModules||{};
      if (!getFirestore) return;
      const db2 = getFirestore();

      // Verificar si ya se borró este mes (flag en Firebase, no localStorage)
      const flagRef = doc(db2,'satisfaccion_config','reset_'+pMes);
      const flagSnap = await getDoc(flagRef);
      if (flagSnap.exists()) return; // ya se borró

      // Verificar que hay datos del mes anterior
      const {query:q2,where:w2} = window._fbModules;
      const snapCheck = await getDocs(q2(collection(db,'satisfaccion'),w2('mes','==',pMes)));
      if (snapCheck.empty) return; // nada que borrar

      // Marcar como borrado PRIMERO para evitar race condition
      await setDoc(flagRef, {borrado:true, por:uid, fecha:serverTimestamp()});

      // Borrar datos del mes anterior
      await Promise.all(snapCheck.docs.map(d=>deleteDoc(doc(db2,'satisfaccion',d.id))));
      console.log(`[SISE] Auto-reset ${pMes}: ${snapCheck.size} registros borrados`);
      // Logros NO se borran
    } catch(e) { console.warn('auto-reset error:', e); }
  }

  function showCelebracion(top3, mesNombre, mesNuevo) {
    // Crear modal si no existe
    let modal = document.getElementById('sat-celeb-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sat-celeb-modal';
      document.body.appendChild(modal);
    }

    const [y2,m2] = mesNuevo.split('-');
    const mesN2   = MESES_N[parseInt(m2)-1]+' '+y2;
    const medals  = ['🥇','🥈','🥉'];
    const podioH  = ['190px','140px','110px'];
    const podioColors = [
      'linear-gradient(180deg,#FFD700,#C8A000)',
      'linear-gradient(180deg,#C0C0C0,#909090)',
      'linear-gradient(180deg,#CD7F32,#A05A20)',
    ];
    const glows = [
      '0 0 40px rgba(255,215,0,.5)',
      '0 0 24px rgba(192,192,192,.4)',
      '0 0 20px rgba(205,127,50,.4)',
    ];

    const frases = [
      '¡El equipo lo dio todo! Gracias a cada uno por su esfuerzo. ¡A por ' + mesN2 + '! 🚀',
      '¡Resultados increíbles! Cada encuesta es una historia de atención real. ¡Nuevo mes, nuevas metas! ⭐',
      '¡Orgullo de equipo! Así se construye la excelencia día a día. ¡Vamos con todo! 💪',
      '¡Mes cerrado con fuerza! El podio lo dice todo. ¡A repetirlo en ' + mesN2 + '! 🏆',
    ];
    const frase = frases[Math.floor(Math.random()*frases.length)];

    modal.innerHTML = `
      <div id="sat-celeb-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.92);backdrop-filter:blur(12px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto">
        <!-- Confeti canvas -->
        <canvas id="sat-confetti-canvas" style="position:fixed;inset:0;pointer-events:none;z-index:1000000"></canvas>

        <div style="background:linear-gradient(160deg,#1a0a3d,#0d0020,#1a0a3d);border:1px solid rgba(255,255,255,.1);border-radius:28px;max-width:580px;width:100%;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.9);position:relative;z-index:1000001">

          <!-- Cabecera -->
          <div style="background:linear-gradient(135deg,#2d1b69,#1a0a3d);padding:32px 28px 24px;text-align:center;position:relative;overflow:hidden">
            <!-- Estrellas decorativas -->
            <div style="position:absolute;inset:0;background:radial-gradient(circle at 20% 50%,rgba(255,215,0,.08),transparent 50%),radial-gradient(circle at 80% 50%,rgba(167,139,250,.08),transparent 50%)"></div>
            <div style="position:relative;z-index:1">
              <div style="font-size:13px;font-weight:800;color:#a78bfa;text-transform:uppercase;letter-spacing:.15em;margin-bottom:10px">✨ Cierre de mes ✨</div>
              <div style="font-size:28px;font-weight:900;color:#fff;line-height:1.2;margin-bottom:6px">¡Los mejores de ${mesNombre}!</div>
              <div style="font-size:14px;color:rgba(255,255,255,.5)">${mesN2} empieza con todo</div>
            </div>
          </div>

          <!-- Podio top 3 -->
          <div style="padding:28px 24px 12px;display:flex;align-items:flex-end;justify-content:center;gap:14px">
            ${[top3[1], top3[0], top3[2]].filter(Boolean).map((r, vi) => {
              const pos   = top3[1] ? [1,0,2][vi] : vi;
              const niv   = getNivel(r.pct);
              const init  = r.asesor.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
              const sz    = pos===0 ? 72 : 58;
              const nameS = pos===0 ? '14px' : '12px';
              const pctS  = pos===0 ? '30px' : '22px';
              return `
                <div style="display:flex;flex-direction:column;align-items:center;flex:1;max-width:160px">
                  <div style="position:relative;margin-bottom:8px">
                    <div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${pos===0?'linear-gradient(135deg,#FFD700,#C8A000)':pos===1?'linear-gradient(135deg,#C0C0C0,#888)':'linear-gradient(135deg,#CD7F32,#8B4A1A)'};display:flex;align-items:center;justify-content:center;font-size:${pos===0?26:19}px;font-weight:900;color:${pos===0?'#5A3E00':'#fff'};box-shadow:${glows[pos]};animation:sat-celeb-pop .6s cubic-bezier(.22,.68,0,1.6) ${pos===0?'.1':pos===1?'.3':'.5'}s both">
                      ${init}
                    </div>
                    <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:${pos===0?28:20}px;line-height:1;animation:sat-celeb-bounce 1s ease-in-out infinite alternate">${medals[pos]}</div>
                  </div>
                  <div style="font-size:${nameS};font-weight:800;color:#fff;text-align:center;line-height:1.3;margin-bottom:4px">${r.asesor}</div>
                  <div style="font-size:${pctS};font-weight:900;color:${pos===0?'#FFD700':pos===1?'#C0C0C0':'#CD7F32'};line-height:1;margin-bottom:4px">${r.pct}%</div>
                  <div style="display:inline-flex;align-items:center;gap:4px;border-radius:99px;padding:3px 10px;font-size:9.5px;font-weight:800;border:1.5px solid ${niv.bdr};background:${niv.bg};color:${niv.color}">${niv.icon} ${niv.label}</div>
                  <!-- Pedestal -->
                  <div style="width:100%;height:${podioH[pos]};background:${podioColors[pos]};border-radius:12px 12px 0 0;display:flex;align-items:flex-start;justify-content:center;padding-top:14px;font-size:${pos===0?36:28}px;margin-top:12px;box-shadow:${glows[pos]};position:relative;overflow:hidden">
                    <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.15),transparent);border-radius:12px 12px 0 0"></div>
                    <span style="position:relative;z-index:1">${medals[pos]}</span>
                  </div>
                </div>`;
            }).join('')}
          </div>

          <!-- Frase motivacional -->
          <div style="margin:0 24px 20px;padding:16px 20px;background:rgba(167,139,250,.08);border:1.5px solid rgba(167,139,250,.2);border-radius:14px;text-align:center;font-size:13.5px;font-weight:600;color:rgba(255,255,255,.8);line-height:1.65">
            ${frase}
          </div>

          <!-- Botón cerrar -->
          <div style="padding:0 24px 28px">
            <button onclick="document.getElementById('sat-celeb-modal').innerHTML='';_satStopConfetti()" style="width:100%;padding:15px;background:linear-gradient(135deg,#7c3aed,#5b21b6);border:none;color:#fff;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 6px 24px rgba(124,58,237,.5);transition:transform .15s;letter-spacing:.02em" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
              ¡Comenzar ${mesN2}! 🚀
            </button>
          </div>
        </div>
      </div>`;

    // Animación de entrada
    const overlay = document.getElementById('sat-celeb-overlay');
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .4s';
    setTimeout(() => { overlay.style.opacity = '1'; }, 50);

    // Cerrar al click en fondo
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => { modal.innerHTML = ''; _satStopConfetti(); }, 400);
      }
    });

    // Lanzar confeti
    _satLanzarConfetti();
  }

  // ── Confeti ───────────────────────────────────────────────────
  let _satConfettiRAF = null;
  function _satLanzarConfetti() {
    const canvas = document.getElementById('sat-confetti-canvas');
    if (!canvas) { setTimeout(_satLanzarConfetti, 200); return; }
    const ctx  = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ['#FFD700','#FF6B6B','#4ADE80','#60A5FA','#A78BFA','#F472B6','#FBBF24','#fff'];
    const pieces = Array.from({length:120}, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height - canvas.height,
      w:     6 + Math.random()*8,
      h:     10 + Math.random()*14,
      color: COLORS[Math.floor(Math.random()*COLORS.length)],
      rot:   Math.random() * 360,
      vx:    (Math.random()-0.5)*3,
      vy:    2 + Math.random()*4,
      vr:    (Math.random()-0.5)*8,
      opacity: 0.7 + Math.random()*0.3,
    }));

    function draw() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      let alive = false;
      pieces.forEach(p => {
        p.x  += p.vx;
        p.y  += p.vy;
        p.rot+= p.vr;
        if (p.y < canvas.height + 20) alive = true;
        if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random()*canvas.width; }
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI/180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      });
      _satConfettiRAF = requestAnimationFrame(draw);
    }
    draw();
    // Parar automático a los 8 segundos
    setTimeout(_satStopConfetti, 8000);
  }

  function _satStopConfetti() {
    if (_satConfettiRAF) { cancelAnimationFrame(_satConfettiRAF); _satConfettiRAF=null; }
    const c = document.getElementById('sat-confetti-canvas');
    if (c) { const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); }
  }


    // ── Barra de filtros por asesor ───────────────────────────────
  let satFiltroActivo = null;

  function renderFilterBar(ranking) {
    const bar   = document.getElementById('sat-filter-bar');
    const chips = document.getElementById('sat-filter-chips');
    if (!bar || !chips || !ranking.length) { if(bar) bar.style.display='none'; return; }

    bar.style.display = 'block';
    chips.innerHTML = `
      <button onclick="_satFiltrar(null)" id="sat-chip-all"
        style="padding:6px 14px;border-radius:99px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid rgba(255,255,255,.2);background:rgba(255,255,255,.12);color:#fff;transition:all .15s">
        Todos
      </button>` +
      ranking.map((r,i) => {
        const niv = getNivel(r.pct);
        return `<button onclick="_satFiltrar('${r.asesor.replace(/'/g,"\\'")}')"
          id="sat-chip-${i}"
          style="padding:5px 13px;border-radius:99px;font-size:11.5px;font-weight:700;cursor:pointer;border:1.5px solid ${niv.bdr};background:${niv.bg};color:${niv.color};transition:all .15s;white-space:nowrap">
          ${niv.icon} ${r.asesor.split(' ')[0]}
        </button>`;
      }).join('');
  }

  window._satFiltrar = function(nombre) {
    satFiltroActivo = nombre;
    // Resaltar chip activo
    document.querySelectorAll('#sat-filter-chips button').forEach(b => {
      b.style.opacity = '0.5';
      b.style.transform = 'scale(0.95)';
    });
    const activeChip = nombre
      ? [...document.querySelectorAll('#sat-filter-chips button')].find(b => b.textContent.includes(nombre.split(' ')[0]))
      : document.getElementById('sat-chip-all');
    if (activeChip) { activeChip.style.opacity='1'; activeChip.style.transform='scale(1.05)'; }

    // Filtrar filas del ranking
    const rows = document.querySelectorAll('#sat-ranking-list .sat-row');
    rows.forEach(row => {
      if (!nombre) { row.style.display=''; return; }
      const nameEl = row.querySelector('[data-asesor]');
      const match  = nameEl && nameEl.dataset.asesor === nombre;
      row.style.display = match ? '' : 'none';
      // También ocultar/mostrar frases debajo
    });
  };

  // ── Modal historial de asesor ─────────────────────────────────
  window._satVerHistorial = function(nombre) {
    const modal = document.getElementById('sat-hist-modal');
    if (!modal) return;

    const mes    = mesActual();
    const niv    = (() => {
      const r = calcRanking(satData).find(x => x.asesor === nombre);
      return r ? getNivel(r.pct) : getNivel(0);
    })();
    const initials = nombre.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();

    // Avatar
    const av = document.getElementById('sat-hist-avatar');
    av.style.cssText += `;background:${niv.bg};border:2px solid ${niv.bdr};color:${niv.color}`;
    av.textContent = initials;

    document.getElementById('sat-hist-name').textContent = nombre;
    document.getElementById('sat-hist-badge').innerHTML =
      `<span style="display:inline-flex;align-items:center;gap:4px;border-radius:99px;padding:2px 10px;font-size:10px;font-weight:800;border:1.5px solid ${niv.bdr};background:${niv.bg};color:${niv.color}">${niv.icon} ${niv.label}</span>`;

    // Datos del asesor — todas las semanas del mes
    const histData = satData
      .filter(r => r.asesor === nombre && r.mes === mes)
      .sort((a,b) => a.semana.localeCompare(b.semana));

    // También buscar datos históricos de meses anteriores
    const allHist = satData
      .filter(r => r.asesor === nombre)
      .sort((a,b) => (a.mes+a.semana).localeCompare(b.mes+b.semana));

    // KPIs
    const pcts  = allHist.map(r => r.pct);
    const avg   = pcts.length ? Math.round(pcts.reduce((s,v)=>s+v,0)/pcts.length) : 0;
    const best  = pcts.length ? Math.max(...pcts) : 0;
    const worst = pcts.length ? Math.min(...pcts) : 0;
    const last  = pcts.length ? pcts[pcts.length-1] : 0;
    const lastNiv = getNivel(last);

    document.getElementById('sat-hist-kpis').innerHTML = [
      { label:'Actual', val:last+'%', color:lastNiv.color, bg:lastNiv.bg, bdr:lastNiv.bdr },
      { label:'Promedio', val:avg+'%', color:'#a78bfa', bg:'rgba(167,139,250,.15)', bdr:'rgba(167,139,250,.4)' },
      { label:'Mejor', val:best+'%', color:'#4ade80', bg:'rgba(74,222,128,.15)', bdr:'rgba(74,222,128,.4)' },
      { label:'Semanas', val:allHist.length, color:'#f4d03f', bg:'rgba(244,208,63,.15)', bdr:'rgba(244,208,63,.4)' },
    ].map(k => `
      <div style="flex:1;min-width:80px;background:${k.bg};border:1.5px solid ${k.bdr};border-radius:12px;padding:12px 14px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">${k.label}</div>
        <div style="font-size:22px;font-weight:900;color:${k.color};line-height:1">${k.val}</div>
      </div>`).join('');

    // Gráfica de barras
    const chartEl  = document.getElementById('sat-hist-chart');
    const labelsEl = document.getElementById('sat-hist-labels');
    const maxPct   = Math.max(...allHist.map(r=>r.pct), 1);

    chartEl.innerHTML = allHist.map(r => {
      const nv  = getNivel(r.pct);
      const h   = Math.max((r.pct/100)*90, 4);
      const wk  = r.semana.includes('W') ? r.semana.replace(/^\d{4}-W/,'W') : r.semana.split('-')[2];
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;min-width:28px;max-width:48px">
        <div style="font-size:9px;font-weight:700;color:${nv.color}">${r.pct}%</div>
        <div title="${wk}: ${r.pct}%" style="width:100%;height:${h}px;background:linear-gradient(180deg,${nv.bdr},${nv.color});border-radius:5px 5px 0 0;transition:height .4s;cursor:default"></div>
      </div>`;
    }).join('');

    labelsEl.innerHTML = allHist.map(r => {
      const wk = r.semana.includes('W') ? r.semana.replace(/^\d{4}-/,'') : r.semana.split('-')[2];
      const mn = r.mes.split('-')[1];
      return `<div style="flex:1;text-align:center;font-size:8.5px;color:rgba(255,255,255,.3);font-weight:600;min-width:28px;max-width:48px">${wk}<br>${mn}</div>`;
    }).join('');

    // Tabla detalle
    document.getElementById('sat-hist-table').innerHTML = allHist.length
      ? allHist.map(r => {
          const nv = getNivel(r.pct);
          const wk = r.semana.includes('W') ? r.semana.replace(/^\d{4}-/,'') : _formatSemana(r.semana);
          const mn = MESES_N[parseInt(r.mes.split('-')[1])-1];
          return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,.04);border-radius:10px;margin-bottom:6px">
            <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.5);width:60px">${mn} ${wk}</div>
            <div style="flex:1;background:rgba(255,255,255,.08);border-radius:99px;height:6px;overflow:hidden">
              <div style="width:${r.pct}%;height:100%;background:${nv.color};border-radius:99px"></div>
            </div>
            <div style="font-size:14px;font-weight:900;color:${nv.color};width:44px;text-align:right">${r.pct}%</div>
            ${r.tmo ? `<div style="font-size:10px;color:rgba(255,255,255,.3)">⏱${r.tmo}</div>` : ''}
          </div>`;
        }).join('')
      : '<div style="color:rgba(255,255,255,.3);font-size:13px;text-align:center;padding:20px">Sin datos históricos</div>';

    // Daily tab
    const dayMap = {};
    allHist.forEach(r => {
      dayMap[r.semana] = { label: _formatSemana(r.semana), pct:r.pct, nv:getNivel(r.pct) };
    });
    const dayEl = document.getElementById('sat-hist-daily');
    if (dayEl) {
      const dKeys = Object.keys(dayMap).sort();
      dayEl.innerHTML = dKeys.length ? dKeys.map((k,i) => {
        const d=dayMap[k],nv=d.nv;
        const isLast = i === dKeys.length-1;
        return '<div style="border-radius:14px;margin-bottom:8px;overflow:hidden;border:1px solid rgba(255,255,255,.08)">'
          // Cabecera con fecha
          +'<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)">'
          +'<div style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">'
          +'<i class="ti ti-calendar" style="font-size:15px;color:rgba(255,255,255,.5)"></i></div>'
          +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:13px;font-weight:800;color:#fff;white-space:nowrap">'+d.label+'</div>'
          +'<div style="font-size:10px;color:rgba(255,255,255,.35);font-weight:500">Excel del día subido</div>'
          +'</div>'
          +(isLast ? '<div style="font-size:9px;font-weight:700;background:rgba(167,139,250,.2);color:#a78bfa;border-radius:6px;padding:2px 8px;white-space:nowrap">Último cargado</div>' : '')
          +'</div>'
          // Barra de progreso
          +'<div style="padding:12px 14px;background:rgba(0,0,0,.2)">'
          +'<div style="display:flex;align-items:center;gap:10px">'
          +'<div style="flex:1;background:rgba(255,255,255,.08);border-radius:99px;height:14px;overflow:hidden">'
          +'<div style="width:'+d.pct+'%;height:100%;background:linear-gradient(90deg,'+nv.color+','+nv.color+'cc);border-radius:99px;transition:width .4s"></div></div>'
          +'<div style="font-size:22px;font-weight:900;color:'+nv.color+';min-width:54px;text-align:right;flex-shrink:0">'+d.pct+'%</div>'
          +'</div>'
          +'<div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,.35);font-weight:600">'+nv.label+'</div>'
          +'</div>'
          +'</div>';
      }).join('') : '<div style="color:rgba(255,255,255,.3);text-align:center;padding:20px">Sin datos para este mes</div>';
    }

        modal.style.display = 'flex';
    modal.addEventListener('click', e => { if(e.target===modal) modal.style.display='none'; }, {once:true});
    if(window._satTabSwitch) window._satTabSwitch('sem');
  };

  // ── Excel ─────────────────────────────────────────────────────
  function getISOWeek(d) {
    const dt=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
    const day=dt.getUTCDay()||7; dt.setUTCDate(dt.getUTCDate()+4-day);
    const ys=new Date(Date.UTC(dt.getUTCFullYear(),0,1));
    return Math.ceil((((dt-ys)/86400000)+1)/7);
  }

  function leerExcelGenesys(file) {
    const st = document.getElementById('sat-upload-status');
    st.textContent = '⏳ Leyendo archivo...'; st.style.color = '#a78bfa';
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const wb  = XLSX.read(e.target.result, { type:'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        if (!raw.length) throw new Error('Archivo vacio');

        const SKIP = ['asesor','nombres','apellidos','nombre','agente','agent','total','promedio','equipo','sise','satisfacci','acum','fecha'];

        // Detectar fila de headers
        let headerRow = 0;
        for (let i = 0; i < Math.min(5, raw.length); i++) {
          if (raw[i].filter(c=>String(c).trim()).length > raw[headerRow].filter(c=>String(c).trim()).length)
            headerRow = i;
        }
        const headers = raw[headerRow].map(h => String(h).trim());

        // Col nombre
        let colN = 0;
        for (let i = 0; i < headers.length; i++) {
          const h = headers[i].toLowerCase();
          if (h.includes('asesor')||h.includes('nombre')||h.includes('agente')) { colN=i; break; }
        }

        // Col ACUM (prioritaria)
        let colP = -1;
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].toLowerCase().includes('acum')) { colP=i; break; }
        }
        if (colP === -1) {
          for (let i = 0; i < headers.length; i++) {
            const h = headers[i].toLowerCase();
            if (h.includes('satisf')||h.includes('%')) { colP=i; break; }
          }
        }

        // Columnas de dias (fallback si no hay ACUM)
        const colDias = [];
        if (colP === -1) {
          headers.forEach((h,i) => {
            if (i===colN) return;
            if (/\d/.test(h) && /[a-zA-Z]/.test(h) && !h.toLowerCase().includes('tmo')) colDias.push(i);
          });
        }

        // Col TMO
        let colT = -1;
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].toLowerCase().includes('tmo')) { colT=i; break; }
        }

        const regs = [];
        for (let ri = headerRow+1; ri < raw.length; ri++) {
          const row    = raw[ri];
          const nombre = String(row[colN]||'').trim();
          if (!nombre) continue;
          const low = nombre.toLowerCase();
          if (SKIP.some(w => low===w||low.startsWith(w+' '))) continue;

          let pct = 0;
          if (colP >= 0) {
            pct = Math.round(parseFloat(String(row[colP]||'0').replace('%',''))||0);
          } else if (colDias.length) {
            const vals = colDias
              .map(ci => parseFloat(String(row[ci]||'').replace('%',''))||null)
              .filter(v => v!==null && !isNaN(v));
            pct = vals.length ? Math.round(vals.reduce((s,v)=>s+v,0)/vals.length) : 0;
          }

          const tmo = colT>=0 ? String(row[colT]||'').trim() : '';
          regs.push({ asesor:nombre, pct, tmo });
        }

        if (!regs.length) throw new Error('Sin datos validos. Verifica que el Excel tenga columna ACUM o dias con porcentajes');

        const ahora  = new Date();
        // Usar fecha exacta del día como semana
        const semana = ahora.getFullYear()+'-'+String(ahora.getMonth()+1).padStart(2,'0')+'-'+String(ahora.getDate()).padStart(2,'0');
        st.textContent = `Guardando ${regs.length} asesores...`;
        await window._satGuardar(regs, semana);
        st.textContent = `${regs.length} asesores cargados correctamente`;
        st.style.color = '#4ade80';
        showToast('Satisfaccion actualizada');
        // Notificación de carga completada
        if (window._satShowNotif) {
          window._satShowNotif({
            icon: '📊', label: 'Ranking actualizado',
            title: 'Datos cargados correctamente',
            sub: regs.length + ' asesores · El ranking se ha actualizado',
            color: '#a78bfa', duration: 5000,
          });
        }
      } catch(err) {
        st.textContent = 'Error: ' + err.message;
        st.style.color = '#f87171';
        showToast('Error al leer el Excel', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }



  // ── Helper rol supervisor ─────────────────────────────────────
  function _esSupervisorSat() {
    const r = (window.currentUserRol||'').toLowerCase();
    return r==='supervisor'||r==='bo'||r==='formador';
  }

  // ── Búsqueda de asesor ────────────────────────────────────────
  window._satBuscar = function(q) {
    const val = q.toLowerCase().trim();
    document.querySelectorAll('#sat-ranking-list .sat-row').forEach(row => {
      const nameEl = row.querySelector('[data-asesor]');
      if (!nameEl) return;
      const nombre = nameEl.dataset.asesor.toLowerCase();
      row.style.display = (!val || nombre.includes(val)) ? '' : 'none';
    });
  };

  // ── Reiniciar tabla del mes ───────────────────────────────────
  window._satConfirmarReinicio = function() {
    const modal = document.getElementById('sat-confirm-modal');
    if (modal) modal.style.display = 'flex';
  };

  window._satEjecutarReinicio = async function() {
    const borrarLogros = document.getElementById('sat-reset-logros-cb')?.checked;
    document.getElementById('sat-confirm-modal').style.display = 'none';
    try {
      const {getFirestore,collection,getDocs,query,where,deleteDoc,doc} = window._fbModules||{};
      if (!getFirestore) return;
      const db  = getFirestore();
      const mes = mesActual();
      // Borrar ranking del mes
      const snap= await getDocs(query(collection(db,'satisfaccion'), where('mes','==',mes)));
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db,'satisfaccion',d.id))));
      // Borrar logros si se marcó la casilla
      if (borrarLogros) {
        const snapL = await getDocs(collection(db,'logros_asesores'));
        await Promise.all(snapL.docs.map(d => deleteDoc(doc(db,'logros_asesores',d.id))));
        showToast('Ranking y logros borrados completamente ✓');
      } else {
        showToast('Ranking del mes borrado completamente ✓');
      }
    } catch(e) {
      showToast('Error al reiniciar: '+e.message,'error');
    }
  };

  // ── Eliminar asesor del ranking (supervisor) ──────────────────
  window._satEliminarAsesor = async function(nombre, semana) {
    if (!confirm('¿Quitar a '+nombre+' del ranking de la semana '+semana+'?')) return;
    try {
      const {getFirestore,collection,getDocs,query,where,deleteDoc,doc} = window._fbModules||{};
      const db  = getFirestore();
      const mes = mesActual();
      const q   = query(collection(db,'satisfaccion'),
        where('asesor','==',nombre), where('semana','==',semana), where('mes','==',mes));
      const snap= await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db,'satisfaccion',d.id))));
      showToast(nombre+' eliminado del ranking ✓');
    } catch(e) {
      showToast('Error: '+e.message,'error');
    }
  };

  // ── Mostrar/ocultar botón de reinicio según rol ───────────────
  function updateSatControls() {
    const btn = document.getElementById('sat-btn-reset-mes');
    if (btn) btn.style.display = _esSupervisorSat() ? 'flex' : 'none';
  }
  window.addEventListener('sise:rolCargado', updateSatControls);
  if (window.currentUserRol) updateSatControls();

  // ── Reemplazar renderFilterBar (ya no se usa chips) ───────────
  function renderFilterBar(ranking) {
    // Solo aseguramos que el botón de reinicio esté visible para supervisores
    updateSatControls();
  }

  // ── Tabs del modal de historial ───────────────────────────────
  window._satTabSwitch = function(tab) {
    const semBtn = document.getElementById('sat-tab-sem');
    const diaBtn = document.getElementById('sat-tab-dia');
    const semDiv = document.getElementById('sat-hist-table');
    const diaDiv = document.getElementById('sat-hist-daily');
    if (!semBtn) return;
    if (tab === 'sem') {
      semBtn.style.cssText += ';background:#a78bfa;color:#fff;border-color:#a78bfa';
      diaBtn.style.cssText += ';background:transparent;color:rgba(255,255,255,.5);border-color:rgba(255,255,255,.15)';
      if (semDiv) semDiv.style.display = '';
      if (diaDiv) diaDiv.style.display = 'none';
    } else {
      diaBtn.style.cssText += ';background:#a78bfa;color:#fff;border-color:#a78bfa';
      semBtn.style.cssText += ';background:transparent;color:rgba(255,255,255,.5);border-color:rgba(255,255,255,.15)';
      if (semDiv) semDiv.style.display = 'none';
      if (diaDiv) diaDiv.style.display = '';
    }
  };


  function onSatViewActive() {
    const rol=(window.currentUserRol||'').toLowerCase();
    const esSup=rol==='supervisor'||rol==='bo'||rol==='formador';
    const bar=document.getElementById('sat-supervisor-bar');
    if(bar) bar.style.display=esSup?'flex':'none';
    const btnGL=document.getElementById('btn-gestionar-logros');
    if(btnGL) btnGL.style.display=esSup?'flex':'none';


    const fi=document.getElementById('sat-file-input');
    if(fi&&!fi._bound){ fi._bound=true; fi.addEventListener('change',e=>{if(e.target.files[0])leerExcelGenesys(e.target.files[0]);e.target.value='';}); }

    if(!satUnsub) initSatFirebase();
  }

  const obs=new MutationObserver(()=>{ try { const v=document.getElementById('view-satisfaccion'); if(v&&v.classList.contains('active')) onSatViewActive(); } catch(e) { console.error('onSatViewActive (capturado):', e); } });
  const mc=document.querySelector('.content');
  if(mc) obs.observe(mc,{subtree:true,attributes:true,attributeFilter:['class']});
  if(document.getElementById('view-satisfaccion')?.classList.contains('active')) onSatViewActive();
  window._initSatFirebase=initSatFirebase;
})();



// ══════════════════════════════════════════════════════════════
// MODO SIN CONEXIÓN — banner + protección de datos
// ══════════════════════════════════════════════════════════════
(function() {

  // ── Estilos del banner ────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #offline-banner {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 999998;
      background: linear-gradient(135deg, #1a0a0a, #2d0d0d);
      border-bottom: 2px solid #C41E3A;
      padding: 0;
      transform: translateY(-100%);
      transition: transform 0.4s cubic-bezier(.22,.68,0,1.2);
      box-shadow: 0 4px 24px rgba(196,30,58,.4);
    }
    #offline-banner.visible {
      transform: translateY(0);
    }
    #offline-banner-inner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 20px;
      max-width: 100%;
    }
    #offline-icon {
      width: 32px; height: 32px;
      background: rgba(196,30,58,.2);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      font-size: 16px;
    }
    #offline-text { flex: 1; min-width: 0; }
    #offline-title {
      font-size: 13px; font-weight: 800;
      color: #fff; line-height: 1.2; margin-bottom: 1px;
    }
    #offline-sub {
      font-size: 11px; color: rgba(255,255,255,.5);
      font-weight: 500;
    }
    #offline-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #C41E3A;
      flex-shrink: 0;
      animation: off-pulse 1.5s ease-in-out infinite;
    }
    @keyframes off-pulse {
      0%,100% { opacity:1; box-shadow: 0 0 0 0 rgba(196,30,58,.5); }
      50%      { opacity:.6; box-shadow: 0 0 0 5px rgba(196,30,58,0); }
    }
    #offline-retry {
      padding: 6px 14px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.15);
      border-radius: 8px;
      color: #fff;
      font-size: 12px; font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background .15s;
      white-space: nowrap;
      flex-shrink: 0;
    }
    #offline-retry:hover { background: rgba(255,255,255,.16); }

    /* Banner de reconexión (verde) */
    #online-banner {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 999998;
      background: linear-gradient(135deg, #0a1a0a, #0d2d0d);
      border-bottom: 2px solid #2ECC71;
      padding: 0;
      transform: translateY(-100%);
      transition: transform 0.4s cubic-bezier(.22,.68,0,1.2);
      box-shadow: 0 4px 24px rgba(46,204,113,.3);
    }
    #online-banner.visible { transform: translateY(0); }
    #online-banner-inner {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 20px;
    }
    #online-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #2ECC71; flex-shrink: 0;
      animation: on-pulse 1s ease-in-out 3;
    }
    @keyframes on-pulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(46,204,113,.5); }
      50%      { box-shadow: 0 0 0 6px rgba(46,204,113,0); }
    }

    /* Overlay que bloquea interacción cuando está offline */
    #offline-overlay {
      display: none;
      position: fixed; inset: 0;
      z-index: 999990;
      background: rgba(0,0,0,0);
      pointer-events: none;
    }
    #offline-overlay.blocking {
      pointer-events: all;
      background: rgba(0,0,0,0);
    }

    /* Ajuste del topbar cuando sale el banner */
    body.is-offline .topbar,
    body.is-offline .sidebar {
      margin-top: 52px;
      transition: margin-top .4s;
    }
    body.is-offline .content {
      margin-top: 0;
    }
  `;
  document.head.appendChild(style);

  // ── HTML del banner offline ───────────────────────────────────
  const offBanner = document.createElement('div');
  offBanner.id = 'offline-banner';
  offBanner.innerHTML = `
    <div id="offline-banner-inner">
      <div id="offline-dot"></div>
      <div id="offline-icon">📡</div>
      <div id="offline-text">
        <div id="offline-title">Sin conexión a internet</div>
        <div id="offline-sub">Los datos mostrados pueden estar desactualizados. Reconectando...</div>
      </div>
      <button id="offline-retry">Reintentar</button>
    </div>`;
  document.body.appendChild(offBanner);

  // ── HTML del banner online ────────────────────────────────────
  const onBanner = document.createElement('div');
  onBanner.id = 'online-banner';
  onBanner.innerHTML = `
    <div id="online-banner-inner">
      <div id="online-dot"></div>
      <div style="font-size:13px;font-weight:800;color:#fff">Conexión restaurada</div>
      <div style="font-size:11px;color:rgba(255,255,255,.5);margin-left:4px">— Sincronizando datos...</div>
    </div>`;
  document.body.appendChild(onBanner);

  // ── Overlay bloqueante ────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'offline-overlay';
  document.body.appendChild(overlay);

  // ── Estado ────────────────────────────────────────────────────
  let isOffline   = false;
  let wasOffline  = false;
  let retryTimer  = null;
  let offlineTime = null;

  // ── Mostrar banner offline ────────────────────────────────────
  function goOffline() {
    if (isOffline) return;
    isOffline   = true;
    offlineTime = new Date();
    document.body.classList.add('is-offline');
    offBanner.classList.add('visible');
    onBanner.classList.remove('visible');

    // Toast informativo
    if (window.showToast) {
      showToast('Sin conexión — los datos pueden estar desactualizados', 'error');
    }

    // Actualizar subtítulo con tiempo
    startOfflineTimer();
  }

  // ── Mostrar banner online ─────────────────────────────────────
  function goOnline() {
    if (!isOffline) return;
    isOffline  = false;
    wasOffline = true;
    document.body.classList.remove('is-offline');
    offBanner.classList.remove('visible');
    onBanner.classList.add('visible');
    stopOfflineTimer();

    // Calcular tiempo que estuvo offline
    const secs = offlineTime ? Math.round((new Date() - offlineTime) / 1000) : 0;
    const timeStr = secs < 60 ? secs + 's' : Math.round(secs/60) + 'min';
    onBanner.querySelector('div:last-child').textContent = '— Reconectado después de ' + timeStr;

    if (window.showToast) {
      showToast('Conexión restaurada ✓');
    }

    // Ocultar banner online después de 4 segundos
    setTimeout(() => {
      onBanner.classList.remove('visible');
      wasOffline = false;
    }, 4000);
  }

  // ── Timer mostrando cuánto tiempo sin conexión ────────────────
  function startOfflineTimer() {
    stopOfflineTimer();
    retryTimer = setInterval(() => {
      if (!offlineTime) return;
      const secs = Math.round((new Date() - offlineTime) / 1000);
      const sub  = document.getElementById('offline-sub');
      if (!sub) return;
      if (secs < 60) {
        sub.textContent = 'Sin internet hace ' + secs + ' segundos. Los datos pueden estar desactualizados.';
      } else {
        sub.textContent = 'Sin internet hace ' + Math.round(secs/60) + ' minutos. Reconectando...';
      }
    }, 5000);
  }

  function stopOfflineTimer() {
    if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
  }

  // ── Botón reintentar ──────────────────────────────────────────
  document.getElementById('offline-retry').addEventListener('click', () => {
    // Intentar hacer un fetch ligero para verificar conexión
    const btn = document.getElementById('offline-retry');
    btn.textContent = 'Verificando...';
    btn.disabled    = true;
    fetch('https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js', {
      method: 'HEAD', cache: 'no-store', mode: 'no-cors'
    })
    .then(() => {
      // Si llega aquí hay conexión — el evento online debería dispararse
      window.dispatchEvent(new Event('online'));
      btn.textContent = 'Reintentar';
      btn.disabled    = false;
    })
    .catch(() => {
      btn.textContent = 'Sin conexión';
      setTimeout(() => {
        btn.textContent = 'Reintentar';
        btn.disabled    = false;
      }, 2000);
    });
  });

  // ── Detectar cambios de conexión del navegador ────────────────
  window.addEventListener('offline', () => {
    goOffline();
  });

  window.addEventListener('online', () => {
    // Verificar que realmente hay conexión (no solo que el navegador dice "online")
    fetch('https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js', {
      method: 'HEAD', cache: 'no-store', mode: 'no-cors'
    })
    .then(() => goOnline())
    .catch(() => { /* sigue offline */ });
  });

  // ── Verificación proactiva cada 30 segundos ───────────────────
  setInterval(() => {
    if (!navigator.onLine) {
      goOffline();
      return;
    }
    // Si el navegador dice online pero sospechamos que no hay real conexión
    if (isOffline) {
      fetch('https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js', {
        method: 'HEAD', cache: 'no-store', mode: 'no-cors'
      })
      .then(() => goOnline())
      .catch(() => { /* sigue offline */ });
    }
  }, 30000);

  // ── Detectar errores de Firebase por conexión ─────────────────
  // Interceptar errores de red globales
  window.addEventListener('unhandledrejection', e => {
    const msg = (e.reason && e.reason.message) ? e.reason.message.toLowerCase() : '';
    if (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('unavailable') ||
      !navigator.onLine
    ) {
      goOffline();
    }
  });

  // ── Estado inicial ────────────────────────────────────────────
  if (!navigator.onLine) {
    goOffline();
  }

})();



// ══════════════════════════════════════════════════════════════
// NOTIFICACIONES DE RANKING — estilo logro Steam
// ══════════════════════════════════════════════════════════════
(function() {

  const notifStyle = document.createElement('style');
  notifStyle.textContent = `
    #sat-notif-container {
      position: fixed;
      bottom: 24px; right: 24px;
      z-index: 999997;
      display: flex; flex-direction: column-reverse;
      gap: 10px; pointer-events: none;
      max-width: 340px; width: calc(100vw - 48px);
    }

    .sat-notif {
      background: linear-gradient(135deg, #1a1035 0%, #0d0020 100%);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 14px;
      padding: 0;
      box-shadow: 0 8px 32px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.05);
      overflow: hidden;
      pointer-events: all;
      transform: translateX(120%);
      opacity: 0;
      transition: transform .45s cubic-bezier(.22,.68,0,1.2), opacity .3s;
      position: relative;
    }
    .sat-notif.show {
      transform: translateX(0);
      opacity: 1;
    }
    .sat-notif.hide {
      transform: translateX(120%);
      opacity: 0;
      transition: transform .35s ease-in, opacity .25s;
    }

    /* Barra de progreso de auto-cierre */
    .sat-notif-progress {
      position: absolute;
      bottom: 0; left: 0;
      height: 2px;
      background: var(--notif-color, #a78bfa);
      border-radius: 0 0 0 14px;
      animation: notif-progress var(--notif-duration, 5s) linear forwards;
    }
    @keyframes notif-progress {
      from { width: 100%; }
      to   { width: 0%; }
    }

    .sat-notif-inner {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px;
    }

    .sat-notif-icon {
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; flex-shrink: 0;
      position: relative;
    }
    .sat-notif-icon::after {
      content: '';
      position: absolute; inset: -2px;
      border-radius: 14px;
      border: 1.5px solid var(--notif-color, #a78bfa);
      opacity: .5;
      animation: notif-ring-pulse 2s ease-in-out infinite;
    }
    @keyframes notif-ring-pulse {
      0%,100% { opacity:.4; transform:scale(1); }
      50%      { opacity:.8; transform:scale(1.05); }
    }

    .sat-notif-text { flex: 1; min-width: 0; }
    .sat-notif-label {
      font-size: 9.5px; font-weight: 800;
      text-transform: uppercase; letter-spacing: .1em;
      color: var(--notif-color, #a78bfa);
      margin-bottom: 2px;
    }
    .sat-notif-title {
      font-size: 13px; font-weight: 800;
      color: #fff; line-height: 1.3; margin-bottom: 2px;
    }
    .sat-notif-sub {
      font-size: 11px; color: rgba(255,255,255,.45);
      font-weight: 500; line-height: 1.4;
    }

    .sat-notif-close {
      position: absolute; top: 8px; right: 10px;
      background: none; border: none;
      color: rgba(255,255,255,.25); font-size: 14px;
      cursor: pointer; padding: 2px; line-height: 1;
      font-family: inherit; transition: color .15s;
    }
    .sat-notif-close:hover { color: rgba(255,255,255,.7); }

    /* Shimmer en notificación de top1 */
    .sat-notif-top1 {
      background: linear-gradient(135deg, #1a1500 0%, #2d2000 50%, #1a1500 100%);
      border-color: rgba(255,215,0,.3);
    }
    .sat-notif-top1::before {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(90deg,transparent 30%,rgba(255,215,0,.06) 50%,transparent 70%);
      background-size: 300% auto;
      animation: notif-shimmer 3s linear infinite;
      pointer-events: none;
    }
    @keyframes notif-shimmer {
      0%  { background-position: 200% center; }
      100%{ background-position: -200% center; }
    }
  `;
  document.head.appendChild(notifStyle);

  // Contenedor
  const container = document.createElement('div');
  container.id = 'sat-notif-container';
  document.body.appendChild(container);

  // ── Función principal para mostrar notificación ───────────────
  let notifQueue = [];
  let isShowingQueue = false;

  function showNotif({ icon, label, title, sub, color, duration = 5000, type = '', onClick = null }) {
    notifQueue.push({ icon, label, title, sub, color, duration, type, onClick });
    if (!isShowingQueue) processQueue();
  }

  function processQueue() {
    if (!notifQueue.length) { isShowingQueue = false; return; }
    isShowingQueue = true;
    const cfg = notifQueue.shift();
    _renderNotif(cfg);
    setTimeout(processQueue, 600);
  }

  function _renderNotif({ icon, label, title, sub, color, duration, type, onClick }) {
    const el = document.createElement('div');
    el.className = 'sat-notif' + (type === 'top1' ? ' sat-notif-top1' : '');
    el.style.setProperty('--notif-color', color || '#a78bfa');
    el.style.setProperty('--notif-duration', (duration / 1000) + 's');
    if (onClick) el.style.cursor = 'pointer';
    el.innerHTML = `
      <div class="sat-notif-inner">
        <div class="sat-notif-icon" style="background:${color}18">${icon}</div>
        <div class="sat-notif-text">
          <div class="sat-notif-label">${label}</div>
          <div class="sat-notif-title">${title}</div>
          <div class="sat-notif-sub">${sub}</div>
        </div>
      </div>
      <div class="sat-notif-progress"></div>
      <button class="sat-notif-close" onclick="event.stopPropagation();this.parentElement.remove()">✕</button>`;

    if (onClick) {
      el.addEventListener('click', () => {
        try { onClick(); } catch(e) {}
        el.classList.add('hide');
        setTimeout(() => { if (el.parentElement) el.remove(); }, 400);
      });
    }

    container.appendChild(el);

    // Animar entrada
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { el.classList.add('show'); });
    });

    // Auto-cerrar
    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => { if (el.parentElement) el.remove(); }, 400);
    }, duration);
  }

  // ── Sonido suave de notificación ─────────────────────────────
  function playNotifSound(type) {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const freqs = type === 'top1'    ? [523, 659, 784] :
                    type === 'subida'  ? [440, 523] :
                    type === 'bajada'  ? [440, 392] :
                    [440];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = f;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
        gain.gain.linearRampToValueAtTime(0, t + 0.3);
        osc.start(t); osc.stop(t + 0.35);
      });
    } catch(e) {}
  }

  // ── Navegar a la vista de ranking (Satisfacción) ───────────────
  function _goToRanking() {
    try { document.querySelector('[data-view="satisfaccion"]')?.click(); } catch(e) {}
  }

  // ── Comparar rankings y generar notificaciones ────────────────
  let _prevRanking = null;

  window._satNotifComparar = function(newRanking) {
    if (!newRanking || !newRanking.length) { _prevRanking = newRanking; return; }

    const miNombre = (window.currentUserNombre || '').toLowerCase();
    const miPrimNombre = miNombre.split(' ')[0];

    // Primera carga — solo mostrar UNA notificación de posición del usuario
    if (!_prevRanking) {
      _prevRanking = newRanking;
      if (!miPrimNombre) return;
      const miPos = newRanking.findIndex(r => r.asesor.toLowerCase().includes(miPrimNombre));
      if (miPos < 0) return;
      const pos = miPos + 1;
      const r   = newRanking[miPos];
      const niv = _satGetNivelNotif(r.pct);
      if (pos === 1) {
        showNotif({ icon:'👑', label:'Tu posición actual', type:'top1',
          title:'¡Estás en el #1!', sub: r.pct + '% — ' + niv.label + '. ¡Mantén el ritmo!',
          color:'#FFD700', duration:7000, onClick:_goToRanking });
        playNotifSound('top1');
      } else if (pos <= 3) {
        showNotif({ icon:['','🥇','🥈','🥉'][pos], label:'Tu posición actual',
          title:'¡Estás en el top ' + pos + '!', sub: r.pct + '% — ' + niv.label + '. ¡Sigue así!',
          color: pos===2 ? '#C0C0C0' : '#CD7F32', duration:6000, onClick:_goToRanking });
        playNotifSound('subida');
      }
      return;
    }

    // Comparar con ranking anterior — SOLO notificar cambios reales
    const prev = _prevRanking;
    _prevRanking = newRanking;

    // Si el ranking no cambió nada, no notificar
    const rankStr = r => r.asesor + r.pct;
    if (newRanking.map(rankStr).join('|') === prev.map(rankStr).join('|')) return;

    let notifCount = 0; // máximo 3 notificaciones por actualización
    const MAX_NOTIFS = 3;

    // Solo notificar cambios RELEVANTES (no "se mantiene")
    newRanking.forEach((r, newIdx) => {
      if (notifCount >= MAX_NOTIFS) return;
      const newPos = newIdx + 1;
      const prevIdx = prev.findIndex(p => p.asesor === r.asesor);
      const prevPos = prevIdx >= 0 ? prevIdx + 1 : null;
      const niv = _satGetNivelNotif(r.pct);
      const esYo = miPrimNombre && r.asesor.toLowerCase().includes(miPrimNombre);

      // Nuevo líder (cambio real)
      if (newPos === 1 && prevPos !== 1 && prevPos !== null) {
        showNotif({ icon:'👑', label:'Nuevo líder del ranking', type:'top1',
          title: r.asesor.split(' ')[0] + ' tomó el #1',
          sub: r.pct + '% — ' + niv.label + '. ¡Un nuevo campeón!',
          color:'#FFD700', duration:8000, onClick:_goToRanking });
        playNotifSound('top1');
        notifCount++;
        return;
      }

      // Solo notificaciones personales (para el usuario actual)
      if (!esYo || prevPos === null) return;

      if (newPos < prevPos) {
        // Subiste
        if (newPos === 1) {
          showNotif({ icon:'👑', label:'¡Logro desbloqueado!', type:'top1',
            title:'¡Alcanzaste el #1!', sub:'¡Eres el mejor del equipo! ' + r.pct + '%',
            color:'#FFD700', duration:10000, onClick:_goToRanking });
          playNotifSound('top1');
        } else if (newPos <= 3) {
          showNotif({ icon:['','🥇','🥈','🥉'][newPos], label:'¡Subiste en el ranking!',
            title:'¡Ahora eres #' + newPos + '!',
            sub:'Subiste ' + (prevPos-newPos) + ' puesto(s). ¡Sigue así! 🔥',
            color:'#4ADE80', duration:7000, onClick:_goToRanking });
          playNotifSound('subida');
        } else {
          showNotif({ icon:'⬆️', label:'Subiste en el ranking',
            title:'Ahora estás en el puesto #' + newPos,
            sub:'Subiste ' + (prevPos-newPos) + ' lugar(es). ¡Buen trabajo!',
            color:'#4ADE80', duration:6000, onClick:_goToRanking });
          playNotifSound('subida');
        }
        notifCount++;
      } else if (newPos > prevPos) {
        // Bajaste
        if (prevPos <= 3) {
          showNotif({ icon:'⚡', label:'Te han superado',
            title:'Bajaste del #' + prevPos + ' al #' + newPos,
            sub:'¡Hora de dar más! Puedes recuperar tu posición 💪',
            color:'#F26522', duration:7000, onClick:_goToRanking });
        } else {
          showNotif({ icon:'📉', label:'Cambio en tu posición',
            title:'Bajaste al puesto #' + newPos,
            sub:'Estabas en #' + prevPos + '. ¡Aún puedes subir!',
            color:'#F26522', duration:6000, onClick:_goToRanking });
        }
        playNotifSound('bajada');
        notifCount++;
      } else {
        // Te mantienes en el mismo puesto
        if (newPos === 1) {
          showNotif({ icon:'👑', label:'Tu posición actual', type:'top1',
            title:'Te mantienes en el #1', sub: r.pct + '% — ' + niv.label + '. ¡Sigue así!',
            color:'#FFD700', duration:6000, onClick:_goToRanking });
        } else if (newPos <= 3) {
          showNotif({ icon:['','🥇','🥈','🥉'][newPos], label:'Tu posición actual',
            title:'Te mantienes en el top ' + newPos,
            sub: r.pct + '% — ' + niv.label + '. ¡Sigue así!',
            color: newPos===2 ? '#C0C0C0' : '#CD7F32', duration:6000, onClick:_goToRanking });
        } else {
          showNotif({ icon:'📌', label:'Tu posición actual',
            title:'Te mantienes en el puesto #' + newPos,
            sub: r.pct + '% — ' + niv.label + '. ¡Tú puedes subir!',
            color:'#a78bfa', duration:6000, onClick:_goToRanking });
        }
        notifCount++;
      }
    });
  };

  // ── Helper nivel para notificaciones ─────────────────────────
  function _satGetNivelNotif(pct) {
    if (pct >= 95) return { label: 'Diamante 💎' };
    if (pct >= 80) return { label: 'Esmeralda 💚' };
    if (pct >= 60) return { label: 'Oro 🥇' };
    if (pct >= 40) return { label: 'Plata 🥈' };
    return { label: 'Bronce 🥉' };
  }

  // Exponer globalmente
  window._satShowNotif = showNotif;

})();












// ══════════════════════════════════════════════════════════════
// LOGROS v3 — Lista de asesores en panel supervisor
// ══════════════════════════════════════════════════════════════
(function() {

  // ── CSS ───────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* Lista de asesores — compacta, debajo del ranking */
    #lg-asesores-panel {
      margin-top:16px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.07);
      border-radius:14px; overflow:hidden;
      display:none;
    }
    #lg-asesores-header {
      padding:10px 16px;
      display:flex; align-items:center; gap:8px;
      border-bottom:1px solid rgba(255,255,255,.05);
      cursor:pointer; transition:background .15s;
    }
    #lg-asesores-header:hover { background:rgba(255,255,255,.04); }
    #lg-asesores-body { display:none; }
    #lg-asesores-body.open { display:block; }
    .lg-asesor-row {
      display:flex; align-items:center; gap:10px;
      padding:9px 16px; cursor:pointer;
      border-bottom:1px solid rgba(255,255,255,.04);
      transition:background .15s;
    }
    .lg-asesor-row:last-child { border-bottom:none; }
    .lg-asesor-row:hover { background:rgba(167,139,250,.08); }
    .lg-asesor-av {
      width:28px; height:28px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:900; flex-shrink:0;
    }
    .lg-asesor-name  { flex:1; font-size:12px; font-weight:700; color:rgba(255,255,255,.8); }
    .lg-asesor-badge { font-size:10px; font-weight:600; color:rgba(255,255,255,.35); }
    .lg-asesor-arrow { color:rgba(255,255,255,.2); font-size:12px; }

    /* Modal logros individual */
    #lg-modal {
      display:none; position:fixed; inset:0;
      background:rgba(0,0,0,.88); backdrop-filter:blur(10px);
      z-index:999990; align-items:flex-start;
      justify-content:center; padding:16px; overflow-y:auto;
    }
    #lg-modal.open { display:flex; }
    #lg-wrap {
      background:#1a1035; border:1px solid rgba(255,255,255,.1);
      border-radius:22px; width:100%; max-width:720px; margin:auto;
      box-shadow:0 32px 80px rgba(0,0,0,.8); overflow:hidden;
    }

    /* Header modal */
    #lg-head {
      background:linear-gradient(135deg,#2d1b69,#1a0a3d);
      padding:18px 22px; display:flex; align-items:center;
      gap:14px; border-bottom:1px solid rgba(255,255,255,.06);
    }
    #lg-head-av {
      width:48px; height:48px; border-radius:50%; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      font-size:18px; font-weight:900;
    }

    /* Tabs del modal */
    .lg-tabs { display:flex; border-bottom:1px solid rgba(255,255,255,.07); }
    .lg-tab {
      flex:1; padding:12px 8px; font-size:12px; font-weight:700;
      color:rgba(255,255,255,.4); background:none; border:none;
      cursor:pointer; font-family:inherit;
      border-bottom:2px solid transparent; transition:all .15s;
      display:flex; align-items:center; justify-content:center; gap:5px;
    }
    .lg-tab.active { color:#a78bfa; border-bottom-color:#a78bfa; }
    .lg-tab:hover:not(.active) { color:rgba(255,255,255,.7); }

    /* Body */
    #lg-body { padding:20px 22px; }

    /* Stats */
    .lg-stats { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
    .lg-stat {
      flex:1; min-width:70px;
      background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);
      border-radius:10px; padding:9px 12px; text-align:center;
    }
    .lg-stat-val { font-size:18px; font-weight:900; color:#fff; }
    .lg-stat-lbl { font-size:9px; font-weight:700; color:rgba(255,255,255,.4); text-transform:uppercase; letter-spacing:.05em; margin-top:1px; }

    /* Cat pills */
    .lg-cats { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:14px; }
    .lg-cat {
      padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700;
      cursor:pointer; border:1.5px solid rgba(255,255,255,.12);
      background:transparent; color:rgba(255,255,255,.45); font-family:inherit; transition:all .15s;
    }
    .lg-cat.active { background:#a78bfa; color:#fff; border-color:#a78bfa; }

    /* Grid logros */
    .lg-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(175px,1fr)); gap:10px; }
    .lg-card {
      background:rgba(255,255,255,.04); border:1.5px solid rgba(255,255,255,.08);
      border-radius:14px; padding:14px; position:relative; transition:transform .18s;
    }
    .lg-card.desbloq { border-color:var(--c); box-shadow:0 0 14px var(--g); }
    .lg-card.bloq    { opacity:.35; filter:grayscale(.7); }
    .lg-card:hover   { transform:translateY(-2px); }
    .lg-icon  { font-size:26px; display:block; margin-bottom:8px; }
    .lg-name  { font-size:12px; font-weight:800; color:#fff; margin-bottom:3px; line-height:1.3; }
    .lg-desc  { font-size:10.5px; color:rgba(255,255,255,.4); line-height:1.45; margin-bottom:8px; }
    .lg-badge {
      display:inline-flex; align-items:center; gap:3px; border-radius:99px;
      padding:2px 8px; font-size:9px; font-weight:800; letter-spacing:.05em;
      border:1px solid; text-transform:uppercase;
    }
    .lg-date  { position:absolute; top:9px; right:10px; font-size:9px; color:rgba(255,255,255,.3); font-weight:600; }
    .lg-nuevo { position:absolute; top:-5px; right:-5px; background:#C41E3A; color:#fff; font-size:8px; font-weight:800; border-radius:99px; padding:2px 7px; text-transform:uppercase; }

    /* ── Panel Gestionar (supervisor) ── */
    .lg-field { margin-bottom:12px; }
    .lg-field label { display:block; font-size:11px; font-weight:700; color:rgba(255,255,255,.5); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px; }
    .lg-input  { width:100%; background:rgba(255,255,255,.07); border:1.5px solid rgba(255,255,255,.12); border-radius:10px; padding:10px 14px; font-size:13px; color:#fff; font-family:inherit; outline:none; transition:border-color .2s; }
    .lg-input:focus  { border-color:#a78bfa; }
    .lg-select { width:100%; background:#1a1035; border:1.5px solid rgba(255,255,255,.12); border-radius:10px; padding:10px 14px; font-size:13px; color:#fff; font-family:inherit; outline:none; }
    .lg-select:focus { border-color:#a78bfa; }
    .lg-row2   { display:grid; grid-template-columns:1fr 1fr; gap:10px; }

    /* Condiciones */
    .lg-cond-list { display:flex; flex-direction:column; gap:7px; margin-bottom:10px; }
    .lg-cond-row  { display:flex; align-items:flex-start; flex-direction:column; gap:4px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09); border-radius:10px; padding:10px 12px; }
    .lg-cond-inner{ display:flex; align-items:center; gap:7px; width:100%; }
    .lg-cond-sel  { flex:1; background:#1a1035; border:1.5px solid rgba(255,255,255,.1); border-radius:8px; padding:7px 10px; font-size:12px; color:#fff; font-family:inherit; outline:none; }
    .lg-cond-val  { width:90px; flex-shrink:0; background:rgba(255,255,255,.07); border:1.5px solid rgba(255,255,255,.12); border-radius:8px; padding:7px 10px; font-size:12px; color:#fff; font-family:inherit; outline:none; }
    .lg-cond-del  { width:28px; height:28px; border-radius:7px; flex-shrink:0; background:rgba(196,30,58,.1); border:1px solid rgba(196,30,58,.25); color:#f87171; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; font-family:inherit; }
    .lg-cond-hint { font-size:10px; color:rgba(255,255,255,.3); }
    .lg-add-cond  { width:100%; padding:8px; background:rgba(167,139,250,.08); border:1.5px dashed rgba(167,139,250,.28); border-radius:9px; color:#a78bfa; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; }
    .lg-add-cond:hover { background:rgba(167,139,250,.18); }

    /* Botones */
    .lg-btn-p { padding:11px 22px; background:linear-gradient(135deg,#7c3aed,#5b21b6); color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; }
    .lg-btn-g { padding:11px 22px; background:rgba(255,255,255,.06); color:rgba(255,255,255,.6); border:1px solid rgba(255,255,255,.14); border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; }
    .lg-btn-d { padding:11px 22px; background:rgba(196,30,58,.15); color:#f87171; border:1.5px solid rgba(196,30,58,.35); border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; }

    /* Lista logros en editor */
    .lg-edit-row { display:flex; align-items:center; gap:10px; padding:11px 14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:11px; margin-bottom:7px; }
    .lg-edit-row:hover { background:rgba(255,255,255,.07); }
    .lg-edit-icon { font-size:22px; flex-shrink:0; width:32px; text-align:center; }
    .lg-edit-info { flex:1; min-width:0; }
    .lg-edit-name { font-size:12.5px; font-weight:800; color:#fff; }
    .lg-edit-meta { font-size:10.5px; color:rgba(255,255,255,.35); margin-top:2px; }
    .lg-edit-btn  { padding:5px 12px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit; border:1px solid; }

    /* Zona peligrosa */
    .lg-danger { background:rgba(196,30,58,.07); border:1.5px solid rgba(196,30,58,.22); border-radius:14px; padding:18px 20px; margin-top:16px; }
    .lg-danger-t { font-size:13px; font-weight:800; color:#f87171; margin-bottom:6px; }
    .lg-danger-d { font-size:12px; color:rgba(255,255,255,.4); margin-bottom:14px; line-height:1.6; }
  `;
  document.head.appendChild(style);

  // ── Rareza ────────────────────────────────────────────────────
  const RAR = {
    comun:      {color:'#9CA3AF', bg:'rgba(156,163,175,.15)', glow:'rgba(156,163,175,.2)',  label:'Común'},
    raro:       {color:'#60A5FA', bg:'rgba(96,165,250,.15)',  glow:'rgba(96,165,250,.25)',  label:'Raro'},
    epico:      {color:'#A78BFA', bg:'rgba(167,139,250,.18)', glow:'rgba(167,139,250,.3)',  label:'Épico'},
    legendario: {color:'#FFD700', bg:'rgba(255,215,0,.15)',   glow:'rgba(255,215,0,.35)',   label:'Legendario'},
  };

  // ── Condiciones disponibles ───────────────────────────────────
  const CONDS = [
    {id:'primer_registro',   label:'Es el primer registro del asesor',                    tipo:'ninguno', hint:'Se activa la primera vez que aparece en el sistema'},
    {id:'nunca_cero',        label:'Nunca tuvo 0% en ningún registro',                   tipo:'ninguno', hint:'Todos sus registros son mayores a cero'},
    {id:'primer_reg_100',    label:'Su primer registro fue 100%',                         tipo:'ninguno', hint:'Solo si debutó con porcentaje perfecto'},
    {id:'mejor_equipo_mes',  label:'Tiene el % más alto de todo el equipo',              tipo:'ninguno', hint:'Es el primero del ranking'},
    {id:'top_n',             label:'Está en el top N del ranking',                        tipo:'numero',  placeholder:'5',    hint:'Ej: 5 → debe estar entre el puesto 1 y el 5'},
    {id:'pos_exacta',        label:'Está exactamente en el puesto N',                    tipo:'numero',  placeholder:'1',    hint:'Solo si está en ese puesto exacto'},
    {id:'mitad_superior',    label:'Está en la mitad superior del ranking',              tipo:'ninguno', hint:'En el 50% mejor del equipo'},
    {id:'pct_mayor_igual',   label:'Su % de satisfacción es mayor o igual a N',         tipo:'numero',  placeholder:'80',   hint:'Ej: 80 → necesita 80% o más'},
    {id:'pct_exacto',        label:'Su % de satisfacción es exactamente N',             tipo:'numero',  placeholder:'100',  hint:'Solo si el % es exactamente ese valor'},
    {id:'pct_entre',         label:'Su % está entre N y M',                              tipo:'rango',   placeholder:'70-85',hint:'Escribe mínimo-máximo, ej: 70-85'},
    {id:'pct_maximo_histor', label:'Su mejor % histórico es mayor o igual a N',         tipo:'numero',  placeholder:'90',   hint:'El porcentaje más alto que haya tenido alguna vez'},
    {id:'pct_sube_n_puntos', label:'Subió N o más puntos vs la semana anterior',        tipo:'numero',  placeholder:'10',   hint:'Ej: 10 → mejoró 10 puntos o más'},
    {id:'supera_promedio_n', label:'Supera el promedio del equipo en N o más puntos',   tipo:'numero',  placeholder:'10',   hint:'Ej: 10 → si el equipo promedia 65%, necesita 75%+'},
    {id:'racha_mayor_igual', label:'Lleva N o más semanas seguidas sobre el 70%',       tipo:'numero',  placeholder:'3',    hint:'Semanas consecutivas sin bajar del 70%'},
    {id:'racha_exacta',      label:'Lleva exactamente N semanas en racha',              tipo:'numero',  placeholder:'5',    hint:'Solo si tiene exactamente ese número de semanas'},
    {id:'racha_sobre_pct',   label:'Lleva N semanas seguidas sobre el M% (ej: 3-80)',   tipo:'rango',   placeholder:'3-80', hint:'semanas-porcentaje, ej: 3-80 significa 3 semanas sobre 80%'},
    {id:'sem_total_mayor',   label:'Tiene N o más semanas registradas en total',        tipo:'numero',  placeholder:'4',    hint:'Número total de semanas en el sistema'},
    {id:'sem_mes_actual',    label:'Tiene N o más registros en el mes actual',          tipo:'numero',  placeholder:'3',    hint:'Cuántas semanas del mes actual tiene'},
    {id:'nunca_bajo_pct',    label:'Nunca bajó del N% en el mes actual',               tipo:'numero',  placeholder:'70',   hint:'Todos sus registros de este mes están sobre ese porcentaje'},
    {id:'subio_n_puestos',   label:'Subió N o más puestos vs la semana anterior',      tipo:'numero',  placeholder:'5',    hint:'Diferencia de posición entre esta semana y la anterior'},
  ];

  // ── Estado ────────────────────────────────────────────────────
  let _lgDefs    = [];
  let _lgAsesor  = '';
  let _lgLogros  = {};
  let _lgCat     = 'Todos';
  let _lgTab     = 'ver';
  let _lgEditId  = null;
  let _lgConds   = [];

  // ── Modal HTML ────────────────────────────────────────────────
  const modal = document.createElement('div');
  modal.id = 'lg-modal';
  modal.innerHTML = `
    <div id="lg-wrap">
      <div id="lg-head">
        <div id="lg-head-av" style="background:rgba(167,139,250,.2);color:#a78bfa;border:2px solid #a78bfa;"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;font-weight:800;color:#a78bfa;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px">🏆 Logros</div>
          <div id="lg-head-name" style="font-size:16px;font-weight:900;color:#fff"></div>
          <div id="lg-head-sub"  style="font-size:11px;color:rgba(255,255,255,.4);margin-top:1px"></div>
        </div>
        <button onclick="document.getElementById('lg-modal').classList.remove('open')"
          style="background:rgba(255,255,255,.08);border:none;border-radius:10px;width:36px;height:36px;cursor:pointer;color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;font-family:inherit">✕</button>
      </div>
      <div class="lg-tabs">
        <button class="lg-tab active" id="lg-tab-ver"    onclick="_lgSetTab('ver')">👤 Logros de este asesor</button>
        <button class="lg-tab"        id="lg-tab-editar" onclick="_lgSetTab('editar')" style="display:none">⚙️ Gestionar logros</button>
      </div>
      <div id="lg-body" style="padding:20px 22px"></div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.classList.remove('open'); });

  // ── Notificación de logros desbloqueados (tiempo real, propio usuario) ──
  let _lgNotifUnsub = null;
  let _lgNotifSeen  = null; // set de ids ya notificados (persistido)

  function _lgNotifStorageKey() {
    const nombre = (window.currentUserNombre||'').trim().toLowerCase();
    return 'sise_logros_vistos_' + nombre.replace(/\s+/g,'_');
  }

  window._lgNotifInit = function() {
    const {getFirestore,doc,onSnapshot} = window._fbModules||{};
    if (!getFirestore) return;
    const nombre = (window.currentUserNombre||'').trim();
    if (!nombre) return;
    const key = nombre.replace(/\s+/g,'_').toLowerCase();

    // Cargar set de logros ya vistos desde localStorage
    try {
      const raw = localStorage.getItem(_lgNotifStorageKey());
      _lgNotifSeen = new Set(raw ? JSON.parse(raw) : []);
    } catch(e) { _lgNotifSeen = new Set(); }

    if (_lgNotifUnsub) _lgNotifUnsub();
    _lgNotifUnsub = onSnapshot(doc(getFirestore(),'logros_asesores',key), async snap => {
      try {
        if (!snap.exists()) return;
        const logros = snap.data().logros || {};
        const ids = Object.keys(logros);

        // Primera carga: marcar todos los existentes como vistos sin notificar
        if (!_lgNotifSeen._init) {
          ids.forEach(id => _lgNotifSeen.add(id));
          _lgNotifSeen._init = true;
          _lgNotifPersist();
          return;
        }

        const nuevos = ids.filter(id => !_lgNotifSeen.has(id));
        if (!nuevos.length) return;

        // Asegurar definiciones cargadas para mostrar icono/nombre
        if (!_lgDefs.length) await _lgCargarDefs();

        nuevos.forEach(id => _lgNotifSeen.add(id));
        _lgNotifPersist();

        if (nuevos.length === 1) {
          const def = _lgDefs.find(l => (l.id||l._fid) === nuevos[0]);
          showNotif({
            icon: (def && def.icon) || '🏆',
            label: '¡Logro desbloqueado!',
            type: 'logro',
            title: (def && def.nombre) || 'Nuevo logro',
            sub: 'Toca para ver tus logros',
            color: '#FFD700',
            duration: 8000,
            onClick: () => { window._lgAbrirAsesor(nombre); }
          });
        } else {
          showNotif({
            icon: '🏆',
            label: '¡Logros desbloqueados!',
            type: 'logro',
            title: 'Has desbloqueado ' + nuevos.length + ' logros',
            sub: 'Revísalos en Logros dentro de Satisfacción',
            color: '#FFD700',
            duration: 8000,
            onClick: () => { window._lgAbrirAsesor(nombre); }
          });
        }
        playNotifSound('top1');
      } catch(e) { console.error('_lgNotifInit snapshot:', e); }
    }, e => console.warn('_lgNotifInit onSnapshot error:', e));
  }

  function _lgNotifPersist() {
    try {
      localStorage.setItem(_lgNotifStorageKey(), JSON.stringify([...(_lgNotifSeen||[])]));
    } catch(e) {}
  }

  // ── Cargar definiciones de Firebase ──────────────────────────
  async function _lgCargarDefs() {
    const {getFirestore,collection,getDocs} = window._fbModules||{};
    if (!getFirestore) return;
    try {
      const snap = await getDocs(collection(getFirestore(),'logros_config'));
      _lgDefs = snap.docs.map(d=>({...d.data(), _fid:d.id}));
    } catch(e) { _lgDefs=[]; }
  }

  // ── Inyectar lista debajo del ranking, visible para todos ─────
  function _lgInyectarListaAsesores() {
    if (document.getElementById('lg-asesores-panel')) return;

    // Insertar después del bloque de ranking completo
    const rankingWrap = document.querySelector('#sat-ranking-list')?.closest('div[style*="border-radius:20px"]');
    const parent = rankingWrap ? rankingWrap.parentElement : document.getElementById('view-satisfaccion');
    if (!parent) return;

    const panel = document.createElement('div');
    panel.id = 'lg-asesores-panel';
    parent.appendChild(panel);

    panel.innerHTML = `
      <div id="lg-asesores-header" onclick="_lgToggleAsesores()">
        <span style="font-size:13px">🏆</span>
        <span style="font-size:12px;font-weight:700;color:rgba(255,255,255,.6)">Logros del equipo</span>
        <span id="lg-asesores-count" style="font-size:11px;color:rgba(255,255,255,.3);margin-left:3px"></span>
        <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
          <span style="font-size:10px;color:rgba(255,255,255,.25)">Clic para ver</span>
          <span id="lg-toggle-arrow" style="font-size:11px;color:rgba(255,255,255,.25);transition:transform .2s">›</span>
        </div>
      </div>
      <div id="lg-asesores-body">
        <div id="lg-asesores-list"></div>
      </div>`;
  }

  window._lgToggleAsesores = function() {
    const body  = document.getElementById('lg-asesores-body');
    const arrow = document.getElementById('lg-toggle-arrow');
    if (!body) return;
    const open = body.classList.toggle('open');
    if (arrow) arrow.style.transform = open ? 'rotate(90deg)' : '';
  };

  // ── Renderizar lista de asesores ──────────────────────────────
  function _lgRenderAsesores(ranking) {
    const panel = document.getElementById('lg-asesores-panel');
    const list  = document.getElementById('lg-asesores-list');
    const count = document.getElementById('lg-asesores-count');
    if (!panel || !list || !ranking.length) return;

    panel.style.display = 'block';
    if (count) count.textContent = '(' + ranking.length + ')';

    list.innerHTML = ranking.map((r, i) => {
      const niv = _getNiv(r.pct);
      const initials = r.asesor.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
      const posHtml = medal
        ? `<span style="font-size:13px;width:22px;flex-shrink:0;text-align:center">${medal}</span>`
        : `<span style="font-size:10px;color:rgba(255,255,255,.25);font-weight:700;width:22px;flex-shrink:0;text-align:center">${i+1}</span>`;
      return `<div class="lg-asesor-row" data-asesor="${escH ? escH(r.asesor) : r.asesor.replace(/"/g,'&quot;')}" onclick="_lgAbrirAsesor(this.dataset.asesor)">
        ${posHtml}
        <div class="lg-asesor-av" style="background:${niv.bg};color:${niv.color};border:1.5px solid ${niv.color}">${initials}</div>
        <div class="lg-asesor-name">${r.asesor}</div>
        <div class="lg-asesor-badge">${r.pct}%</div>
        <div class="lg-asesor-arrow">›</div>
      </div>`;
    }).join('');
  }

  function _getNiv(pct) {
    if (pct>=95) return {color:'#1a6fbf',bg:'rgba(74,144,217,.15)',label:'Diamante 💎'};
    if (pct>=80) return {color:'#0e7a45',bg:'rgba(46,204,113,.15)',label:'Esmeralda 💚'};
    if (pct>=60) return {color:'#9A6700',bg:'rgba(240,192,64,.15)',label:'Oro 🥇'};
    if (pct>=40) return {color:'#5A5A6A',bg:'rgba(160,160,192,.15)',label:'Plata 🥈'};
    return        {color:'#7A4A20',bg:'rgba(205,139,90,.15)',label:'Bronce 🥉'};
  }

  // ── Abrir logros de un asesor ─────────────────────────────────
  window._lgAbrirAsesor = async function(nombre) {
    // Limpiar INMEDIATAMENTE al cambiar de asesor — evita parpadeo
    _lgAsesor = nombre;
    _lgLogros = {};
    _lgCat    = 'Todos';

    // Header inmediato sin esperar Firebase
    const initials = nombre.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
    const av = document.getElementById('lg-head-av');
    av.textContent = initials;
    av.style.background = 'rgba(167,139,250,.2)';
    av.style.color = '#a78bfa';
    av.style.border = '2px solid #a78bfa';
    document.getElementById('lg-head-name').textContent = nombre;
    document.getElementById('lg-head-sub').textContent  = 'Cargando...';

    // Mostrar tab gestionar
    const rol = (window.currentUserRol||'').toLowerCase();
    const esSup = ['supervisor','bo','formador'].includes(rol);
    const tabEdit = document.getElementById('lg-tab-editar');
    if (tabEdit) tabEdit.style.display = esSup ? 'flex' : 'none';

    modal.classList.add('open');
    _lgSetTab('ver');

    // Cargar defs y logros actuales EN PARALELO
    const {getFirestore, doc, getDoc} = window._fbModules||{};
    const key = nombre.trim().replace(/\s+/g,'_').toLowerCase();

    await _lgCargarDefs();

    // Cargar logros existentes de Firebase PRIMERO (sin calcular)
    if (getFirestore) {
      try {
        const snap = await getDoc(doc(getFirestore(),'logros_asesores',key));
        _lgLogros = snap.exists() ? (snap.data().logros||{}) : {};
      } catch(e) { _lgLogros = {}; }
    }

    // Renderizar con datos actuales de Firebase (sin parpadeo)
    _lgRenderVer();

    // Calcular nuevos logros en background
    const nombreCaptura = nombre;
    _lgCalcular(nombreCaptura).then(async () => {
      if (_lgAsesor !== nombreCaptura) return; // usuario cambió de asesor
      if (!getFirestore) return;
      try {
        const snap2 = await getDoc(doc(getFirestore(),'logros_asesores',key));
        const fresh = snap2.exists() ? (snap2.data().logros||{}) : {};
        if (JSON.stringify(fresh) !== JSON.stringify(_lgLogros)) {
          _lgLogros = fresh;
          _lgRenderVer();
        }
      } catch(e) {}
    });
  };

  // ── Tabs ──────────────────────────────────────────────────────
  window._lgSetTab = function(tab) {
    _lgTab = tab;
    document.getElementById('lg-tab-ver').classList.toggle('active', tab==='ver');
    document.getElementById('lg-tab-editar').classList.toggle('active', tab==='editar');
    if (tab==='ver')    _lgRenderVer();
    if (tab==='editar') _lgRenderEditar();
  };

  // ── Render ver logros ─────────────────────────────────────────
  function _lgRenderVer() {
    const body = document.getElementById('lg-body');
    const defs = _lgDefs;
    const desbloq = Object.keys(_lgLogros).length;
    const total   = defs.length;
    document.getElementById('lg-head-sub').textContent = desbloq+' / '+total+' logros ('+Math.round(total?desbloq/total*100:0)+'%)';

    const counts={comun:0,raro:0,epico:0,legendario:0};
    Object.keys(_lgLogros).forEach(id=>{
      const d=defs.find(l=>(l.id||l._fid)===id);
      if(d) counts[d.rarity||'comun']=(counts[d.rarity||'comun']||0)+1;
    });

    const cats=['Todos',...new Set(defs.map(l=>l.cat||'General'))];
    const filtered=_lgCat==='Todos'?defs:defs.filter(l=>(l.cat||'General')===_lgCat);
    const sorted=[...filtered].sort((a,b)=>{
      const aD=!!_lgLogros[a.id||a._fid], bD=!!_lgLogros[b.id||b._fid];
      return aD===bD?0:aD?-1:1;
    });

    body.innerHTML=`
      <div class="lg-stats">
        ${[{l:'Total',v:desbloq,c:'#fff'},{l:'Comunes',v:counts.comun,c:RAR.comun.color},{l:'Raros',v:counts.raro,c:RAR.raro.color},{l:'Épicos',v:counts.epico,c:RAR.epico.color},{l:'Legendarios',v:counts.legendario,c:RAR.legendario.color}]
          .map(s=>`<div class="lg-stat"><div class="lg-stat-val" style="color:${s.c}">${s.v}</div><div class="lg-stat-lbl">${s.l}</div></div>`).join('')}
      </div>
      <div class="lg-cats">
        ${cats.map(c=>`<button class="lg-cat${c===_lgCat?' active':''}" onclick="_lgSetCat('${c}')">${c}</button>`).join('')}
      </div>
      <div class="lg-grid">
        ${sorted.length ? sorted.map(def=>{
          const key=def.id||def._fid;
          const data=_lgLogros[key];
          const r=RAR[def.rarity||'comun'];
          const rol=(window.currentUserRol||'').toLowerCase();
          const esSup=['supervisor','bo','formador'].includes(rol);
          const safeKey=key.replace(/'/g,"\\'");
          return `<div class="lg-card ${data?'desbloq':'bloq'}" style="--c:${r.color};--g:${r.glow};position:relative">
            ${data&&data.nuevo?'<div class="lg-nuevo">¡Nuevo!</div>':''}
            ${data?`<div class="lg-date">${data.fecha||''}</div>`:''}
            ${data&&esSup?`<button onclick="event.stopPropagation();_lgQuitarLogro('${safeKey}')" title="Quitar este logro" style="position:absolute;bottom:10px;right:10px;background:rgba(196,30,58,.15);border:1px solid rgba(196,30,58,.3);color:#f87171;border-radius:7px;width:24px;height:24px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;transition:all .15s;font-family:inherit" onmouseover="this.style.background='rgba(196,30,58,.3)'" onmouseout="this.style.background='rgba(196,30,58,.15)'">✕</button>`:''}
            <span class="lg-icon">${data?(def.icon||'🏆'):'🔒'}</span>
            <div class="lg-name">${def.nombre||'Sin nombre'}</div>
            <div class="lg-desc">${data?(def.desc||''):'???'}</div>
            <div class="lg-badge" style="color:${r.color};border-color:${r.color};background:${r.bg}">${r.label}</div>
            ${!data&&esSup?`<button onclick="event.stopPropagation();_lgAsignarLogro('${safeKey}')" title="Asignar este logro" style="margin-top:10px;width:100%;padding:6px;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);color:#4ade80;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;transition:all .15s" onmouseover="this.style.background='rgba(74,222,128,.2)'" onmouseout="this.style.background='rgba(74,222,128,.1)'">✓ Asignar</button>`:''}
          </div>`;
        }).join('') : '<div style="color:rgba(255,255,255,.3);text-align:center;padding:32px;grid-column:1/-1;font-size:13px">No hay logros definidos.<br><span style="font-size:11px;opacity:.7">Ve a ⚙️ Gestionar para crear logros.</span></div>'}
      </div>`;
  }

  window._lgSetCat=function(cat){
    _lgCat=cat;
    document.querySelectorAll('.lg-cat').forEach(b=>b.classList.toggle('active',b.textContent===cat));
    _lgRenderVer();
  };

  // ── Render gestionar logros ───────────────────────────────────
  function _lgRenderEditar() {
    const body=document.getElementById('lg-body');
    body.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:13px;font-weight:800;color:#fff">Logros definidos <span id="lg-edit-count" style="color:rgba(255,255,255,.4)">(${_lgDefs.length})</span></div>
        <button class="lg-btn-p" onclick="_lgAbrirForm(null)" style="padding:8px 16px;font-size:12px">＋ Nuevo logro</button>
      </div>
      <input style="width:100%;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;font-size:13px;color:#fff;font-family:inherit;outline:none;margin-bottom:12px" placeholder="Buscar logro..." oninput="_lgFiltrarEdit(this.value)">
      <div id="lg-edit-list"></div>
      <div id="lg-form-wrap" style="display:none"></div>
      <div class="lg-danger">
        <div class="lg-danger-t">⚠️ Reiniciar logros de todos los asesores</div>
        <div class="lg-danger-d">Elimina todos los logros obtenidos. Los logros definidos se mantienen.</div>
        <button class="lg-btn-d" onclick="_lgReiniciarTodos()" style="font-size:12px;padding:9px 18px">🗑️ Reiniciar todos</button>
      </div>`;
    _lgRenderEditList();
  }

  function _lgRenderEditList(filtro='') {
    const list=document.getElementById('lg-edit-list');
    if(!list) return;
    const f=filtro.toLowerCase();
    const filtered=f?_lgDefs.filter(l=>(l.nombre||'').toLowerCase().includes(f)):_lgDefs;
    if(!filtered.length){list.innerHTML='<div style="color:rgba(255,255,255,.3);text-align:center;padding:24px;font-size:13px">No hay logros. ¡Crea el primero!</div>';return;}
    list.innerHTML=filtered.map(l=>{
      const r=RAR[l.rarity||'comun'];
      return `<div class="lg-edit-row">
        <div class="lg-edit-icon">${l.icon||'🏆'}</div>
        <div class="lg-edit-info">
          <div class="lg-edit-name">${l.nombre||'Sin nombre'}</div>
          <div class="lg-edit-meta"><span style="color:${r.color}">${r.label}</span> · ${l.cat||'General'} · ${l.condiciones?.length?l.condiciones.length+' condición(es)':'<span style="color:#F59E0B">Manual</span>'}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="lg-edit-btn" style="color:#a78bfa;border-color:rgba(167,139,250,.3);background:rgba(167,139,250,.08)" onclick="_lgAbrirForm('${(l._fid||'').replace(/'/g,"\\'")}')">✏️</button>
          <button class="lg-edit-btn" style="color:#f87171;border-color:rgba(196,30,58,.3);background:rgba(196,30,58,.08)" onclick="_lgBorrarLogro('${(l._fid||'').replace(/'/g,"\\'")}')">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }
  window._lgFiltrarEdit=function(q){_lgRenderEditList(q);};

  // ── Form crear/editar ─────────────────────────────────────────
  window._lgAbrirForm=function(fid){
    _lgEditId=fid; _lgConds=[];
    const wrap=document.getElementById('lg-form-wrap');
    const list=document.getElementById('lg-edit-list');
    if(!wrap||!list) return;
    let def={icon:'🏆',nombre:'',desc:'',cat:'General',rarity:'comun',condiciones:[]};
    if(fid){const found=_lgDefs.find(l=>l._fid===fid);if(found){def={...found};_lgConds=JSON.parse(JSON.stringify(found.condiciones||[]));}}
    list.style.display='none';
    wrap.style.display='block';
    wrap.innerHTML=`
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px;margin-bottom:16px">
        <div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:16px"><span id="lgf-icon-prev">${def.icon}</span> ${fid?'Editar logro':'Nuevo logro'}</div>
        <div class="lg-row2">
          <div class="lg-field"><label>Ícono</label><input class="lg-input" id="lgf-icon" value="${def.icon}" maxlength="4" oninput="document.getElementById('lgf-icon-prev').textContent=this.value||'🏆'"></div>
          <div class="lg-field"><label>Rareza</label><select class="lg-select" id="lgf-rarity">${['comun','raro','epico','legendario'].map(r=>`<option value="${r}" ${r===def.rarity?'selected':''}>${RAR[r].label}</option>`).join('')}</select></div>
        </div>
        <div class="lg-row2">
          <div class="lg-field"><label>Nombre</label><input class="lg-input" id="lgf-nombre" value="${def.nombre}" placeholder="El Imparable"></div>
          <div class="lg-field"><label>Categoría</label><input class="lg-input" id="lgf-cat" value="${def.cat}" placeholder="General" list="lgf-cats-dl"><datalist id="lgf-cats-dl"><option value="Inicio"><option value="Porcentaje"><option value="Racha"><option value="Mejora"><option value="Consistencia"><option value="Posición"><option value="Especial"></datalist></div>
        </div>
        <div class="lg-field"><label>Descripción</label><input class="lg-input" id="lgf-desc" value="${def.desc}" placeholder="Descripción del logro..."></div>
        <div style="margin-top:14px">
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">⚡ Condiciones automáticas</div>
          <div style="font-size:11px;color:rgba(255,255,255,.3);margin-bottom:10px">Se desbloquea cuando se cumplan TODAS las condiciones. Sin condiciones = asignación manual.</div>
          <div id="lgf-conds" class="lg-cond-list"></div>
          <button class="lg-add-cond" onclick="_lgAddCond()">＋ Agregar condición</button>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="lg-btn-p" onclick="_lgGuardarLogro()">${fid?'✓ Guardar cambios':'✓ Crear logro'}</button>
          <button class="lg-btn-g" onclick="_lgCancelarForm()">Cancelar</button>
        </div>
        <div id="lgf-status" style="margin-top:10px;font-size:12px;display:none"></div>
      </div>`;
    _lgRenderConds();
  };

  window._lgCancelarForm=function(){
    const w=document.getElementById('lg-form-wrap');
    const l=document.getElementById('lg-edit-list');
    if(w) w.style.display='none';
    if(l) l.style.display='block';
    _lgConds=[];
  };

  function _lgRenderConds(){
    const list=document.getElementById('lgf-conds');
    if(!list) return;
    list.innerHTML=_lgConds.map((c,i)=>{
      const def=CONDS.find(x=>x.id===c.id)||CONDS[0];
      return `<div class="lg-cond-row">
        <div class="lg-cond-inner">
          <select class="lg-cond-sel" onchange="_lgChangeCond(${i},this.value)">
            ${CONDS.map(op=>`<option value="${op.id}" ${op.id===c.id?'selected':''}>${op.label}</option>`).join('')}
          </select>
          ${def.tipo!=='ninguno'?`<input class="lg-cond-val" placeholder="${def.placeholder||'valor'}" value="${c.valor||''}" oninput="_lgCondVal(${i},this.value)">`:''}
          <button class="lg-cond-del" onclick="_lgDelCond(${i})">✕</button>
        </div>
        ${def.hint?`<div class="lg-cond-hint">💡 ${def.hint}</div>`:''}
      </div>`;
    }).join('');
  }
  window._lgAddCond=function(){_lgConds.push({id:CONDS[0].id,valor:''});_lgRenderConds();};
  window._lgChangeCond=function(i,id){_lgConds[i]={id,valor:''};_lgRenderConds();};
  window._lgCondVal=function(i,v){_lgConds[i].valor=v;};
  window._lgDelCond=function(i){_lgConds.splice(i,1);_lgRenderConds();};

  window._lgGuardarLogro=async function(){
    const icon=document.getElementById('lgf-icon')?.value.trim()||'🏆';
    const nombre=document.getElementById('lgf-nombre')?.value.trim();
    const desc=document.getElementById('lgf-desc')?.value.trim();
    const cat=document.getElementById('lgf-cat')?.value.trim()||'General';
    const rarity=document.getElementById('lgf-rarity')?.value||'comun';
    const status=document.getElementById('lgf-status');
    if(!nombre||!desc){status.style.display='block';status.style.color='#f87171';status.textContent='⚠️ Completa nombre y descripción';return;}
    const {getFirestore,collection,doc,setDoc,addDoc,serverTimestamp}=window._fbModules||{};
    if(!getFirestore) return;
    status.style.display='block';status.style.color='#a78bfa';status.textContent='Guardando...';
    const condiciones=_lgConds.filter(c=>c.id);
    const data={icon,nombre,desc,cat,rarity,condiciones,actualizado:serverTimestamp()};
    try{
      if(_lgEditId) await setDoc(doc(getFirestore(),'logros_config',_lgEditId),data,{merge:true});
      else{data.id='lg_'+Date.now();await addDoc(collection(getFirestore(),'logros_config'),data);}
      status.style.color='#4ADE80';status.textContent='✅ Guardado';
      await _lgCargarDefs();
      setTimeout(()=>{_lgCancelarForm();_lgRenderEditList();},800);
    }catch(e){status.style.color='#f87171';status.textContent='❌ '+e.message;}
  };

  window._lgBorrarLogro=async function(fid){
    if(!confirm('¿Eliminar este logro?')) return;
    const {getFirestore,doc,deleteDoc}=window._fbModules||{};
    if(!getFirestore) return;
    try{await deleteDoc(doc(getFirestore(),'logros_config',fid));showToast('Logro eliminado ✓');await _lgCargarDefs();_lgRenderEditList();}
    catch(e){showToast('Error: '+e.message,'error');}
  };

  window._lgReiniciarTodos=async function(){
    if(!confirm('⚠️ ¿Reiniciar TODOS los logros de TODOS los asesores?\n\nNo se puede deshacer.')) return;
    const {getFirestore,collection,getDocs,doc,deleteDoc}=window._fbModules||{};
    if(!getFirestore) return;
    try{
      const snap=await getDocs(collection(getFirestore(),'logros_asesores'));
      await Promise.all(snap.docs.map(d=>deleteDoc(doc(getFirestore(),'logros_asesores',d.id))));
      showToast('Logros reiniciados ✓');
    }catch(e){showToast('Error: '+e.message,'error');}
  };

  // ── Asignar logro individual a un asesor ────────────────────
  window._lgAsignarLogro = async function(logroKey) {
    if (!_lgAsesor) return;
    const def = _lgDefs.find(l=>(l.id||l._fid)===logroKey);
    const nombre_logro = def ? def.nombre : logroKey;
    if (!confirm(`¿Asignar el logro "${nombre_logro}" a ${_lgAsesor}?`)) return;

    const {getFirestore,doc,getDoc,setDoc,serverTimestamp} = window._fbModules||{};
    if (!getFirestore) return;
    const db  = getFirestore();
    const key = _lgAsesor.trim().replace(/\s+/g,'_').toLowerCase();
    const ref = doc(db,'logros_asesores',key);

    try {
      const snap = await getDoc(ref);
      const logros = snap.exists() ? (snap.data().logros||{}) : {};
      const hoy = new Date().toLocaleDateString('es-PE');
      logros[logroKey] = { fecha: hoy, nuevo: true, manual: true };
      await setDoc(ref, {logros, actualizado:serverTimestamp()}, {merge:true});
      _lgLogros = logros;
      _lgRenderVer();
      showToast(`Logro "${nombre_logro}" asignado a ${_lgAsesor.split(' ')[0]} ✓`);
    } catch(e) {
      showToast('Error: '+e.message,'error');
    }
  };

  // ── Quitar logro individual a un asesor ──────────────────────
  window._lgQuitarLogro = async function(logroKey) {
    if (!_lgAsesor) return;
    const def = _lgDefs.find(l=>(l.id||l._fid)===logroKey);
    const nombre_logro = def ? def.nombre : logroKey;
    if (!confirm(`¿Quitar el logro "${nombre_logro}" a ${_lgAsesor}?`)) return;

    const {getFirestore,doc,getDoc,setDoc,serverTimestamp} = window._fbModules||{};
    if (!getFirestore) return;
    const db  = getFirestore();
    const key = _lgAsesor.trim().replace(/\s+/g,'_').toLowerCase();
    const ref = doc(db,'logros_asesores',key);

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const logros = snap.data().logros || {};
      delete logros[logroKey];
      await setDoc(ref, {logros, actualizado:serverTimestamp()}, {merge:true});
      _lgLogros = logros;
      _lgRenderVer();
      showToast(`Logro "${nombre_logro}" quitado a ${_lgAsesor.split(' ')[0]} ✓`);
    } catch(e) {
      showToast('Error: '+e.message,'error');
    }
  };

  // ── Calcular logros automáticos ───────────────────────────────
  async function _lgCalcular(nombre){
    const {getFirestore,doc,getDoc,setDoc,serverTimestamp}=window._fbModules||{};
    if(!getFirestore||!_lgDefs.length) return;
    const db=getFirestore();
    const data=window._satData||[];
    const hist=data.filter(r=>r.asesor===nombre||r.asesor.toLowerCase()===nombre.toLowerCase()).sort((a,b)=>(a.mes+a.semana).localeCompare(b.mes+b.semana));
    if(!hist.length) return;
    const ranking=window._satLastRanking||[];
    const myIdx=ranking.findIndex(r=>r.asesor===nombre);
    const myPos=myIdx+1;
    const myData=ranking[myIdx]||{};
    const prevRank=window._satPrevRanking||[];
    const prevPos=prevRank.findIndex(r=>r.asesor===nombre)+1||0;
    const pcts=hist.map(h=>h.pct);
    const pct=pcts[pcts.length-1]||0;
    const maxPct=Math.max(...pcts);
    const racha=myData.racha||0;
    const avgTeam=ranking.length?Math.round(ranking.reduce((s,r)=>s+r.pct,0)/ranking.length):0;
    const total=ranking.length;
    const mesAct=new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');
    const mesPcts={};
    hist.forEach(h=>{if(!mesPcts[h.mes])mesPcts[h.mes]=[];mesPcts[h.mes].push(h.pct);});
    const key=nombre.trim().replace(/\s+/g,'_').toLowerCase();
    const ref=doc(db,'logros_asesores',key);
    let exist={};
    try{const s=await getDoc(ref);if(s.exists()) exist=s.data().logros||{};}catch(e){}
    const nuevos={};
    function evalC(c){
      const v=parseFloat(c.valor)||0;
      const[v1,v2]=(c.valor||'').split('-').map(Number);
      switch(c.id){
        case 'primer_registro':   return hist.length>=1 && Object.keys(exist).length===0;
        case 'nunca_cero':        return hist.every(h=>h.pct>0);
        case 'primer_reg_100':    return hist.length===1&&pct===100;
        case 'mejor_equipo_mes':  return myPos===1;
        case 'top_n':             return myPos>=1&&myPos<=v;
        case 'pos_exacta':        return myPos===v;
        case 'mitad_superior':    return total>0&&myPos<=Math.ceil(total/2);
        case 'pct_mayor_igual':   return pct>=v;
        case 'pct_exacto':        return pct===v;
        case 'pct_entre':         return pct>=v1&&pct<=v2;
        case 'pct_maximo_histor': return maxPct>=v;
        case 'pct_sube_n_puntos': return hist.length>=2&&(hist[hist.length-1].pct-hist[hist.length-2].pct)>=v;
        case 'supera_promedio_n': return pct>=(avgTeam+v);
        case 'racha_mayor_igual': return racha>=v;
        case 'racha_exacta':      return racha===v;
        case 'racha_sobre_pct':{let rc=0;for(let i=hist.length-1;i>=0;i--){if(hist[i].pct>=(v2||70))rc++;else break;}return rc>=(v1||v);}
        case 'sem_total_mayor':   return hist.length>=v;
        case 'sem_mes_actual':    return(mesPcts[mesAct]||[]).length>=v;
        case 'nunca_bajo_pct':    return(mesPcts[mesAct]||[]).length>0&&(mesPcts[mesAct]||[]).every(p=>p>=v);
        case 'subio_n_puestos':   return prevPos>0&&(prevPos-myPos)>=v;
        default: return false;
      }
    }
    _lgDefs.forEach(def=>{
      const id=def.id||def._fid;
      if(nuevos[id]) return; // ya marcado en esta sesión
      const conds=def.condiciones||[];
      if(!conds.length) return; // manual
      if(exist[id]) return;     // ya tiene este logro, no re-asignar
      if(conds.every(c=>evalC(c))) nuevos[id]=true;
    });
    if(!Object.keys(nuevos).length) return;

    // Verificar sesión activa antes de escribir
    if (!window.currentUser) {
      console.warn('logros: sin sesión activa');
      return;
    }

    const update={...exist};
    const hoy=new Date().toLocaleDateString('es-PE');
    Object.keys(nuevos).forEach(id=>{update[id]={fecha:hoy,nuevo:true};});
    try {
      await setDoc(ref,{logros:update,actualizado:serverTimestamp()},{merge:true});
      console.log('logros guardados para', nombre, ':', Object.keys(nuevos));
    } catch(e) {
      console.warn('logros save error:', e.code, e.message);
    }
  }

  // ── Hook en renderRanking para actualizar lista ───────────────
  const _origNotif = window._satNotifComparar;
  window._satNotifComparar = function(ranking) {
    window._satPrevRanking = window._satLastRanking||[];
    window._satLastRanking = ranking;
    if (_origNotif) _origNotif(ranking);
    _lgInyectarListaAsesores();
    _lgRenderAsesores(ranking);

    // Auto-calcular logros cuando el ranking se actualiza
    if (_lgDefs.length && window._satData?.length && window.currentUser) {
      ranking.forEach((r, i) => {
        // Escalonar para no saturar Firebase
        setTimeout(() => _lgCalcular(r.asesor), i * 200);
      });
    }
  };

  // Abrir modal directo en tab gestionar
  window._lgAbrirGestionar = async function() {
    await _lgCargarDefs();
    _lgAsesor = '';
    const tabEdit = document.getElementById('lg-tab-editar');
    if (tabEdit) tabEdit.style.display = 'flex';
    modal.classList.add('open');
    document.getElementById('lg-head-name').textContent = 'Gestión de Logros';
    document.getElementById('lg-head-sub').textContent  = _lgDefs.length + ' logros definidos';
    document.getElementById('lg-head-av').textContent   = '⚙️';
    _lgSetTab('editar');
  };

  // Init — cargar defs para todos (cualquiera puede ver logros)
  window.addEventListener('sise:rolCargado', async () => {
    await _lgCargarDefs();
  });
  if (window.currentUserRol) _lgCargarDefs();

})();

})();