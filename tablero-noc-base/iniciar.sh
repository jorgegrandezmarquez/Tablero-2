#!/bin/bash
# Reinicia el tablero para que tome la clave que escribió en esta terminal (export ANTHROPIC_API_KEY=...)
if [ -z "$ANTHROPIC_API_KEY" ]; then echo "Falta la clave. Escriba primero: export ANTHROPIC_API_KEY=su-clave"; exit 1; fi
pkill -f servir.mjs 2>/dev/null; sleep 1
nohup node servir.mjs > /dev/null 2>&1 &
sleep 1; echo "Tablero reiniciado con la clave del terminal. Recargue la página (F5). Para Claude Code escriba: claude"
