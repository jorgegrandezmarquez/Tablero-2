/* COPILOTO · panel de chat al costado. Responde sobre lo que se ve en el tablero usando las herramientas. */
(function () {
  'use strict';
  const NOC = window.NOC; if (!NOC) return;
  const IA = NOC.ia, esc = NOC.esc;
  const C = NOC.copiloto = { historial: [], ocupado: false };

  const md = t => esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  C.montar = function (el) {
    el.innerHTML = `
      <div class="cab">
        <h3>Copiloto del NOC</h3>
        <div class="cfg">
          <input id="cp-clave" type="password" class="ancho" placeholder="Clave de la IA (sk-ant-…)" autocomplete="off">
          <select id="cp-modelo" title="Modelo">${IA.modelos.map(m => `<option ${m === IA.modelo ? 'selected' : ''}>${m}</option>`).join('')}</select>
          <button class="btn chico" id="cp-guardar">Usar clave</button>
          <details class="ancho"><summary style="cursor:pointer;font-size:12px;color:var(--suave)">Avanzado: URL del API</summary>
            <input id="cp-base" value="${esc(IA.base)}" style="margin-top:6px">
            <small>En una empresa real aquí va su servidor intermedio, no la dirección de Anthropic.</small></details>
        </div>
        <div class="estado"><span id="cp-modo"></span><span id="cp-uso"></span></div>
      </div>
      <div id="msgs"></div>
      <div id="chips"></div>
      <div id="entrada"><textarea id="cp-texto" placeholder="Pregúntele a los datos…"></textarea><button class="btn" id="cp-enviar">Enviar</button></div>`;
    el.querySelector('#cp-guardar').onclick = () => { IA.fijarClave(el.querySelector('#cp-clave').value); IA.fijarBase(el.querySelector('#cp-base').value); el.querySelector('#cp-clave').value = ''; C.estado(); C.sis(IA.hayClave() ? 'Clave lista (solo en esta pestaña).' : 'Sin clave: modo demostración.'); };
    el.querySelector('#cp-modelo').onchange = e => IA.fijarModelo(e.target.value);
    el.querySelector('#cp-enviar').onclick = () => C.enviar();
    el.querySelector('#cp-texto').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); C.enviar(); } });
    IA.alUso.push(() => C.estado());
    C.chips(); C.estado();
    IA.detectarServidor().then(ok => { if (ok) { el.querySelector('.cfg').querySelectorAll('#cp-clave,#cp-guardar,details').forEach(x => x.style.display = 'none'); C.estado(); C.sis('Usando la clave del terminal (no hace falta pegarla aquí).'); } });
    C.sis('Soy el copiloto. Respondo con las herramientas del tablero: la IA no calcula, pide la cuenta al programa. ' + (IA.hayClave() ? '' : 'Aún no hay clave: puede probar el modo demostración con las preguntas sugeridas.'));
  };

  C.estado = function () {
    const m = document.getElementById('cp-modo'), u = document.getElementById('cp-uso'); if (!m) return;
    m.innerHTML = IA.hayClave() ? '<span class="etq ok">Con IA' + (IA.viaServidor ? ' · clave del terminal' : '') + '</span>' : '<span class="etq alerta">Demostración (sin IA)</span>';
    u.textContent = IA.uso.llamadas ? `${IA.uso.llamadas} llamadas · ${NOC.entero(IA.uso.entrada + IA.uso.salida)} tokens · ≈ USD ${IA.uso.costo.toFixed(4)}` : '';
  };
  C.chips = function () {
    const c = document.getElementById('chips'); c.innerHTML = '';
    IA.preguntasDemo.forEach(p => { const b = document.createElement('button'); b.textContent = p.texto; b.onclick = () => C.enviar(p.texto, p.id); c.appendChild(b); });
  };
  C.msg = function (cls, html) {
    const box = document.getElementById('msgs'), d = document.createElement('div'); d.className = 'msg ' + cls; d.innerHTML = html; box.appendChild(d); box.scrollTop = box.scrollHeight; return d;
  };
  C.sis = t => C.msg('sis', esc(t));
  C.herramienta = function (cont, n, a, s) {
    const d = document.createElement('details'); d.className = 'herr';
    const j = JSON.stringify(s); d.innerHTML = `<summary>Herramienta: <b>${esc(n)}</b></summary><div>Pedido: ${esc(JSON.stringify(a))}</div><div>Respuesta: ${esc(j.length > 700 ? j.slice(0, 700) + '…' : j)}</div>`;
    cont.appendChild(d); document.getElementById('msgs').scrollTop = 1e9;
  };

  C.enviar = async function (texto, demoId) {
    if (C.ocupado) return;
    const ta = document.getElementById('cp-texto'); texto = (texto || ta.value).trim(); if (!texto) return;
    ta.value = ''; C.msg('user', esc(texto)); C.ocupado = true;
    const caja = C.msg('ia', '<i style="color:var(--suave)">Pensando…</i>'); const herr = document.createElement('div');
    try {
      if (!IA.hayClave()) {
        const p = demoId || (IA.preguntasDemo.find(q => q.texto === texto) || {}).id;
        caja.innerHTML = ''; caja.appendChild(herr);
        const r = IA.demo(p, (n, a, s) => C.herramienta(herr, n, a, s));
        const t = document.createElement('div'); t.innerHTML = md(r); caja.appendChild(t);
      } else {
        C.historial.push({ role: 'user', content: texto + '\n\n(' + IA.contextoVista() + ')' });
        const antes = IA.uso.costo;
        const r = await IA.conversar({ sistema: IA.sistemaCopiloto, mensajes: C.historial, alHerramienta: (n, a, s) => C.herramienta(herr, n, a, s) });
        C.historial = r.mensajes;
        caja.innerHTML = ''; caja.appendChild(herr);
        const t = document.createElement('div'); t.innerHTML = md(r.texto || '(sin texto)'); caja.appendChild(t);
        const c = document.createElement('div'); c.style.cssText = 'font-size:11px;color:var(--tenue);margin-top:4px'; c.textContent = `Esta respuesta: ≈ USD ${(IA.uso.costo - antes).toFixed(4)} · ${r.traza.length} herramienta(s)`; caja.appendChild(c);
      }
    } catch (e) {
      caja.innerHTML = '<span style="color:var(--mal)">' + esc(e.message) + '</span>';
      if (C.historial.length && C.historial[C.historial.length - 1].role === 'user') C.historial.pop();
    }
    C.ocupado = false; C.estado();
  };
})();
