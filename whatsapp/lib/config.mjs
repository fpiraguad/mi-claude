// Configuración compartida del servicio de WhatsApp, del CLI `wsp` y de `arranque.mjs`.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirDatos } from '../../setup/lib/rutas.mjs';

export const DIR_WHATSAPP_CODIGO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUERTO_POR_DEFECTO = 7717;
export const ETIQUETA = 'local.mi-claude.whatsapp';

export function puerto(env = process.env) {
  const n = Number(env.WSP_PUERTO);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : PUERTO_POR_DEFECTO;
}

export function urlBase(env = process.env) {
  return `http://127.0.0.1:${puerto(env)}`;
}

// Todo lo de WhatsApp (sesión, base, archivos) vive fuera del repo: son chats privados.
export function rutasDatos(env = process.env) {
  const dir = path.join(dirDatos(env), 'whatsapp');
  return {
    dir,
    auth: path.join(dir, 'auth'),
    db: path.join(dir, 'whatsapp.db'),
    medios: path.join(dir, 'medios'),
    voz: path.join(dir, 'voz'),
    log: path.join(dir, 'servicio.log'),
  };
}

// `node:sqlite` sin bandera experimental llegó en Node 22.13 (y está en 23.4+).
export function nodeCompatible(version = process.versions.node) {
  const [mayor, menor] = version.replace(/^v/, '').split('.').map(Number);
  if (mayor > 23) return true;
  if (mayor === 23) return menor >= 4;
  if (mayor === 22) return menor >= 13;
  return false;
}

export function mensajeNodeViejo(version = process.versions.node) {
  return (
    `El servicio de WhatsApp necesita Node 22.13 o más nuevo, y este es Node ${version}.\n` +
    'Pídele a Claude: "actualiza Node a la versión 22 LTS" (o corre setup/instalar.mjs de nuevo).'
  );
}
