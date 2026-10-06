// Dónde vive cada cosa, igual en Mac y Windows.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const esWindows = process.platform === 'win32';

// Datos de la persona (keys, sesión de WhatsApp): FUERA del repo, para que actualizar nunca los pise.
export function dirDatos(env = process.env) {
  return env.MI_CLAUDE_DIR || path.join(os.homedir(), '.mi-claude');
}

export function archivoSecretos(env = process.env) {
  return path.join(dirDatos(env), 'secrets.env');
}

export function dirClaude(env = process.env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}
