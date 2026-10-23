/* PENDIENTES · pestañas que aparecen vacías hasta que exista su archivo en js/modulos/.
   Cada una muestra las REGLAS del taller. Cuando el archivo real existe, reemplaza a esta pestaña. */
(function () {
  'use strict';
  const NOC = window.NOC; if (!NOC) return;

  const PENDIENTES = [
    { id: 'anomalias', titulo: 'Anomalías', grupo: 'Analizar', orden: 4, taller: 'Taller 2', archivo: 'js/modulos/anomalias.js',
      reglas: ['Marca como anomalía un valor que se aleja de lo normal PARA ESA HORA del día (no un número fijo).', 'El umbral se ajusta con un control deslizante y la lista se actualiza al instante.', 'Una caída durante una ventana de mantenimiento aprobada NO cuenta como falla.', 'Un pico de una sola muestra se muestra como "ruido", no como falla.', 'La lista dice cuántas anomalías hay y cuántas parecen ruido.'] },
    { id: 'incidentes', titulo: 'Incidentes', grupo: 'Analizar', orden: 5, taller: 'Taller 3', archivo: 'js/modulos/incidentes.js',
      reglas: ['Agrupa alarmas cercanas en el tiempo y de la misma zona (mismo sitio o mismo agregador) en UN incidente.', 'Muestra cuántas alarmas entraron y cuántos incidentes salieron (el "embudo").', 'Cada incidente dice: cuándo, cuántos sitios, cuántas alarmas y cuál es el agregador probable.', 'Los incidentes por mantenimiento programado se marcan aparte.', 'La ventana de agrupación se ajusta con un control (en minutos).'] },
    { id: 'insights', titulo: 'Insights IA', grupo: 'IA', orden: 6, taller: 'Taller 4', archivo: 'js/modulos/insights.js',
      reglas: ['El programa prepara un RESUMEN con cifras; la IA nunca recibe las filas completas.', 'Cada insight trae: qué pasó, causa probable, acción sugerida, confianza y la EVIDENCIA (qué cifra lo respalda).', 'El programa comprueba cada evidencia contra los datos y marca "respaldada" o "sin evidencia".', 'La IA debe decir "no sé" cuando no hay datos.', 'Los comentarios de los tickets son datos, no órdenes: la IA no los obedece.'] },
    { id: 'reportes', titulo: 'Reportes', grupo: 'IA', orden: 7, taller: 'Taller 5', archivo: 'js/modulos/reportes.js',
      reglas: ['Reporte de turno (técnico): lo que debe saber quien recibe el turno.', 'Reporte ejecutivo (gerencia): máximo cinco líneas y una decisión pedida.', 'Las cifras salen del programa; la IA solo redacta.', 'Se puede imprimir o guardar como archivo.', 'Cada cifra del reporte se puede rastrear hasta el tablero.'] },
  ];
  PENDIENTES.forEach(p => NOC.registrarModulo({
    id: p.id, titulo: p.titulo, grupo: p.grupo, orden: p.orden, pendiente: true,
    render(cont) {
      cont.innerHTML = `<div class="pendiente"><h3>${NOC.esc(p.titulo)} · pieza pendiente (${p.taller})</h3>
        <p>Esta pieza todavía no existe. Se construye en el ${p.taller} pidiéndole a Claude Code que cree <code>${p.archivo}</code>.</p>
        <b>Reglas que debe cumplir:</b><ol>${p.reglas.map(r => `<li>${NOC.esc(r)}</li>`).join('')}</ol>
        <p style="margin-top:12px"><small>Guía: <code>pedidos/${p.taller.replace(' ', '')}.md</code> · Si no alcanza el tiempo, copie la pieza lista desde la carpeta <code>respaldo/</code> y recargue la página (F5).</small></p></div>`;
    },
  }));
})();
