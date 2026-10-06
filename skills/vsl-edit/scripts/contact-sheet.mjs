#!/usr/bin/env node
// Junta varios PNG en una sola hoja de contactos.
//
//   node contact-sheet.mjs salida.jpg frame_1.png frame_2.png ... [--cols 3]
//
// Pensado para revisar de un vistazo los fotogramas que devuelve
// `npx remotion still`. Verlos juntos es lo que delata los problemas de montaje
// — un rótulo pisando los subtítulos, un gráfico sobre la cara, un inserto que
// contradice el texto — que leyendo el código no se ven.
// Solo necesita ffmpeg (nada de Python ni Pillow).
import path from 'node:path';
import { correrFfmpeg } from './comun.mjs';

const ANCHO_CELDA = 512;

const args = process.argv.slice(2);
let cols = 3;
const i = args.indexOf('--cols');
if (i !== -1) {
  cols = Number(args[i + 1]);
  args.splice(i, 2);
}
if (args.length < 2) {
  console.error('uso: node contact-sheet.mjs salida.jpg frame_*.png [--cols 3]');
  process.exit(1);
}

const [salida, ...resto] = args;
const fuentes = [...resto].sort();
const filas = Math.ceil(fuentes.length / cols);

// Todas van a la misma celda: ancho fijo y alto proporcional al de la primera imagen.
const { stderr: info } = correrFfmpeg(['-hide_banner', '-i', fuentes[0]]);
const m = info.match(/Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/);
const altoCelda = m ? Math.round((ANCHO_CELDA * Number(m[2])) / Number(m[1]) / 2) * 2 : 288;

// Cada imagen se escala a la celda, se encadenan como fotogramas y `tile` arma la rejilla.
const entradas = fuentes.flatMap((f) => ['-i', f]);
const grafo =
  fuentes.map((_, k) => `[${k}:v]scale=${ANCHO_CELDA}:${altoCelda},setsar=1,format=rgb24[c${k}]`).join(';') +
  ';' +
  fuentes.map((_, k) => `[c${k}]`).join('') +
  `concat=n=${fuentes.length}:v=1:a=0[todo];[todo]tile=${cols}x${filas}:color=black[hoja]`;

const r = correrFfmpeg([
  '-y', '-v', 'error', ...entradas,
  '-filter_complex', grafo, '-map', '[hoja]', '-frames:v', '1', '-q:v', '3', salida,
]);
if (r.status !== 0) {
  console.error(`ffmpeg falló: ${r.stderr.slice(0, 400)}`);
  process.exit(1);
}
console.log(`${fuentes.length} fotogramas -> ${salida}  (${ANCHO_CELDA * cols}x${altoCelda * filas})`);
for (const f of fuentes) console.log(`  ${path.basename(f)}`);
