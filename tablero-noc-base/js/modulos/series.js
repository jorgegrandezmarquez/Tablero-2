/* MÓDULO · Series de tiempo de un sitio, comparación con sus pares, perfil por hora y capas (anomalías, etc.). */
(function () {
  'use strict';
  const NOC = window.NOC, G = NOC.G, PD = NOC.muestrasPorDia;

  NOC.registrarModulo({
    id: 'series', titulo: 'Series', grupo: 'Ver', orden: 3,
    render(cont) {
      const e = NOC.estado, idxF = NOC.sitiosFiltrados();
      if (!e.sitio || NOC.idxSitio[e.sitio] === undefined) e.sitio = NOC.sitios[idxF[0] !== undefined ? idxF[0] : 0].id;
      const lista = idxF.map(i => NOC.sitios[i].id); if (!lista.includes(e.sitio)) lista.unshift(e.sitio);
      cont.innerHTML = `
        <div class="titulo-modulo"><h2>Series de tiempo</h2><p>Mire un sitio a lo largo del mes. Compárelo con sus pares (misma tecnología) y vea a qué hora ocurre cada cosa.</p></div>
        <div class="controles">
          <label>Sitio<select id="sr-s">${lista.map(s => `<option ${s === e.sitio ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          <label>Métrica<select id="sr-m">${NOC.metricas.map(m => `<option value="${m}" ${m === e.metrica ? 'selected' : ''}>${NOC.etiquetas[m]}</option>`).join('')}</select></label>
          <label style="flex-direction:row;align-items:center;gap:6px;text-transform:none"><input type="checkbox" id="sr-p"> Comparar con sus pares</label>
          <span id="sr-capas" style="display:flex;gap:10px;flex-wrap:wrap"></span>
        </div>
        <div id="sr-info" class="nota"></div>
        <div class="card" style="margin-bottom:12px"><h3 id="sr-t1"></h3><div id="sr-g1"></div></div>
        <div class="fila">
          <div class="card"><h3>Perfil por hora del día <small>(promedio del periodo)</small></h3><div id="sr-g2"></div></div>
          <div class="card"><h3>Alarmas y tickets de este sitio</h3><div id="sr-tab" class="tabla-scroll" style="max-height:240px"></div></div>
        </div>`;
      const $ = s => cont.querySelector(s);
      const dibujar = () => {
        const i = NOC.idxSitio[$('#sr-s').value], m = $('#sr-m').value, s = NOC.sitios[i], [a, b] = NOC.rango();
        NOC.estado.sitio = s.id; NOC.estado.metrica = m;
        const ser = NOC.serie(m, i), y = ser.subarray(a, b);
        const series = [{ nombre: s.id, y, color: '#FF5A36' }];
        let pares = null;
        if ($('#sr-p').checked) {
          const idxP = NOC.sitios.map((x, k) => k).filter(k => k !== i && NOC.sitios[k].tecnologia === s.tecnologia);
          pares = NOC.agregarSerie(m, idxP, a, b, 1); series.push({ nombre: 'Promedio de pares (' + s.tecnologia + ')', y: pares, color: '#6C8CFF' });
        }
        const bandas = [];
        $('#sr-capas').querySelectorAll('input:checked').forEach(chk => {
          const capa = NOC.capas.find(c => c.id === chk.dataset.id); if (capa) capa.calcular(i, m).forEach(ev => { if (ev.fin > a && ev.ini < b) bandas.push(ev); });
        });
        $('#sr-t1').textContent = `${s.id} · ${s.region} · ${s.tecnologia} · agregador ${s.agr} — ${NOC.etiquetas[m]}`;
        const umb = NOC.umbrales[m];
        G.lineas($('#sr-g1'), { series, x0: a, paso: 1, alto: 260, bandas, lineas: umb ? [{ y: umb[0], texto: 'alerta', color: '#F5B942' }, { y: umb[1], texto: 'crítico', color: '#FF5A5F' }] : [], fmt: v => NOC.num(v, m === 'perdida_pct' ? 2 : 1) });
        const med = NOC.est.media(y), mx = NOC.est.max(y), mn = NOC.est.min(y);
        $('#sr-info').innerHTML = `Periodo: media <b>${NOC.num(med, 2)}</b> · máximo <b>${NOC.num(mx, 2)}</b> · mínimo <b>${NOC.num(mn, 2)}</b>` + (bandas.length ? ` · ${bandas.length} marcas de capas` : '');
        // perfil por hora: laborable vs fin de semana
        const lab = Array(24).fill(0), labN = Array(24).fill(0), fin = Array(24).fill(0), finN = Array(24).fill(0);
        for (let t = a; t < b; t++) { const v = ser[t]; if (v !== v) continue; const h = Math.floor(NOC.slotDe(t) / 4); if (NOC.esFinDeSemana(t)) { fin[h] += v; finN[h]++; } else { lab[h] += v; labN[h]++; } }
        const pl = lab.map((v, h) => labN[h] ? v / labN[h] : NaN), pf = fin.map((v, h) => finN[h] ? v / finN[h] : NaN), ps = [{ nombre: 'Laborables', y: pl, color: '#FF5A36' }, { nombre: 'Fin de semana', y: pf, color: '#A78BFA' }];
        if (pares) { const pp = Array(24).fill(0), pn = Array(24).fill(0); for (let t = a; t < b; t++) { const v = pares[t - a]; if (v !== v || NOC.esFinDeSemana(t)) continue; const h = Math.floor(NOC.slotDe(t) / 4); pp[h] += v; pn[h]++; } ps.push({ nombre: 'Pares (laborables)', y: pp.map((v, h) => pn[h] ? v / pn[h] : NaN), color: '#6C8CFF' }); }
        G.lineas($('#sr-g2'), { series: ps, x0: 0, paso: 1, alto: 230, fmt: v => NOC.num(v, 1), cadaX: 3, fmtX: h => h + ':00' });
        // alarmas y tickets del sitio
        const al = NOC.alarmasEnRango(a, b).filter(x => x.sitio === s.id), tk = NOC.ticketsEnRango(a, b, t => t.sitio === s.id);
        const porTipo = {}; al.forEach(x => { porTipo[x.tipo] = (porTipo[x.tipo] || 0) + 1; });
        $('#sr-tab').innerHTML = `<table><tr><th>Alarmas (${al.length})</th><th>Cantidad</th></tr>${Object.entries(porTipo).sort((p, q) => q[1] - p[1]).slice(0, 5).map(([k, v]) => `<tr><td>${NOC.esc(k)}</td><td>${v}</td></tr>`).join('') || '<tr><td colspan="2"><small>Sin alarmas</small></td></tr>'}</table>
          <table style="margin-top:8px"><tr><th>Ticket (${tk.length})</th><th>Cat.</th><th>Prio.</th></tr>${tk.slice(0, 6).map(t => `<tr><td>${t.id}<br><small>${NOC.fmtMin(t.creado)}</small></td><td>${NOC.esc(t.categoria)}</td><td>${t.prioridad}</td></tr>`).join('') || '<tr><td colspan="3"><small>Sin tickets</small></td></tr>'}</table>`;
      };
      $('#sr-capas').innerHTML = NOC.capas.map(c => `<label style="flex-direction:row;align-items:center;gap:6px;text-transform:none"><input type="checkbox" data-id="${c.id}" ${c.porDefecto ? 'checked' : ''}> ${NOC.esc(c.nombre)}</label>`).join('');
      cont.querySelectorAll('select,input').forEach(el => el.addEventListener('change', dibujar));
      dibujar();
    },
  });
})();
