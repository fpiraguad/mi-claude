// Conversión de audio con el ffmpeg que trae `ffmpeg-static` (no hace falta instalarlo aparte).
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const correr = promisify(execFile);

export async function rutaFfmpeg() {
  const { default: ruta } = await import('ffmpeg-static');
  if (!ruta || !fs.existsSync(ruta)) {
    throw new Error('No encuentro ffmpeg. Reinstala las dependencias: npm install (en la carpeta whatsapp).');
  }
  return ruta;
}

// ffmpeg imprime «time=00:00:03.45» a medida que procesa; el último es la duración total.
export function duracionDeSalidaFfmpeg(stderr) {
  const tiempos = [...String(stderr).matchAll(/time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
  const ultimo = tiempos.at(-1);
  if (!ultimo) return 1;
  const segundos = Number(ultimo[1]) * 3600 + Number(ultimo[2]) * 60 + Number(ultimo[3]);
  return Math.max(1, Math.round(segundos));
}

// WhatsApp solo muestra como nota de voz un OGG/Opus mono; cualquier otro audio sale como
// archivo adjunto. Se convierte siempre, aunque ya venga en .ogg, para no adivinar el códec.
export async function aNotaDeVoz(archivo, dirSalida) {
  fs.mkdirSync(dirSalida, { recursive: true });
  const salida = path.join(dirSalida, `${path.basename(archivo, path.extname(archivo))}-${Date.now()}.ogg`);
  // Medio segundo de silencio al arrancar (WhatsApp se come el principio al darle play),
  // un respiro al final y volumen normalizado, para que suene parejo con las notas del celular.
  const filtros = 'adelay=500:all=1,apad=pad_dur=0.3,loudnorm=I=-14:TP=-1:LRA=11';
  const { stderr } = await correr(await rutaFfmpeg(), [
    '-y', '-hide_banner', '-i', archivo, '-vn', '-af', filtros,
    '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '48k', salida,
  ], { maxBuffer: 20 * 1024 * 1024 });
  return { archivo: salida, segundos: duracionDeSalidaFfmpeg(stderr) };
}
