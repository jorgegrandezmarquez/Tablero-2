# Tablero NOC con IA

Un tablero de operaciones de red hecho solo con archivos web. **Datos sintéticos** (inventados) de 150 sitios durante 30 días.

## En su PC (sin instalar nada)

1. Descomprima la carpeta (si la recibió en .zip).
2. Haga doble clic en `index.html`. Se abre en el navegador (Chrome o Edge).
3. Todo funciona sin internet **excepto** el copiloto y los insights con IA, que necesitan la clave y conexión.

## En el Codespace

El tablero se enciende solo. Abra la pestaña **Puertos**, y en el puerto **5500** haga clic en el globo.
Si no está encendido: en la terminal escriba `node servir.mjs`.

## Llevarlo a su PC

En la terminal del Codespace escriba `node empaquetar.mjs`. Se crea `tablero-noc.zip`: clic derecho sobre el archivo → **Descargar**.

## La clave de la IA

**En el Codespace:** en la terminal escriba `export ANTHROPIC_API_KEY=su-clave`, luego `bash iniciar.sh` y recargue (F5). El tablero y Claude Code (`claude`) usan esa misma clave; nunca llega al navegador.

**En su PC (doble clic):** se escribe en el panel de la derecha ("Clave de la IA") y vive solo en esa pestaña del navegador.
Sin clave, el panel funciona en **modo demostración** (el programa responde unas preguntas de ejemplo, sin IA).
Si la red de su empresa bloquea `api.anthropic.com`, el modo demostración le permite seguir trabajando.

## Qué hay en cada pestaña

| Pestaña | Para qué sirve |
|---|---|
| Resumen, Mapa, Series | Ver la red: indicadores, mapa en el tiempo, series por sitio |
| Anomalías | Qué se aleja de lo normal **para esa hora** (estadística robusta) |
| Incidentes | De miles de alarmas a pocos incidentes (agrupar por tiempo y red) |
| Insights IA | La IA interpreta un resumen; el programa verifica cada cifra |
| Reportes | Reporte de turno, ejecutivo y traspaso de turno |
| Pronóstico, Prioridad, Perfiles | Retos extra |

## Cargar sus propios datos

Los archivos de ejemplo están en `datos/ejemplos/` (`metricas_7dias.csv`, `alarmas.csv`, `tickets.csv`, `sitios.csv`).
**Nunca cargue datos reales de la red en una IA externa sin autorización.** Agregue, anonimice o enmascare primero.

## Reglas de trabajo con Claude Code

Están en `CLAUDE.md` (las lee solo). Los pedidos de cada taller están en `pedidos/`.
