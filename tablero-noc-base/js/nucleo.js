/* NÚCLEO · datos, estado, estadística y registro de módulos.
   Los módulos de los talleres usan solo lo que está expuesto en window.NOC. No hace falta tocar este archivo. */
(function () {
  'use strict';
  const D = window.NOC_DATOS;
  if (!D) {
    document.body.innerHTML = '<p style="padding:2rem;color:#fff;font-family:sans-serif">No se encontró <code>datos/datos.js</code>. Revise que la carpeta esté completa.</p>';
    return;
  }
  const meta = D.meta, NS = D.sitios.length, N = meta.muestras, M = meta.metricas.length;
  const PASO = meta.paso_min; // minutos entre muestras

  // ---- decodificar la matriz [métrica][sitio][tiempo] guardada en base64 como enteros de 16 bits
  const bin = atob(D.serie_b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const RAW = new Int16Array(u8.buffer);
  D.serie_b64 = null;

  const NOC = {
    meta, NS, N, M, PASO,
    sitios: D.sitios, agregadores: D.agregadores,
    metricas: meta.metricas,
    etiquetas: { latencia_ms: 'Latencia (ms)', perdida_pct: 'Pérdida de paquetes (%)', utilizacion_pct: 'Utilización (%)', disponibilidad_pct: 'Disponibilidad (%)', clientes: 'Clientes activos' },
    cortas: { latencia_ms: 'Latencia', perdida_pct: 'Pérdida', utilizacion_pct: 'Utilización', disponibilidad_pct: 'Disponibilidad', clientes: 'Clientes' },
    // "mala dirección" de cada métrica: +1 = peor cuando sube, -1 = peor cuando baja
    malaDireccion: { latencia_ms: 1, perdida_pct: 1, utilizacion_pct: 1, disponibilidad_pct: -1, clientes: -1 },
    // umbrales de semáforo [alerta, mal]
    umbrales: { disponibilidad_pct: [99.5, 98], latencia_ms: [60, 100], perdida_pct: [0.5, 1.5], utilizacion_pct: [75, 90] },
    estado: { region: 'Todas', area: 'Todas', tecnologia: 'Todas', dDesde: 0, dHasta: meta.dias - 1, sitio: null, tab: 'resumen', metrica: 'latencia_ms' },
    modulos: [], capas: [],
  };
  window.NOC = NOC;

  const idxSitio = {}; D.sitios.forEach((s, i) => { idxSitio[s.id] = i; });
  NOC.idxSitio = idxSitio;
  NOC.idxM = {}; meta.metricas.forEach((m, k) => { NOC.idxM[m] = k; });
  NOC.agrDe = D.sitios.map(s => s.agr);

  // ---- alarmas y tickets como objetos
  NOC.alarmas = D.alarmas.map(a => ({ id: a[0], min: a[1], sitio: a[2], tipo: meta.tipos_alarma[a[3]], sev: a[4], sevTxt: meta.severidades[a[4]], ticket: a[6] || '' }));
  NOC.tickets = D.tickets.map(t => ({ id: t[0], creado: t[1], resuelto: t[2], sitio: t[3], region: t[4], categoria: t[5], prioridad: t[6], clientes: t[7], comentario: t[8], vIni: t[9], vFin: t[10] }));

  // ---- acceso a la serie
  const cache = {};
  NOC.serie = function (metrica, i) {
    const k = typeof metrica === 'number' ? metrica : NOC.idxM[metrica];
    const key = k * NS + i;
    if (cache[key]) return cache[key];
    const esc = meta.escala[k], out = new Float32Array(N), base = (k * NS + i) * N;
    for (let t = 0; t < N; t++) { const v = RAW[base + t]; out[t] = v === meta.faltante ? NaN : v / esc; }
    return (cache[key] = out);
  };

  // ---- tiempo
  const T0 = new Date(meta.inicio);
  const DIAS_TXT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const p2 = n => String(n).padStart(2, '0');
  NOC.fechaMin = m => new Date(T0.getTime() + m * 60000);
  NOC.fechaT = t => NOC.fechaMin(t * PASO);
  NOC.isoDia = d => { const f = NOC.fechaMin(d * 1440); return `${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())}`; };  // día 0..29 -> AAAA-MM-DD
  NOC.fmtMin = m => { const d = NOC.fechaMin(m); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  NOC.fmtT = t => NOC.fmtMin(t * PASO);
  NOC.etiquetaDia = d => { const f = NOC.fechaMin(d * 1440); return `${DIAS_TXT[f.getDay()]} ${p2(f.getDate())}/${p2(f.getMonth() + 1)}`; };
  NOC.esFinDeSemana = t => { const w = NOC.fechaT(t).getDay(); return w === 0 || w === 6; };
  NOC.slotDe = t => t % (1440 / PASO);
  NOC.diaDe = t => Math.floor(t / (1440 / PASO));
  NOC.muestrasPorDia = 1440 / PASO;

  // ---- estado y filtros
  const oyentes = [];
  NOC.alCambiar = fn => oyentes.push(fn);
  NOC.emitir = () => oyentes.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  NOC.fijar = function (parcial) { Object.assign(NOC.estado, parcial); NOC.emitir(); };
  NOC.rango = () => [NOC.estado.dDesde * NOC.muestrasPorDia, (NOC.estado.dHasta + 1) * NOC.muestrasPorDia];
  NOC.sitiosFiltrados = function () {
    const e = NOC.estado, out = [];
    for (let i = 0; i < NS; i++) {
      const s = NOC.sitios[i];
      if (e.region !== 'Todas' && s.region !== e.region) continue;
      if (e.area !== 'Todas' && s.area !== e.area) continue;
      if (e.tecnologia !== 'Todas' && s.tecnologia !== e.tecnologia) continue;
      out.push(i);
    }
    return out;
  };

  // ---- estadística tolerante a faltantes (NaN)
  const S = NOC.est = {};
  S.media = (a, i0 = 0, i1 = a.length) => { let s = 0, n = 0; for (let i = i0; i < i1; i++) { const v = a[i]; if (v === v) { s += v; n++; } } return n ? s / n : NaN; };
  S.max = (a, i0 = 0, i1 = a.length) => { let m = -Infinity; for (let i = i0; i < i1; i++) { const v = a[i]; if (v === v && v > m) m = v; } return m === -Infinity ? NaN : m; };
  S.min = (a, i0 = 0, i1 = a.length) => { let m = Infinity; for (let i = i0; i < i1; i++) { const v = a[i]; if (v === v && v < m) m = v; } return m === Infinity ? NaN : m; };
  S.ordenados = a => Array.from(a).filter(v => v === v).sort((x, y) => x - y);
  S.percentil = (ord, p) => { if (!ord.length) return NaN; const k = (ord.length - 1) * p, f = Math.floor(k), c = Math.ceil(k); return ord[f] + (ord[c] - ord[f]) * (k - f); };
  S.mediana = a => S.percentil(S.ordenados(a), 0.5);
  S.mad = (a, med) => { const m = med === undefined ? S.mediana(a) : med; return S.mediana(Array.from(a).filter(v => v === v).map(v => Math.abs(v - m))); };
  S.regresion = function (x, y) {      // mínimos cuadrados: y = a + b·x
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < x.length; i++) { if (y[i] !== y[i]) continue; n++; sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i]; }
    if (n < 3) return { n, pendiente: NaN, intercepto: NaN, r2: NaN, sd: NaN };
    const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n;
    let sr = 0, st = 0; const ym = sy / n;
    for (let i = 0; i < x.length; i++) { if (y[i] !== y[i]) continue; const e = y[i] - (a + b * x[i]); sr += e * e; st += (y[i] - ym) ** 2; }
    return { n, pendiente: b, intercepto: a, r2: st ? 1 - sr / st : NaN, sd: Math.sqrt(sr / Math.max(1, n - 2)) };
  };

  // ---- agregaciones de uso común
  // Serie promedio (o máx/mín) de varios sitios, agrupada en cubos de `cubo` muestras.
  NOC.agregarSerie = function (metrica, idxs, a, b, cubo, modo) {
    const nb = Math.ceil((b - a) / cubo), y = new Float32Array(nb), c = new Float32Array(nb);
    modo = modo || 'media';
    if (modo === 'max') y.fill(-Infinity); if (modo === 'min') y.fill(Infinity);
    for (const i of idxs) {
      const s = NOC.serie(metrica, i);
      for (let t = a; t < b; t++) {
        const v = s[t]; if (v !== v) continue;
        const j = ((t - a) / cubo) | 0;
        if (modo === 'media') { y[j] += v; c[j]++; } else if (modo === 'max') { if (v > y[j]) y[j] = v; } else if (v < y[j]) y[j] = v;
      }
    }
    for (let j = 0; j < nb; j++) {
      if (modo === 'media') y[j] = c[j] ? y[j] / c[j] : NaN;
      else if (!isFinite(y[j])) y[j] = NaN;
    }
    return y;
  };

  NOC.kpis = function (idxs, a, b) {
    let disp = 0, nd = 0, lat = 0, nl = 0, loss = 0, nlo = 0, cli = 0, nc = 0, picos = 0, np = 0, caidas = 0;
    for (const i of idxs) {
      const sd = NOC.serie('disponibilidad_pct', i), sl = NOC.serie('latencia_ms', i), sp = NOC.serie('perdida_pct', i), su = NOC.serie('utilizacion_pct', i), sc = NOC.serie('clientes', i);
      for (let t = a; t < b; t++) {
        if (sd[t] === sd[t]) { disp += sd[t]; nd++; if (sd[t] < 50) caidas++; }
        if (sl[t] === sl[t]) { lat += sl[t]; nl++; }
        if (sp[t] === sp[t]) { loss += sp[t]; nlo++; }
        if (sc[t] === sc[t]) { cli += sc[t]; nc++; }
      }
      const mu = S.max(su, a, b); if (mu === mu) { picos += mu; np++; }
    }
    return {
      disponibilidad: nd ? disp / nd : NaN, latencia: nl ? lat / nl : NaN, perdida: nlo ? loss / nlo : NaN,
      utilizacionPico: np ? picos / np : NaN, clientes: nc ? (cli / nc) * idxs.length : NaN, // clientes activos (suma de sitios, promedio en el tiempo)
      muestrasCaidas: caidas, sitios: idxs.length,
    };
  };
  NOC.semaforo = function (metrica, v) {
    const u = NOC.umbrales[metrica]; if (!u || v !== v) return 'ok';
    if (metrica === 'disponibilidad_pct') return v < u[1] ? 'mal' : v < u[0] ? 'alerta' : 'ok';
    return v > u[1] ? 'mal' : v > u[0] ? 'alerta' : 'ok';
  };
  NOC.ticketsEnRango = function (a, b, filtro) {
    const m0 = a * PASO, m1 = b * PASO;
    return NOC.tickets.filter(t => t.creado >= m0 && t.creado < m1 && (!filtro || filtro(t)));
  };
  NOC.mttrHoras = ts => { const r = ts.filter(t => t.resuelto != null && !t.id.startsWith('MANT')).map(t => (t.resuelto - t.creado) / 60); return r.length ? S.media(r) : NaN; };
  NOC.alarmasEnRango = (a, b) => NOC.alarmas.filter(x => x.min >= a * PASO && x.min < b * PASO);
  NOC.ventanasMantenimiento = () => NOC.tickets.filter(t => t.vIni != null).map(t => ({ ticket: t.id, ini: t.vIni, fin: t.vFin }));

  // ---- formato
  NOC.num = (v, d = 1) => (v === v && v !== null && v !== undefined) ? Number(v).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  NOC.entero = v => (v === v) ? Math.round(v).toLocaleString('es-PE') : '—';
  NOC.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  NOC.colorSem = { ok: 'var(--ok)', alerta: 'var(--alerta)', mal: 'var(--mal)' };

  // ---- registro de módulos y capas
  NOC.registrarModulo = function (m) {          // m: {id, titulo, grupo, orden, render(contenedor)}
    const i = NOC.modulos.findIndex(x => x.id === m.id);
    if (i >= 0) NOC.modulos[i] = Object.assign({}, NOC.modulos[i], m, { pendiente: false }); else NOC.modulos.push(m);
  };
  // Una "capa" dibuja marcas sobre las series: {id, nombre, calcular(sitioIdx, metrica) -> [{ini,fin,texto,color}]}
  NOC.registrarCapa = function (c) { const i = NOC.capas.findIndex(x => x.id === c.id); if (i >= 0) NOC.capas[i] = c; else NOC.capas.push(c); };
})();
