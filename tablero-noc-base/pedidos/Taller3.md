# Taller 3 · De alarmas a incidentes (25 min, en salas)

**Objetivo:** pedirle a Claude Code la pestaña **Incidentes**, que agrupa miles de alarmas en pocos incidentes, y descubrir qué cambia al mover la ventana de agrupación.

## PEDIDO 1 · pegar en Claude Code

```
Lee CLAUDE.md. Voy a crear la pestaña "Incidentes" en js/modulos/incidentes.js, siguiendo el contrato de módulos.
Antes de escribir código, dime tu plan en cinco líneas y espera mi aprobación.

Reglas que debe cumplir:
1. Agrupa alarmas (NOC.alarmasEnRango) que ocurren cerca en el tiempo Y en la misma zona de la red: mismo sitio, o mismo
   agregador (el campo "agr" del sitio). Para unir por agregador usa solo alarmas de severidad mayor o crítica.
2. La ventana de agrupación es un control deslizante en minutos (por defecto 10).
3. Muestra un "embudo": alarmas recibidas -> alarmas únicas (mismo sitio y tipo dentro de la ventana) -> incidentes -> incidentes relevantes.
4. Cada incidente dice: cuándo empezó, cuántas alarmas, cuántos sitios, cuál es el agregador más probable, severidad máxima y tickets asociados.
5. Los incidentes cuyos tickets empiezan con "MANT" se marcan aparte como mantenimiento y no cuentan como relevantes.
6. Un incidente es relevante si tiene 10 alarmas o más, o 3 sitios o más con severidad mayor/crítica y al menos 5 alarmas.
7. Muestra los "incidentes que se repiten": mismo sitio y mismo tipo 8 veces o más (indica la hora típica).
8. Registra una herramienta "listar_incidentes" para el copiloto con NOC.registrarHerramienta.
Cuando termines, dime en dos líneas cómo comprobarlo.
```

## LISTO CUANDO
- El incidente mayor es del **16/10 ~14:08**, con unas **1.100 alarmas en 10 sitios** del agregador **A-07**, marcado "tormenta".
- El embudo muestra que de ~18.800 alarmas salen **pocos incidentes relevantes** (1 a 3 con 10 min).
- Con **5 minutos** salen menos relevantes; con **30 minutos** salen más (y más ruido pegado). Anoten ambos números.
- En "Incidentes que se repiten" aparecen 6 sitios del Centro con "Latencia alta" alrededor de las 17:00–18:00.

## PREGUNTA PARA PENSAR
Una ventana muy corta separa una sola causa en varios incidentes. Una ventana muy larga pega causas distintas. ¿Cuál ventana elegiría su NOC y por qué?

## Prueben con el copiloto
Ahora que existe la herramienta, pregunten: **"¿Qué pasó la tarde del 16 de octubre?"** (el copiloto usará `listar_incidentes` y verán la herramienta en el chat).

## Si no alcanza el tiempo
Copien `respaldo/incidentes.js` dentro de `js/modulos/` y recarguen (F5).
