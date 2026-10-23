/* RETO · Perfiles de sitios: agrupar sitios parecidos (k-medias) y encontrar los "raros" que no se parecen a sus pares. */
(function () {
  'use strict';
  const NOC = window.NOC, S = NOC.est;
  const COLORES = ['#6C8CFF', '#3DD68C', '#F5B942', '#A78BFA', '#FF5A36', '#4DD0E1'];
  const cfg = { k: 4 };

  function caracteristicas(i, a, b) {
    const lat = NOC.serie('latencia_ms', i), per = NOC.serie('perdida_pct', i), u = NOC.serie('utilizacion_pct', i), d = NOC.serie('disponibilidad_pct', i);
    const ml = S.media(lat, a, b); let sd = 0, n = 0; for (let t = a; t < b; t++) if (lat[t] === lat[t]) { sd += (lat[t] - ml) ** 2; n++; }
    let caido = 0; for (let t = a; t < b; t++) if (d[t] < 50) caido++;
    return [ml, Math.sqrt(sd / Math.max(1, n)) / ml, S.media(per, a, b), S.media(u, a, b), S.max(u, a, b), 100 * caido / (b - a)];
  }
  const NOMBRES = ['latencia media', 'variabilidad de latencia', 'pérdida media', 'utilización media', 'utilización pico', '% del tiempo caído'];

  function kmedias(X, k) {                       // inicialización determinista (los más lejanos entre sí) y 25 vueltas
    const c = [X[0].slice()];
    while (c.length < k) { let mejor = -1, md = -1; X.forEach((x, i) => { const d = Math.min(...c.map(y => dist(x, y))); if (d > md) { md = d; mejor = i; } }); c.push(X[mejor].slice()); }
    let asg = new Array(X.length).fill(0);
    for (let it = 0; it < 25; it++) {
      asg = X.map(x => { let b = 0, bd = Infinity; c.forEach((y, j) => { const d = dist(x, y); if (d < bd) { bd = d; b = j; } }); return b; });
      for (let j = 0; j < k; j++) { const m = X.filter((_, i) => asg[i] === j); if (m.length) c[j] = c[j].map((_, q) => S.media(m.map(x => x[q]))); }
    }
    return { asg, c };
  }
  const dist = (p, q) => Math.sqrt(p.reduce((s, v, i) => s + (v - q[i]) ** 2, 0));

  NOC.registrarModulo({
    id: 'perfiles', titulo: 'Perfiles', grupo: 'Retos', orden: 10,
    render(cont) {
      cont.innerHTML = `
        <div class="titulo-modulo"><h2>Perfiles de sitios</h2><p>Agrupamiento (k-medias) con seis características de cada sitio. Los grupos pequeños y los sitios lejos de su grupo son los "raros": candidatos a revisar.</p></div>
        <div class="controles"><label>Grupos: <b id="pf-kv">${cfg.k}</b><input id="pf-k" type="range" min="2" max="6" value="${cfg.k}"></label></div>
        <div class="fila"><div class="card" style="flex:2"><h3>Utilización media (→) frente a latencia media (↑)</h3><div id="pf-g"></div></div><div class="card"><h3>Grupos</h3><div id="pf-r"></div></div></div>
        <div class="card" style="margin-top:12px"><h3>Los sitios más lejos de su grupo (los "raros")</h3><div id="pf-o" class="tabla-scroll" style="max-height:300px"></div></div>`;
      const $ = s => cont.querySelector(s);
      const pintar = () => {
        const [a, b] = NOC.rango(), idx = NOC.sitiosFiltrados(); if (idx.length < cfg.k + 1) { $('#pf-r').textContent = 'Muy pocos sitios para agrupar.'; return; }
        const F = idx.map(i => caracteristicas(i, a, b)), mu = F[0].map((_, q) => S.media(F.map(f => f[q]))), sd = F[0].map((_, q) => Math.sqrt(S.media(F.map(f => (f[q] - mu[q]) ** 2))) || 1);
        const X = F.map(f => f.map((v, q) => (v - mu[q]) / sd[q])), { asg, c } = kmedias(X, cfg.k);
        const W = 520, H = 300, lx = F.map(f => f[3]), ly = F.map(f => f[0]), x0 = Math.min(...lx), x1 = Math.max(...lx), y0 = Math.min(...ly), y1 = Math.max(...ly);
        $('#pf-g').innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;background:#120e26;border-radius:10px">${idx.map((i, q) => `<circle cx="${30 + (lx[q] - x0) / (x1 - x0 || 1) * (W - 50)}" cy="${H - 24 - (ly[q] - y0) / (y1 - y0 || 1) * (H - 44)}" r="5" fill="${COLORES[asg[q]]}" opacity=".85"><title>${NOC.sitios[i].id} · ${NOC.sitios[i].tecnologia}</title></circle>`).join('')}</svg>`;
        $('#pf-r').innerHTML = c.map((_, j) => { const m = F.filter((_, q) => asg[q] === j), n = m.length; if (!n) return ''; const med = F[0].map((_, p) => S.media(m.map(f => f[p])));
          return `<div style="margin:8px 0"><span class="etq" style="color:${COLORES[j]};border-color:${COLORES[j]}">Grupo ${j + 1}</span> <b>${n}</b> sitios<br><small>lat ${NOC.num(med[0], 0)} ms · pérd ${NOC.num(med[2], 2)} % · util ${NOC.num(med[3], 0)} % · caído ${NOC.num(med[5], 1)} %</small></div>`; }).join('');
        const lejos = idx.map((i, q) => ({ i, q, d: dist(X[q], c[asg[q]]) })).sort((p, q) => q.d - p.d).slice(0, 10);
        $('#pf-o').innerHTML = `<table><tr><th>Sitio</th><th>Tecnología</th><th>Grupo</th><th>Distancia</th><th>Qué lo hace distinto</th></tr>${lejos.map(o => { const dif = X[o.q].map((v, p) => [Math.abs(v - c[asg[o.q]][p]), p]).sort((p, q) => q[0] - p[0])[0][1];
          return `<tr class="clic" data-s="${NOC.sitios[o.i].id}"><td><b>${NOC.sitios[o.i].id}</b></td><td>${NOC.sitios[o.i].tecnologia}</td><td>${asg[o.q] + 1}</td><td>${NOC.num(o.d, 1)}</td><td>${NOMBRES[dif]}: ${NOC.num(F[o.q][dif], 2)}</td></tr>`; }).join('')}</table>`;
        $('#pf-o').querySelectorAll('tr.clic').forEach(tr => tr.onclick = () => NOC.fijar({ sitio: tr.dataset.s, tab: 'series' }));
      };
      $('#pf-k').oninput = e => { cfg.k = +e.target.value; $('#pf-kv').textContent = cfg.k; pintar(); };
      pintar();
    },
  });
})();
