# Taller 2 · Construir el detector de anomalías (25 min, en salas)

**Objetivo:** pedirle a Claude Code la pestaña **Anomalías**, comprobar que cumple las reglas y mover el umbral para ver el equilibrio entre ruido y fallas perdidas.

## PEDIDO 1 · pegar en Claude Code

```
Lee CLAUDE.md. Voy a crear la pestaña "Anomalías" en js/modulos/anomalias.js, siguiendo el contrato de módulos.
Antes de escribir código, dime tu plan en cinco líneas y espera mi aprobación.

Reglas que debe cumplir:
1. Un valor es anómalo si se aleja de lo NORMAL PARA ESA HORA DEL DÍA, no de un número fijo. Lo normal se calcula con la
   mediana de la misma hora en los otros días (separando laborables y fin de semana). La distancia se mide en
   "desviaciones robustas" usando NOC.est.mediana y NOC.est.mad.
2. Solo cuenta si el valor está en la dirección MALA de la métrica (NOC.malaDireccion).
3. El umbral se ajusta con un control deslizante y la lista se actualiza al instante.
4. Una caída durante una ventana de mantenimiento aprobada (NOC.ventanasMantenimiento) y en sitios del mismo agregador NO cuenta como falla: se muestra aparte.
5. Un pico de menos de 2 muestras seguidas se cuenta como "ruido", no como falla.
6. Muestra cuántas anomalías hay, cuántas son ruido y cuántas se excluyeron por mantenimiento.
7. Al hacer clic en un evento, se dibuja la serie con lo medido y lo normal esperado.
8. Registra una herramienta "listar_anomalias" para el copiloto con NOC.registrarHerramienta.
Cuando termines, dime en dos líneas cómo comprobarlo en la pantalla.
```

## LISTO CUANDO (comprueben en la pantalla, recargando con F5)
- Métrica **Disponibilidad**, umbral 4: aparecen **9 sitios** caídos el **16/10 14:15** (el corte de fibra del agregador A-07).
- Con "Ignorar ventanas de mantenimiento" marcado, **6 sitios del 01/10 02:00–04:00** pasan a "Por mantenimiento"; desmarcado, aparecen en la lista.
- Métrica **Latencia**: el número de "Ruido" es mucho mayor que el de "Eventos persistentes".
- Subir el umbral reduce la lista; bajarlo la llena de ruido.

## PREGUNTA PARA PENSAR (la presentan al volver)
Con "lo normal es la historia del propio sitio", el pico diario de 17:00 a 19:30 en el Centro **no** aparece como anomalía. ¿Por qué? ¿Qué cambia si definimos "lo normal" como "lo que hacen sus pares"?

## Si no alcanza el tiempo
Copien `respaldo/anomalias.js` dentro de `js/modulos/` y recarguen (F5). El copiloto aprende solo la herramienta nueva.
