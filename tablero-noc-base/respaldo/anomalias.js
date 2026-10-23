/* MÓDULO · Anomalías (Taller 2)
   Idea: un valor es anómalo si se aleja de lo NORMAL PARA ESA HORA, medido en "desviaciones robustas" (mediana y MAD, que no se
   dejan arrastrar por los propios picos). Dos formas de definir "lo normal": la propia historia del sitio (estacional) o lo que hacen
   sus pares (misma tecnología) a la misma hora. Mismo razonamiento que un z-score, pero con estadística robusta. */
(function () {
  'use strict';
  const NOC = window.NOC, G = NOC.G, S = NOC.est, PD = NOC.muestrasPorDia, N = NOC.N;
  const PISO = { latencia_ms: 1.0, perdida_pct: 0.04, utilizacion_pct: 1.5, disponibilidad_pct: 0.5, clientes: 15 }; // evita dividir por casi cero
  const cfg = { metrica: 'latencia_ms', base: 'propia', umbral: 4, minMuestras: 2, excluirMant: true };
  const sel = { eventos: [], resumen: null, etiquetas: {}, elegido: null };

  // ---- "lo normal" por sitio
  function lineaBasePropia(serie) {                       // mediana y escala por (hora del día, laborable/fin de semana)
    const g = Array.from({ length: PD * 2 }, () => []);
    for (let t = 0; t < N; t++) { const v = serie[t]; if (v === v) g[NOC.slotDe(t) + (NOC.esFinDeSemana(t) ? PD : 0)].push(v); }
    const med = new Float32Array(PD * 2), esc = new Float32Array(PD * 2);
    g.forEach((arr, k) => { const m = S.mediana(arr); med[k] = m; esc[k] = 1.4826 * S.mad(arr, m); });
    return { med, esc, en: t => NOC.slotDe(t) + (NOC.esFinDeSemana(t) ? PD : 0) };
  }
  const cachePares = {};
  function medianaPares(tec, metrica) {                   // mediana de todos los sitios de esa tecnología, en cada instante
    const key = tec + '|' + metrica; if (cachePares[key]) return cachePares[key];
    const ids = NOC.sitios.map((s, i) => i).filter(i => NOC.sitios[i].tecnologia === tec), ser = ids.map(i => NOC.serie(metrica, i)), out = new Float32Array(N), buf = [];
    for (let t = 0; t < N; t++) { buf.length = 0; for (const s of ser) if (s[t] === s[t]) buf.push(s[t]); buf.sort((a, b) => a - b); out[t] = buf.length ? buf[buf.length >> 1] : NaN; }
    return (cachePares[key] = out);
  }

  // puntajes z (positivo = en la mala dirección) para un sitio
  function puntajes(i, metrica, base) {
    const serie = NOC.serie(metrica, i), dir = NOC.malaDireccion[metrica], z = new Float32Array(N), esp = new Float32Array(N), piso = PISO[metrica];
    if (base === 'pares') {
      const ref = medianaPares(NOC.sitios[i].tecnologia, metrica), r = new Float32Array(N);
      for (let t = 0; t < N; t++) r[t] = serie[t] - ref[t];
      const m = S.mediana(r), esc = Math.max(1.4826 * S.mad(r, m), piso);
      for (let t = 0; t < N; t++) { z[t] = dir * (r[t] - m) / esc; esp[t] = ref[t] + m; }
    } else {
      const lb = lineaBasePropia(serie);
      for (let t = 0; t < N; t++) { const k = lb.en(t); z[t] = dir * (serie[t] - lb.med[k]) / Math.max(lb.esc[k], piso); esp[t] = lb.med[k]; }
    }
    return { z, esp, serie };
  }

  const ventanas = () => NOC.ventanasMantenimiento().map(v => ({ ticket: v.ticket, ini: v.ini / NOC.PASO, fin: v.fin / NOC.PASO, agr: (NOC.tickets.find(t => t.id === v.ticket) || {}).sitio }));
  function eventosDeSitio(i, c, vent) {
    const { z, esp, serie } = puntajes(i, c.metrica, c.base), out = [], agr = NOC.sitios[i].agr;
    let ini = -1, pico = 0, tp = 0, ult = -9;
    const cerrar = fin => {
      const n = fin - ini, v = vent.find(w => ini < w.fin && fin > w.ini && (NOC.sitios[NOC.idxSitio[w.agr]] || {}).agr === agr);
      out.push({ sitio: NOC.sitios[i].id, i, metrica: c.metrica, ini, fin, n, z: pico, valor: serie[tp], esperado: esp[tp], ruido: n < c.minMuestras, mant: v ? v.ticket : null });
    };
    for (let t = 0; t < N; t++) {
      const hit = z[t] > c.umbral;
      if (hit) { if (ini < 0) { ini = t; pico = 0; } ult = t; if (z[t] > pico) { pico = z[t]; tp = t; } }
      else if (ini >= 0 && t - ult > 1) { cerrar(ult + 1); ini = -1; }
    }
    if (ini >= 0) cerrar(ult + 1);
    return out;
  }

  const memo = new Map();   // mismos parámetros -> mismo resultado (el cálculo es costoso)
  function analizar(idxs, c, a, b) {
    const clave = idxs.join(',') + '|' + c.metrica + c.base + c.umbral + c.minMuestras + c.excluirMant + '|' + a + '|' + b;
    if (memo.has(clave)) return memo.get(clave);
    const r = analizarSinMemoria(idxs, c, a, b); if (memo.size > 60) memo.clear(); memo.set(clave, r); return r;
  }
  function analizarSinMemoria(idxs, c, a, b) {
    const vent = ventanas(), todos = [];
    for (const i of idxs) for (const e of eventosDeSitio(i, c, vent)) if (e.fin > a && e.ini < b) todos.push(e);
    const mant = todos.filter(e => e.mant), resto = todos.filter(e => !e.mant || !c.excluirMant);
    const reales = resto.filter(e => !e.ruido), ruido = resto.filter(e => e.ruido);
    reales.sort((p, q) => q.z * Math.sqrt(q.n) - p.z * Math.sqrt(p.n));
    return { eventos: reales, ruido: ruido.length, mantenimiento: mant.length, total: todos.length };
  }
  NOC.anomalias = { cfg, analizar, eventosDeSitio, puntajes };

  // ---- capa sobre las series
  NOC.registrarCapa({ id: 'anomalias', nombre: 'Anomalías', porDefecto: true, calcular(i, m) {
    return eventosDeSitio(i, Object.assign({}, cfg, { metrica: m }), ventanas()).filter(e => !e.ruido && !(e.mant && cfg.excluirMant)).map(e => ({ ini: e.ini, fin: e.fin, color: '#FF5A5F', texto: 'Anomalía z=' + NOC.num(e.z, 1) }));
  } });

  // ---- herramienta para el copiloto
  NOC.registrarHerramienta({
    name: 'listar_anomalias',
    description: 'Anomalías detectadas por el programa (valores fuera de lo normal para esa hora) en un periodo. Devuelve conteos y las más fuertes. Separa ruido (1 muestra) y eventos por mantenimiento.',
    input_schema: { type: 'object', required: ['metrica'], properties: { metrica: { type: 'string', enum: NOC.metricas }, region: { type: 'string', enum: NOC.meta.regiones }, tecnologia: { type: 'string', enum: NOC.meta.tecnologias }, desde: { type: 'string' }, hasta: { type: 'string' }, umbral: { type: 'number', description: 'Desviaciones robustas, por defecto 4.' }, base: { type: 'string', enum: ['propia', 'pares'] }, cuantos: { type: 'integer' } } },
    run(a) {
      const [t0, t1] = NOC.rangoDe(a), c = Object.assign({}, cfg, { metrica: a.metrica, umbral: a.umbral || cfg.umbral, base: a.base || cfg.base });
      const r = analizar(NOC.sitiosDe(a), c, t0, t1);
      return { metrica: a.metrica, umbral: c.umbral, base: c.base, total_candidatas: r.total, persistentes: r.eventos.length, ruido_de_una_muestra: r.ruido, excluidas_por_mantenimiento: r.mantenimiento,
        mas_fuertes: r.eventos.slice(0, Math.min(10, a.cuantos || 5)).map(e => ({ sitio: e.sitio, desde: NOC.fmtT(e.ini), hasta: NOC.fmtT(e.fin - 1), muestras: e.n, valor_pico: NOC.r2(e.valor), esperado: NOC.r2(e.esperado), z: NOC.r2(e.z) })) };
    },
  });

  // ---- pantalla
  NOC.registrarModulo({
    id: 'anomalias', titulo: 'Anomalías', grupo: 'Analizar', orden: 4,
    render(cont) {
      cont.innerHTML = `
        <div class="titulo-modulo"><h2>Anomalías</h2><p>¿Qué se aleja de lo normal <b>para esa hora</b>? Mueva el umbral: más bajo detecta más cosas pero también más ruido; más alto deja pasar fallas reales.</p></div>
        <div class="controles">
          <label>Métrica<select id="an-m">${NOC.metricas.map(m => `<option value="${m}" ${m === cfg.metrica ? 'selected' : ''}>${NOC.etiquetas[m]}</option>`).join('')}</select></label>
          <label>Lo normal es…<select id="an-b"><option value="propia" ${cfg.base === 'propia' ? 'selected' : ''}>la historia del propio sitio</option><option value="pares" ${cfg.base === 'pares' ? 'selected' : ''}>lo que hacen sus pares</option></select></label>
          <label>Umbral: <b id="an-uv">${cfg.umbral}</b> desviaciones<input id="an-u" type="range" min="2" max="12" step="0.5" value="${cfg.umbral}" style="width:170px"></label>
          <label>Duración mínima: <b id="an-nv">${cfg.minMuestras}</b> muestras (${cfg.minMuestras * NOC.PASO} min)<input id="an-n" type="range" min="1" max="8" step="1" value="${cfg.minMuestras}" style="width:150px"></label>
          <label style="flex-direction:row;align-items:center;gap:6px;text-transform:none"><input type="checkbox" id="an-x" ${cfg.excluirMant ? 'checked' : ''}> Ignorar ventanas de mantenimiento</label>
        </div>
        <div class="kpis" id="an-kpis"></div>
        <div class="fila"><div class="card" style="flex:3"><h3>Eventos detectados <small>(más fuertes primero; etiquételos para estimar cuántos son reales)</small></h3><div id="an-tab" class="tabla-scroll"></div></div>
        <div class="card"><h3>Sitios con más eventos</h3><div id="an-top"></div><div class="nota" id="an-prec" style="margin-top:12px"></div></div></div>
        <div class="card" style="margin-top:12px"><h3 id="an-t">Detalle: elija un evento de la lista</h3><div id="an-g"></div></div>`;
      const $ = s => cont.querySelector(s);
      let res = null;
      const marca = e => e.sitio + '|' + e.ini + '|' + e.metrica;
      const pintarTabla = () => {
        const filas = res.eventos.slice(0, 120);
        $('#an-tab').innerHTML = `<table><tr><th>Sitio</th><th>Región</th><th>Cuándo</th><th>Dur.</th><th>Valor / esperado</th><th>z</th><th>Etiqueta</th></tr>${filas.map(e => { const k = marca(e), et = sel.etiquetas[k];
          return `<tr class="clic" data-k="${k}"><td><b>${e.sitio}</b></td><td>${NOC.sitios[e.i].region}</td><td>${NOC.fmtT(e.ini)}</td><td>${NOC.num(e.n * NOC.PASO / 60, 1)} h</td><td>${NOC.num(e.valor, 1)} / ${NOC.num(e.esperado, 1)}</td><td>${NOC.num(e.z, 1)}</td>
          <td style="white-space:nowrap"><button class="btn chico ${et === 'real' ? '' : 'ghost'}" data-e="real">Real</button> <button class="btn chico ${et === 'ruido' ? '' : 'ghost'}" data-e="ruido">Ruido</button> <button class="btn chico ${et === 'mant' ? '' : 'ghost'}" data-e="mant">Mant.</button></td></tr>`; }).join('') || '<tr><td colspan="7"><small>Sin eventos con estos parámetros.</small></td></tr>'}</table>`;
        $('#an-tab').querySelectorAll('tr.clic').forEach(tr => {
          tr.onclick = ev => { if (ev.target.dataset.e) return; detalle(res.eventos.find(e => marca(e) === tr.dataset.k)); };
          tr.querySelectorAll('button').forEach(b => b.onclick = () => { sel.etiquetas[tr.dataset.k] = b.dataset.e; pintarTabla(); precision(); });
        });
      };
      const precision = () => {
        const et = Object.values(sel.etiquetas), r = et.filter(x => x === 'real').length, ru = et.filter(x => x === 'ruido').length;
        $('#an-prec').innerHTML = et.length ? `Etiquetados: ${et.length}. De los que marcó real o ruido, <b>${r + ru ? NOC.num(100 * r / (r + ru), 0) : '—'} %</b> eran reales. Esa es la <b>precisión</b> de este umbral.` : 'Etiquete algunos eventos como Real, Ruido o Mant. y aquí verá la <b>precisión</b> de su umbral.';
      };
      const detalle = e => {
        if (!e) return; sel.elegido = e;
        const a = Math.max(0, e.ini - 3 * PD), b = Math.min(N, e.fin + 3 * PD), { serie, esp } = puntajes(e.i, e.metrica, cfg.base);
        $('#an-t').textContent = `${e.sitio} · ${NOC.etiquetas[e.metrica]} · ${NOC.fmtT(e.ini)}`;
        G.lineas($('#an-g'), { series: [{ nombre: 'Medido', y: serie.subarray(a, b), color: '#FF5A36' }, { nombre: 'Normal esperado', y: esp.subarray(a, b), color: '#6C8CFF', ancho: 1.2 }], x0: a, paso: 1, alto: 240, bandas: [{ ini: e.ini, fin: e.fin, texto: 'Evento', color: '#FF5A5F' }], fmt: v => NOC.num(v, 1) });
      };
      const calcular = () => {
        const [a, b] = NOC.rango(); res = analizar(NOC.sitiosFiltrados(), cfg, a, b); sel.resumen = res;
        const kp = (et, v, sub, cl) => `<div class="kpi ${cl || ''}"><div class="et">${et}</div><div class="val">${v}</div><div class="sub">${sub}</div></div>`;
        $('#an-kpis').innerHTML = kp('Eventos persistentes', NOC.entero(res.eventos.length), 'candidatos a falla real', res.eventos.length > 150 ? 'alerta' : '') + kp('Ruido', NOC.entero(res.ruido), 'picos de menos de ' + cfg.minMuestras + ' muestras') + kp('Por mantenimiento', NOC.entero(res.mantenimiento), cfg.excluirMant ? 'excluidos por ventana aprobada' : 'incluidos en la lista') + kp('Total candidatas', NOC.entero(res.total), 'antes de filtrar');
        const por = {}; res.eventos.forEach(e => { por[e.sitio] = (por[e.sitio] || 0) + e.n; });
        G.barras($('#an-top'), Object.entries(por).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([s, n]) => ({ etiqueta: s, valor: n * NOC.PASO / 60, alClic: () => NOC.fijar({ sitio: s, tab: 'series', metrica: cfg.metrica }) })), { colEt: 60, fmt: v => NOC.num(v, 0) + ' h' });
        pintarTabla(); precision();
      };
      let tmr = null; const pronto = () => { clearTimeout(tmr); tmr = setTimeout(calcular, 120); };
      $('#an-m').onchange = e => { cfg.metrica = e.target.value; sel.etiquetas = {}; calcular(); };
      $('#an-b').onchange = e => { cfg.base = e.target.value; sel.etiquetas = {}; calcular(); };
      $('#an-u').oninput = e => { cfg.umbral = +e.target.value; $('#an-uv').textContent = cfg.umbral; pronto(); };
      $('#an-n').oninput = e => { cfg.minMuestras = +e.target.value; $('#an-nv').textContent = cfg.minMuestras + ' (' + cfg.minMuestras * NOC.PASO + ' min)'; pronto(); };
      $('#an-x').onchange = e => { cfg.excluirMant = e.target.checked; calcular(); };
      calcular();
    },
  });
})();
