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
getAnalytics(app);
const auth = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);
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
TIPIFICACIONES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
refreshTipi();
},
err => console.error('onSnapshot tipificaciones:', err)
);
onSnapshot(
collection(db, 'categorias'),
snap => {
CATEGORIAS_EXTRA = snap.docs.map(d => d.data().nombre);
refreshTipi();
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
const q = (query || '').toLowerCase().trim();
const formador = isFormador();
container.innerHTML = '';
let totalVisible = 0;
cats.forEach(cat => {
let items = TIPIFICACIONES.filter(t => t.categoria === cat);
if (q) {
items = items.filter(t =>
(t.modalidad||'').toLowerCase().includes(q)    ||
(t.proceso||'').toLowerCase().includes(q)      ||
(t.subProceso||'').toLowerCase().includes(q)   ||
(t.asunto||'').toLowerCase().includes(q)       ||
(t.aplica||'').toLowerCase().includes(q)       ||
(t.tipoAtencion||'').toLowerCase().includes(q) ||
(t.plazo||'').toLowerCase().includes(q)
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
const thAcciones = formador ? `<th style="width:70px">Acciones</th>` : '';
const rowsHtml = items.map((t, idx) => {
const tdAcciones = formador ? `
<td>
<div class="tipi-row-actions" style="display:flex">
<button class="btn-tr-edit" title="Editar" onclick="editarTipi('${t.id}')"><i class="ti ti-pencil"></i></button>
<button class="btn-tr-del"  title="Eliminar" onclick="eliminarTipi('${t.id}')"><i class="ti ti-trash"></i></button>
</div>
</td>` : '';
const editAttr = (campo) => formador
? `onclick="editarCelda('${t.id}','${campo}',this)" title="Clic para editar" style="cursor:text"`
: '';
return `<tr>
<td class="tipi-num">${idx + 1}</td>
<td><span class="tipi-badge modalidad" ${editAttr('modalidad')}>${escH(t.modalidad)}</span></td>
<td><span class="tipi-badge sub" ${editAttr('subProceso')}>${escH(t.subProceso)}</span></td>
<td style="font-weight:600;font-size:12px;word-break:break-word" ${editAttr('asunto')}>${escH(t.asunto)}</td>
<td class="tipi-aplica" ${editAttr('aplica')} title="${escH(t.aplica)}">${t.aplica ? escH(t.aplica) : '<span style="color:#ccc">—</span>'}</td>
<td>${t.tipoAtencion
? `<span class="tipi-badge ${tipoClass(t.tipoAtencion)}" ${editAttr('tipoAtencion')}>${escH(t.tipoAtencion)}</span>`
: `<span style="color:#ccc;font-size:11px" ${editAttr('tipoAtencion')}>—</span>`}</td>
<td>${t.plazo
? `<span class="tipi-badge plazo" ${editAttr('plazo')}><i class="ti ti-clock" style="font-size:10px"></i> ${escH(t.plazo)}</span>`
: `<span style="color:#ccc;font-size:11px" ${editAttr('plazo')}>—</span>`}</td>
<td>${t.plazoWeb
? `<span class="tipi-badge plazo" style="background:#EBF2FF;color:#1D5FBD" ${editAttr('plazoWeb')}><i class="ti ti-world" style="font-size:10px"></i> ${escH(t.plazoWeb)}</span>`
: `<span style="color:#ccc;font-size:11px" ${editAttr('plazoWeb')}>—</span>`}</td>
<td>${t.plazoManual
? `<span class="tipi-badge plazo" style="background:#F5F0FF;color:#5B21B6" ${editAttr('plazoManual')}><i class="ti ti-user" style="font-size:10px"></i> ${escH(t.plazoManual)}</span>`
: `<span style="color:#ccc;font-size:11px" ${editAttr('plazoManual')}>—</span>`}</td>
<td style="vertical-align:top;padding:8px 10px">${
(t.colaDer && Array.isArray(t.colaDer) && t.colaDer.length)
? t.colaDer.map(c => `<span class="cola-chip"><i class="ti ti-arrow-right" style="font-size:9px"></i>${escH(c)}</span>`).join('')
: `<span style="color:#ccc;font-size:11px">—</span>`
}</td>
${tdAcciones}
</tr>`;
}).join('');
const emptyRow = formador && !items.length
? `<tr><td colspan="${formador ? 11 : 10}" style="padding:20px;text-align:center;color:var(--muted);font-size:12px">
<i class="ti ti-plus-circle" style="margin-right:5px"></i>Categoría vacía — usa "Nueva tipificación" para añadir.
</td></tr>` : '';
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
<div class="tipi-table-wrap">
<table class="tipi-table">
<colgroup>
<col class="col-num"/>
<col class="col-modal"/>
<col class="col-sub"/>
<col class="col-asunto"/>
<col class="col-aplica"/>
<col class="col-tipo"/>
<col class="col-plazo"/>
<col class="col-plazo-web"/>
<col class="col-plazo-manual"/>
<col class="col-cola"/>
${formador ? '<col class="col-acc"/>' : ''}
</colgroup>
<thead>
<tr>
<th>#</th>
<th>Modalidad</th>
<th>Sub-Proceso</th>
<th>Asunto</th>
<th>En qué casos aplica</th>
<th>Tipo de atención</th>
<th>Plazo</th>
<th>Plazo Web</th>
<th>Plazo Manual</th>
<th>Cola de derivación</th>
${thAcciones}
</tr>
</thead>
<tbody>${rowsHtml}${emptyRow}</tbody>
</table>
</div>
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
onAuthStateChanged(auth, async user => {
if (!user) { window.location.href = 'Index.html'; return; }
currentUser = user;
document.getElementById('user-av').textContent   = user.email.substring(0, 2).toUpperCase();
document.getElementById('user-name').textContent = user.email.split('@')[0];
try {
const snap = await getDoc(doc(db, 'asesores_autorizados', user.email.toLowerCase()));
if (snap.exists()) currentUserRol = snap.data().Rol || '';
} catch(e) { currentUserRol = ''; }
// Iniciar listeners de Firestore AHORA que hay sesión activa
if (!_tipiListenersStarted) { _tipiListenersStarted = true; await iniciarListenersTipi(); }
else refreshTipi();
// Configurar barra de formador con el rol ya cargado
if (!_tipiFormadorSetupDone) { _tipiFormadorSetupDone = true; setupTipiFormador(); }
if (isFormador()) {
document.getElementById('tipi-formador-bar').classList.add('visible');
}
if (!_pltListenersStarted) { _pltListenersStarted = true; iniciarListenersPlantillas(); }
setupPltFormador();
setupProtoEditor();
loadCasos();
loadPendientes();
if (window._loadFaqs) window._loadFaqs();
setTimeout(() => { if (window._rerenderFaqs) window._rerenderFaqs(); }, 1500);
});
document.getElementById('btn-logout').addEventListener('click', async () => {
await signOut(auth);
window.location.href = 'Index.html';
});
document.querySelectorAll('.nav-item[data-view]').forEach(item => {
item.addEventListener('click', () => {
document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
item.classList.add('active');
document.getElementById('view-' + item.dataset.view).classList.add('active');
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
const payload = {
codigo:        document.getElementById('f-codigo').value.trim(),
nombre:        document.getElementById('f-nombre').value.trim(),
celular:       document.getElementById('f-celular').value.trim(),
asesorWsp:     document.getElementById('f-asesor-wsp').value.trim(),
motivo:        document.getElementById('f-motivo').value.trim(),
prioridad:     prioridad,
fechaRegistro: ahora.toISOString().split('T')[0],
horaRegistro:  ahora.toTimeString().slice(0,5),
};
try {
if (boEditId) {
await updateDoc(doc(db, 'bo_llamadas', boEditId), { ...payload, actualizadoPor: currentUser.email, actualizadoEn: serverTimestamp() });
showToast('Caso actualizado');
} else {
await addDoc(collection(db, 'bo_llamadas'), { ...payload, estadoLlamada: 'pendiente', descripcionBo: '', creadoPor: currentUser.email, creadoEn: serverTimestamp() });
showToast('Caso registrado correctamente');
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
function updateBoDayLabel() {
const today = new Date().toISOString().split('T')[0];
const viewStr = boViewDay.toISOString().split('T')[0];
const isToday = viewStr === today;
const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const d = boViewDay;
document.getElementById('bo-day-label').textContent =
(isToday ? 'Hoy · ' : '') + dias[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
}
document.getElementById('bo-prev').addEventListener('click',  () => { boViewDay.setDate(boViewDay.getDate()-1); updateBoDayLabel(); applyBoFilters(); });
document.getElementById('bo-next').addEventListener('click',  () => { boViewDay.setDate(boViewDay.getDate()+1); updateBoDayLabel(); applyBoFilters(); });
document.getElementById('bo-today').addEventListener('click', () => { boViewDay = new Date(); updateBoDayLabel(); applyBoFilters(); });
function loadCasos() {
const q = query(collection(db, 'bo_llamadas'), orderBy('creadoEn', 'asc'));
onSnapshot(q, snap => {
allCasos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
updateBoDayLabel();
applyBoFilters();
}, err => {
console.error(err);
document.getElementById('cards-container').innerHTML = '<div class="empty-state"><i class="ti ti-wifi-off"></i><p>Error al cargar.</p></div>';
});
}
function applyBoFilters() {
const q       = document.getElementById('search-bo').value.toLowerCase().trim();
const est     = document.getElementById('filter-estado').value;
const viewStr = boViewDay.toISOString().split('T')[0];
let data = allCasos.filter(r => (r.fechaRegistro || '') === viewStr);
if (q) data = data.filter(r =>
(r.nombre||'').toLowerCase().includes(q) ||
(r.codigo||'').toLowerCase().includes(q) ||
(r.celular||'').toLowerCase().includes(q) ||
(r.asesorWsp||'').toLowerCase().includes(q) ||
(r.motivo||'').toLowerCase().includes(q)
);
if (est) {
data = data.filter(r => (r.estadoLlamada || 'pendiente') === est);
} else {
data = data.filter(r => (r.estadoLlamada || 'pendiente') === 'pendiente');
}
const prioOrder = { alto: 0, medio: 1, bajo: 2 };
data.sort((a, b) => {
const pa = prioOrder[a.prioridad || 'medio'];
const pb = prioOrder[b.prioridad || 'medio'];
if (pa !== pb) return pa - pb;
const ta = a.creadoEn?.toDate?.() || new Date(a.horaRegistro || 0);
const tb = b.creadoEn?.toDate?.() || new Date(b.horaRegistro || 0);
return ta - tb;
});
renderCards(data);
updateBoBadge();
renderLlamadosHoy();
}
function renderCards(data) {
const container = document.getElementById('cards-container');
const isBO = tienePermiso();
if (!data.length) {
container.innerHTML = '<div class="empty-state"><i class="ti ti-phone-off"></i><p>No hay casos para este día.</p><p class="empty-hint">Usa \"Registrar caso\" o navega a otro día.</p></div>';
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
function renderLlamadosHoy() {
const viewStr = boViewDay.toISOString().split('T')[0];
const todayStr = new Date().toISOString().split('T')[0];
const isToday = viewStr === todayStr;
const llamados = allCasos.filter(r =>
(r.fechaRegistro || '') === viewStr &&
['no_contesta','atendida'].includes(r.estadoLlamada || 'pendiente')
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
const active = (r.estadoLlamada||'no_contesta') === estado;
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
const viewStr = boViewDay.toISOString().split('T')[0];
const d = boViewDay;
let data = allCasos.filter(r => (r.fechaRegistro||'') === viewStr);
if (!data.length) { showToast('No hay casos para exportar', 'error'); return; }
const wb = XLSX.utils.book_new();
const titleRow   = [['SISE · Portal SAES — Reporte BO Llamadas']];
const subtitleRow = [['Fecha: ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' ' + d.getFullYear() + '   |   Generado: ' + new Date().toLocaleDateString('es-PE','es-PE') + '   |   Total casos: ' + data.length]];
const blankRow   = [[]];
const headerRow  = [['#','Fecha Registro','Nombre Alumno','Código','Celular','Asesor WSP','Prioridad','Estado','Motivo de Derivación','Gestión BO']];
const dataRows   = data.map((r,i) => [
i+1,
fmtDate(r.fechaRegistro||''),
r.nombre||'',
r.codigo||'',
r.celular||'',
r.asesorWsp||'',
(r.prioridad||'medio').charAt(0).toUpperCase()+(r.prioridad||'medio').slice(1),
(r.estadoLlamada||'pendiente')==='pendiente'?'Pendiente':(r.estadoLlamada==='atendida'?'Atendida':'No contesta'),
r.motivo||'',
r.descripcionBo||'',
]);
const wsData = [...titleRow, ...subtitleRow, ...blankRow, ...headerRow, ...dataRows];
const ws = XLSX.utils.aoa_to_sheet(wsData);
ws['!cols'] = [{wch:4},{wch:16},{wch:24},{wch:10},{wch:14},{wch:18},{wch:10},{wch:14},{wch:44},{wch:44}];
ws['!merges'] = [
{s:{r:0,c:0},e:{r:0,c:9}},
{s:{r:1,c:0},e:{r:1,c:9}},
];
if (!ws['A1']) ws['A1'] = {};
ws['A1'].s = { font:{bold:true,sz:14,color:{rgb:'F26522'}}, fill:{fgColor:{rgb:'0D0D0D'}}, alignment:{horizontal:'center'} };
XLSX.utils.book_append_sheet(wb, ws, 'BO Llamadas');
const pendientes   = data.filter(r=>(r.estadoLlamada||'pendiente')==='pendiente').length;
const atendidas    = data.filter(r=>r.estadoLlamada==='atendida').length;
const noContesta   = data.filter(r=>r.estadoLlamada==='no_contesta').length;
const alto         = data.filter(r=>(r.prioridad||'medio')==='alto').length;
const medio        = data.filter(r=>(r.prioridad||'medio')==='medio').length;
const bajo         = data.filter(r=>(r.prioridad||'medio')==='bajo').length;
const wsRes = XLSX.utils.aoa_to_sheet([
['RESUMEN DEL DÍA'],
[''],
['Fecha', d.getDate() + ' de ' + MESES[d.getMonth()] + ' ' + d.getFullYear()],
['Total casos', data.length],
[''],
['ESTADO DE LLAMADAS'],
['Pendientes',   pendientes],
['Atendidas',    atendidas],
['No contesta',  noContesta],
[''],
['PRIORIDAD'],
['Alta',  alto],
['Media', medio],
['Baja',  bajo],
]);
wsRes['!cols'] = [{wch:20},{wch:16}];
XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');
XLSX.writeFile(wb, 'BO_Llamadas_' + d.getDate() + '_' + MESES[d.getMonth()] + '_' + d.getFullYear() + '.xlsx');
showToast('Excel descargado ✓');
});
document.getElementById('btn-bo-export-pdf').addEventListener('click', () => {
const { jsPDF } = window.jspdf;
const viewStr = boViewDay.toISOString().split('T')[0];
const d = boViewDay;
let data = allCasos.filter(r => (r.fechaRegistro||'') === viewStr);
if (!data.length) { showToast('No hay casos para exportar', 'error'); return; }
const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
const pw = pdf.internal.pageSize.width;   // 297
const ph = pdf.internal.pageSize.height;  // 210
pdf.setFillColor(13,13,13);
pdf.rect(0, 0, pw, 26, 'F');
pdf.setFillColor(242, 101, 34);
pdf.rect(0, 26, pw, 2, 'F');
pdf.setFillColor(242, 101, 34);
pdf.circle(18, 13, 6, 'F');
pdf.setTextColor(255,255,255);
pdf.setFontSize(10); pdf.setFont('helvetica','bold');
pdf.text('S', 18, 16.5, {align:'center'});
pdf.setFontSize(14); pdf.setFont('helvetica','bold');
pdf.setTextColor(255,255,255);
pdf.text('SISE · Portal SAES', 28, 11);
pdf.setFontSize(8); pdf.setFont('helvetica','normal');
pdf.setTextColor(170,170,170);
pdf.text('Reporte de Gestión BO — Llamadas', 28, 17);
pdf.setFontSize(9); pdf.setFont('helvetica','bold');
pdf.setTextColor(242,101,34);
pdf.text(d.getDate() + ' de ' + MESES[d.getMonth()] + ' ' + d.getFullYear(), pw - 14, 10, {align:'right'});
pdf.setFontSize(7.5); pdf.setFont('helvetica','normal');
pdf.setTextColor(150,150,150);
pdf.text('Generado: ' + new Date().toLocaleDateString('es-PE'), pw - 14, 17, {align:'right'});
const pendientes = data.filter(r=>(r.estadoLlamada||'pendiente')==='pendiente').length;
const atendidas  = data.filter(r=>r.estadoLlamada==='atendida').length;
const noContesta = data.filter(r=>r.estadoLlamada==='no_contesta').length;
const kpis = [
{label:'Total Casos',  val: data.length,  color:[13,13,13]},
{label:'Pendientes',   val: pendientes,   color:[91,33,182]},
{label:'Atendidas',    val: atendidas,    color:[26,122,69]},
{label:'No Contesta',  val: noContesta,   color:[224,49,49]},
];
const kpiW = 40, kpiH = 14, kpiY = 31, kpiGap = 4;
const kpiStartX = 14;
kpis.forEach((k, idx) => {
const x = kpiStartX + idx * (kpiW + kpiGap);
pdf.setFillColor(k.color[0], k.color[1], k.color[2]);
pdf.roundedRect(x, kpiY, kpiW, kpiH, 2, 2, 'F');
pdf.setTextColor(255,255,255);
pdf.setFontSize(14); pdf.setFont('helvetica','bold');
pdf.text(String(k.val), x + kpiW/2, kpiY + 9, {align:'center'});
pdf.setFontSize(6.5); pdf.setFont('helvetica','normal');
pdf.text(k.label, x + kpiW/2, kpiY + 13, {align:'center'});
});
const estadoStr = (est) => {
if (est === 'atendida')    return 'Atendida';
if (est === 'no_contesta') return 'No contesta';
return 'Pendiente';
};
const prioStr = (p) => p ? p.charAt(0).toUpperCase()+p.slice(1) : 'Medio';
pdf.autoTable({
startY: kpiY + kpiH + 6,
head: [['#','Alumno','Código','Celular','Asesor WSP','Prioridad','Estado','Motivo','Gestión BO']],
body: data.map((r,i) => [
i+1,
r.nombre||'—',
r.codigo||'—',
r.celular||'—',
r.asesorWsp||'—',
prioStr(r.prioridad),
estadoStr(r.estadoLlamada),
r.motivo||'—',
r.descripcionBo||'—'
]),
styles: {
font: 'helvetica', fontSize: 7.5, cellPadding: {top:3,bottom:3,left:3,right:3},
lineColor: [230,230,225], lineWidth: 0.2, overflow: 'linebreak',
},
headStyles: {
fillColor: [13,13,13], textColor: [255,255,255],
fontStyle: 'bold', fontSize: 7.5, halign: 'left',
cellPadding: {top:4,bottom:4,left:3,right:3},
},
columnStyles: {
0:{cellWidth:7,halign:'center'},
1:{cellWidth:26},
2:{cellWidth:16},
3:{cellWidth:20},
4:{cellWidth:20},
5:{cellWidth:16},
6:{cellWidth:20},
7:{cellWidth:60},
8:{cellWidth:'auto'},
},
alternateRowStyles: { fillColor: [250,249,247] },
margin: { left:14, right:14 },
didDrawCell: (hookData) => {
if (hookData.section === 'body' && hookData.column.index === 6) {
const val = hookData.cell.raw;
const x = hookData.cell.x + 2;
const y = hookData.cell.y + 2;
const w = hookData.cell.width - 4;
const h = hookData.cell.height - 4;
if (val === 'Atendida')    { pdf.setFillColor(232,250,240); pdf.roundedRect(x,y,w,h,1.5,1.5,'F'); pdf.setTextColor(26,122,69); }
else if (val === 'No contesta') { pdf.setFillColor(255,240,240); pdf.roundedRect(x,y,w,h,1.5,1.5,'F'); pdf.setTextColor(224,49,49); }
else                       { pdf.setFillColor(245,240,255); pdf.roundedRect(x,y,w,h,1.5,1.5,'F'); pdf.setTextColor(91,33,182); }
pdf.setFontSize(7); pdf.setFont('helvetica','bold');
pdf.text(val, x + w/2, y + h/2 + 2, {align:'center'});
}
if (hookData.section === 'body' && hookData.column.index === 5) {
const val = (hookData.cell.raw||'').toLowerCase();
const x = hookData.cell.x + 2; const y = hookData.cell.y + 2;
const w = hookData.cell.width - 4; const h = hookData.cell.height - 4;
if (val === 'alto')   { pdf.setFillColor(255,240,240); pdf.roundedRect(x,y,w,h,1.5,1.5,'F'); pdf.setTextColor(224,49,49); }
else if (val === 'bajo') { pdf.setFillColor(232,250,240); pdf.roundedRect(x,y,w,h,1.5,1.5,'F'); pdf.setTextColor(26,122,69); }
else                    { pdf.setFillColor(255,247,230); pdf.roundedRect(x,y,w,h,1.5,1.5,'F'); pdf.setTextColor(184,112,0); }
pdf.setFontSize(7); pdf.setFont('helvetica','bold');
pdf.text(hookData.cell.raw||'', x + w/2, y + h/2 + 2, {align:'center'});
}
},
});
const pages = pdf.internal.getNumberOfPages();
for (let i=1;i<=pages;i++) {
pdf.setPage(i);
pdf.setFillColor(245,244,242);
pdf.rect(0, ph-10, pw, 10, 'F');
pdf.setFontSize(7); pdf.setTextColor(154,150,144);
pdf.setFont('helvetica','normal');
pdf.text('SISE · Portal SAES — Documento de uso interno confidencial', 14, ph-4);
pdf.text('Página ' + i + ' de ' + pages, pw-14, ph-4, {align:'right'});
}
pdf.save('BO_Llamadas_' + d.getDate() + '_' + MESES[d.getMonth()] + '_' + d.getFullYear() + '.pdf');
showToast('PDF descargado ✓');
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
snap => { PLANTILLAS = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderPlantillas(); },
err => console.error('onSnapshot plantillas:', err)
);
}
// iniciarListenersPlantillas() se llama dentro de onAuthStateChanged
function renderPlantillas(q) {
const grid = document.getElementById('plantillas-grid');
if (!grid) return;
const query2 = (q || document.getElementById('search-plantillas').value || '').toLowerCase().trim();
const formador = isFormador();
if (formador) grid.classList.add('is-formador-plt');
else grid.classList.remove('is-formador-plt');
const filtered = PLANTILLAS.filter(p =>
!query2 ||
(p.nombre||'').toLowerCase().includes(query2) ||
(p.desc||'').toLowerCase().includes(query2) ||
(p.texto||'').toLowerCase().includes(query2)
);
if (!filtered.length) {
grid.innerHTML = `<div class="plt-empty"><i class="ti ti-file-off"></i><p>No se encontraron plantillas${query2 ? ` para "<strong>${query2}</strong>"` : ''}.</p></div>`;
return;
}
grid.innerHTML = filtered.map((p, idx) => {
const rowActs = formador ? `
<div class="plt-row-actions" onclick="event.stopPropagation()">
<button class="btn-plt-edit" title="Editar" onclick="abrirModalPlt('${p.id}')"><i class="ti ti-pencil"></i></button>
<button class="btn-plt-del"  title="Eliminar" onclick="eliminarPlt('${p.id}')"><i class="ti ti-trash"></i></button>
</div>` : '';
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
<div class="plt-name">${escH(p.nombre)}</div>
<div class="plt-desc">${escH(p.desc)}</div>
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
snap => { PROTOCOLO = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderProtocolo(); },
err => console.error('onSnapshot protocolo:', err)
);
}
iniciarListenersProtocolo();
window._GLOSA_MAP = {};
function renderProtocolo(q) {
const list = document.getElementById('proto-list');
if (!list) return;
const query2 = (q || document.getElementById('search-protocolo').value || '').toLowerCase().trim();
const editor = tienePermiso();
let filtered = PROTOCOLO;
if (query2) {
filtered = PROTOCOLO.filter(p =>
(p.nombre || '').toLowerCase().includes(query2) ||
(p.proceso || '').toLowerCase().includes(query2) ||
(p.glosas || []).some(g => g.toLowerCase().includes(query2))
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
${escH(g)}
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
<div class="proto-card-title">${escH(p.nombre)}</div>
<div class="proto-card-subtitle">${escH(p.proceso || '')}</div>
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
const today = new Date().toISOString().split('T')[0];
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
const payload = { numeroCaso: numero, fechaCaso: fecha, fechaRegistro: new Date().toISOString().split('T')[0], descripcion: desc, asesor, tipoCaso: tipo };
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
allPendientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
allPendientes.sort((a,b) => (b.fechaRegistro||b.fecha||'') > (a.fechaRegistro||a.fecha||'') ? 1 : -1);
updatePendBadge();
renderPendientes();
}, err => { console.error('pendientes error:', err); });
}
function updatePendBadge() {
const sinCheck = allPendientes.filter(r => !r.alertado).length;
const badge = document.getElementById('badge-pendientes');
badge.textContent = sinCheck;
badge.style.display = sinCheck > 0 ? '' : 'none';
}
function updateBoBadge() {
const today = new Date().toISOString().split('T')[0];
const pendientesHoy = allCasos.filter(r =>
(r.fechaRegistro || '') === today &&
(r.estadoLlamada || 'pendiente') === 'pendiente'
).length;
const badge = document.getElementById('badge-bo-llamadas');
badge.textContent = pendientesHoy;
badge.style.display = pendientesHoy > 0 ? '' : 'none';
}
document.getElementById('pend-prev').addEventListener('click', () => { pendViewDay.setDate(pendViewDay.getDate()-1); renderPendientes(); });
document.getElementById('pend-next').addEventListener('click', () => { pendViewDay.setDate(pendViewDay.getDate()+1); renderPendientes(); });
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
const viewDateStr = pendViewDay.toISOString().split('T')[0];
const today       = new Date().toISOString().split('T')[0];
const isToday     = viewDateStr === today;
const dias   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MESES_C= ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const d = pendViewDay;
const dayLabel = (isToday ? 'Hoy · ' : '') + dias[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
document.getElementById('pend-month-label').textContent = dayLabel;
const q = document.getElementById('search-pend').value.toLowerCase().trim();
let data = allPendientes.filter(r => (r.fechaRegistro || r.fecha || '') === viewDateStr && !r.resuelto);
let resueltos = allPendientes.filter(r => (r.fechaRegistro || r.fecha || '') === viewDateStr && r.resuelto);
if (showMisAlertados) {
data = allPendientes.filter(r => r.alertado && r.alertadoPor === currentUser?.email);
resueltos = [];
} else if (pendFilterMode === 'mios') {
data = data.filter(r => r.creadoPor === currentUser?.email);
resueltos = resueltos.filter(r => r.creadoPor === currentUser?.email);
}
if (q) {
data = data.filter(r => (r.numeroCaso||'').toLowerCase().includes(q)||(r.descripcion||'').toLowerCase().includes(q)||(r.asesor||'').toLowerCase().includes(q));
resueltos = resueltos.filter(r => (r.numeroCaso||'').toLowerCase().includes(q)||(r.descripcion||'').toLowerCase().includes(q)||(r.asesor||'').toLowerCase().includes(q));
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
fecha: ahora.toISOString().split('T')[0]
}];
try {
await updateDoc(doc(db, 'casos_pendientes', id), { comentarios });
ta.value = '';
ta.style.height = 'auto';
showToast('Comentario enviado ✓');
} catch(e) { showToast('Error al guardar comentario', 'error'); }
};
document.getElementById('btn-export-excel').addEventListener('click', () => {
const viewDateStr = pendViewDay.toISOString().split('T')[0];
const d = pendViewDay;
const q = document.getElementById('search-pend').value.toLowerCase().trim();
let data = allPendientes.filter(r => (r.fechaRegistro||r.fecha||'') === viewDateStr);
if (q) data = data.filter(r => (r.numeroCaso||'').toLowerCase().includes(q)||(r.descripcion||'').toLowerCase().includes(q)||(r.asesor||'').toLowerCase().includes(q));
if (!data.length) { showToast('No hay casos para exportar', 'error'); return; }
const rows = data.sort((a,b)=>(a.fechaRegistro||a.fecha)<(b.fechaRegistro||b.fecha)?-1:1).map((r,i) => ({ '#': i+1, 'Registrado': fmtDate(r.fechaRegistro||r.fecha), 'Caso desde': fmtDate(r.fechaCaso||''), 'N° Caso': r.numeroCaso||'', 'Descripción': r.descripcion||'', 'Asesor': r.asesor||'', 'Registrado por': r.creadoPor?r.creadoPor.split('@')[0]:'' }));
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(rows);
ws['!cols'] = [{wch:4},{wch:14},{wch:14},{wch:12},{wch:60},{wch:20},{wch:20}];
XLSX.utils.book_append_sheet(wb, ws, 'Casos Pendientes');
XLSX.writeFile(wb, 'casos_pendientes_' + d.getDate() + '_' + MESES[d.getMonth()] + '_' + d.getFullYear() + '.xlsx');
showToast('Excel descargado correctamente');
});
document.getElementById('btn-export-pdf').addEventListener('click', () => {
const { jsPDF } = window.jspdf;
const viewDateStr = pendViewDay.toISOString().split('T')[0];
const d = pendViewDay;
const q = document.getElementById('search-pend').value.toLowerCase().trim();
let data = allPendientes.filter(r => (r.fechaRegistro||r.fecha||'') === viewDateStr);
if (q) data = data.filter(r => (r.numeroCaso||'').toLowerCase().includes(q)||(r.descripcion||'').toLowerCase().includes(q)||(r.asesor||'').toLowerCase().includes(q));
if (!data.length) { showToast('No hay casos para exportar', 'error'); return; }
const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
pdf.setFillColor(13,13,13); pdf.rect(0,0,297,20,'F');
pdf.setTextColor(255,255,255); pdf.setFontSize(12); pdf.setFont('helvetica','bold');
pdf.text('SISE · Portal SAES', 14, 13);
pdf.setFontSize(9); pdf.setFont('helvetica','normal');
pdf.text('Casos Pendientes Fuera de Plazo — ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' ' + d.getFullYear(), 14, 18);
pdf.text('Generado: ' + new Date().toLocaleDateString('es-PE'), 240, 18);
pdf.autoTable({
startY: 26,
head: [['#','Registrado','Caso desde','N° Caso','Descripción del caso','Asesor']],
body: data.sort((a,b)=>(a.fechaRegistro||a.fecha)<(b.fechaRegistro||b.fecha)?-1:1).map((r,i)=>[i+1, fmtDate(r.fechaRegistro||r.fecha), fmtDate(r.fechaCaso||''), r.numeroCaso||'—', r.descripcion||'—', r.asesor||'—']),
styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
headStyles: { fillColor: [242,101,34], textColor: 255, fontStyle: 'bold', fontSize: 9 },
columnStyles: { 0:{halign:'center',cellWidth:10}, 1:{cellWidth:22}, 2:{cellWidth:22}, 3:{cellWidth:20}, 4:{cellWidth:148}, 5:{cellWidth:40} },
alternateRowStyles: { fillColor: [250,250,248] },
margin: { left: 14, right: 14 },
});
const pages = pdf.internal.getNumberOfPages();
for (let i=1;i<=pages;i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(150); pdf.text('Página '+i+' de '+pages+' · SISE Portal SAES', 14, pdf.internal.pageSize.height-8); }
pdf.save('casos_pendientes_' + d.getDate() + '_' + MESES[d.getMonth()] + '_' + d.getFullYear() + '.pdf');
showToast('PDF descargado correctamente');
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
(function() {
const h = new Date().getHours();
const greet = h < 12 ? '¡Buenos días' : h < 18 ? '¡Buenas tardes' : '¡Buenas noches';
const el = document.querySelector('.home-hero-title');
if (el) el.innerHTML = greet + '! Portal SAES <span style="color:var(--orange)">·</span> Canal WhatsApp';
})();
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
allFaqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
allFaqs.sort((a, b) => {
const ta = a.creadoEn?.seconds ?? a.orden ?? 0;
const tb = b.creadoEn?.seconds ?? b.orden ?? 0;
return ta - tb;
});
allFaqs.forEach(f => getCatColor(f.categoria || 'General'));
renderFaqView();
if (puedeGestionar()) document.getElementById('btn-faq-nueva').style.display = '';
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
function renderFaqView() {
const q   = (document.getElementById('faq-search')?.value || '').toLowerCase().trim();
const cat = activeFaqCat;
let data = [...allFaqs];
if (cat)  data = data.filter(f => f.categoria === cat);
if (q)    data = data.filter(f =>
(f.pregunta||'').toLowerCase().includes(q) ||
(f.respuesta||'').toLowerCase().includes(q) ||
(f.categoria||'').toLowerCase().includes(q)
);
document.getElementById('faq-count').textContent = data.length + ' respuesta' + (data.length !== 1 ? 's' : '');
renderFaqChips();
renderFaqCatSelect();
const grid = document.getElementById('faq-grid');
if (!data.length) {
grid.innerHTML = '<div class="empty-state"><i class="ti ti-help-off"></i><p>No se encontraron preguntas.</p><p class="empty-hint">Intenta con otra búsqueda o categoría.</p></div>';
return;
}
grid.innerHTML = data.map((f, idx) => {
const color = getCatColor(f.categoria || 'General');
const hasImg   = !!(f.imgUrl || f.imgB64);
const hasVideo = !!ytId(f.videoUrl);
const gestor   = puedeGestionar();
return `<div class="faq-card" onclick="window._faqVer('${f.id}')">
<div class="faq-card-top">
<div class="faq-card-cat ${color}"><i class="ti ti-folder" style="font-size:11px"></i>${escH(f.categoria||'General')}</div>
<div class="faq-card-q">${escH(f.pregunta||'')}</div>
<div class="faq-card-a-preview">${escH(f.respuesta||'')}</div>
</div>
<div class="faq-card-footer">
<div class="faq-card-icons">
${hasImg   ? '<span class="faq-card-icon-badge"><i class="ti ti-photo" style="font-size:12px"></i>Imagen</span>' : ''}
${hasVideo ? '<span class="faq-card-icon-badge"><i class="ti ti-brand-youtube" style="font-size:12px;color:#E03131"></i>Video</span>' : ''}
${!hasImg && !hasVideo ? '<span class="faq-card-icon-badge"><i class="ti ti-align-left" style="font-size:12px"></i>Solo texto</span>' : ''}
</div>
<div style="display:flex;align-items:center;gap:8px">
${gestor ? `<button class="btn-row edit" title="Editar" onclick="event.stopPropagation();window._faqEditar('${f.id}')"><i class="ti ti-pencil"></i></button>
<button class="btn-row del"  title="Eliminar" onclick="event.stopPropagation();window._faqEliminar('${f.id}')"><i class="ti ti-trash"></i></button>` : ''}
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
document.getElementById('faq-search')?.addEventListener('input', renderFaqView);
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
})();