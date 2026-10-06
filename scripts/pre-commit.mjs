#!/usr/bin/env node
// Pre-commit: revisa lo que está en stage (el contenido exacto que se va a commitear) con el escáner.
// Instalar una vez:  git config core.hooksPath .githooks   (con .githooks/pre-commit llamando a este script)
// o directamente:    node scripts/pre-commit.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  RAIZ, cargarProhibidos, compilarProhibidos, escanear, informar, rutaProhibidos,
} from './sin-datos-personales.mjs';

const git = (args, opciones = {}) => spawnSync('git', args, { cwd: RAIZ, windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...opciones });

// Lista de términos: la variable, ~/.mi-claude-prohibidos.txt, o la carpeta de herramientas del
// espacio de trabajo local (~/Desktop/Claude/<carpeta>/herramientas/mi-claude-prohibidos.txt).
export function buscarListaProhibidos(env = process.env, casa = os.homedir()) {
  if (env.MI_CLAUDE_PROHIBIDOS) return env.MI_CLAUDE_PROHIBIDOS;
  const enCasa = rutaProhibidos({});
  if (fs.existsSync(enCasa)) return enCasa;
  const espacio = path.join(casa, 'Desktop', 'Claude');
  if (fs.existsSync(espacio)) {
    for (const d of fs.readdirSync(espacio, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const candidato = path.join(espacio, d.name, 'herramientas', 'mi-claude-prohibidos.txt');
      if (fs.existsSync(candidato)) return candidato;
    }
  }
  return null;
}

const lista = buscarListaProhibidos();
if (lista) process.env.MI_CLAUDE_PROHIBIDOS = lista;
const terminos = cargarProhibidos(lista);

const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8' });
if (staged.status !== 0) {
  console.log('❌ No pude leer los archivos en stage (¿estás dentro del repo?).');
  process.exit(1);
}
const archivos = staged.stdout.split('\0').filter(Boolean).map((nombre) => {
  const blob = git(['show', `:${nombre}`]);
  const buf = blob.stdout ?? Buffer.alloc(0);
  const binario = blob.status !== 0 || buf.includes(0) || /\.(png|jpe?g|gif|webp|ico|pdf|zip|mp[34]|mov|wav|woff2?|ttf)$/i.test(nombre);
  return { nombre, texto: binario ? null : buf.toString('utf8') };
});

const codigo = informar(escanear(archivos, { prohibidos: compilarProhibidos(terminos) }), { conTerminos: !!terminos });
if (codigo) console.log('Commit detenido. Si es un falso positivo, cambia el texto por un marcador (p. ej. sk-xxxx).');
process.exit(codigo);
