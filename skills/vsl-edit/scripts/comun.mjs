// Piezas compartidas por los scripts de vsl-edit: keys y ffmpeg, igual en Mac y Windows.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const DIR_DATOS = process.env.MI_CLAUDE_DIR || path.join(os.homedir(), '.mi-claude');

function leerEnv(archivo) {
  if (!fs.existsSync(archivo)) return {};
  const valores = {};
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) valores[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2').trim();
  }
  return valores;
}

/**
 * Una key: primero el entorno, luego ~/.mi-claude/secrets.env, luego el .env del proyecto.
 * Nunca se imprime: si falta, se dice cómo guardarla.
 */
export function clave(nombre) {
  const valor =
    process.env[nombre]?.trim() ||
    leerEnv(path.join(DIR_DATOS, 'secrets.env'))[nombre] ||
    leerEnv(path.join(process.cwd(), '.env'))[nombre];
  if (valor) return valor;
  throw new Error(
    `Falta ${nombre}. Pídele a Claude que la guarde (node ~/mi-claude/setup/keys.mjs guardar ` +
      `${nombre.replace(/_API_KEY$/, '')} <key>): queda en ~/.mi-claude/secrets.env.`,
  );
}

const funciona = (bin) => {
  try {
    return spawnSync(bin, ['-version'], { stdio: 'ignore', windowsHide: true }).status === 0;
  } catch {
    return false;
  }
};

/** Ruta de ffmpeg: FFMPEG del entorno, el del sistema, o el ffmpeg-static que instaló mi-claude. */
export function ffmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  if (funciona('ffmpeg')) return 'ffmpeg';
  const candidatos = [
    path.join(os.homedir(), 'mi-claude', 'whatsapp', 'package.json'),
    path.join(os.homedir(), 'mi-claude', 'package.json'),
    path.join(process.cwd(), 'package.json'),
  ];
  for (const base of candidatos) {
    try {
      const bin = createRequire(base)('ffmpeg-static');
      if (bin && fs.existsSync(bin)) return bin;
    } catch {
      // sigue con el siguiente
    }
  }
  throw new Error('No encontré ffmpeg. Instálalo (Mac: brew install ffmpeg · Windows: winget install Gyan.FFmpeg) o define FFMPEG.');
}

/** Corre ffmpeg y devuelve { status, stdout (Buffer), stderr (texto) }. */
export function correrFfmpeg(args, opciones = {}) {
  const r = spawnSync(ffmpeg(), args, { maxBuffer: 1 << 28, windowsHide: true, ...opciones });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr?.toString('utf8') || '' };
}

/** Duración (s), ancho, alto y fps de un video, leyendo la cabecera que imprime `ffmpeg -i` (sin ffprobe). */
export function medir(video) {
  const { stderr } = correrFfmpeg(['-hide_banner', '-i', video]);
  const d = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  const v = stderr.match(/Stream[^\n]*Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/);
  const f = stderr.match(/Stream[^\n]*Video:[^\n]*?([\d.]+)\s*fps/);
  if (!d || !v) throw new Error(`No pude leer el video ${video}`);
  return {
    duracion: Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]),
    ancho: Number(v[1]),
    alto: Number(v[2]),
    fps: f ? Number(f[1]) : null,
  };
}
