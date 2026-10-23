/* RETO · ¿Qué atiendo primero? Puntaje de impacto = clientes afectados × peso de prioridad × avance del SLA. Explicable, no una caja negra. */
(function () {
  'use strict';
  const NOC = window.NOC, G = NOC.G;
  const PESO = { P1: 4, P2: 3, P3: 2, P4: 1 }, SLA_H = { P1: 4, P2: 8, P3: 24, P4: 72 };
  const est = { dia: NOC.meta.dias - 1, hora: 18 };

  function abiertosEn(m) {
    return NOC.tickets.filter(t => t.creado <= m && (t.resuelto == null || t.resuelto > m) && !t.id.startsWith('MANT') && (m - t.creado) < 14 * 1440).map(t => {
      const h = (m - t.creado) / 60, avance = h / SLA_H[t.prioridad], p = t.clientes * PESO[t.prioridad] * (1 + Math.min(avance, 3));
      return { t, h, avance, puntaje: p, porque: `${NOC.entero(t.clientes)} clientes · ${t.prioridad} (peso ${PESO[t.prioridad]}) · lleva ${NOC.num(h, 1)} h de ${SLA_H[t.prioridad]} h de SLA (${NOC.num(100 * avance, 0)} %)` };
    }).sort((p, q) => q.puntaje - p.puntaje);
  }
  NOC.prioridad = { abiertosEn };

  NOC.registrarModulo({
    id: 'prioridad', titulo: 'Prioridad', grupo: 'Retos', orden: 9,
    render(cont) {
      cont.innerHTML = `
        <div class="titulo-modulo"><h2>¿Qué atiendo primero?</h2><p>Tickets abiertos en un momento dado, ordenados por impacto. Cada fila explica POR QUÉ está arriba: si no se puede explicar, no se puede defender.</p></div>
        <div class="controles"><label>Día<select id="pd-d">${Array.from({ length: NOC.meta.dias }, (_, d) => `<option value="${d}" ${d === est.dia ? 'selected' : ''}>${NOC.etiquetaDia(d)}</option>`).join('')}</select></label>
        <label>Hora: <b id="pd-hv">${est.hora}:00</b><input id="pd-h" type="range" min="0" max="23" value="${est.hora}"></label></div>
        <div class="card"><h3>Cola de atención</h3><div id="pd-t" class="tabla-scroll" style="max-height:520px"></div></div>
        <div class="nota">Puntaje = clientes × peso de la prioridad × (1 + avance del SLA, con tope 3). Los pesos son una decisión de negocio: cámbielos y vea cómo cambia la cola.</div>`;
      const $ = s => cont.querySelector(s);
      const pintar = () => {
        const m = est.dia * 1440 + est.hora * 60, l = abiertosEn(m);
        $('#pd-t').innerHTML = `<table><tr><th>#</th><th>Ticket</th><th>Sitio</th><th>Región</th><th>Puntaje</th><th>Por qué</th></tr>${l.slice(0, 25).map((x, k) => `<tr><td>${k + 1}</td><td><b>${x.t.id}</b><br><small>${NOC.esc(x.t.categoria)}</small></td><td>${x.t.sitio}</td><td>${x.t.region}</td><td>${NOC.entero(x.puntaje)}</td><td>${NOC.esc(x.porque)}${x.avance > 1 ? ' <span class="etq mal">SLA vencido</span>' : ''}</td></tr>`).join('')}</table>`;
      };
      $('#pd-d').onchange = e => { est.dia = +e.target.value; pintar(); };
      $('#pd-h').oninput = e => { est.hora = +e.target.value; $('#pd-hv').textContent = est.hora + ':00'; pintar(); };
      pintar();
    },
  });
})();
