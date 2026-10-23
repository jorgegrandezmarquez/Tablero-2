/* MÓDULO · Reportes (Taller 5): reporte de turno, ejecutivo y traspaso de turno.
   Las cifras las calcula el programa. La IA (si hay clave) solo REDACTA el resumen a partir de esas cifras.
   Se puede imprimir/guardar como PDF o descargar como un archivo HTML autónomo. */
(function () {
  'use strict';
  const NOC = window.NOC, IA = NOC.ia, esc = NOC.esc, PD = NOC.muestrasPorDia;
  const TURNOS = { manana: ['Mañana (06:00–14:00)', 6, 14], tarde: ['Tarde (14:00–22:00)', 14, 22], noche: ['Noche (22:00–06:00)', 22, 30], dia: ['Día completo', 0, 24] };
  const est = { dia: 24, turno: 'tarde', tipo: 'turno', notas: '', texto: '', ultimoHtml: '' };
  const run = (n, a) => { const h = NOC.herramientas.find(x => x.name === n); return h ? h.run(a) : null; };

  // ---- 1) cifras del turno (todas las calcula el programa)
  function datosTurno(dia, turno) {
    const [, h0, h1] = TURNOS[turno], a = dia * PD + h0 * 4, b = Math.min(NOC.N, dia * PD + h1 * 4), idx = NOC.sitios.map((s, i) => i);
    const k = NOC.kpis(idx, a, b), m0 = a * NOC.PASO, m1 = b * NOC.PASO;
    const inc = NOC.incidentes ? NOC.incidentes.agrupar(a, b) : null;
    const nuevos = NOC.tickets.filter(t => t.creado >= m0 && t.creado < m1 && !t.id.startsWith('MANT'));
    const abiertos = NOC.tickets.filter(t => t.creado < m1 && (t.resuelto == null || t.resuelto >= m1) && (t.prioridad === 'P1' || t.prioridad === 'P2') && !t.id.startsWith('MANT'));
    const caidos = {}; idx.forEach(i => { const s = NOC.serie('disponibilidad_pct', i); let c = 0; for (let t = a; t < b; t++) if (s[t] < 50) c++; if (c) caidos[NOC.sitios[i].id] = c; });
    return { fecha: NOC.etiquetaDia(dia), turno: TURNOS[turno][0], desde: NOC.fmtT(a), hasta: NOC.fmtT(b - 1), disponibilidad: k.disponibilidad, latencia: k.latencia, perdida: k.perdida, utilizacionPico: k.utilizacionPico, sitiosConCaida: Object.keys(caidos).length,
      alarmas: NOC.alarmasEnRango(a, b).length, incidentes: inc ? inc.relevantes.slice().sort((p, q) => q.n - p.n).slice(0, 5) : [], nIncidentes: inc ? inc.relevantes.length : null,
      ticketsNuevos: nuevos.length, p1p2Nuevos: nuevos.filter(t => t.prioridad === 'P1' || t.prioridad === 'P2').length, pendientes: abiertos.sort((p, q) => q.clientes - p.clientes).slice(0, 8) };
  }
  const aTexto = d => ({ fecha: d.fecha, turno: d.turno, disponibilidad_pct: NOC.r2(d.disponibilidad), latencia_ms: NOC.r2(d.latencia), perdida_pct: NOC.r2(d.perdida), sitios_con_caida: d.sitiosConCaida, alarmas: d.alarmas, incidentes_relevantes: d.nIncidentes,
    mayores_incidentes: d.incidentes.map(i => ({ id: i.id, alarmas: i.n, sitios: i.nSitios, agregador: i.agregador, tickets: i.tickets })), tickets_nuevos: d.ticketsNuevos, pendientes_p1_p2: d.pendientes.map(t => ({ id: t.id, sitio: t.sitio, prioridad: t.prioridad, clientes: t.clientes, categoria: t.categoria })) });

  // ---- 2) redacción: plantilla (sin IA) o IA (con clave)
  function plantillaEjecutiva(d) {
    const g = d.incidentes[0], l = [`Resumen ${d.fecha}, ${d.turno}: disponibilidad ${NOC.num(d.disponibilidad, 2)} % y latencia media ${NOC.num(d.latencia, 1)} ms.`];
    l.push(g ? `Incidente principal: ${g.id}, ${g.n} alarmas en ${g.nSitios} sitio(s), agregador ${g.agregador}${g.tickets.length ? ' (ticket ' + g.tickets.join(', ') + ')' : ''}.` : 'No hubo incidentes relevantes en el turno.');
    l.push(`${d.sitiosConCaida} sitio(s) tuvieron caídas; ${d.ticketsNuevos} tickets nuevos (${d.p1p2Nuevos} de prioridad alta).`);
    l.push(d.pendientes.length ? `Quedan ${d.pendientes.length} tickets P1/P2 abiertos; el mayor afecta a ${d.pendientes[0].clientes} clientes (${d.pendientes[0].id}).` : 'No quedan tickets P1/P2 abiertos.');
    l.push(d.pendientes.length ? 'Decisión solicitada: confirmar prioridad de cuadrillas para los tickets abiertos.' : 'Decisión solicitada: ninguna.');
    return l.join('\n');
  }
  async function redactar(d, tipo) {
    if (!IA.hayClave()) return { texto: plantillaEjecutiva(d), ia: false };
    const sis = tipo === 'gerencia'
      ? 'Redactas el reporte EJECUTIVO de un NOC para gerencia. Máximo 5 líneas, lenguaje simple, sin siglas técnicas. Usa SOLO las cifras del JSON, sin inventar ni redondear distinto. Cierra con UNA decisión que se le pide a gerencia (o "ninguna"). Si falta un dato, dilo.'
      : 'Redactas el resumen TÉCNICO de un reporte de turno de un NOC para quien recibe el turno. Máximo 8 líneas con viñetas, incluye ids de incidentes y tickets. Usa SOLO las cifras del JSON, sin inventar. Marca qué queda pendiente.';
    const r = await IA.llamar({ system: sis, messages: [{ role: 'user', content: 'DATOS DEL TURNO (JSON calculado por el programa):\n' + JSON.stringify(aTexto(d)) }], max_tokens: 600 });
    return { texto: r.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim(), ia: true };
  }

  // ---- 3) documento (HTML autónomo)
  function documento(d, tipo, texto, notas) {
    const kp = (et, v) => `<td style="padding:8px 14px;border:1px solid #ccc"><div style="font-size:11px;color:#555;text-transform:uppercase">${et}</div><div style="font-size:20px;font-weight:600">${v}</div></td>`;
    const inc = d.incidentes.map(i => `<tr><td>${i.id}</td><td>${NOC.fmtMin(i.ini)}</td><td>${i.n}</td><td>${i.nSitios}</td><td>${esc(i.agregador)}</td><td>${esc(i.tickets.join(', ') || '—')}</td></tr>`).join('');
    const pen = d.pendientes.map(t => `<tr><td>${t.id}</td><td>${t.sitio}</td><td>${t.prioridad}</td><td>${t.clientes}</td><td>${esc(t.categoria)}</td><td>☐</td></tr>`).join('');
    const titulo = tipo === 'gerencia' ? 'Reporte ejecutivo' : tipo === 'traspaso' ? 'Traspaso de turno' : 'Reporte de turno';
    const cifras = `Cifras de respaldo (calculadas por el programa): disponibilidad ${NOC.num(d.disponibilidad, 2)} % · latencia ${NOC.num(d.latencia, 1)} ms · pérdida ${NOC.num(d.perdida, 2)} % · ${d.alarmas} alarmas · ${d.nIncidentes == null ? '—' : d.nIncidentes} incidentes relevantes · ${d.ticketsNuevos} tickets nuevos.`;
    return `<div class="rp-doc" style="font-family:'IBM Plex Sans',Arial,sans-serif;color:#111;background:#fff;padding:24px;max-width:860px"><style>.rp-doc h1,.rp-doc h3{color:#111;font-family:inherit}.rp-doc h3{margin:18px 0 6px;font-size:15px}.rp-doc th{background:#eee;color:#222;position:static}.rp-doc td,.rp-doc th{color:#111;border-color:#bbb}</style><h1 style="margin:0;font-size:24px">${titulo} · ${esc(d.fecha)}</h1><div style="color:#555;margin-bottom:14px">${esc(d.turno)} · ${esc(d.desde)} a ${esc(d.hasta)} · datos sintéticos</div>
      ${tipo === 'gerencia' ? `<div style="font-size:16px;line-height:1.5;white-space:pre-wrap;border-left:4px solid #FF5A36;padding:6px 14px;margin:10px 0">${esc(texto)}</div><div style="font-size:12px;color:#555">${cifras}</div>` : `
      <table style="border-collapse:collapse;margin:8px 0"><tr>${kp('Disponibilidad', NOC.num(d.disponibilidad, 2) + ' %')}${kp('Latencia', NOC.num(d.latencia, 1) + ' ms')}${kp('Pérdida', NOC.num(d.perdida, 2) + ' %')}${kp('Alarmas', NOC.entero(d.alarmas))}${kp('Incidentes', d.nIncidentes == null ? '—' : d.nIncidentes)}</tr></table>
      ${texto ? `<h3>Resumen</h3><div style="white-space:pre-wrap;line-height:1.5">${esc(texto)}</div>` : ''}
      <h3>Incidentes relevantes</h3><table style="border-collapse:collapse;width:100%;font-size:13px" border="1" cellpadding="5"><tr><th>ID</th><th>Inicio</th><th>Alarmas</th><th>Sitios</th><th>Agregador</th><th>Tickets</th></tr>${inc || '<tr><td colspan="6">Sin incidentes relevantes.</td></tr>'}</table>
      <h3>Pendientes para el siguiente turno</h3><table style="border-collapse:collapse;width:100%;font-size:13px" border="1" cellpadding="5"><tr><th>Ticket</th><th>Sitio</th><th>Prio.</th><th>Clientes</th><th>Categoría</th><th>Recibido</th></tr>${pen || '<tr><td colspan="6">Nada pendiente.</td></tr>'}</table>
      ${notas ? `<h3>Observaciones del operador</h3><div style="white-space:pre-wrap">${esc(notas)}</div>` : ''}<div style="font-size:12px;color:#555;margin-top:12px">${cifras}</div>`}</div>`;
  }

  NOC.reportes = { datosTurno, documento, redactar };

  NOC.registrarModulo({
    id: 'reportes', titulo: 'Reportes', grupo: 'IA', orden: 7,
    render(cont) {
      cont.innerHTML = `
        <div class="titulo-modulo"><h2>Reportes</h2><p>El mismo turno contado para dos públicos. Las cifras salen del programa; la IA solo redacta y no puede cambiar un número.</p></div>
        <div class="controles no-imprimir">
          <label>Día<select id="rp-d">${Array.from({ length: NOC.meta.dias }, (_, d) => `<option value="${d}" ${d === est.dia ? 'selected' : ''}>${NOC.etiquetaDia(d)}</option>`).join('')}</select></label>
          <label>Turno<select id="rp-t">${Object.entries(TURNOS).map(([k, v]) => `<option value="${k}" ${k === est.turno ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
          <label>Reporte<select id="rp-k"><option value="turno" ${est.tipo === 'turno' ? 'selected' : ''}>De turno (técnico)</option><option value="gerencia" ${est.tipo === 'gerencia' ? 'selected' : ''}>Ejecutivo (gerencia)</option><option value="traspaso" ${est.tipo === 'traspaso' ? 'selected' : ''}>Traspaso de turno</option></select></label>
          <button class="btn" id="rp-gen">${IA.hayClave() ? 'Generar con IA' : 'Generar (plantilla, sin IA)'}</button>
          <button class="btn ghost" id="rp-imp">Imprimir / guardar PDF</button><button class="btn ghost" id="rp-dl">Descargar HTML</button>
        </div>
        <div class="no-imprimir"><label style="font-size:11px;text-transform:uppercase;color:var(--suave)">Observaciones del operador (se agregan al reporte)</label>
          <textarea id="rp-n" style="width:100%;height:60px;background:var(--panel2);border:1px solid var(--linea);border-radius:10px;padding:8px;color:var(--texto)">${esc(est.notas)}</textarea><div id="rp-est" style="color:var(--suave);margin:6px 0"></div></div>
        <div class="card" style="background:#fff;padding:0;overflow:auto"><div id="rp-doc"></div></div>`;
      const $ = s => cont.querySelector(s);
      const pintar = (texto) => { const d = datosTurno(est.dia, est.turno); est.texto = texto === undefined ? est.texto : texto; est.ultimoHtml = documento(d, est.tipo, est.tipo === 'traspaso' ? '' : est.texto, est.notas); $('#rp-doc').innerHTML = est.ultimoHtml; return d; };
      const tomar = () => { est.dia = +$('#rp-d').value; est.turno = $('#rp-t').value; est.tipo = $('#rp-k').value; est.notas = $('#rp-n').value; };
      ['#rp-d', '#rp-t', '#rp-k'].forEach(s => $(s).onchange = () => { tomar(); est.texto = ''; pintar(''); });
      $('#rp-n').oninput = () => { tomar(); pintar(); };
      $('#rp-gen').onclick = async () => {
        tomar(); const b = $('#rp-gen'); b.disabled = true; $('#rp-est').textContent = 'Redactando…';
        try { const d = datosTurno(est.dia, est.turno), antes = IA.uso.costo, r = await redactar(d, est.tipo); pintar(r.texto); $('#rp-est').innerHTML = r.ia ? `Redactado por la IA a partir de las cifras del programa · ≈ USD ${(IA.uso.costo - antes).toFixed(4)}. Revise que cada cifra coincida con las "Cifras de respaldo".` : '<span class="etq alerta">Plantilla (sin IA)</span> Con clave, la IA redacta con más naturalidad.'; }
        catch (e) { $('#rp-est').innerHTML = `<span style="color:var(--mal)">${esc(e.message)}</span>`; }
        b.disabled = false;
      };
      $('#rp-imp').onclick = () => window.print();
      $('#rp-dl').onclick = () => { const blob = new Blob(['<!doctype html><meta charset="utf-8"><title>Reporte NOC</title>' + est.ultimoHtml], { type: 'text/html' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `reporte-noc-${NOC.isoDia(est.dia)}-${est.turno}.html`; a.click(); };
      tomar(); pintar(est.texto);
    },
  });
})();
