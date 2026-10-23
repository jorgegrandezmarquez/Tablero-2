/* MÓDULO · Resumen ejecutivo: KPIs con semáforo, regiones, mapa de calor sitios × días y peores sitios. */
(function () {
  'use strict';
  const NOC = window.NOC, G = NOC.G, PD = NOC.muestrasPorDia;
  const Resumen = { modo: 'lat' };

  NOC.registrarModulo({
    id: 'resumen', titulo: 'Resumen', grupo: 'Ver', orden: 1,
    render(cont) {
      const e = NOC.estado, idx = NOC.sitiosFiltrados(), [a, b] = NOC.rango();
      const k = NOC.kpis(idx, a, b), tk = NOC.ticketsEnRango(a, b, t => e.region === 'Todas' || t.region === e.region);
      const abiertos = tk.filter(t => t.resuelto == null).length;
      const kp = (et, val, sub, sem) => `<div class="kpi ${sem || ''}"><div class="et">${et}</div><div class="val">${val}</div><div class="sub">${sub || ''}</div></div>`;
      cont.innerHTML = `
        <div class="titulo-modulo"><h2>Resumen de la red</h2><p>${idx.length} sitios · ${NOC.etiquetaDia(e.dDesde)} a ${NOC.etiquetaDia(e.dHasta)}. Cada tarjeta se pinta según el umbral de operación.</p></div>
        <div class="kpis">
          ${kp('Disponibilidad', NOC.num(k.disponibilidad, 2) + ' %', k.muestrasCaidas + ' muestras con sitio caído', NOC.semaforo('disponibilidad_pct', k.disponibilidad))}
          ${kp('Latencia media', NOC.num(k.latencia, 1) + ' ms', 'umbral alerta 60 ms', NOC.semaforo('latencia_ms', k.latencia))}
          ${kp('Pérdida de paquetes', NOC.num(k.perdida, 2) + ' %', 'umbral alerta 0,5 %', NOC.semaforo('perdida_pct', k.perdida))}
          ${kp('Utilización pico', NOC.num(k.utilizacionPico, 1) + ' %', 'promedio del máximo por sitio', NOC.semaforo('utilizacion_pct', k.utilizacionPico))}
          ${kp('Tickets', NOC.entero(tk.length), abiertos + ' abiertos · MTTR ' + NOC.num(NOC.mttrHoras(tk), 1) + ' h')}
        </div>
        <div class="fila" style="margin-bottom:14px">
          <div class="card" style="flex:2"><h3>Disponibilidad y latencia por día</h3><div id="rs-lineas"></div></div>
          <div class="card"><h3>Por región</h3><div id="rs-reg"></div></div>
        </div>
        <div class="card" style="margin-bottom:14px"><h3>Mapa de calor por sitio y día <small>(cada fila es un sitio; clic para abrirlo)</small>
          <select id="rs-hm" style="margin-left:10px;background:var(--panel2);border:1px solid var(--linea);border-radius:8px;padding:3px 8px"><option value="lat">Latencia vs. su nivel normal</option><option value="perd">Pérdida de paquetes</option><option value="caida">Tiempo caído</option><option value="util">Utilización pico</option></select></h3><div id="rs-calor"></div></div>
        <div class="card"><h3>Diez sitios con peor desempeño <small>(puntaje = latencia + pérdida + caídas)</small></h3><div id="rs-peores" class="tabla-scroll"></div></div>`;

      // líneas por día: disponibilidad (izq) y latencia (der, normalizada en su propio gráfico)
      const nd = e.dHasta - e.dDesde + 1;
      const disp = NOC.agregarSerie('disponibilidad_pct', idx, a, b, PD), lat = NOC.agregarSerie('latencia_ms', idx, a, b, PD);
      const cl = cont.querySelector('#rs-lineas'); cl.innerHTML = '<div id="l1"></div><div id="l2"></div>';
      G.lineas(cl.querySelector('#l1'), { series: [{ nombre: 'Disponibilidad %', y: disp, color: '#3DD68C' }], x0: a, paso: PD, alto: 130, fmt: v => NOC.num(v, 2) });
      G.lineas(cl.querySelector('#l2'), { series: [{ nombre: 'Latencia ms', y: lat, color: '#6C8CFF' }], x0: a, paso: PD, alto: 130, fmt: v => NOC.num(v, 1) });

      // por región
      const reg = NOC.meta.regiones.map(r => { const ii = idx.filter(i => NOC.sitios[i].region === r); if (!ii.length) return null; const kk = NOC.kpis(ii, a, b); return { etiqueta: r, valor: kk.disponibilidad, k: kk, color: NOC.colorSem[NOC.semaforo('disponibilidad_pct', kk.disponibilidad)], alClic: () => NOC.fijar({ region: r }) }; }).filter(Boolean);
      cont.querySelector('#rs-reg').innerHTML = reg.map(r => `<div style="margin:8px 0;cursor:pointer" data-r="${r.etiqueta}"><b>${r.etiqueta}</b> <span class="etq ${NOC.semaforo('disponibilidad_pct', r.k.disponibilidad)}">${NOC.num(r.k.disponibilidad, 2)} %</span><br><small>lat ${NOC.num(r.k.latencia, 1)} ms · pérd ${NOC.num(r.k.perdida, 2)} % · ${r.k.sitios} sitios</small></div>`).join('');
      cont.querySelectorAll('#rs-reg [data-r]').forEach(el => el.onclick = () => NOC.fijar({ region: el.dataset.r }));

      // mapa de calor: cada celda = un sitio en un día. Se pinta contra el nivel NORMAL de ese mismo sitio.
      const orden = idx.slice().sort((p, q) => NOC.sitios[p].region.localeCompare(NOC.sitios[q].region) || NOC.sitios[p].agr.localeCompare(NOC.sitios[q].agr) || p - q);
      const MODOS = {
        lat: { et: 'Latencia vs. su nivel normal', lo: 1.0, hi: 1.5, malo: true, f: (s, d, ref) => NOC.est.media(s, d * PD, (d + 1) * PD) / ref, ref: i => NOC.est.mediana(NOC.serie('latencia_ms', i)), m: 'latencia_ms', txt: v => 'x' + NOC.num(v, 2) + ' de lo normal' },
        perd: { et: 'Pérdida de paquetes (%)', lo: 0.05, hi: 1.5, malo: true, f: (s, d) => NOC.est.media(s, d * PD, (d + 1) * PD), m: 'perdida_pct', txt: v => NOC.num(v, 2) + ' %' },
        caida: { et: 'Tiempo caído (% del día)', lo: 0, hi: 15, malo: true, f: (s, d) => { let c = 0, n = 0; for (let t = d * PD; t < (d + 1) * PD; t++) if (s[t] === s[t]) { n++; if (s[t] < 50) c++; } return n ? 100 * c / n : 0; }, m: 'disponibilidad_pct', txt: v => NOC.num(v, 1) + ' % del día' },
        util: { et: 'Utilización pico del día (%)', lo: 40, hi: 95, malo: true, f: (s, d) => NOC.est.max(s, d * PD, (d + 1) * PD), m: 'utilizacion_pct', txt: v => NOC.num(v, 0) + ' %' },
      };
      const selH = cont.querySelector('#rs-hm'); selH.value = Resumen.modo;
      const pintarCalor = () => {
        const M = MODOS[Resumen.modo];
        const vals = orden.map(i => { const s = NOC.serie(M.m, i), ref = M.ref ? M.ref(i) : 1, r = []; for (let d = e.dDesde; d <= e.dHasta; d++) r.push(M.f(s, d, ref)); return r; });
        G.calor(cont.querySelector('#rs-calor'), {
          filas: orden, cols: nd, filaAlto: Math.max(2, Math.min(5, Math.floor(620 / orden.length))),
          valor: (f, c) => vals[f][c], color: v => G.escala(v, M.lo, M.hi, M.malo),
          etiquetasCol: Array.from({ length: Math.ceil(nd / 5) }, (_, j) => [j * 5, NOC.etiquetaDia(e.dDesde + j * 5)]),
          tip: (f, c) => { const s = NOC.sitios[orden[f]]; return `<b>${s.id}</b> · ${s.region} · ${s.tecnologia}<br>${NOC.etiquetaDia(e.dDesde + c)}: ${M.txt(vals[f][c])}`; },
          alClic: (f) => NOC.fijar({ sitio: NOC.sitios[orden[f]].id, tab: 'series', metrica: M.m }),
        });
      };
      selH.onchange = () => { Resumen.modo = selH.value; pintarCalor(); };
      pintarCalor();

      // peores sitios
      const pts = idx.map(i => { const l = NOC.est.media(NOC.serie('latencia_ms', i), a, b), p = NOC.est.media(NOC.serie('perdida_pct', i), a, b), d = NOC.serie('disponibilidad_pct', i); let c = 0; for (let t = a; t < b; t++) if (d[t] < 50) c++; return { i, l, p, c, puntaje: l / 30 + p * 2 + c / 8 }; }).sort((x, y) => y.puntaje - x.puntaje).slice(0, 10);
      cont.querySelector('#rs-peores').innerHTML = `<table><tr><th>Sitio</th><th>Región</th><th>Tecnología</th><th>Latencia</th><th>Pérdida</th><th>Muestras caídas</th></tr>${pts.map(p => `<tr class="clic" data-s="${NOC.sitios[p.i].id}"><td><b>${NOC.sitios[p.i].id}</b></td><td>${NOC.sitios[p.i].region}</td><td>${NOC.sitios[p.i].tecnologia}</td><td>${NOC.num(p.l, 1)} ms</td><td>${NOC.num(p.p, 2)} %</td><td>${p.c}</td></tr>`).join('')}</table>`;
      cont.querySelectorAll('#rs-peores tr.clic').forEach(tr => tr.onclick = () => NOC.fijar({ sitio: tr.dataset.s, tab: 'series' }));
    },
  });
})();
