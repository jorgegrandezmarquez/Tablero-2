/* RETO · Pronóstico de capacidad: ¿en cuántos días un sitio llega al umbral? (regresión lineal sobre el máximo diario) */
(function () {
  'use strict';
  const NOC = window.NOC, G = NOC.G, S = NOC.est, PD = NOC.muestrasPorDia;
  const cfg = { metrica: 'utilizacion_pct', umbral: 90, dias: 14 };

  NOC.registrarModulo({
    id: 'pronostico', titulo: 'Pronóstico', grupo: 'Retos', orden: 8,
    render(cont) {
      cont.innerHTML = `
        <div class="titulo-modulo"><h2>Pronóstico de capacidad</h2><p>Se ajusta una recta al máximo diario de los últimos días y se proyecta hasta el umbral. Es regresión lineal simple: sirve cuando la tendencia es clara, y avisa cuando no lo es (R² bajo).</p></div>
        <div class="controles">
          <label>Métrica<select id="pr-m"><option value="utilizacion_pct">Utilización (%)</option><option value="latencia_ms">Latencia (ms)</option><option value="perdida_pct">Pérdida (%)</option></select></label>
          <label>Umbral<input id="pr-u" type="number" value="${cfg.umbral}" style="width:80px"></label>
          <label>Últimos días: <b id="pr-dv">${cfg.dias}</b><input id="pr-d" type="range" min="7" max="30" value="${cfg.dias}" style="width:150px"></label>
        </div>
        <div class="fila"><div class="card" style="flex:2"><h3>Sitios que llegarían antes al umbral</h3><div id="pr-tab" class="tabla-scroll"></div></div>
        <div class="card" style="flex:3"><h3 id="pr-t">Elija un sitio</h3><div id="pr-g"></div><div class="nota" id="pr-n" style="display:none"></div></div></div>`;
      const $ = s => cont.querySelector(s); $('#pr-m').value = cfg.metrica;
      const detalle = i => {
        const m = cfg.metrica, s = NOC.serie(m, i), nd = NOC.meta.dias, d0 = Math.max(0, nd - cfg.dias), x = [], y = [];
        for (let d = 0; d < nd; d++) y.push(S.max(s, d * PD, (d + 1) * PD)); for (let d = d0; d < nd; d++) x.push(d);
        const r = S.regresion(x, y.slice(d0)), ext = 25, proy = new Array(nd + ext).fill(NaN), real = y.concat(new Array(ext).fill(NaN));
        for (let d = d0; d < nd + ext; d++) proy[d] = r.intercepto + r.pendiente * d;
        $('#pr-t').textContent = `${NOC.sitios[i].id} · máximo diario de ${NOC.cortas[m]} y su proyección`;
        G.lineas($('#pr-g'), { series: [{ nombre: 'Máximo diario', y: real, color: '#FF5A36' }, { nombre: 'Tendencia proyectada', y: proy, color: '#6C8CFF', ancho: 1.4 }], x0: 0, paso: PD, alto: 260, lineas: [{ y: cfg.umbral, texto: 'umbral', color: '#FF5A5F' }], fmt: v => NOC.num(v, 1) });
        const n = $('#pr-n'); n.style.display = 'block'; n.innerHTML = `Pendiente <b>${NOC.num(r.pendiente, 2)}</b> por día · R² <b>${NOC.num(r.r2, 2)}</b>. ${r.r2 < 0.5 ? 'El ajuste es débil: <b>no confíe</b> en esta proyección.' : 'El ajuste es bueno.'}`;
      };
      const calcular = () => {
        const f = NOC.sitiosFiltrados().map(i => Object.assign(NOC.pronosticoUmbral(i, cfg.metrica, cfg.umbral, cfg.dias), { i })).filter(x => x.dias_hasta_umbral != null).sort((p, q) => p.dias_hasta_umbral - q.dias_hasta_umbral).slice(0, 25);
        $('#pr-tab').innerHTML = `<table><tr><th>Sitio</th><th>Hoy</th><th>Pend./día</th><th>R²</th><th>Días</th></tr>${f.map(x => `<tr class="clic" data-i="${x.i}"><td><b>${x.sitio}</b></td><td>${NOC.num(x.valor_actual_max_diario, 1)}</td><td>${NOC.num(x.pendiente_por_dia, 2)}</td><td><span class="etq ${x.r2 > 0.5 ? 'ok' : 'alerta'}">${NOC.num(x.r2, 2)}</span></td><td>${NOC.num(x.dias_hasta_umbral, 0)}</td></tr>`).join('') || '<tr><td colspan="5"><small>Ningún sitio sube.</small></td></tr>'}</table>`;
        $('#pr-tab').querySelectorAll('tr.clic').forEach(tr => tr.onclick = () => detalle(+tr.dataset.i));
        const mejor = f.find(x => x.r2 > 0.5); if (mejor) detalle(mejor.i);
      };
      $('#pr-m').onchange = e => { cfg.metrica = e.target.value; calcular(); };
      $('#pr-u').onchange = e => { cfg.umbral = +e.target.value; calcular(); };
      $('#pr-d').oninput = e => { cfg.dias = +e.target.value; $('#pr-dv').textContent = cfg.dias; calcular(); };
      calcular();
    },
  });
})();
