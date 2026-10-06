#!/usr/bin/env node
// Falla si el repo trae una key o un dato personal. Corre en pre-commit y en CI.
//
//   node scripts/sin-datos-personales.mjs              todos los archivos del repo
//   node scripts/sin-datos-personales.mjs a.md b.mjs   solo esos
//
// Términos prohibidos (nombres, teléfonos, clientes): un archivo FUERA del repo, un término por línea.
// Se toma de la variable MI_CLAUDE_PROHIBIDOS o de ~/.mi-claude-prohibidos.txt. Sin archivo, solo se
// revisan los patrones de keys (caso CI).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PATRONES_KEY = [
  /sk-[A-Za-z0-9]{16,}/g,
  /sk_[A-Za-z0-9]{20,}/g,
  /ak_[A-Za-z0-9]{12,}/g,
  /ck_[A-Za-z0-9]{12,}/g,
  /AIza[0-9A-Za-z_-]{30,}/g,
  /gh[pousr]_[A-Za-z0-9]{30,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./g,
  /-{5}BEGIN .*PRIVATE KEY-{5}/g,
];

// Las URL públicas del repo pueden nombrar al dueño.
export const PERMITIDOS = ['raw.githubusercontent.com/fpiraguad/mi-claude', 'github.com/fpiraguad/mi-claude', 'fpiraguad.github.io/mi-claude'];

const MARCADOR = /xxx|…|\.\.\.|tu-key/i;
export const esMarcador = (texto) => MARCADOR.test(texto);

export function enmascarar(texto) {
  return texto.length <= 4 ? '••••' : `${texto.slice(0, 3)}${'•'.repeat(Math.min(8, texto.length - 3))}`;
}

export function rutaProhibidos(env = process.env) {
  if (env.MI_CLAUDE_PROHIBIDOS) return env.MI_CLAUDE_PROHIBIDOS;
  return path.join(os.homedir(), '.mi-claude-prohibidos.txt');
}

export function cargarProhibidos(archivo) {
  if (!archivo || !fs.existsSync(archivo)) return null;
  return fs.readFileSync(archivo, 'utf8').split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function compilarProhibidos(terminos) {
  if (!terminos?.length) return null;
  return new RegExp(terminos.map(escaparRegex).join('|'), 'gi');
}

// Devuelve [{ archivo, linea, tipo, muestra }] con la coincidencia enmascarada.
export function escanearTexto(texto, archivo, { prohibidos = null } = {}) {
  const hallazgos = [];
  const lineas = texto.split(/\r?\n/);
  lineas.forEach((original, i) => {
    for (const patron of PATRONES_KEY) {
      for (const m of original.matchAll(patron)) {
        if (esMarcador(m[0])) continue;
        hallazgos.push({ archivo, linea: i + 1, tipo: 'key', muestra: enmascarar(m[0]) });
      }
    }
    if (prohibidos) {
      let linea = original;
      for (const p of PERMITIDOS) linea = linea.split(p).join(' ').replace(new RegExp(escaparRegex(p), 'gi'), ' ');
      for (const m of linea.matchAll(prohibidos)) {
        hallazgos.push({ archivo, linea: i + 1, tipo: 'dato personal', muestra: enmascarar(m[0]) });
      }
    }
  });
  return hallazgos;
}

const BINARIO = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|mp3|mp4|mov|wav|ogg|woff2?|ttf|otf)$/i;

export function archivosDelRepo(raiz = RAIZ) {
  const git = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: raiz, encoding: 'utf8', windowsHide: true,
  });
  if (git.status === 0 && git.stdout) return git.stdout.split('\0').filter(Boolean);
  const lista = [];
  const recorrer = (rel) => {
    for (const d of fs.readdirSync(path.join(raiz, rel), { withFileTypes: true })) {
      if (['node_modules', '.git'].includes(d.name)) continue;
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) recorrer(r);
      else if (d.isFile()) lista.push(r);
    }
  };
  recorrer('');
  return lista;
}

export function leerTexto(ruta) {
  if (BINARIO.test(ruta)) return null;
  const buf = fs.readFileSync(ruta);
  if (buf.length > 5 * 1024 * 1024 || buf.includes(0)) return null;
  return buf.toString('utf8');
}

// archivos: [{ nombre, texto }]
export function escanear(archivos, { prohibidos = null } = {}) {
  return archivos.flatMap(({ nombre, texto }) => (texto == null ? [] : escanearTexto(texto, nombre, { prohibidos })));
}

export function informar(hallazgos, { conTerminos, log = console.log } = {}) {
  if (!conTerminos) log('ℹ️  Sin lista de términos prohibidos: solo reviso patrones de keys.');
  if (!hallazgos.length) { log('✅ Sin keys ni datos personales.'); return 0; }
  for (const h of hallazgos) log(`❌ ${h.archivo}:${h.linea}  ${h.tipo}: ${h.muestra}`);
  log(`\n${hallazgos.length} hallazgo(s). Quítalos antes de publicar.`);
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rutas = process.argv.slice(2);
  const nombres = rutas.length ? rutas : archivosDelRepo();
  const base = rutas.length ? process.cwd() : RAIZ;
  const terminos = cargarProhibidos(rutaProhibidos());
  const archivos = nombres.map((n) => {
    const ruta = path.resolve(base, n);
    return { nombre: n, texto: fs.existsSync(ruta) ? leerTexto(ruta) : null };
  });
  process.exitCode = informar(escanear(archivos, { prohibidos: compilarProhibidos(terminos) }), { conTerminos: !!terminos });
}
