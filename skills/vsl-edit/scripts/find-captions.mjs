#!/usr/bin/env node
// Localiza la franja de subtítulos quemados de un video.
//
//   node find-captions.mjs entrada.mp4 [n_muestras]
//
// Muestrea fotogramas repartidos por el video y busca filas con muchos píxeles
// casi blancos en la zona central horizontal — que es como se ve un caption
// incrustado. Devuelve el rango de alturas que ocupan, para declararlo zona
// prohibida en el theme del montaje.
//
// Sin esto se descubre el problema tarde, con dos textos superpuestos en pantalla.
// Solo necesita ffmpeg (nada de Python ni Pillow).
import { correrFfmpeg, medir } from './comun.mjs';

const BLANCO = 238; // umbral de "casi blanco"
const MIN_RUN = 12; // píxeles blancos en una fila para considerarla texto

/** Filas (min, max) con texto blanco en un fotograma en escala de grises. */
export function filasDeTexto(gris, ancho, alto) {
  const filas = [];
  const desde = Math.floor(ancho * 0.15);
  const hasta = Math.floor(ancho * 0.85);
  for (let y = 0; y < alto; y++) {
    let run = 0;
    for (let x = desde; x < hasta; x += 2) if (gris[y * ancho + x] > BLANCO) run++;
    if (run > MIN_RUN) filas.push(y);
  }
  return filas.length ? [Math.min(...filas), Math.max(...filas)] : null;
}

const [video, nTexto] = process.argv.slice(2);
if (!video) {
  console.error('uso: node find-captions.mjs entrada.mp4 [n_muestras]');
  process.exit(1);
}

try {
  const n = Number(nTexto || 8);
  const { duracion, ancho, alto } = medir(video);
  const hits = [];

  for (let i = 0; i < n; i++) {
    const t = (duracion * (i + 0.5)) / n;
    const r = correrFfmpeg([
      '-v', 'error', '-ss', String(t), '-i', video, '-frames:v', '1',
      '-f', 'rawvideo', '-pix_fmt', 'gray', '-',
    ]);
    if (r.status !== 0 || r.stdout.length < ancho * alto) {
      console.log(`  ${t.toFixed(1).padStart(6)}s  ->  (no se pudo leer el fotograma)`);
      continue;
    }
    const banda = filasDeTexto(r.stdout, ancho, alto);
    console.log(`  ${t.toFixed(1).padStart(6)}s  ->  ${banda ? `(${banda[0]}, ${banda[1]})` : 'sin texto'}`);
    if (banda) hits.push(banda);
  }

  console.log(`\nvideo: ${ancho}x${alto}`);
  if (!hits.length) {
    console.log('No se detectaron subtítulos quemados.');
  } else {
    const top = Math.min(...hits.map((b) => b[0]));
    const bottom = Math.max(...hits.map((b) => b[1]));
    // Un poco de aire: los captions cambian de alto según la línea.
    console.log(`franja de subtítulos: y ${top}-${bottom}`);
    console.log(`zona prohibida sugerida: y ${Math.max(0, top - 14)}-${Math.min(alto, bottom + 14)}`);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
