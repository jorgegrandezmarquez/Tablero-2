/* GRÁFICOS · SVG y canvas propios, sin librerías ni internet. */
(function () {
  'use strict';
  const NOC = window.NOC; if (!NOC) return;
  const G = NOC.G = {};
  const tt = () => document.getElementById('tt');

  G.mostrarTip = function (html, e) {
    const el = tt(); el.innerHTML = html; el.style.display = 'block';
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 14) + 'px';
    el.style.top = Math.min(window.innerHeight - h - 8, e.clientY + 14) + 'px';
  };
  G.ocultarTip = () => { tt().style.display = 'none'; };

  const fmtNum = (v, d) => (v === v) ? NOC.num(v, d === undefined ? (Math.abs(v) >= 100 ? 0 : 1) : d) : '—';

  // ---------------------------------------------------------------- líneas
  // opts: series[{nombre,y,color}], x0 (muestra donde empieza y[0]), paso (muestras por punto),
  //       alto, bandas[{ini,fin,color,texto}] (en muestras), lineas[{y,color,texto}], reducir:'media'|'max', ymin, ymax, fmt
  G.lineas = function (cont, o) {
    const w = Math.max(360, cont.clientWidth || 800), h = o.alto || 240;
    const ml = 48, mr = 12, mt = 10, mb = 26, pw = w - ml - mr, ph = h - mt - mb;
    const paso = o.paso || 1, x0 = o.x0 || 0;
    const n = Math.max(...o.series.map(s => s.y.length));
    // reducir a ~1 punto por píxel
    const k = Math.max(1, Math.ceil(n / pw));
    const reduc = o.series.map(s => {
      if (k === 1) return Array.from(s.y);
      const out = [];
      for (let i = 0; i < n; i += k) {
        let a = 0, c = 0, m = -Infinity;
        for (let j = i; j < Math.min(n, i + k); j++) { const v = s.y[j]; if (v === v) { a += v; c++; if (v > m) m = v; } }
        out.push(c ? ((o.reducir === 'max') ? m : a / c) : NaN);
      }
      return out;
    });
    const np = reduc[0].length, stride = paso * k;
    let lo = o.ymin, hi = o.ymax;
    if (lo === undefined || hi === undefined) {
      let mn = Infinity, mx = -Infinity;
      reduc.forEach(r => r.forEach(v => { if (v === v) { if (v < mn) mn = v; if (v > mx) mx = v; } }));
      (o.lineas || []).forEach(l => { if (l.y < mn) mn = l.y; if (l.y > mx) mx = l.y; });
      if (!isFinite(mn)) { mn = 0; mx = 1; }
      const pad = (mx - mn) * 0.08 || 1;
      lo = o.ymin !== undefined ? o.ymin : mn - pad; hi = o.ymax !== undefined ? o.ymax : mx + pad;
    }
    const X = i => ml + (np <= 1 ? 0 : i / (np - 1)) * pw;
    const Y = v => mt + (1 - (v - lo) / (hi - lo || 1)) * ph;
    const xs = s => ml + ((s - x0) / (paso * (n - 1 || 1))) * pw;           // muestra -> x
    let g = '';
    // rejilla Y
    for (let i = 0; i <= 4; i++) {
      const v = lo + (hi - lo) * i / 4, y = Y(v);
      g += `<line x1="${ml}" x2="${w - mr}" y1="${y}" y2="${y}" stroke="#37316A" stroke-width="1" opacity=".55"/><text x="${ml - 6}" y="${y + 4}" text-anchor="end" fill="#B9B4D6" font-size="11">${(o.fmt || fmtNum)(v)}</text>`;
    }
    // marcas X (días u horas)
    const total = (n - 1) * paso, dias = total / NOC.muestrasPorDia;
    const maxMarcas = Math.max(2, Math.floor(pw / 100));   // evita que las etiquetas se amontonen
    const cadaSamples = o.cadaX || (dias <= 3 ? NOC.muestrasPorDia / 4 : NOC.muestrasPorDia * Math.ceil(dias / maxMarcas));
    for (let s = Math.ceil(x0 / cadaSamples) * cadaSamples; s <= x0 + total; s += cadaSamples) {
      const x = xs(s); if (x < ml || x > w - mr) continue;
      const lbl = o.fmtX ? o.fmtX(s) : dias <= 3 ? NOC.fmtT(s).slice(0, 11) : NOC.etiquetaDia(Math.floor(s / NOC.muestrasPorDia));
      g += `<line x1="${x}" x2="${x}" y1="${mt}" y2="${mt + ph}" stroke="#37316A" opacity=".35"/><text x="${x}" y="${h - 8}" text-anchor="middle" fill="#8B86B0" font-size="10.5">${lbl}</text>`;
    }
    // bandas
    (o.bandas || []).forEach(b => {
      const xa = Math.max(ml, xs(b.ini)), xb = Math.min(w - mr, xs(b.fin));
      if (xb <= ml || xa >= w - mr) return;
      g += `<rect x="${xa}" y="${mt}" width="${Math.max(2, xb - xa)}" height="${ph}" fill="${b.color || '#FF5A36'}" opacity=".22"><title>${NOC.esc(b.texto || '')}</title></rect>`;
    });
    (o.lineas || []).forEach(l => { g += `<line x1="${ml}" x2="${w - mr}" y1="${Y(l.y)}" y2="${Y(l.y)}" stroke="${l.color || '#F5B942'}" stroke-dasharray="5 4"/><text x="${w - mr - 2}" y="${Y(l.y) - 4}" text-anchor="end" fill="${l.color || '#F5B942'}" font-size="10.5">${NOC.esc(l.texto || '')}</text>`; });
    // series
    reduc.forEach((r, si) => {
      let d = '', pen = false;
      r.forEach((v, i) => { if (v !== v) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; });
      g += `<path d="${d}" fill="none" stroke="${o.series[si].color || '#6C8CFF'}" stroke-width="${o.series[si].ancho || 1.6}" stroke-linejoin="round"/>`;
    });
    cont.innerHTML = `<svg class="grafico" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${g}<line id="gv" y1="${mt}" y2="${mt + ph}" stroke="#FAF8F3" opacity="0"/><rect id="gh" x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="transparent"/></svg>`;
    const svg = cont.firstChild, gv = svg.querySelector('#gv'), gh = svg.querySelector('#gh');
    gh.addEventListener('mousemove', e => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (w / r.width);
      const i = Math.max(0, Math.min(np - 1, Math.round((px - ml) / pw * (np - 1))));
      gv.setAttribute('x1', X(i)); gv.setAttribute('x2', X(i)); gv.setAttribute('opacity', '.5');
      const t = x0 + i * stride;
      let html = `<b>${(paso * k) >= NOC.muestrasPorDia ? NOC.etiquetaDia(Math.floor(t / NOC.muestrasPorDia)) : NOC.fmtT(t)}</b>`;
      o.series.forEach((s, si) => { html += `<br><span style="color:${s.color || '#6C8CFF'}">●</span> ${NOC.esc(s.nombre || '')}: ${(o.fmt || fmtNum)(reduc[si][i])}`; });
      G.mostrarTip(html, e);
    });
    gh.addEventListener('mouseleave', () => { gv.setAttribute('opacity', '0'); G.ocultarTip(); });
  };

  // ---------------------------------------------------------------- barras horizontales
  // items: [{etiqueta, valor, color, sub, alClic}]
  G.barras = function (cont, items, o) {
    o = o || {};
    const mx = Math.max(...items.map(i => i.valor || 0), 1e-9);
    cont.innerHTML = items.map((it, k) => `
      <div class="barra" data-k="${k}" style="display:grid;grid-template-columns:${o.colEt || 130}px 1fr 70px;gap:8px;align-items:center;margin:4px 0;${it.alClic ? 'cursor:pointer' : ''}">
        <div style="font-size:12.5px;color:var(--suave);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${NOC.esc(it.etiqueta)}">${NOC.esc(it.etiqueta)}</div>
        <div style="background:var(--panel2);border-radius:6px;height:14px"><div style="width:${Math.max(2, 100 * (it.valor || 0) / mx)}%;height:14px;border-radius:6px;background:${it.color || 'var(--azul)'}"></div></div>
        <div style="font-size:12.5px;text-align:right">${o.fmt ? o.fmt(it.valor) : fmtNum(it.valor)}</div>
      </div>`).join('');
    cont.querySelectorAll('.barra').forEach(el => { const it = items[+el.dataset.k]; if (it.alClic) el.addEventListener('click', it.alClic); });
  };

  // ---------------------------------------------------------------- mini-línea
  G.spark = function (vals, w, h, color) {
    w = w || 120; h = h || 28;
    const v = Array.from(vals).filter(x => x === x); if (v.length < 2) return '';
    const mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1;
    let d = ''; const arr = Array.from(vals);
    arr.forEach((x, i) => { if (x !== x) return; d += (d ? 'L' : 'M') + (i / (arr.length - 1) * w).toFixed(1) + ' ' + (h - 2 - (x - mn) / r * (h - 4)).toFixed(1); });
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="${color || '#6C8CFF'}" stroke-width="1.6"/></svg>`;
  };

  // ---------------------------------------------------------------- mapa de calor (canvas)
  // filas:[{id,etiqueta}], cols, valor(f,c) -> número|NaN, color(v)->css, tip(f,c)->html, alClic(f,c)
  G.calor = function (cont, o) {
    const w = Math.max(360, cont.clientWidth || 800), rowH = o.filaAlto || 4, labelW = 0, top = 16;
    const cw = (w - labelW) / o.cols, h = top + o.filas.length * rowH;
    cont.innerHTML = `<canvas width="${w}" height="${h}" style="width:100%;height:${h}px;border-radius:8px;display:block"></canvas>`;
    const cv = cont.firstChild, ctx = cv.getContext('2d');
    ctx.fillStyle = '#8B86B0'; ctx.font = '10px sans-serif';
    if (o.etiquetasCol) o.etiquetasCol.forEach(([c, txt]) => ctx.fillText(txt, c * cw, 11));
    o.filas.forEach((f, fi) => { for (let c = 0; c < o.cols; c++) { ctx.fillStyle = o.color(o.valor(fi, c)); ctx.fillRect(c * cw, top + fi * rowH, Math.ceil(cw), rowH - (rowH > 3 ? 1 : 0)); } });
    const pos = e => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * o.cols), Math.floor((e.clientY - r.top) * (h / r.height) - top) / rowH | 0]; };
    cv.addEventListener('mousemove', e => { const [c, f] = pos(e); if (f < 0 || f >= o.filas.length || c < 0 || c >= o.cols) return G.ocultarTip(); G.mostrarTip(o.tip(f, c), e); });
    cv.addEventListener('mouseleave', G.ocultarTip);
    if (o.alClic) cv.addEventListener('click', e => { const [c, f] = pos(e); if (f >= 0 && f < o.filas.length && c >= 0 && c < o.cols) o.alClic(f, c); });
  };

  // ---------------------------------------------------------------- escalas de color
  G.escala = function (v, lo, hi, malo) {     // verde -> amarillo -> rojo (malo=true: valores altos son malos)
    if (v !== v) return '#2a2550';
    let t = (v - lo) / (hi - lo || 1); t = Math.max(0, Math.min(1, t)); if (!malo) t = 1 - t;
    const c = t < .5 ? [61 + (245 - 61) * t * 2, 214 + (185 - 214) * t * 2, 140 + (66 - 140) * t * 2] : [245 + (255 - 245) * (t - .5) * 2, 185 + (90 - 185) * (t - .5) * 2, 66 + (95 - 66) * (t - .5) * 2];
    return `rgb(${c.map(Math.round).join(',')})`;
  };
})();
