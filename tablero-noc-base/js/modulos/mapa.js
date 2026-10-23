/* MÓDULO · Mapa de sitios con control de tiempo: se ve cómo estaba la red en cada momento. */
(function () {
  'use strict';
  const NOC = window.NOC;
  let t = null, timer = null;

  NOC.registrarModulo({
    id: 'mapa', titulo: 'Mapa', grupo: 'Ver', orden: 2,
    render(cont) {
      const N = NOC.N, e = NOC.estado;
      if (t === null) t = 24 * NOC.muestrasPorDia + 14 * 4 + 2;           // por defecto: el momento del corte (16/10 14:30)
      const idx = NOC.sitiosFiltrados(), set = new Set(idx);
      cont.innerHTML = `
        <div class="titulo-modulo"><h2>Mapa de sitios</h2><p>Cada punto es un sitio; los cuadrados son agregadores (la fibra que los une). Mueva el tiempo y vea cómo se cae y se recupera la red.</p></div>
        <div class="controles">
          <label style="flex:1;min-width:300px">Momento: <b id="mp-t"></b><input id="mp-r" type="range" min="0" max="${N - 1}" value="${t}"></label>
          <button class="btn chico" id="mp-play">▶ Reproducir</button>
          <button class="btn chico ghost" id="mp-corte">Ir al corte del 16/10</button>
          <label>Color por<select id="mp-m"><option value="disp">Disponibilidad</option><option value="latencia_ms">Latencia</option><option value="perdida_pct">Pérdida</option><option value="utilizacion_pct">Utilización</option></select></label>
        </div>
        <div class="card"><svg id="mp-svg" viewBox="0 0 1000 620" style="width:100%;height:auto;background:#120e26;border-radius:10px"></svg>
        <div style="margin-top:6px"><span class="etq ok">normal</span> <span class="etq alerta">alerta</span> <span class="etq mal">crítico</span> <span class="etq">sin dato</span></div></div>
        <div class="card" style="margin-top:12px"><h3>Sitios caídos en este momento</h3><div id="mp-caidos"></div></div>`;
      const svg = cont.querySelector('#mp-svg'), sel = cont.querySelector('#mp-m'), rng = cont.querySelector('#mp-r');
      const estadoDe = (i, m) => {
        if (m === 'disp') { const v = NOC.serie('disponibilidad_pct', i)[t]; if (v !== v) return ['sin', v]; return [v < 50 ? 'mal' : v < 99.5 ? 'alerta' : 'ok', v]; }
        const v = NOC.serie(m, i)[t]; if (v !== v) return ['sin', v]; return [NOC.semaforo(m, v), v];
      };
      const colores = { ok: '#3DD68C', alerta: '#F5B942', mal: '#FF5A5F', sin: '#4a4580' };
      const dibujar = () => {
        const m = sel.value; let h = '';
        NOC.agregadores.forEach(a => {
          NOC.sitios.forEach((s, i) => { if (s.agr === a.id && set.has(i)) h += `<line x1="${a.x}" y1="${a.y}" x2="${s.x}" y2="${s.y}" stroke="#37316A" stroke-width="1" opacity=".7"/>`; });
        });
        NOC.agregadores.forEach(a => {
          const hijos = NOC.sitios.map((s, i) => [s, i]).filter(([s]) => s.agr === a.id), caidos = hijos.filter(([s, i]) => NOC.serie('disponibilidad_pct', i)[t] < 50).length;
          h += `<rect x="${a.x - 9}" y="${a.y - 9}" width="18" height="18" rx="3" fill="${caidos > 3 ? '#FF5A5F' : '#6C8CFF'}"><title>${a.id} · ${a.region} · ${caidos} sitios caídos de ${hijos.length}</title></rect><text x="${a.x}" y="${a.y - 14}" text-anchor="middle" fill="#B9B4D6" font-size="11">${a.id}</text>`;
        });
        const caidos = [];
        idx.forEach(i => {
          const s = NOC.sitios[i], [est, v] = estadoDe(i, m); if (est === 'mal' && m === 'disp') caidos.push(s);
          h += `<circle cx="${s.x}" cy="${s.y}" r="${est === 'mal' ? 7 : 5}" fill="${colores[est]}" stroke="#15112B" stroke-width="1.5" data-i="${i}"><title>${s.id} · ${s.tecnologia} · ${NOC.etiquetas[m === 'disp' ? 'disponibilidad_pct' : m]}: ${NOC.num(v, 2)}</title></circle>`;
        });
        svg.innerHTML = h;
        svg.querySelectorAll('circle').forEach(c => c.onclick = () => NOC.fijar({ sitio: NOC.sitios[+c.dataset.i].id, tab: 'series' }));
        cont.querySelector('#mp-t').textContent = NOC.fmtT(t) + ' · ' + NOC.etiquetaDia(NOC.diaDe(t));
        cont.querySelector('#mp-caidos').innerHTML = caidos.length ? caidos.map(s => `<span class="etq mal" style="margin:2px">${s.id} · ${s.agr}</span>`).join('') : '<small>Ninguno.</small>';
        rng.value = t;
      };
      rng.oninput = () => { t = +rng.value; dibujar(); };
      sel.onchange = dibujar;
      cont.querySelector('#mp-corte').onclick = () => { t = 24 * NOC.muestrasPorDia + 14 * 4 + 2; dibujar(); };
      const play = cont.querySelector('#mp-play');
      play.onclick = () => {
        if (timer) { clearInterval(timer); timer = null; play.textContent = '▶ Reproducir'; return; }
        play.textContent = '⏸ Pausar'; timer = setInterval(() => { t = (t + 2) % N; dibujar(); if (!document.body.contains(play)) { clearInterval(timer); timer = null; } }, 90);
      };
      dibujar();
    },
  });
})();
