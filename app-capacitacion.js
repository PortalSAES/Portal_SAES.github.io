import { getApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import {
getFirestore, collection, addDoc, updateDoc, deleteDoc,
doc, query, orderBy, serverTimestamp, onSnapshot, getDoc
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import {
getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
await new Promise(r => setTimeout(r, 400));
const app     = getApp();
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);
let capItems      = [];
let capEditId     = null;
let capActiveCat  = '';
let currentCapRol  = '';
let currentCapUser = null;
let capDocTipo    = 'ppt';
let capDocEditId  = null;
let capDocFile    = null;   // File object (for upload)
function puedeGestionar() {
const r = (currentCapRol || '').toLowerCase();
return r === 'formador' || r === 'supervisor' || r === 'bo';
}
function escH(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showCapToast(msg, type='success') {
const t = document.getElementById('toast');
if (!t) return;
t.textContent = (type==='success'?'✓ ':'✗ ') + msg;
t.className = `toast ${type} show`;
setTimeout(() => t.classList.remove('show'), 3500);
}
function detectSource(v) {
if (v.tipo === 'ppt') return 'ppt';
if (v.tipo === 'pdf') return 'pdf';
const url = v.url || '';
if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
if (/drive\.google\.com/.test(url)) return 'drive';
return 'other';
}
function ytThumb(url) {
try {
const u = new URL(url);
let id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : (u.searchParams.get('v') || '');
return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
} catch(e) { return null; }
}
function driveEmbedUrl(url) {
const m = url.match(/\/d\/([^/]+)\//);
return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
}
function renderCapCats() {
const cats = [...new Set(capItems.map(v => v.categoria).filter(Boolean))].sort();
const bar = document.getElementById('cap-cats-bar');
bar.innerHTML = `<button class="cap-cat-btn${capActiveCat===''?' active':''}" data-cat="">Todos</button>`;
cats.forEach(c => {
const btn = document.createElement('button');
btn.className = 'cap-cat-btn' + (capActiveCat===c?' active':'');
btn.dataset.cat = c; btn.textContent = c;
bar.appendChild(btn);
});
bar.querySelectorAll('.cap-cat-btn').forEach(btn => {
btn.addEventListener('click', () => { capActiveCat = btn.dataset.cat; renderCapCats(); renderCapGrid(); });
});
}
function renderCapGrid() {
const q    = document.getElementById('cap-search')?.value.trim() || '';
const grid = document.getElementById('cap-grid');
const canEdit = puedeGestionar();
let filtered = capItems.filter(v => {
const catMatch    = !capActiveCat || v.categoria === capActiveCat;
const searchMatch = !q || (window._smartMatch ? window._smartMatch([v.titulo||'', v.categoria||'', v.desc||''], q) : [v.titulo||'',v.categoria||'',v.desc||''].some(s=>s.toLowerCase().includes(q.toLowerCase())));
return catMatch && searchMatch;
});
const total = filtered.length;
document.getElementById('cap-count').textContent = `${total} recurso${total!==1?'s':''}`;
if (!total) {
grid.innerHTML = `<div class="cap-empty" style="grid-column:1/-1">
<i class="ti ti-player-play"></i>
<p>No hay recursos disponibles</p>
<span>${canEdit ? 'Usa los botones superiores para añadir contenido.' : 'Aún no hay recursos en esta categoría.'}</span>
</div>`;
return;
}
grid.innerHTML = filtered.map(v => {
const src = detectSource(v);
const actionsHtml = canEdit ? `
<div class="cap-card-actions">
<button class="btn-row edit" title="Editar" onclick="event.stopPropagation();window._capEditar('${escH(v.id)}','${escH(src)}')"><i class="ti ti-pencil"></i></button>
<button class="btn-row del"  title="Eliminar" onclick="event.stopPropagation();window._capEliminar('${escH(v.id)}')"><i class="ti ti-trash"></i></button>
</div>` : '';
if (src === 'ppt' || src === 'pdf' || src === 'word' || src === 'excel') {
const ICONS  = { ppt:'📊', pdf:'📄', word:'📝', excel:'📈' };
const LABELS = {
  ppt:   '<i class="ti ti-presentation"></i> PowerPoint',
  pdf:   '<i class="ti ti-file-type-pdf"></i> PDF',
  word:  '<i class="ti ti-file-type-doc"></i> Word',
  excel: '<i class="ti ti-file-type-xls"></i> Excel',
};
const icon  = ICONS[src];
const label = LABELS[src];
return `
<div class="cap-doc-card" onclick="window._capVerDoc('${escH(v.id)}')">
<div class="cap-doc-thumb ${src}">
${icon}
<span class="cap-source-badge ${src}">${label}</span>
</div>
<div class="cap-card-body">
<div class="cap-card-cat">${escH(v.categoria||'General')}</div>
<div class="cap-card-title">${escH(v.titulo)}</div>
${v.desc ? `<div class="cap-card-desc">${escH(v.desc)}</div>` : ''}
<div class="cap-card-footer">
<div class="cap-card-autor"><i class="ti ti-user-circle"></i>${escH(v.creadoPor?.split('@')[0]||'Formador')}</div>
${actionsHtml}
</div>
</div>
</div>`;
}
const thumb = src==='youtube' ? ytThumb(v.url) : null;
const srcLabel = src==='youtube' ? '<i class="ti ti-brand-youtube"></i> YouTube'
: src==='drive' ? '<i class="ti ti-brand-google-drive"></i> Drive'
: '<i class="ti ti-link"></i> Externo';
const srcClass = src==='youtube' ? 'yt' : src==='drive' ? 'drive' : '';
const thumbHtml = thumb
? `<img src="${escH(thumb)}" alt="${escH(v.titulo)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=cap-thumb-placeholder><i class=\'ti ti-player-play\'></i></div>'">`
: `<div class="cap-thumb-placeholder"><i class="ti ti-player-play"></i></div>`;
return `
<div class="cap-card" onclick="window._capVerVideo('${escH(v.id)}')">
<div class="cap-thumb">
${thumbHtml}
<div class="cap-play-overlay"><div class="cap-play-btn"><i class="ti ti-player-play-filled"></i></div></div>
<span class="cap-source-badge ${srcClass}">${srcLabel}</span>
${v.duracion ? `<span class="cap-duration">${escH(v.duracion)}</span>` : ''}
</div>
<div class="cap-card-body">
<div class="cap-card-cat">${escH(v.categoria||'General')}</div>
<div class="cap-card-title">${escH(v.titulo)}</div>
${v.desc ? `<div class="cap-card-desc">${escH(v.desc)}</div>` : ''}
<div class="cap-card-footer">
<div class="cap-card-autor"><i class="ti ti-user-circle"></i>${escH(v.creadoPor?.split('@')[0]||'Formador')}</div>
${actionsHtml}
</div>
</div>
</div>`;
}).join('');
}
window._capVerVideo = function(id) {
const v = capItems.find(x => x.id === id);
if (!v) return;
document.getElementById('cmv-cat-label').textContent = v.categoria || '';
document.getElementById('cmv-title').textContent     = v.titulo || '';
document.getElementById('cmv-autor').textContent     = 'Subido por: ' + (v.creadoPor?.split('@')[0]||'Formador');
document.getElementById('cmv-desc').textContent      = v.desc || '';
document.getElementById('cmv-ext-link').href         = v.url || '#';
const embed = document.getElementById('cmv-embed');
const src   = detectSource(v);
if (src === 'youtube') {
const thumb = ytThumb(v.url);
const hq    = thumb ? thumb.replace('mqdefault','maxresdefault') : '';
embed.innerHTML = `
<div class="cap-yt-player" onclick="window.open('${v.url}','_blank')">
<img class="yt-bg" src="${hq}" onerror="this.src='${thumb||''}'" alt="${escH(v.titulo)}"/>
<div class="cap-yt-play-circle"><i class="ti ti-player-play-filled"></i></div>
<div class="cap-yt-label"><span><i class="ti ti-brand-youtube" style="font-size:11px;margin-right:4px"></i>Ver en YouTube</span></div>
</div>`;
} else if (src === 'drive') {
embed.innerHTML = `<iframe src="${escH(driveEmbedUrl(v.url))}" allowfullscreen allow="autoplay"></iframe>`;
} else {
embed.innerHTML = `
<div class="cap-yt-player" onclick="window.open('${escH(v.url)}','_blank')" style="background:#111">
<div class="cap-yt-play-circle" style="background:var(--orange)"><i class="ti ti-external-link" style="margin-left:0"></i></div>
<div class="cap-yt-label"><span>Abrir recurso externo</span></div>
</div>`;
}
document.getElementById('modal-cap-view-overlay').classList.add('open');
};
window._capVerDoc = function(id) {
const v = capItems.find(x => x.id === id);
if (!v) return;
document.getElementById('cdv-cat').textContent   = v.categoria || '';
document.getElementById('cdv-title').textContent = v.titulo || '';
document.getElementById('cdv-autor').textContent = 'Subido por: ' + (v.creadoPor?.split('@')[0]||'Formador');
document.getElementById('cdv-desc').textContent  = v.desc || '';
const wrap = document.getElementById('cdv-embed-wrap');
const fileUrl = v.fileUrl || '';
if (!fileUrl) {
wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)"><i class="ti ti-file-off" style="font-size:40px;display:block;margin-bottom:10px;opacity:0.4"></i><p>Archivo no disponible</p></div>`;
} else if (v.tipo === 'pdf') {
wrap.innerHTML = `
<iframe src="${escH(fileUrl)}" class="cap-doc-embed" title="${escH(v.titulo)}"
onload="this.style.opacity='1'"
style="opacity:0;transition:opacity 0.3s"></iframe>`;
setTimeout(() => { const f = wrap.querySelector('iframe'); if(f) f.style.opacity='1'; }, 800);
} else if (v.tipo === 'ppt') {
const gdocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
wrap.innerHTML = `
<div style="position:relative">
<iframe id="cdv-ppt-iframe" src="${escH(gdocsUrl)}" class="cap-doc-embed"
title="${escH(v.titulo)}" allowfullscreen
style="opacity:0;transition:opacity 0.5s"
onload="this.style.opacity='1';document.getElementById('cdv-ppt-loading').style.display='none'">
</iframe>
<div id="cdv-ppt-loading" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--surface);border-radius:12px;gap:12px">
<span style="font-size:44px">📊</span>
<p style="font-size:13px;font-weight:600;color:var(--text)">Cargando presentación…</p>
<p style="font-size:11px;color:var(--muted)">Puede tardar unos segundos</p>
</div>
</div>
<div style="margin-top:10px;display:flex;gap:8px;justify-content:center">
<a href="${escH(fileUrl)}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--orange);font-weight:600;text-decoration:none">
<i class="ti ti-external-link"></i>Abrir en nueva pestaña
</a>
</div>`;
setTimeout(() => {
const loading = document.getElementById('cdv-ppt-loading');
const iframe  = document.getElementById('cdv-ppt-iframe');
if (loading && loading.style.display !== 'none') {
loading.innerHTML = `
<span style="font-size:44px">📊</span>
<p style="font-size:14px;font-weight:700;color:var(--text)">${escH(v.titulo)}</p>
<p style="font-size:12px;color:var(--muted);max-width:320px;text-align:center;line-height:1.6">La vista previa no pudo cargar. Abre o descarga el archivo directamente.</p>
<div style="display:flex;gap:10px;margin-top:4px">
<a href="${escH(fileUrl)}" target="_blank" style="display:inline-flex;align-items:center;gap:7px;background:var(--orange);color:#fff;border-radius:9px;padding:9px 18px;font-size:13px;font-weight:700;text-decoration:none">
<i class="ti ti-external-link"></i>Abrir archivo
</a>
<a href="${escH(fileUrl)}" download style="display:inline-flex;align-items:center;gap:7px;background:var(--surface);color:var(--text);border:1.5px solid var(--border);border-radius:9px;padding:9px 18px;font-size:13px;font-weight:700;text-decoration:none">
<i class="ti ti-download"></i>Descargar
</a>
</div>`;
if (iframe) iframe.style.display = 'none';
}
}, 12000);
} else if (v.tipo === 'word') {
const gdocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
wrap.innerHTML = `
<div style="position:relative">
<iframe id="cdv-word-iframe" src="${escH(gdocsUrl)}" class="cap-doc-embed"
title="${escH(v.titulo)}" allowfullscreen
style="opacity:0;transition:opacity 0.5s"
onload="this.style.opacity='1';document.getElementById('cdv-word-loading').style.display='none'">
</iframe>
<div id="cdv-word-loading" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--surface);border-radius:12px;gap:12px">
<span style="font-size:44px">📝</span>
<p style="font-size:13px;font-weight:600;color:var(--text)">Cargando documento…</p>
<p style="font-size:11px;color:var(--muted)">Puede tardar unos segundos</p>
</div>
</div>
<div style="margin-top:10px;display:flex;gap:8px;justify-content:center">
<a href="${escH(fileUrl)}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--orange);font-weight:600;text-decoration:none">
<i class="ti ti-external-link"></i>Abrir en nueva pestaña
</a>
</div>`;
setTimeout(() => {
const loading = document.getElementById('cdv-word-loading');
const iframe  = document.getElementById('cdv-word-iframe');
if (loading && loading.style.display !== 'none') {
loading.innerHTML = `<span style="font-size:44px">📝</span><p style="font-size:13px;font-weight:600;color:var(--text)">No se pudo previsualizar</p><p style="font-size:11px;color:var(--muted)">Usa el botón "Abrir en nueva pestaña" o descarga el archivo</p>`;
}
}, 12000);
} else if (v.tipo === 'excel') {
wrap.innerHTML = `<div style="padding:40px 32px;text-align:center;color:var(--muted)">
<span style="font-size:52px;display:block;margin-bottom:14px">📈</span>
<p style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">Archivo de Excel</p>
<p style="font-size:12px;color:var(--muted)">Descárgalo para verlo completo</p>
</div>`;
} else {
wrap.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted)"><i class="ti ti-file-off" style="font-size:36px;display:block;margin-bottom:8px"></i><p>Archivo no disponible</p></div>`;
}
const dlBtn = document.getElementById('cdv-download-btn');
dlBtn.href     = fileUrl || '#';
dlBtn.target   = '_blank';
dlBtn.download = '';   // Storage signed URLs don't need filename hint
document.getElementById('modal-cap-docview-overlay').classList.add('open');
};
function closeCapViewModal() {
document.getElementById('modal-cap-view-overlay').classList.remove('open');
document.getElementById('cmv-embed').innerHTML = '';
}
function closeCapDocViewModal() {
document.getElementById('modal-cap-docview-overlay').classList.remove('open');
document.getElementById('cdv-embed-wrap').innerHTML = '';
}
window._capEditar = function(id, src) {
if (src === 'ppt' || src === 'pdf') { _capEditarDoc(id); return; }
capEditId = id;
const v = capItems.find(x => x.id === id);
if (!v) return;
document.getElementById('modal-cap-form-title').textContent   = 'Editar video';
document.getElementById('btn-cap-form-save-text').textContent = 'Guardar cambios';
document.getElementById('fcap-titulo').value   = v.titulo || '';
document.getElementById('fcap-url').value      = v.url || '';
document.getElementById('fcap-cat').value      = v.categoria || '';
document.getElementById('fcap-duracion').value = v.duracion || '';
document.getElementById('fcap-desc').value     = v.desc || '';
document.getElementById('modal-cap-form-overlay').classList.add('open');
};
function _capEditarDoc(id) {
capDocEditId = id;
const v = capItems.find(x => x.id === id);
if (!v) return;
capDocSetTipo(v.tipo || 'pdf');
document.getElementById('fdoc-titulo').value = v.titulo || '';
document.getElementById('fdoc-cat').value    = v.categoria || '';
document.getElementById('fdoc-desc').value   = v.desc || '';
capDocFile = null;
document.getElementById('modal-cap-doc-title').textContent   = 'Editar documento';
document.getElementById('btn-cap-doc-save-text').textContent = 'Guardar cambios';
if (v.titulo) document.getElementById('fdoc-drop-hint').textContent = '✓ Archivo ya subido. Sube uno nuevo para reemplazar.';
document.getElementById('modal-cap-doc-overlay').classList.add('open');
}
window._capEliminar = async function(id) {
const prefConfirm = localStorage.getItem('pref_confirmar');
const confirmar = prefConfirm === null ? true : prefConfirm === 'true';
if (confirmar && !window.confirm('¿Eliminar este recurso?')) return;
try {
const v = capItems.find(x => x.id === id);
if (v?.storagePath) {
try { await deleteObject(storageRef(storage, v.storagePath)); } catch(e) {  }
}
await deleteDoc(doc(db, 'capacitate', id));
showCapToast('Recurso eliminado ✓');
} catch(e) {
showCapToast('Error al eliminar: ' + (e.message||''), 'error');
}
};
function abrirModalCapNuevo() {
capEditId = null;
document.getElementById('modal-cap-form-title').textContent   = 'Agregar video';
document.getElementById('btn-cap-form-save-text').textContent = 'Guardar video';
['fcap-titulo','fcap-url','fcap-cat','fcap-duracion','fcap-desc'].forEach(id => { document.getElementById(id).value = ''; });
document.getElementById('modal-cap-form-overlay').classList.add('open');
}
function closeCapFormModal() {
document.getElementById('modal-cap-form-overlay').classList.remove('open');
capEditId = null;
}
document.getElementById('btn-cap-form-save')?.addEventListener('click', async () => {
const titulo = document.getElementById('fcap-titulo').value.trim();
const url    = document.getElementById('fcap-url').value.trim();
const cat    = document.getElementById('fcap-cat').value.trim();
if (!titulo || !url || !cat) { showCapToast('Completa los campos obligatorios (*)', 'error'); return; }
const btn = document.getElementById('btn-cap-form-save');
btn.disabled = true;
btn.innerHTML = '<i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> Guardando…';
const payload = {
titulo, url, categoria: cat, tipo: 'video',
duracion: document.getElementById('fcap-duracion').value.trim(),
desc:     document.getElementById('fcap-desc').value.trim(),
};
try {
if (capEditId) {
await updateDoc(doc(db, 'capacitate', capEditId), { ...payload, actualizadoPor: currentCapUser?.email, actualizadoEn: serverTimestamp() });
showCapToast('Video actualizado ✓');
} else {
await addDoc(collection(db, 'capacitate'), { ...payload, creadoPor: currentCapUser?.email, creadoEn: serverTimestamp() });
showCapToast('Video añadido ✓');
}
closeCapFormModal();
} catch(e) {
showCapToast('Error: ' + (e.message||''), 'error');
} finally {
btn.disabled = false;
btn.innerHTML = '<i class="ti ti-device-floppy"></i><span id="btn-cap-form-save-text">' + (capEditId?'Guardar cambios':'Guardar video') + '</span>';
}
});
window.capDocSetTipo = function(tipo) {
capDocTipo = tipo;
['ppt','pdf','word','excel'].forEach(t => {
const btn = document.getElementById(`cap-doc-tipo-${t}`);
if (!btn) return;
btn.className = 'cap-tipo-btn' + (t===tipo ? ` active-${t}` : '');
});
const fi = document.getElementById('fdoc-file-input');
const ACCEPT = { ppt:'.ppt,.pptx', pdf:'.pdf', word:'.doc,.docx', excel:'.xls,.xlsx,.csv' };
const HINT   = { ppt:'PPT, PPTX', pdf:'PDF', word:'DOC, DOCX', excel:'XLS, XLSX, CSV' };
fi.accept = ACCEPT[tipo] || '.pdf';
document.getElementById('fdoc-drop-hint').textContent = (HINT[tipo] || 'Archivo') + ' — sin límite de tamaño';
};
document.getElementById('fdoc-file-input')?.addEventListener('change', e => {
const file = e.target.files[0];
if (file) setDocFile(file);
});
const dropZone = document.getElementById('fdoc-drop-zone');
if (dropZone) {
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
e.preventDefault(); dropZone.classList.remove('dragover');
if (e.dataTransfer.files[0]) setDocFile(e.dataTransfer.files[0]);
});
}
function setDocFile(file) {
document.getElementById('fdoc-size-warning').style.display = 'none';
capDocFile = file;
const prog = document.getElementById('fdoc-progress-wrap');
prog.style.display = 'block';
const fnameSpan = document.getElementById('fdoc-filename')?.querySelector('span');
if (fnameSpan) fnameSpan.textContent = file.name;
document.getElementById('fdoc-bar').style.width = '0%';
document.getElementById('fdoc-drop-hint').textContent =
`✓ ${file.name} (${(file.size / 1024).toFixed(0)} KB) — listo para subir`;
}
document.getElementById('btn-cap-doc-save')?.addEventListener('click', async () => {
const titulo = document.getElementById('fdoc-titulo').value.trim();
const cat    = document.getElementById('fdoc-cat').value.trim();
if (!titulo || !cat) { showCapToast('Completa título y categoría', 'error'); return; }
if (!capDocFile && !capDocEditId) { showCapToast('Selecciona un archivo para subir', 'error'); return; }
const btn = document.getElementById('btn-cap-doc-save');
btn.disabled = true;
btn.innerHTML = '<i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> Subiendo…';
try {
let fileUrl     = capDocEditId ? (capItems.find(x=>x.id===capDocEditId)?.fileUrl || '') : '';
let storagePath = capDocEditId ? (capItems.find(x=>x.id===capDocEditId)?.storagePath || '') : '';
if (capDocFile) {
const ext  = capDocFile.name.split('.').pop().toLowerCase();
const path = `capacitate/${Date.now()}_${capDocFile.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
const ref  = storageRef(storage, path);
await new Promise((resolve, reject) => {
const task = uploadBytesResumable(ref, capDocFile);
task.on('state_changed',
snap => {
const pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
document.getElementById('fdoc-bar').style.width = pct + '%';
btn.innerHTML = `<i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> ${pct}%…`;
},
reject,
async () => {
fileUrl     = await getDownloadURL(task.snapshot.ref);
storagePath = path;
resolve();
}
);
});
}
const payload = {
titulo, categoria: cat,
desc:        document.getElementById('fdoc-desc').value.trim(),
tipo:        capDocTipo,
fileUrl,
storagePath,
};
if (capDocEditId) {
await updateDoc(doc(db, 'capacitate', capDocEditId), { ...payload, actualizadoPor: currentCapUser?.email, actualizadoEn: serverTimestamp() });
showCapToast('Documento actualizado ✓');
} else {
await addDoc(collection(db, 'capacitate'), { ...payload, creadoPor: currentCapUser?.email, creadoEn: serverTimestamp() });
showCapToast('Documento subido ✓');
}
const wasEdit = !!capDocEditId;
closeCapDocModal();
} catch(e) {
showCapToast('Error al subir: ' + (e.message||''), 'error');
} finally {
btn.disabled = false;
btn.innerHTML = '<i class="ti ti-upload"></i><span id="btn-cap-doc-save-text">Subir documento</span>';
}
});
function closeCapDocModal() {
document.getElementById('modal-cap-doc-overlay').classList.remove('open');
capDocEditId = null; capDocFile = null;
['fdoc-titulo','fdoc-cat','fdoc-desc'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
const prog = document.getElementById('fdoc-progress-wrap');
if (prog) prog.style.display = 'none';
const bar = document.getElementById('fdoc-bar'); if(bar) bar.style.width = '0%';
const sw = document.getElementById('fdoc-size-warning'); if(sw) sw.style.display = 'none';
const hint = document.getElementById('fdoc-drop-hint'); if(hint) hint.textContent = 'PPT, PPTX o PDF — sin límite de tamaño';
const fi = document.getElementById('fdoc-file-input'); if(fi) fi.value='';
const docTitle = document.getElementById('modal-cap-doc-title'); if(docTitle) docTitle.textContent = 'Subir documento';
const saveText = document.getElementById('btn-cap-doc-save-text'); if(saveText) saveText.textContent = 'Subir documento';
}
document.getElementById('btn-cap-nueva')?.addEventListener('click', abrirModalCapNuevo);
document.getElementById('btn-cap-nueva-doc')?.addEventListener('click', () => {
capDocEditId = null; capDocSetTipo('ppt');
document.getElementById('modal-cap-doc-overlay').classList.add('open');
});
document.getElementById('btn-cap-form-cancel')?.addEventListener('click', closeCapFormModal);
document.getElementById('modal-cap-form-close')?.addEventListener('click', closeCapFormModal);
document.getElementById('modal-cap-form-overlay')?.addEventListener('click', e => { if(e.target===document.getElementById('modal-cap-form-overlay')) closeCapFormModal(); });
document.getElementById('cmv-close')?.addEventListener('click', closeCapViewModal);
document.getElementById('cmv-cancel')?.addEventListener('click', closeCapViewModal);
document.getElementById('modal-cap-view-overlay')?.addEventListener('click', e => { if(e.target===document.getElementById('modal-cap-view-overlay')) closeCapViewModal(); });
document.getElementById('btn-cap-doc-cancel')?.addEventListener('click', closeCapDocModal);
document.getElementById('modal-cap-doc-close')?.addEventListener('click', closeCapDocModal);
document.getElementById('modal-cap-doc-overlay')?.addEventListener('click', e => { if(e.target===document.getElementById('modal-cap-doc-overlay')) closeCapDocModal(); });
document.getElementById('modal-cap-docview-close')?.addEventListener('click', closeCapDocViewModal);
document.getElementById('btn-cap-docview-close')?.addEventListener('click', closeCapDocViewModal);
document.getElementById('modal-cap-docview-overlay')?.addEventListener('click', e => { if(e.target===document.getElementById('modal-cap-docview-overlay')) closeCapDocViewModal(); });
document.getElementById('cap-search')?.addEventListener('input', renderCapGrid);
let capUnsubscribe = null;
onAuthStateChanged(auth, async user => {
if (!user) return;
currentCapUser = user;
try {
const snap = await getDoc(doc(db, 'asesores_autorizados', user.email.toLowerCase()));
if (snap.exists()) currentCapRol = snap.data().Rol || '';
} catch(e) { currentCapRol = ''; }
const bar = document.getElementById('cap-formador-bar');
if (puedeGestionar() && bar) bar.classList.add('visible');
if (capUnsubscribe) capUnsubscribe();
capUnsubscribe = onSnapshot(
query(collection(db, 'capacitate'), orderBy('creadoEn', 'asc')),
snap => {
try {
capItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
renderCapCats();
renderCapGrid();
} catch(e) { console.error('renderCapGrid:', e); }
},
err => {
console.warn('Capacítate onSnapshot:', err);
document.getElementById('cap-grid').innerHTML = `<div class="cap-empty" style="grid-column:1/-1"><i class="ti ti-wifi-off"></i><p>Error al cargar recursos</p><span>${err.message}</span></div>`;
}
);
});
