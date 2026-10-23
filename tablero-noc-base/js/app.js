/* APP · arranque: filtros, pestañas, copiloto. Dibuja el módulo activo cada vez que cambia el estado. */
(function () {
  'use strict';
  const NOC = window.NOC; if (!NOC) return;
  const $ = s => document.querySelector(s);
  const esc = NOC.esc;

  function filtros() {
    const e = NOC.estado, opts = (arr, sel) => ['Todas'].concat(arr).map(v => `<option ${v === sel ? 'selected' : ''}>${v}</option>`).join('');
    const dias = Array.from({ length: NOC.meta.dias }, (_, d) => d);
    $('#filtros').innerHTML = `
      <label>Región<select id="f-reg">${opts(NOC.meta.regiones, e.region)}</select></label>
      <label>Área<select id="f-area">${opts(['Radio', 'Transporte', 'Fibra'], e.area)}</select></label>
      <label>Tecnología<select id="f-tec">${opts(NOC.meta.tecnologias, e.tecnologia)}</select></label>
      <label>Desde<select id="f-d0">${dias.map(d => `<option value="${d}" ${d === e.dDesde ? 'selected' : ''}>${NOC.etiquetaDia(d)}</option>`).join('')}</select></label>
      <label>Hasta<select id="f-d1">${dias.map(d => `<option value="${d}" ${d === e.dHasta ? 'selected' : ''}>${NOC.etiquetaDia(d)}</option>`).join('')}</select></label>
      <button class="btn ghost chico" id="f-ult7">Últimos 7 días</button><button class="btn ghost chico" id="f-todo">Mes completo</button>`;
    const tomar = () => {
      let d0 = +$('#f-d0').value, d1 = +$('#f-d1').value; if (d1 < d0) { const x = d0; d0 = d1; d1 = x; }
      NOC.fijar({ region: $('#f-reg').value, area: $('#f-area').value, tecnologia: $('#f-tec').value, dDesde: d0, dHasta: d1 });
    };
    ['#f-reg', '#f-area', '#f-tec', '#f-d0', '#f-d1'].forEach(s => $(s).addEventListener('change', tomar));
    $('#f-ult7').onclick = () => NOC.fijar({ dDesde: NOC.meta.dias - 7, dHasta: NOC.meta.dias - 1 });
    $('#f-todo').onclick = () => NOC.fijar({ dDesde: 0, dHasta: NOC.meta.dias - 1 });
  }

  function pestanas() {
    const mods = NOC.modulos.slice().sort((a, b) => (a.orden || 99) - (b.orden || 99));
    let h = '', grupo = '';
    mods.forEach(m => {
      if (m.grupo !== grupo) { grupo = m.grupo; h += `<div class="grupo">${esc(grupo || '')}</div>`; }
      h += `<button data-id="${m.id}" class="${m.id === NOC.estado.tab ? 'activa' : ''}">${esc(m.titulo)}${m.pendiente ? '<span class="pend">pendiente</span>' : ''}</button>`;
    });
    $('#pestanas').innerHTML = h;
    $('#pestanas').querySelectorAll('button').forEach(b => b.onclick = () => NOC.fijar({ tab: b.dataset.id }));
  }

  let dibujando = false;
  function dibujar() {
    if (dibujando) return; dibujando = true;
    try {
      filtros(); pestanas();
      const m = NOC.modulos.find(x => x.id === NOC.estado.tab) || NOC.modulos[0];
      const cont = $('#principal'); cont.innerHTML = '';
      try { m.render(cont); } catch (err) {
        console.error(err);
        cont.innerHTML = `<div class="pendiente"><h3>Este módulo tiene un error</h3><p>${esc(err.message)}</p><p>Copie este mensaje y pídale a Claude Code que lo corrija en <code>js/modulos/${esc(m.id)}.js</code>.</p></div>`;
      }
    } finally { dibujando = false; }
  }

  function iniciar() {
    // enlace directo a una pestaña: index.html#anomalias  (útil para marcadores y pruebas)
    const h = decodeURIComponent((location.hash || '').slice(1)).split('&'), t = h[0];
    if (t && NOC.modulos.some(m => m.id === t)) NOC.estado.tab = t;
    h.slice(1).forEach(p => {
      const i = p.indexOf('='), k = p.slice(0, i), v = p.slice(i + 1);
      if (k === 'sitio' && NOC.idxSitio[v] !== undefined) NOC.estado.sitio = v;
      else if (k === 'dia') NOC.estado.dDesde = NOC.estado.dHasta = +v;
      else if (k === 'solo' && v === '1') $('#cuerpo').classList.add('sin-copiloto');
      else if (/^\w+\.\w+$/.test(k)) { const [m, c] = k.split('.'); if (NOC[m] && NOC[m].cfg) NOC[m].cfg[c] = isNaN(v) ? v : Number(v); }   // p. ej. anomalias.umbral=6
    });
    const clic = (h.find(p => p.startsWith('clic=')) || '').slice(5);   // clic=id  o  clic=sel:<selector CSS>
    if (clic) setTimeout(() => { const el = clic.startsWith('sel:') ? document.querySelector(clic.slice(4)) : document.getElementById(clic); if (el) el.click(); }, 900);
    NOC.copiloto.montar($('#copiloto'));
    $('#btn-copiloto').onclick = () => $('#cuerpo').classList.toggle('sin-copiloto');
    NOC.alCambiar(dibujar);
    dibujar();
  }
  // Recarga las pestañas cuando un módulo se registra tarde
  NOC.refrescar = () => dibujar();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
