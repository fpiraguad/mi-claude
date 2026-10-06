// Lee una key: primero la variable de entorno, luego ~/.mi-claude/secrets.env (o $MI_CLAUDE_DIR).
// Autocontenido a propósito: la skill se instala por copia y no puede depender del repo. Nunca imprime valores.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function leerKey(nombre, env = process.env) {
  if (env[nombre]) return String(env[nombre]).trim();
  const archivo = path.join(env.MI_CLAUDE_DIR || path.join(os.homedir(), '.mi-claude'), 'secrets.env');
  if (!fs.existsSync(archivo)) return '';
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && m[1] === nombre) return m[2].replace(/^(['"])(.*)\1$/, '$2').trim();
  }
  return '';
}
