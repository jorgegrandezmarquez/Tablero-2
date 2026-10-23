/* MÓDULO · Mis datos (Taller 5): cargar un CSV propio, ver anomalías y preparar el RESUMEN que sí puede ir a una IA.
   Todo se procesa en su navegador: el archivo no sale de su equipo. A la IA solo se le envía el resumen, y solo si usted lo decide. */
(function () {
  'use strict';
  const NOC = window.NOC, G = NOC.G, S = NOC.est, IA = NOC.ia, esc = NOC.esc;
  const SENSIBLE = /(nombre|apellido|dni|cedula|cédula|ruc|telefono|teléfono|celular|msisdn|imsi|imei|correo|email|mail|direccion|dirección|ip_|^ip$|mac|cliente_id|id_cliente|documento|contrase|password|token|clave)/i;
  const est = { d: null, col: null, grupoCol: null, grupoVal: null, umbral: 4, minM: 2, ev: [], resumen: null };

  // ---- lectura de CSV (acepta coma o punto y coma, y comillas simples)
  function parsear(texto) {
    const lineas = texto.replace(/\r/g, '').split('\n').filter(l => l.trim()); if (lineas.length < 3) throw new Error('El archivo tiene muy pocas filas.');
    const sep = (lineas[0].match(/;/g) || []).length > (lineas[0].match(/,/g) || []).length ? ';' : ',';
    const celdas = l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o.map(x => x.trim()); };
    const cab = celdas(lineas[0]), filas = lineas.slice(1, 200001).map(celdas);
    const info = cab.map((nombre, j) => {
      const v = filas.slice(0, 400).map(f => f[j]).filter(x => x !== undefined && x !== '');
      const num = v.filter(x => x !== '' && !isNaN(Number(x.replace(',', '.')))).length / Math.max(1, v.length);
      const fecha = v.filter(x => isNaN(Number(x)) && !isNaN(Date.parse(x.replace(' ', 'T')))).length / Math.max(1, v.length);
      return { nombre, j, numerica: num >= 0.8, fecha: fecha >= 0.9, sensible: SENSIBLE.test(nombre), unicos: new Set(v).size };
    });
    return { cab, filas, info };
  }
  function serieDe(d, col, grupoCol, grupoVal) {
    const tc = d.info.find(c => c.fecha), vc = d.info.find(c => c.nombre === col); if (!tc) throw new Error('No encontré una columna de fecha y hora.');
    const gc = grupoCol ? d.info.find(c => c.nombre === grupoCol) : null, pts = [];
    for (const f of d.filas) { if (gc && f[gc.j] !== grupoVal) continue; const t = Date.parse((f[tc.j] || '').replace(' ', 'T')), v = Number((f[vc.j] || '').replace(',', '.')); if (!isNaN(t)) pts.push([t, f[vc.j] === '' || isNaN(v) ? NaN : v]); }
    pts.sort((a, b) => a[0] - b[0]); return pts;
  }
  // robusto: mediana y MAD, por hora del día si hay varias muestras al día
  function detectar(pts, umbral, minM) {
    const n = pts.length, y = pts.map(p => p[1]); const difs = []; for (let i = 1; i < Math.min(n, 300); i++) difs.push(pts[i][0] - pts[i - 1][0]); const paso = S.mediana(difs) || 3600000;
    const porDia = paso < 20 * 3600000, slots = porDia ? Math.max(1, Math.round(86400000 / paso)) : 1, g = Array.from({ length: slots }, () => []);
    const slot = i => porDia ? Math.floor(((pts[i][0] % 86400000) / 86400000) * slots) : 0;
    for (let i = 0; i < n; i++) if (y[i] === y[i]) g[slot(i)].push(y[i]);
    const med = g.map(a => S.mediana(a)), esc2 = g.map((a, k) => Math.max(1.4826 * S.mad(a, med[k]), Math.abs(med[k]) * 0.02, 1e-6));
    const z = y.map((v, i) => (v - med[slot(i)]) / esc2[slot(i)]), ev = []; let ini = -1, pico = 0, ip = 0;
    for (let i = 0; i <= n; i++) {
      const hit = i < n && Math.abs(z[i]) > umbral;
      if (hit) { if (ini < 0) { ini = i; pico = 0; } if (Math.abs(z[i]) > Math.abs(pico)) { pico = z[i]; ip = i; } }
      else if (ini >= 0) { ev.push({ ini, fin: i, n: i - ini, z: pico, valor: y[ip], esperado: med[slot(ip)], cuando: pts[ip][0] }); ini = -1; }
    }
    return { ev: ev.filter(e => e.n >= minM).sort((a, b) => Math.abs(b.z) - Math.abs(a.z)), ruido: ev.filter(e => e.n < minM).length, paso, porDia, med, slot, y };
  }
  NOC.misdatos = { parsear, serieDe, detectar };

  NOC.registrarModulo({
    id: 'misdatos', titulo: 'Mis datos', grupo: 'Mi área', orden: 11,
    render(cont) {
      cont.innerHTML = `
        <div class="titulo-modulo"><h2>Mis datos</h2><p>Cargue un CSV de su área (con una columna de fecha y hora y al menos una columna numérica). Se procesa en su navegador: el archivo no sale de su equipo.</p></div>
        <div class="nota alerta">Use <b>datos agregados o anonimizados</b>. Las columnas que parecen datos personales o identificadores (nombres, teléfonos, IMSI, IP, correos…) se marcan en rojo y <b>no se incluyen</b> en nada que vaya a la IA.</div>
        <div class="controles"><label>Archivo CSV<input type="file" id="md-f" accept=".csv,text/csv"></label><button class="btn ghost" id="md-ej">Probar con el archivo de ejemplo (7 días)</button></div>
        <div id="md-cuerpo"></div>`;
      const $ = s => cont.querySelector(s);
      const cargar = txt => { try { est.d = parsear(txt); const num = est.d.info.filter(c => c.numerica && !c.fecha && !c.sensible); est.col = num[0] && num[0].nombre; est.grupoCol = null; est.grupoVal = null; pintar(); } catch (e) { $('#md-cuerpo').innerHTML = `<div class="nota mal">${esc(e.message)}</div>`; } };
      $('#md-f').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cargar(String(r.result)); r.readAsText(f); };
      $('#md-ej').onclick = () => { try { const x = new XMLHttpRequest(); x.open('GET', 'datos/ejemplos/metricas_7dias.csv'); x.onload = () => { if (x.status === 200 || x.responseText) cargar(x.responseText); else $('#md-cuerpo').innerHTML = '<div class="nota">Abra el archivo con el botón "Archivo CSV" (está en datos/ejemplos/).</div>'; }; x.onerror = () => { $('#md-cuerpo').innerHTML = '<div class="nota">Su navegador no permite leer archivos locales automáticamente. Use el botón "Archivo CSV" y elija datos/ejemplos/metricas_7dias.csv.</div>'; }; x.send(); } catch (e) { $('#md-cuerpo').innerHTML = '<div class="nota">Use el botón "Archivo CSV".</div>'; } };
      const pintar = () => {
        const d = est.d, num = d.info.filter(c => c.numerica && !c.fecha), cat = d.info.filter(c => !c.numerica && !c.fecha && c.unicos > 1 && c.unicos <= 400 && !c.sensible);
        $('#md-cuerpo').innerHTML = `
          <div class="card" style="margin-bottom:12px"><h3>Columnas encontradas</h3><div>${d.info.map(c => `<span class="etq ${c.sensible ? 'mal' : c.fecha ? 'azul' : c.numerica ? 'ok' : ''}" style="margin:2px" title="${c.sensible ? 'Parece dato personal o identificador: NO se enviará a la IA' : ''}">${esc(c.nombre)} · ${c.fecha ? 'fecha' : c.numerica ? 'número' : 'texto'}${c.sensible ? ' · SENSIBLE' : ''}</span>`).join('')}</div><small>${NOC.entero(d.filas.length)} filas.</small></div>
          <div class="controles"><label>Columna a analizar<select id="md-c">${num.filter(c => !c.sensible).map(c => `<option ${c.nombre === est.col ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
            ${cat.length ? `<label>Filtrar por<select id="md-gc"><option value="">(todo)</option>${cat.map(c => `<option ${c.nombre === est.grupoCol ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label><label>Valor<select id="md-gv"></select></label>` : ''}
            <label>Umbral: <b id="md-uv">${est.umbral}</b><input type="range" id="md-u" min="2" max="12" step="0.5" value="${est.umbral}"></label></div>
          <div id="md-res"></div>`;
        const $$ = s => cont.querySelector(s);
        const llenarValores = () => { const gv = $$('#md-gv'); if (!gv) return; const gc = d.info.find(c => c.nombre === est.grupoCol); gv.innerHTML = gc ? [...new Set(d.filas.map(f => f[gc.j]))].slice(0, 400).map(v => `<option>${esc(v)}</option>`).join('') : ''; if (gc && !est.grupoVal) est.grupoVal = gv.value; if (gc) gv.value = est.grupoVal; };
        llenarValores();
        $$('#md-c').onchange = e => { est.col = e.target.value; analizar(); };
        if ($$('#md-gc')) { $$('#md-gc').onchange = e => { est.grupoCol = e.target.value || null; est.grupoVal = null; llenarValores(); analizar(); }; $$('#md-gv').onchange = e => { est.grupoVal = e.target.value; analizar(); }; }
        $$('#md-u').oninput = e => { est.umbral = +e.target.value; $$('#md-uv').textContent = est.umbral; analizar(); };
        analizar();
      };
      const analizar = () => {
        const out = $('#md-res'); if (!est.col) { out.innerHTML = '<div class="nota mal">No encontré ninguna columna numérica que no sea sensible.</div>'; return; }
        try {
          const pts = serieDe(est.d, est.col, est.grupoCol, est.grupoVal); if (pts.length < 10) throw new Error('Muy pocas filas para analizar (filtre menos).');
          const r = detectar(pts, est.umbral, est.minM); est.ev = r.ev; const vals = pts.map(p => p[1]).filter(v => v === v), ord = S.ordenados(vals);
          const fmtF = t => { const f = new Date(t); return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')} ${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`; };
          est.resumen = { archivo_filas: est.d.filas.length, columna: est.col, filtro: est.grupoCol ? { [est.grupoCol]: est.grupoVal } : null, periodo: [fmtF(pts[0][0]), fmtF(pts[pts.length - 1][0])], muestras: pts.length,
            media: NOC.r2(S.media(vals)), mediana: NOC.r2(S.percentil(ord, .5)), p95: NOC.r2(S.percentil(ord, .95)), max: NOC.r2(ord[ord.length - 1]), min: NOC.r2(ord[0]), anomalias: r.ev.length, ruido: r.ruido,
            mayores_anomalias: r.ev.slice(0, 5).map(e => ({ cuando: fmtF(e.cuando), valor: NOC.r2(e.valor), esperado: NOC.r2(e.esperado), muestras: e.n })), columnas_excluidas_por_sensibles: est.d.info.filter(c => c.sensible).map(c => c.nombre) };
          out.innerHTML = `<div class="kpis"><div class="kpi"><div class="et">Muestras</div><div class="val">${NOC.entero(pts.length)}</div><div class="sub">${est.resumen.periodo.join(' → ')}</div></div><div class="kpi"><div class="et">Media / p95</div><div class="val">${NOC.num(est.resumen.media, 1)}</div><div class="sub">p95 ${NOC.num(est.resumen.p95, 1)} · máx ${NOC.num(est.resumen.max, 1)}</div></div><div class="kpi ${r.ev.length > 20 ? 'alerta' : ''}"><div class="et">Anomalías</div><div class="val">${r.ev.length}</div><div class="sub">${r.ruido} de una sola muestra (ruido)</div></div></div>
            <div class="card" style="margin-bottom:12px"><h3>${esc(est.col)}</h3><div id="md-g"></div></div>
            <div class="fila"><div class="card"><h3>Mayores anomalías</h3><div class="tabla-scroll" style="max-height:240px"><table><tr><th>Cuándo</th><th>Valor</th><th>Esperado</th><th>z</th></tr>${r.ev.slice(0, 30).map(e => `<tr><td>${fmtF(e.cuando)}</td><td>${NOC.num(e.valor, 2)}</td><td>${NOC.num(e.esperado, 2)}</td><td>${NOC.num(e.z, 1)}</td></tr>`).join('') || '<tr><td colspan="4"><small>Ninguna.</small></td></tr>'}</table></div></div>
            <div class="card"><h3>Lo que SÍ podría enviarse a una IA</h3><pre class="bloque" style="max-height:220px">${esc(JSON.stringify(est.resumen, null, 1))}</pre><div class="controles"><button class="btn" id="md-ia">${IA.hayClave() ? 'Pedir interpretación a la IA' : 'Sin clave: no disponible'}</button></div><div id="md-iar"></div></div></div>`;
          G.lineas(out.querySelector('#md-g'), { series: [{ nombre: est.col, y: pts.map(p => p[1]), color: '#FF5A36' }, ...(r.porDia ? [{ nombre: 'Normal esperado', y: pts.map((_, i) => r.med[r.slot(i)]), color: '#6C8CFF', ancho: 1.1 }] : [])], x0: 0, paso: 1, alto: 230, bandas: r.ev.map(e => ({ ini: e.ini, fin: e.fin, color: '#FF5A5F', texto: 'Anomalía' })), fmt: v => NOC.num(v, 1), cadaX: Math.max(1, Math.floor(pts.length / 6)), fmtX: i => fmtF(pts[Math.min(pts.length - 1, Math.round(i))][0]) });
          out.querySelector('#md-ia').onclick = async () => {
            if (!IA.hayClave()) return; const b = out.querySelector('#md-ia'); b.disabled = true; const o = out.querySelector('#md-iar'); o.textContent = 'Consultando…';
            try { const antes = IA.uso.costo, res = await IA.llamar({ system: 'Eres analista de un NOC. Recibes un RESUMEN estadístico de una serie (calculado por un programa). Explica en 5 líneas qué se ve, qué podría explicarlo (como hipótesis, con confianza) y qué revisarías primero. Usa solo las cifras del resumen; si no alcanzan, dilo.', messages: [{ role: 'user', content: JSON.stringify(est.resumen) }], max_tokens: 500 }); o.innerHTML = `<div class="nota">${esc(res.content.filter(x => x.type === 'text').map(x => x.text).join('\n'))}</div><small>≈ USD ${(IA.uso.costo - antes).toFixed(4)}</small>`; }
            catch (e) { o.innerHTML = `<span style="color:var(--mal)">${esc(e.message)}</span>`; } b.disabled = false;
          };
        } catch (e) { out.innerHTML = `<div class="nota mal">${esc(e.message)}</div>`; }
      };
      if (est.d) pintar();
    },
  });
})();
