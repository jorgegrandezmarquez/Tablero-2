/* MÓDULO · Incidentes: de miles de alarmas a pocos incidentes.
   Une alarmas cercanas en el tiempo (ventana en minutos) y de la misma zona: mismo sitio, o mismo agregador
   (esto último solo con alarmas de severidad mayor o crítica). */
(function () {
  'use strict';
  const NOC = window.NOC, G = NOC.G;

  // Ajustes (también desde la dirección: index.html#incidentes&incidentes.ventana=30)
  const cfg = { ventana: 10, tormenta: 100, repeticiones: 8 };
  const MAYOR = 2;   // severidad 2 = mayor, 3 = crítica
  const SEV_ETQ = ['', '', 'alerta', 'mal'];
  const p2 = n => String(n).padStart(2, '0');
  const horaDe = min => { const f = NOC.fechaMin(min); return f.getHours() * 60 + f.getMinutes(); };
  // algunas alarmas las emite el propio agregador (id "A-..."): su zona es él mismo
  const agrDe = id => id.startsWith('A-') ? id : NOC.agrDe[NOC.idxSitio[id]];
  const regionDe = id => { const s = NOC.sitios[NOC.idxSitio[id]] || (NOC.agregadores || []).find(a => a.id === id); return s ? s.region : ''; };

  function analizar(ventana, idxs, a, b) {
    const enFiltro = new Set(idxs.map(i => NOC.sitios[i].id));
    idxs.forEach(i => enFiltro.add(NOC.sitios[i].agr));   // incluye las alarmas de los agregadores de esos sitios
    const alarmas = NOC.alarmasEnRango(a, b).filter(x => enFiltro.has(x.sitio)).sort((p, q) => p.min - q.min);

    // 1) alarmas únicas: mismo sitio y tipo dentro de la ventana cuentan una sola vez
    const ultima = {}, unicas = [];
    for (const x of alarmas) {
      const k = x.sitio + '|' + x.tipo;
      if (ultima[k] === undefined || x.min - ultima[k] > ventana) unicas.push(x);
      ultima[k] = x.min;
    }

    // 2) incidentes: una alarma entra a un incidente abierto si llegó dentro de la ventana y es de la misma zona
    const abiertos = [], todos = [];
    for (const x of alarmas) {
      const agr = agrDe(x.sitio);
      for (let j = abiertos.length - 1; j >= 0; j--) if (x.min - abiertos[j].fin > ventana) abiertos.splice(j, 1);
      let inc = abiertos.find(c => c.sitios.has(x.sitio) || (x.sev >= MAYOR && c.agrsMayores.has(agr)));
      if (!inc) {
        inc = { ini: x.min, fin: x.min, alarmas: 0, sitios: new Set(), sitiosMayores: new Set(), agrsMayores: new Set(), cuentaAgr: {}, sevMax: 0, tickets: new Set(), tipos: {} };
        abiertos.push(inc); todos.push(inc);
      }
      inc.fin = x.min; inc.alarmas++; inc.sitios.add(x.sitio);
      if (x.sev > inc.sevMax) inc.sevMax = x.sev;
      if (x.ticket) inc.tickets.add(x.ticket);
      inc.tipos[x.tipo] = (inc.tipos[x.tipo] || 0) + 1;
      if (x.sev >= MAYOR) { inc.sitiosMayores.add(x.sitio); inc.agrsMayores.add(agr); inc.cuentaAgr[agr] = (inc.cuentaAgr[agr] || 0) + 1; }
    }

    // 3) clasificar: mantenimiento, relevante o menor
    todos.forEach((c, k) => {
      const agrs = Object.entries(c.cuentaAgr).sort((p, q) => q[1] - p[1]);
      c.id = 'INC-' + String(k + 1).padStart(4, '0');
      c.agr = agrs.length ? agrs[0][0] : agrDe([...c.sitios][0]);
      c.tipoPrincipal = Object.entries(c.tipos).sort((p, q) => q[1] - p[1])[0][0];
      c.mant = [...c.tickets].some(t => t.startsWith('MANT'));
      c.relevante = !c.mant && (c.alarmas >= 10 || (c.sitiosMayores.size >= 3 && c.alarmas >= 5));
      c.tormenta = c.alarmas >= cfg.tormenta;
    });
    const orden = (p, q) => q.alarmas - p.alarmas;
    const relevantes = todos.filter(c => c.relevante).sort(orden), mantenimiento = todos.filter(c => c.mant).sort(orden);

    // 4) lo que se repite: incidentes de un solo sitio con el mismo tipo principal muchas veces ("Alarma despejada" no es una falla)
    const rep = {};
    for (const c of todos) {
      if (c.sitios.size !== 1 || c.tipoPrincipal === 'Alarma despejada') continue;
      const sitio = [...c.sitios][0], k = sitio + '|' + c.tipoPrincipal;
      (rep[k] = rep[k] || { sitio, tipo: c.tipoPrincipal, inis: [] }).inis.push(c.ini);
    }
    const repetidos = Object.values(rep).filter(r => r.inis.length >= cfg.repeticiones).map(r => {
      const med = Math.round(NOC.est.mediana(r.inis.map(horaDe))), dias = new Set(r.inis.map(m => Math.floor(m / 1440)));
      return { sitio: r.sitio, region: regionDe(r.sitio), tipo: r.tipo, veces: r.inis.length, dias: dias.size, hora: `${p2(Math.floor(med / 60))}:${p2(med % 60)}` };
    }).sort((p, q) => q.veces - p.veces);

    return { recibidas: alarmas.length, unicas: unicas.length, incidentes: todos.length, relevantes, mantenimiento, repetidos };
  }

  // ---- la pestaña
  const etqSev = s => `<span class="etq ${SEV_ETQ[s]}">${NOC.meta.severidades[s]}</span>`;
  const filaInc = (c, k, lista) => `<tr data-l="${lista}" data-k="${k}" style="cursor:pointer">
      <td>${c.id}${c.tormenta ? ' <span class="etq mal">tormenta</span>' : ''}<br><small>${NOC.fmtMin(c.ini)} · ${Math.max(1, c.fin - c.ini)} min</small></td>
      <td>${NOC.entero(c.alarmas)}</td><td>${c.sitios.size}</td><td>${NOC.esc(c.agr)}</td><td>${etqSev(c.sevMax)}</td>
      <td><small>${[...c.tickets].map(NOC.esc).join(', ') || '—'}</small></td></tr>`;
  const tablaInc = (lista, l, max) => l.length ? `<table><tr><th>Incidente / inicio</th><th>Alarmas</th><th>Sitios</th><th>Agregador probable</th><th>Sev. máx.</th><th>Tickets</th></tr>
      ${l.slice(0, max).map((c, k) => filaInc(c, k, lista)).join('')}</table>${l.length > max ? `<small>Se muestran ${max} de ${l.length}.</small>` : ''}` : '<small>Ninguno con esta ventana.</small>';

  NOC.registrarModulo({
    id: 'incidentes', titulo: 'Incidentes', grupo: 'Analizar', orden: 5,
    render(cont) {
      cont.innerHTML = `
        <div class="titulo-modulo"><h2>Incidentes</h2><p>De miles de alarmas a pocos incidentes: se unen alarmas cercanas en el tiempo y de la misma zona (mismo sitio, o mismo agregador si son mayores o críticas). Datos sintéticos.</p></div>
        <div class="controles">
          <label>Ventana de agrupación: <b id="in-vv">${cfg.ventana}</b> min<input type="range" id="in-v" min="1" max="60" step="1" value="${cfg.ventana}"></label>
        </div>
        <div class="fila">
          <div class="card"><h3>Embudo</h3><div id="in-e"></div><div class="nota" id="in-en"></div></div>
          <div class="card"><h3 id="in-dt">Detalle del incidente</h3><div id="in-d"><small>Haga clic en un incidente de la lista.</small></div></div>
        </div>
        <div class="card" style="margin-bottom:12px"><h3>Incidentes relevantes <small>10+ alarmas, o 3+ sitios con mayor/crítica y 5+ alarmas</small></h3><div id="in-l" class="tabla-scroll" style="max-height:340px"></div></div>
        <div class="fila">
          <div class="card"><h3>Mantenimiento <small>tickets MANT: no cuentan como relevantes</small></h3><div id="in-m" class="tabla-scroll" style="max-height:240px"></div></div>
          <div class="card"><h3>Incidentes que se repiten <small>mismo sitio y tipo, ${cfg.repeticiones}+ veces</small></h3><div id="in-r" class="tabla-scroll" style="max-height:240px"></div></div>
        </div>`;
      const $ = s => cont.querySelector(s);
      let res = null;

      const verIncidente = c => {
        $('#in-dt').textContent = `${c.id} · ${NOC.fmtMin(c.ini)} → ${NOC.fmtMin(c.fin)}`;
        const tipos = Object.entries(c.tipos).sort((p, q) => q[1] - p[1]).slice(0, 6);
        $('#in-d').innerHTML = `<p>${NOC.entero(c.alarmas)} alarmas en ${c.sitios.size} sitios · agregador probable <b>${NOC.esc(c.agr)}</b> · severidad máxima ${etqSev(c.sevMax)}${c.mant ? ' · <span class="etq azul">mantenimiento</span>' : ''}</p>
          <p><small>Sitios: ${[...c.sitios].slice(0, 20).join(', ')}${c.sitios.size > 20 ? '…' : ''}</small></p><div id="in-dg"></div>
          <button class="btn ghost chico" id="in-ver">Ver primer sitio en Series</button>`;
        G.barras($('#in-dg'), tipos.map(([t, n]) => ({ etiqueta: t, valor: n })), { fmt: v => NOC.entero(v), colEt: 170 });
        $('#in-ver').onclick = () => NOC.fijar({ sitio: [...c.sitios][0], tab: 'series', dDesde: NOC.diaDe(Math.floor(c.ini / NOC.PASO)), dHasta: NOC.diaDe(Math.floor(c.ini / NOC.PASO)) });
      };

      const listar = () => {
        const [a, b] = NOC.rango();
        res = analizar(cfg.ventana, NOC.sitiosFiltrados(), a, b);
        G.barras($('#in-e'), [
          { etiqueta: 'Alarmas recibidas', valor: res.recibidas, color: 'var(--tenue)' },
          { etiqueta: 'Alarmas únicas', valor: res.unicas, color: 'var(--azul)' },
          { etiqueta: 'Incidentes', valor: res.incidentes, color: 'var(--alerta)' },
          { etiqueta: 'Incidentes relevantes', valor: res.relevantes.length, color: 'var(--mal)' },
        ], { fmt: v => NOC.entero(v), colEt: 150 });
        $('#in-en').innerHTML = `De <b>${NOC.entero(res.recibidas)}</b> alarmas salen <b>${res.relevantes.length}</b> incidentes relevantes con una ventana de ${cfg.ventana} min. Otros <b>${res.mantenimiento.length}</b> son de mantenimiento.`;
        $('#in-l').innerHTML = tablaInc('relevantes', res.relevantes, 100);
        $('#in-m').innerHTML = tablaInc('mantenimiento', res.mantenimiento, 50);
        $('#in-r').innerHTML = res.repetidos.length ? `<table><tr><th>Sitio</th><th>Tipo</th><th>Veces</th><th>Días</th><th>Hora típica</th></tr>
          ${res.repetidos.slice(0, 60).map(r => `<tr><td>${r.sitio}<br><small>${NOC.esc(r.region)}</small></td><td>${NOC.esc(r.tipo)}</td><td>${r.veces}</td><td>${r.dias}</td><td>${r.hora}</td></tr>`).join('')}</table>` : '<small>Ninguno.</small>';
        cont.querySelectorAll('tr[data-l]').forEach(tr => tr.addEventListener('click', () => verIncidente(res[tr.dataset.l][+tr.dataset.k])));
      };

      $('#in-v').addEventListener('input', e => { cfg.ventana = +e.target.value; $('#in-vv').textContent = cfg.ventana; listar(); });
      try { listar(); } catch (err) { $('#in-l').innerHTML = `<div class="nota mal">No se pudieron calcular los incidentes: ${NOC.esc(err.message)}</div>`; }
    },
  });

  // ---- herramienta para el copiloto (las cifras las calcula el programa)
  if (NOC.registrarHerramienta) NOC.registrarHerramienta({
    name: 'listar_incidentes',
    description: 'Agrupa alarmas en incidentes (cercanas en el tiempo y de la misma zona: mismo sitio, o mismo agregador si son mayores/críticas). Devuelve el embudo (recibidas, únicas, incidentes, relevantes), los incidentes relevantes, los de mantenimiento y los que se repiten.',
    input_schema: { type: 'object', properties: {
      ventana_min: { type: 'integer', description: 'Ventana de agrupación en minutos, por defecto 10.' },
      region: { type: 'string', enum: NOC.meta.regiones }, tecnologia: { type: 'string', enum: NOC.meta.tecnologias },
      desde: { type: 'string', description: 'Fecha inicial AAAA-MM-DD.' }, hasta: { type: 'string', description: 'Fecha final inclusive AAAA-MM-DD.' },
      cuantos: { type: 'integer', description: 'Incidentes a devolver, por defecto 10, máximo 25.' },
    } },
    run(args) {
      const a = args || {}, v = Math.max(1, Math.min(240, Math.round(a.ventana_min || cfg.ventana))), n = Math.max(1, Math.min(25, a.cuantos || 10));
      const [t0, t1] = NOC.rangoDe(a), r = analizar(v, NOC.sitiosDe(a), t0, t1);
      const corto = c => ({ id: c.id, inicio: NOC.fmtMin(c.ini), duracion_min: c.fin - c.ini, alarmas: c.alarmas, sitios: c.sitios.size, agregador_probable: c.agr, severidad_max: NOC.meta.severidades[c.sevMax], tipo_principal: c.tipoPrincipal, tickets: [...c.tickets], tormenta: c.tormenta });
      return {
        ventana_min: v, embudo: { alarmas_recibidas: r.recibidas, alarmas_unicas: r.unicas, incidentes: r.incidentes, incidentes_relevantes: r.relevantes.length },
        relevantes: r.relevantes.slice(0, n).map(corto), mantenimiento: r.mantenimiento.slice(0, 5).map(corto),
        se_repiten: r.repetidos.slice(0, 10),
        nota: 'Datos sintéticos. Relevante = 10+ alarmas, o 3+ sitios con severidad mayor/crítica y 5+ alarmas; los de mantenimiento (tickets MANT) no cuentan.',
      };
    },
  });

  NOC.incidentes = { cfg, analizar };
})();
