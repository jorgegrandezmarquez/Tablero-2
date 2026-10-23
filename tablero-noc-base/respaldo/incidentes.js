/* MÓDULO · Incidentes (Taller 3): de miles de alarmas a pocos incidentes.
   Idea: una alarma suelta no es un problema; un grupo de alarmas cercanas en el tiempo y en la red (mismo sitio o mismo agregador)
   suele ser UNA causa. Es "agrupar por cercanía" (clustering) con dos ejes: tiempo y topología. */
(function () {
  'use strict';
  const NOC = window.NOC, G = NOC.G, PASO = NOC.PASO;
  const cfg = { ventana: 10, ignorarAvisos: false, soloRelevantes: true };
  const agrDe = id => id.startsWith('A-') ? id : (NOC.sitios[NOC.idxSitio[id]] || {}).agr;

  function agrupar(a, b, c) {
    c = Object.assign({}, cfg, c || {});
    let alarmas = NOC.alarmasEnRango(a, b); const total = alarmas.length;
    if (c.ignorarAvisos) alarmas = alarmas.filter(x => x.sev > 0);
    // paso 1: duplicados (mismo sitio y tipo dentro de la ventana cuentan como una sola alarma)
    const ultimo = new Map(); let unicas = 0; const util = [];
    for (const x of alarmas) { const k = x.sitio + '|' + x.tipo, l = ultimo.get(k); ultimo.set(k, x.min); if (l === undefined || x.min - l > c.ventana) { unicas++; } util.push(x); }
    // paso 2: unir por sitio y por agregador (el agregador solo une alarmas mayores o críticas: lo menor suele ser local)
    const padre = []; const raiz = i => { while (padre[i] !== i) { padre[i] = padre[padre[i]]; i = padre[i]; } return i; };
    const llaves = new Map(), inc = [];
    for (const x of util) {
      const ks = ['s:' + x.sitio]; if (x.sev >= 2) ks.push('a:' + agrDe(x.sitio));
      const cand = new Set();
      for (const k of ks) { const l = llaves.get(k); if (l && x.min - l.t <= c.ventana) cand.add(raiz(l.i)); }
      let id;
      if (!cand.size) { id = inc.length; padre.push(id); inc.push({ ini: x.min, fin: x.min, n: 0, sitios: new Set(), tipos: {}, sevMax: 0, tickets: new Set(), agr: {} }); }
      else { const l = [...cand]; id = l[0]; for (let j = 1; j < l.length; j++) padre[l[j]] = id; }
      for (const k of ks) llaves.set(k, { i: id, t: x.min });
      const I = inc[id]; I.n++; I.fin = Math.max(I.fin, x.min); I.ini = Math.min(I.ini, x.min); I.sitios.add(x.sitio); I.tipos[x.tipo] = (I.tipos[x.tipo] || 0) + 1; I.sevMax = Math.max(I.sevMax, x.sev); if (x.ticket) I.tickets.add(x.ticket);
      const g = agrDe(x.sitio); I.agr[g] = (I.agr[g] || 0) + 1; x._inc = id;
    }
    // fusionar los datos de los incidentes unidos
    const fin = new Map();
    inc.forEach((I, i) => { const r = raiz(i); if (!fin.has(r)) { fin.set(r, I); return; } if (r === i) return; const R = fin.get(r); R.ini = Math.min(R.ini, I.ini); R.fin = Math.max(R.fin, I.fin); R.n += I.n; I.sitios.forEach(s => R.sitios.add(s)); I.tickets.forEach(t => R.tickets.add(t)); R.sevMax = Math.max(R.sevMax, I.sevMax); for (const k in I.tipos) R.tipos[k] = (R.tipos[k] || 0) + I.tipos[k]; for (const k in I.agr) R.agr[k] = (R.agr[k] || 0) + I.agr[k]; });
    const lista = [...fin.values()].sort((p, q) => p.ini - q.ini).map((I, k) => {
      const mant = [...I.tickets].some(t => t.startsWith('MANT')), agrTop = Object.entries(I.agr).sort((p, q) => q[1] - p[1])[0];
      const clase = mant ? 'mantenimiento' : (I.n >= 100 || (I.sitios.size >= 5 && I.n >= 20)) ? 'tormenta' : 'normal';
      return { id: 'INC-' + String(k + 1).padStart(4, '0'), ini: I.ini, fin: I.fin, n: I.n, sitios: [...I.sitios], nSitios: I.sitios.size, tipos: I.tipos, sevMax: I.sevMax, tickets: [...I.tickets], agregador: agrTop ? agrTop[0] : '', clase,
        relevante: !mant && (I.n >= 10 || (I.sitios.size >= 3 && I.sevMax >= 2 && I.n >= 5)) };
    });
    const relevantes = lista.filter(i => i.relevante);
    // recurrentes: el mismo sitio con el mismo tipo de incidente muchas veces (suele ser un patrón, no mala suerte)
    const rec = new Map();
    lista.forEach(i => { if (i.nSitios !== 1) return; const tipo = Object.entries(i.tipos).sort((p, q) => q[1] - p[1])[0][0], k = i.sitios[0] + '|' + tipo; const r = rec.get(k) || { sitio: i.sitios[0], tipo, veces: 0, horas: [] }; r.veces++; r.horas.push(new Date(NOC.fechaMin(i.ini)).getHours()); rec.set(k, r); });
    const recurrentes = [...rec.values()].filter(r => r.veces >= 8 && r.tipo !== 'Alarma despejada').map(r => { const h = r.horas.slice().sort((p, q) => p - q)[r.horas.length >> 1]; return { sitio: r.sitio, tipo: r.tipo, veces: r.veces, hora_tipica: h + ':00' }; }).sort((p, q) => q.veces - p.veces);
    return { totalAlarmas: total, consideradas: alarmas.length, unicas, incidentes: lista, relevantes, recurrentes, alarmas: util };
  }
  NOC.incidentes = { agrupar, cfg };

  NOC.registrarHerramienta({
    name: 'listar_incidentes',
    description: 'Agrupa las alarmas de un periodo en incidentes (por cercanía en el tiempo y la red). Devuelve el embudo (alarmas → incidentes → relevantes), los mayores incidentes y los sitios con incidentes recurrentes.',
    input_schema: { type: 'object', properties: { desde: { type: 'string' }, hasta: { type: 'string' }, cuantos: { type: 'integer' }, ventana_min: { type: 'integer', description: 'Por defecto 10 minutos.' } } },
    run(a) {
      const [t0, t1] = NOC.rangoDe(a), r = agrupar(t0, t1, { ventana: a.ventana_min || cfg.ventana }), top = r.relevantes.slice().sort((p, q) => q.n - p.n).slice(0, Math.min(8, a.cuantos || 3));
      return { alarmas: r.totalAlarmas, alarmas_unicas: r.unicas, incidentes: top.length ? undefined : r.incidentes.length, total_incidentes: r.incidentes.length, relevantes: r.relevantes.length,
        incidentes_mayores: top.map(i => ({ id: i.id, desde: NOC.fmtMin(i.ini), hasta: NOC.fmtMin(i.fin), alarmas: i.n, sitios: i.nSitios, agregador: i.agregador, severidad_max: NOC.meta.severidades[i.sevMax], clase: i.clase, tickets: i.tickets })),
        recurrentes: r.recurrentes.slice(0, 6) };
    },
  });

  NOC.registrarModulo({
    id: 'incidentes', titulo: 'Incidentes', grupo: 'Analizar', orden: 5,
    render(cont) {
      cont.innerHTML = `
        <div class="titulo-modulo"><h2>De alarmas a incidentes</h2><p>Miles de alarmas cansan al operador. Aquí se agrupan las que ocurren cerca en el tiempo y en la red: una causa, un incidente.</p></div>
        <div class="controles">
          <label>Ventana de agrupación: <b id="in-vv">${cfg.ventana}</b> min<input id="in-v" type="range" min="1" max="60" value="${cfg.ventana}" style="width:200px"></label>
          <label style="flex-direction:row;align-items:center;gap:6px;text-transform:none"><input type="checkbox" id="in-a" ${cfg.ignorarAvisos ? 'checked' : ''}> Ignorar alarmas de aviso</label>
          <label style="flex-direction:row;align-items:center;gap:6px;text-transform:none"><input type="checkbox" id="in-r" ${cfg.soloRelevantes ? 'checked' : ''}> Mostrar solo relevantes</label>
        </div>
        <div class="card" style="margin-bottom:12px"><h3>El embudo</h3><div id="in-emb"></div></div>
        <div class="fila"><div class="card" style="flex:3"><h3>Incidentes <small>(los mayores primero; clic para ver el detalle)</small></h3><div id="in-tab" class="tabla-scroll"></div></div>
        <div class="card"><h3>Incidentes que se repiten</h3><small>Mismo sitio, mismo tipo, 8 veces o más: parece un patrón, no mala suerte.</small><div id="in-rec" style="margin-top:8px"></div></div></div>
        <div class="card" style="margin-top:12px"><h3 id="in-t">Detalle: elija un incidente</h3><div id="in-d"></div></div>`;
      const $ = s => cont.querySelector(s); let r = null;
      const clase = c => c === 'tormenta' ? '<span class="etq mal">tormenta</span>' : c === 'mantenimiento' ? '<span class="etq azul">mantenimiento</span>' : '<span class="etq">normal</span>';
      const detalle = I => {
        $('#in-t').textContent = `${I.id} · ${NOC.fmtMin(I.ini)} a ${NOC.fmtMin(I.fin)} · ${I.n} alarmas · ${I.nSitios} sitio(s)`;
        const bins = Math.max(6, Math.min(60, Math.ceil((I.fin - I.ini) / 5) + 6)), y = new Float32Array(bins), m0 = I.ini - 15;
        r.alarmas.filter(x => x._inc !== undefined && x.min >= m0 && x.min <= I.fin + 15 && I.sitios.includes(x.sitio)).forEach(x => { const j = Math.min(bins - 1, Math.max(0, Math.floor((x.min - m0) / 5))); y[j]++; });
        const tipos = Object.entries(I.tipos).sort((p, q) => q[1] - p[1]);
        $('#in-d').innerHTML = `<div class="fila"><div><b>Alarmas cada 5 min</b><div id="in-g"></div></div><div><b>Tipos de alarma</b><div id="in-b"></div></div></div>
          <p><b>Sitios:</b> ${I.sitios.slice(0, 14).map(s => `<span class="etq">${s}</span>`).join(' ')}${I.sitios.length > 14 ? ' …' : ''}</p>
          <p><b>Agregador probable:</b> ${I.agregador || '—'} · <b>Severidad máxima:</b> ${NOC.meta.severidades[I.sevMax]} · <b>Tickets:</b> ${I.tickets.join(', ') || '—'}</p>`;
        G.lineas($('#in-g'), { series: [{ nombre: 'Alarmas', y, color: '#FF5A36' }], x0: 0, paso: 1, alto: 150, fmt: v => NOC.num(v, 0), cadaX: Math.max(1, Math.floor(bins / 6)), fmtX: j => NOC.fmtMin(m0 + j * 5).slice(6) });
        G.barras($('#in-b'), tipos.map(([k, v]) => ({ etiqueta: k, valor: v })), { colEt: 170, fmt: v => NOC.num(v, 0) });
      };
      const pintar = () => {
        const lista = (cfg.soloRelevantes ? r.relevantes : r.incidentes).slice().sort((p, q) => q.n - p.n).slice(0, 60);
        $('#in-tab').innerHTML = `<table><tr><th>Incidente</th><th>Cuándo</th><th>Alarmas</th><th>Sitios</th><th>Agregador</th><th>Severidad</th><th>Tipo</th></tr>${lista.map(i => `<tr class="clic" data-id="${i.id}"><td><b>${i.id}</b></td><td>${NOC.fmtMin(i.ini)}</td><td>${i.n}</td><td>${i.nSitios}</td><td>${i.agregador}</td><td>${NOC.meta.severidades[i.sevMax]}</td><td>${clase(i.clase)}</td></tr>`).join('') || '<tr><td colspan="7"><small>Sin incidentes.</small></td></tr>'}</table>`;
        $('#in-tab').querySelectorAll('tr.clic').forEach(tr => tr.onclick = () => detalle(r.incidentes.find(i => i.id === tr.dataset.id)));
      };
      const calcular = () => {
        const [a, b] = NOC.rango(); r = agrupar(a, b);
        const mx = r.totalAlarmas || 1, paso = (et, v, col) => ({ etiqueta: et, valor: v, color: col });
        G.barras($('#in-emb'), [paso('Alarmas recibidas', r.totalAlarmas, '#8B86B0'), paso('Alarmas únicas', r.unicas, '#6C8CFF'), paso('Incidentes', r.incidentes.length, '#F5B942'), paso('Relevantes', r.relevantes.length, '#FF5A36')], { colEt: 150, fmt: v => NOC.entero(v) });
        const big = r.relevantes.slice().sort((p, q) => q.n - p.n)[0];
        $('#in-emb').insertAdjacentHTML('beforeend', `<div class="nota">De <b>${NOC.entero(r.totalAlarmas)}</b> alarmas salen <b>${NOC.entero(r.relevantes.length)}</b> incidentes relevantes.${big ? ` El mayor (<b>${big.id}</b>) concentra <b>${NOC.entero(big.n)}</b> alarmas de ${big.nSitios} sitios: ${NOC.num(100 * big.n / mx, 1)} % de todo lo recibido.` : ''}</div>`);
        $('#in-rec').innerHTML = r.recurrentes.length ? `<table><tr><th>Sitio</th><th>Tipo</th><th>Veces</th><th>Hora</th></tr>${r.recurrentes.slice(0, 10).map(x => `<tr class="clic" data-s="${x.sitio}"><td><b>${x.sitio}</b></td><td>${NOC.esc(x.tipo)}</td><td>${x.veces}</td><td>${x.hora_tipica}</td></tr>`).join('')}</table>` : '<small>Ninguno.</small>';
        $('#in-rec').querySelectorAll('tr.clic').forEach(tr => tr.onclick = () => NOC.fijar({ sitio: tr.dataset.s, tab: 'series' }));
        pintar();
      };
      let tmr = null; const pronto = () => { clearTimeout(tmr); tmr = setTimeout(calcular, 120); };
      $('#in-v').oninput = e => { cfg.ventana = +e.target.value; $('#in-vv').textContent = cfg.ventana; pronto(); };
      $('#in-a').onchange = e => { cfg.ignorarAvisos = e.target.checked; calcular(); };
      $('#in-r').onchange = e => { cfg.soloRelevantes = e.target.checked; pintar(); };
      calcular();
    },
  });
})();
