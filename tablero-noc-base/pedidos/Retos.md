# Retos extra (para los grupos que terminen antes)

Cada reto ya existe terminado en `respaldo/retos/`. Primero **intenten pedirlo ustedes**; si quieren comparar, copien el archivo a `js/modulos/`.

## Reto A · Pronóstico de capacidad (`pronostico.js`)
```
Lee CLAUDE.md. Crea la pestaña "Pronóstico": para cada sitio, ajusta una recta (NOC.est.regresion) al máximo diario de los
últimos 14 días de una métrica y calcula en cuántos días llegaría a un umbral (por defecto 90 % de utilización).
Muestra una tabla ordenada por días, el R² de cada ajuste (avisa si es bajo) y un gráfico con la recta proyectada.
```
**Para pensar:** el sitio S-131 llega al 90 % en unos 10 días. ¿Qué pasa si el crecimiento no es lineal (por ejemplo, un evento deportivo)?

## Reto B · ¿Qué atiendo primero? (`prioridad.js`)
```
Crea la pestaña "Prioridad": tickets abiertos en un momento dado (elegir día y hora), ordenados por un puntaje =
clientes afectados × peso de prioridad × (1 + avance del SLA, con tope 3). Cada fila debe EXPLICAR por qué está arriba.
```
**Para pensar:** ¿quién decide los pesos? ¿Un puntaje que no se puede explicar es defendible ante un cliente?

## Reto C · Perfiles de sitios (`perfiles.js`)
```
Crea la pestaña "Perfiles": agrupa los sitios con k-medias (k ajustable de 2 a 6) usando latencia media, variabilidad,
pérdida, utilización media, utilización pico y porcentaje de tiempo caído. Muestra un gráfico de dispersión y los 10 sitios
más lejos de su grupo, con qué característica los hace distintos.
```
**Para pensar:** un sitio "raro" ¿es una falla, una configuración distinta o simplemente otro tipo de sitio?

## Reto D · Rompan el copiloto
Escriban tickets o preguntas que engañen al copiloto: ¿pueden hacerle afirmar algo falso? ¿Que ignore sus reglas? Anoten qué intentaron y qué defensa del **programa** (no de la IA) lo habría detenido.
