(function() {
  function _initHomeStats() {
    // Nombre y rol
    window.addEventListener('sise:rolCargado', _updateHomeHeader);
    if (window.currentUserRol) _updateHomeHeader();

    // Sesión timer
    const sesionInicio = new Date();
    setInterval(() => {
      const mins = Math.round((new Date() - sesionInicio) / 60000);
      const el = document.getElementById('home-stat-sesion');
      if (el) el.textContent = mins < 60 ? mins + ' min' : Math.floor(mins/60) + 'h ' + (mins%60) + 'min';
    }, 30000);

    // Stats de Firebase
    _loadHomeStats();
  }

  function _updateHomeHeader() {
    const nombre = window.currentUserNombre || '';
    const rol    = window.currentUserRol || '';
    const el  = document.getElementById('home-nombre-display');
    const elR = document.getElementById('home-rol-badge');
    if (el && nombre)  el.textContent  = nombre.split(' ')[0];
    if (elR && rol)    elR.textContent = '· ' + rol;
    _updateRankingPos();
  }

  function _updateRankingPos() {
    const nombre  = window.currentUserNombre || '';
    const ranking = window._satLastRanking || [];
    const el2 = document.getElementById('home-stat-rank');
    if (!el2) return;
    if (!ranking.length || !nombre) { el2.textContent = '—'; return; }
    const primerNombre = nombre.split(' ')[0].toLowerCase();
    const pos = ranking.findIndex(r => r.asesor.toLowerCase().includes(primerNombre)) + 1;
    el2.textContent = pos > 0 ? '#' + pos : '—';
    // Color según posición
    el2.style.color = pos === 1 ? '#B8860B' : pos <= 3 ? '#1A7A45' : 'var(--text)';
  }

  function _loadHomeStats() {
    const mods = window._fbModules;
    if (!mods || !mods.getFirestore) { setTimeout(_loadHomeStats, 1000); return; }
    const {getFirestore, collection, onSnapshot} = mods;
    const db = getFirestore();

    // BO Llamadas — todos los meses, solo las NO atendidas (pendiente + no contesta)
    onSnapshot(collection(db, 'bo_llamadas'), snap => {
      try {
        const activos = snap.docs.filter(d => {
          const estado = (d.data().estadoLlamada || 'pendiente').toLowerCase();
          return estado === 'pendiente' || estado === 'no_contesta' || estado === 'no contesta';
        }).length;
        const el = document.getElementById('home-stat-bo');
        if (el) el.textContent = activos;
      } catch(e) { console.error('home-stat-bo:', e); }
    }, () => {});

    // Casos pendientes — solo los alertados SIN resuelto (ambos tags = no suma, ningún tag = suma)
    onSnapshot(collection(db, 'casos_pendientes'), snap => {
      try {
        const activos = snap.docs.filter(d => {
          const data = d.data();
          const alertado = !!(data.alertado);
          const resuelto = !!(data.resuelto);
          if (resuelto) return false;
          return true;
        }).length;
        const el = document.getElementById('home-stat-pend');
        if (el) el.textContent = activos;
      } catch(e) { console.error('home-stat-pend:', e); }
    }, () => {});
  }

  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initHomeStats);
  } else {
    setTimeout(_initHomeStats, 500);
  }

  // Actualizar posición en ranking cuando cargue el sat
  const _origNotifHome = window._satNotifComparar;
  if (_origNotifHome) {
    window._satNotifComparar = function(ranking) {
      _origNotifHome(ranking);
      setTimeout(_updateRankingPos, 200);
    };
  } else {
    // Polling fallback: verificar cada 2s hasta que haya ranking
    const _rankTimer = setInterval(() => {
      if ((window._satLastRanking||[]).length) {
        _updateRankingPos();
        clearInterval(_rankTimer);
      }
    }, 2000);
  }
})();
