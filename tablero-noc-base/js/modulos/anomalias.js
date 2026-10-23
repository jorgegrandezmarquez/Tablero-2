/* MÓDULO · Anomalías: valores que se alejan de lo NORMAL PARA ESA HORA del día (no de un número fijo).
   Lo normal = mediana de la misma hora en los otros días (laborables y fin de semana por separado).
   La distancia se mide en "desviaciones robustas": (valor - mediana) / (1,4826 · MAD). */
(function () {
  'use strict';
  const NOC = window.NOC, G = NOC.G, S = NOC.est, PD = NOC.muestrasPorDia, N = NOC.N;

  // Ajustes (también se pueden fijar desde la dirección: index.html#anomalias&anomalias.umbral=6)
  const cfg = { umbral: 4, metrica: 'latencia_ms', minMuestras: 2 };
  // Variación mínima aceptada por métrica: evita dividir por cero cuando la métrica casi no varía (p. ej. disponibilidad = 100 siempre).
  const PISO = { latencia_ms: 1, perdida_pct: 0.05, utilizacion_pct: 1, disponibilidad_pct: 0.5, clientes: 5 };
  const K = 1.4826;   // convierte la MAD en algo comparable a una desviación estándar

  // ---- lo normal y la distancia de cada muestra (se calcula una vez por métrica y sitio, y se guarda)
  const memo = {};
  function base(metrica, i) {
    const key = metrica + ':' + i;
    if (memo[key]) return memo[key];
    const s = NOC.serie(metrica, i), esperado = new Float32Array(N).fill(NaN), z = new Float32Array(N).fill(NaN);
    const piso = PISO[metrica] || 0.01;
    for (let slot = 0; slot < PD; slot++) {
      // muestras de esta hora del día, separadas en laborables y fin de semana
      const grupos = [[], []];
      for (let t = slot; t < N; t += PD) grupos[NOC.esFinDeSemana(t) ? 1 : 0].push(t);
      for (const ts of grupos) {
        const vals = ts.map(t => s[t]);
        // la variación típica de esa hora (MAD) se calcula una vez para el grupo; es robusta, un día raro casi no la mueve
        const escala = Math.max(K * S.mad(vals, S.mediana(vals)), piso);
        const ord = S.ordenados(vals);
        for (const t of ts) {
          // lo normal = mediana de los OTROS días: se quita de la lista ordenada el valor de este día
          let otros = ord;
          if (s[t] === s[t]) { otros = ord.slice(); otros.splice(otros.indexOf(s[t]), 1); }
          const med = S.percentil(otros, 0.5);
          if (med !== med) continue;
          esperado[t] = med;
          if (s[t] === s[t]) z[t] = (s[t] - med) / escala;
        }
      }
    }
    return (memo[key] = { esperado, z });
  }

  // ---- eventos: muestras seguidas que superan el umbral en la dirección MALA de la métrica
  function ventanasConAgregador() {
    return NOC.ventanasMantenimiento().map(v => {
      const tk = NOC.tickets.find(t => t.id === v.ticket), i = tk ? NOC.idxSitio[tk.sitio] : undefined;
      return { ticket: v.ticket, ini: Math.floor(v.ini / NOC.PASO), fin: Math.ceil(v.fin / NOC.PASO), agr: i !== undefined ? NOC.agrDe[i] : null, sitio: tk ? tk.sitio : '' };
    });
  }

  function detectar(metrica, umbral, idxs, a, b) {
    const dir = NOC.malaDireccion[metrica] || 1, ventanas = ventanasConAgregador();
    const out = { fallas: [], ruido: [], mantenimiento: [] };
    for (const i of idxs) {
      const { esperado, z } = base(metrica, i), s = NOC.serie(metrica, i), sitio = NOC.sitios[i];
      let t = a;
      while (t < b) {
        if (!(z[t] * dir >= umbral)) { t++; continue; }
        const ini = t; let pico = t;
        while (t < b && z[t] * dir >= umbral) { if (z[t] * dir > z[pico] * dir) pico = t; t++; }
        const ev = { sitio: sitio.id, i, agr: sitio.agr, metrica, ini, fin: t, muestras: t - ini, pico, valor: s[pico], esperado: esperado[pico], desv: Math.abs(z[pico]) };
        const v = ventanas.find(w => w.agr && w.agr === sitio.agr && ev.ini < w.fin && ev.fin > w.ini);
        if (v) { ev.ticket = v.ticket; out.mantenimiento.push(ev); }
        else if (ev.muestras < cfg.minMuestras) out.ruido.push(ev);
        else out.fallas.push(ev);
      }
    }
    Object.values(out).forEach(l => l.sort((p, q) => q.desv - p.desv));
    return out;
  }

  // ---- la pestaña
  const dec = m => m === 'perdida_pct' ? 2 : 1;
  const fila = (ev, k, lista) => `<tr data-l="${lista}" data-k="${k}" style="cursor:pointer">
      <td>${ev.sitio}<br><small>agr. ${NOC.esc(ev.agr)}</small></td><td>${NOC.fmtT(ev.ini)}<br><small>${ev.muestras * NOC.PASO} min</small></td>
      <td>${NOC.num(ev.valor, dec(ev.metrica))}</td><td>${NOC.num(ev.esperado, dec(ev.metrica))}</td><td><b>${NOC.num(ev.desv, 1)}</b></td>${lista === 'mantenimiento' ? `<td>${ev.ticket}</td>` : ''}</tr>`;
  const tabla = (lista, evs, max) => evs.length ? `<table><tr><th>Sitio</th><th>Inicio / duración</th><th>Medido</th><th>Normal</th><th>Desv.</th>${lista === 'mantenimiento' ? '<th>Ticket</th>' : ''}</tr>
      ${evs.slice(0, max).map((ev, k) => fila(ev, k, lista)).join('')}</table>${evs.length > max ? `<small>Se muestran los ${max} más fuertes de ${evs.length}.</small>` : ''}` : '<small>Ninguno con este umbral.</small>';

  NOC.registrarModulo({
    id: 'anomalias', titulo: 'Anomalías', grupo: 'Analizar', orden: 4,
    render(cont) {
      if (!NOC.metricas.includes(cfg.metrica)) cfg.metrica = 'latencia_ms';
      cont.innerHTML = `
        <div class="titulo-modulo"><h2>Anomalías</h2><p>Valores que se alejan de lo <b>normal para esa hora del día</b> (mediana de la misma hora en los otros días, laborables y fin de semana por separado), solo en la dirección mala de la métrica. Datos sintéticos.</p></div>
        <div class="controles">
          <label>Métrica<select id="an-m">${NOC.metricas.map(m => `<option value="${m}" ${m === cfg.metrica ? 'selected' : ''}>${NOC.etiquetas[m]}</option>`).join('')}</select></label>
          <label>Umbral: <b id="an-uv">${cfg.umbral}</b> desviaciones robustas<input type="range" id="an-u" min="2" max="12" step="0.5" value="${cfg.umbral}"></label>
        </div>
        <div class="kpis" id="an-k"></div>
        <div class="fila">
          <div class="card"><h3>Anomalías (fallas) <small>clic en una fila para ver la serie</small></h3><div id="an-l" class="tabla-scroll" style="max-height:340px"></div></div>
          <div class="card"><h3 id="an-gt">Medido vs. normal esperado</h3><div id="an-g"><small>Elija un evento de la lista.</small></div><div id="an-gi" class="nota" style="display:none"></div></div>
        </div>
        <div class="fila">
          <div class="card"><h3>Ruido <small>picos de menos de ${cfg.minMuestras} muestras seguidas (${cfg.minMuestras * NOC.PASO} min)</small></h3><div id="an-r" class="tabla-scroll" style="max-height:240px"></div></div>
          <div class="card"><h3>Excluidas por mantenimiento <small>dentro de una ventana aprobada y en el mismo agregador</small></h3><div id="an-x" class="tabla-scroll" style="max-height:240px"></div></div>
        </div>`;
      const $ = s => cont.querySelector(s);
      let res = null;

      const verEvento = ev => {
        const a = Math.max(0, ev.ini - PD), b = Math.min(N, ev.fin + PD), { esperado } = base(ev.metrica, ev.i), s = NOC.serie(ev.metrica, ev.i);
        $('#an-gt').textContent = `${ev.sitio} · ${NOC.etiquetas[ev.metrica]} · ${NOC.fmtT(ev.ini)}`;
        G.lineas($('#an-g'), {
          series: [{ nombre: 'Medido', y: s.subarray(a, b), color: '#FF5A36' }, { nombre: 'Normal esperado', y: esperado.subarray(a, b), color: '#6C8CFF' }],
          x0: a, paso: 1, alto: 260, bandas: [{ ini: ev.ini, fin: ev.fin, color: ev.ticket ? '#6C8CFF' : '#FF5A5F', texto: 'Evento' }], fmt: v => NOC.num(v, dec(ev.metrica)),
        });
        $('#an-gi').style.display = '';
        $('#an-gi').innerHTML = `Pico: medido <b>${NOC.num(ev.valor, dec(ev.metrica))}</b>, lo normal a esa hora es <b>${NOC.num(ev.esperado, dec(ev.metrica))}</b> → ${NOC.num(ev.desv, 1)} desviaciones robustas durante ${ev.muestras * NOC.PASO} min.${ev.ticket ? ` Coincide con la ventana de mantenimiento ${ev.ticket}.` : ''}
          <button class="btn ghost chico" id="an-ver">Ver en Series</button>`;
        $('#an-ver').onclick = () => NOC.fijar({ sitio: ev.sitio, metrica: ev.metrica, tab: 'series' });
      };

      const listar = () => {
        const [a, b] = NOC.rango();
        res = detectar(cfg.metrica, cfg.umbral, NOC.sitiosFiltrados(), a, b);
        const kp = (et, val, sub, sem) => `<div class="kpi ${sem}"><div class="et">${et}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`;
        $('#an-k').innerHTML = kp('Anomalías', res.fallas.length, `${new Set(res.fallas.map(e => e.sitio)).size} sitios afectados`, res.fallas.length ? 'mal' : '')
          + kp('Ruido', res.ruido.length, 'picos aislados, no cuentan como falla', res.ruido.length ? 'alerta' : '')
          + kp('Por mantenimiento', res.mantenimiento.length, 'excluidas: ventana aprobada', '');
        $('#an-l').innerHTML = tabla('fallas', res.fallas, 150);
        $('#an-r').innerHTML = tabla('ruido', res.ruido, 80);
        $('#an-x').innerHTML = tabla('mantenimiento', res.mantenimiento, 80);
        cont.querySelectorAll('tr[data-l]').forEach(tr => tr.addEventListener('click', () => verEvento(res[tr.dataset.l][+tr.dataset.k])));
      };

      $('#an-u').addEventListener('input', e => { cfg.umbral = +e.target.value; $('#an-uv').textContent = cfg.umbral; listar(); });
      $('#an-m').addEventListener('change', e => { cfg.metrica = e.target.value; listar(); });
      try { listar(); } catch (err) { $('#an-l').innerHTML = `<div class="nota mal">No se pudieron calcular las anomalías: ${NOC.esc(err.message)}</div>`; }
    },
  });

  // ---- herramienta para el copiloto (las cifras las calcula el programa)
  if (NOC.registrarHerramienta) NOC.registrarHerramienta({
    name: 'listar_anomalias',
    description: 'Anomalías de una métrica: valores que se alejan de lo normal para esa hora del día (mediana de la misma hora en otros días), solo en la dirección mala. Separa fallas, ruido (picos de menos de 2 muestras) y excluidas por mantenimiento aprobado. Devuelve conteos y los eventos más fuertes.',
    input_schema: { type: 'object', properties: {
      metrica: { type: 'string', enum: NOC.metricas, description: 'Por defecto latencia_ms.' },
      umbral: { type: 'number', description: 'Desviaciones robustas mínimas. Por defecto el de la pestaña (4).' },
      region: { type: 'string', enum: NOC.meta.regiones }, tecnologia: { type: 'string', enum: NOC.meta.tecnologias },
      desde: { type: 'string', description: 'Fecha inicial AAAA-MM-DD.' }, hasta: { type: 'string', description: 'Fecha final inclusive AAAA-MM-DD.' },
      cuantos: { type: 'integer', description: 'Eventos a devolver, por defecto 10, máximo 25.' },
    } },
    run(args) {
      const a = args || {}, m = NOC.metricas.includes(a.metrica) ? a.metrica : 'latencia_ms';
      const u = a.umbral > 0 ? +a.umbral : cfg.umbral, n = Math.max(1, Math.min(25, a.cuantos || 10));
      const [t0, t1] = NOC.rangoDe(a), r = detectar(m, u, NOC.sitiosDe(a), t0, t1);
      const corto = ev => ({ sitio: ev.sitio, agregador: ev.agr, inicio: NOC.fmtT(ev.ini), duracion_min: ev.muestras * NOC.PASO, medido: NOC.r2(ev.valor), normal_esperado: NOC.r2(ev.esperado), desviaciones: NOC.r2(ev.desv), ...(ev.ticket ? { ticket_mantenimiento: ev.ticket } : {}) });
      return {
        metrica: m, umbral: u, anomalias: r.fallas.length, ruido: r.ruido.length, excluidas_mantenimiento: r.mantenimiento.length,
        sitios_afectados: new Set(r.fallas.map(e => e.sitio)).size,
        principales: r.fallas.slice(0, n).map(corto), mantenimiento: r.mantenimiento.slice(0, 5).map(corto),
        nota: 'Datos sintéticos. Desviación robusta = (valor − mediana de esa hora) / (1,4826 · MAD).',
      };
    },
  });

  NOC.anomalias = { cfg, detectar, base };
})();
