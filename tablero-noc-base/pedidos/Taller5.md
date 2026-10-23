# Taller 5 · Reportes, llevarlo a su PC y su hoja de ruta (15 min, en salas)

## Parte 1 · Reportes (7 min)

### PEDIDO · pegar en Claude Code
```
Lee CLAUDE.md. Voy a crear la pestaña "Reportes" en js/modulos/reportes.js. Antes de escribir código, dime tu plan en cinco líneas.
Reglas:
1. El usuario elige un día y un turno (mañana 06-14, tarde 14-22, noche 22-06). Todas las cifras (disponibilidad, latencia,
   pérdida, alarmas, incidentes, tickets nuevos y pendientes P1/P2) las calcula el PROGRAMA.
2. Hay tres reportes: de turno (técnico), ejecutivo (máximo 5 líneas y una decisión pedida) y traspaso de turno
   (pendientes con casillas y un cuadro de observaciones).
3. Con clave, la IA solo REDACTA el texto a partir de las cifras que le da el programa. Sin clave, se usa una plantilla.
4. Cada reporte termina con "Cifras de respaldo" para poder rastrear los números.
5. Botones: imprimir/guardar PDF y descargar como archivo HTML.
```
**LISTO CUANDO:** el reporte del **16/10, turno tarde** menciona el incidente del agregador A-07 y el ticket del corte; el ejecutivo cabe en 5 líneas.

**PREGUNTA:** el reporte de gerencia, ¿qué quita respecto al de turno? ¿Y qué NO puede quitar?

## Parte 2 · Llévelo a su PC (3 min)
1. En la terminal del Codespace escriba `node empaquetar.mjs`.
2. Clic derecho sobre `tablero-noc.zip` → **Descargar**.
3. En su PC: descomprima y haga doble clic en `index.html`. Pruebe que abre.
4. Si quiere IA: pegue la clave en el panel. Si su red la bloquea, verá un mensaje claro y puede usar el modo demostración.

## Parte 3 · Mi tablero (5 min, individual) — usen la pestaña "Mis datos"
Completen la tarjeta de hoja de ruta:
- **Un dato de mi área** que llevaría a un tablero así (¿lo puedo exportar a CSV?).
- **Quién lo miraría y cada cuánto.**
- **Qué NO enviaría nunca a una IA externa** (datos de clientes, identificadores, contratos…) y cómo lo protegería (agregar, enmascarar, no enviar).
- **Qué decisión seguiría tomando una persona.**
- **Plan:** en 30 días ___, en 60 días ___, en 90 días ___.

Si tienen un CSV propio **ya anonimizado**, cárguenlo en "Mis datos": verán si las columnas sensibles se marcan en rojo.
