#!/usr/bin/env node
// Hook PreToolUse (Bash): TODO ARREGLO SALE CON EL TEST QUE REPRODUCE EL BUG.
//
// Una regla que dice «verifica» es una promesa; un test que falla es un hecho.
// Los bugs que vuelven casi siempre son los que se arreglaron sin test.
//
// Frena un `git push` cuando lo que se va a subir trae un commit que parece
// arreglo («arregla», «corrige», «ya no», «otra vez»…) y ningún archivo de test
// en todo el tramo. Solo en repos que ya tienen Vitest: donde no hay tests
// todavía, pasa (se montan con /calidad). Escape honesto para copy o CSS:
// `[sin-test: motivo]` en el mensaje del commit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { leerEntrada, negar, limpiar, sentencias } from './comun.mjs';

const datos = await leerEntrada();
if (!datos) process.exit(0);

const comando = String(datos.tool_input?.command || '');
const cwd = datos.cwd || process.cwd();

const PUSH = /\bgit\b((?:\s+-C\s+\S+)?)\s+push\b/;
// `cd`, `Set-Location`, `sl`, `pushd` (bash y PowerShell).
const CD = /^\s*(?:cd|set-location|sl|pushd)\s+(?:-path\s+)?(\S+)/i;
const ARREGLO = new RegExp(
  '\\b(arregl\\w*|corrig\\w*|fix\\w*|bug\\w*|hotfix|otra vez|de nuevo|vuelve a|ya no|' +
    'se ca[ií]a|fallaba|no (?:llegaba|entraba|guardaba|aparec[ií]a|funcionaba|cargaba|sal[ií]a))\\b',
  'i',
);
const ESCAPE = /\[sin-test\b/i;
const TEST = /\.(test|spec)\.(ts|tsx|js|mjs)$/;

function git(repo, ...args) {
  try {
    return execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
  } catch {
    return null;
  }
}

function resolver(ruta, base) {
  let r = ruta.replace(/^['"]|['"]$/g, '');
  if (r === '~' || r.startsWith('~/') || r.startsWith('~\\')) r = path.join(os.homedir(), r.slice(2));
  return path.isAbsolute(r) ? r : path.normalize(path.join(base, r));
}

// ¿Dónde se hace el push? Sigue los `cd` del comando y el `git -C`.
let repo = null;
let base = cwd;
for (const s of sentencias(limpiar(comando))) {
  const m = s.match(CD);
  if (m) base = resolver(m[1], base);
  const p = s.match(PUSH);
  if (p) {
    const c = (p[1] || '').match(/-C\s+(\S+)/);
    repo = c ? resolver(c[1], base) : base;
    break;
  }
}
if (!repo || !fs.existsSync(repo) || !fs.statSync(repo).isDirectory()) process.exit(0);

let arreglos = [];
try {
  const raiz = (git(repo, 'rev-parse', '--show-toplevel') || '').trim();
  if (!raiz) process.exit(0);

  // Solo donde ya hay tests montados.
  const tieneVitest = (ruta) => {
    try {
      return fs.readFileSync(ruta, 'utf8').includes('"vitest"');
    } catch {
      return false;
    }
  };
  if (!tieneVitest(path.join(raiz, 'package.json')) && !tieneVitest(path.join(raiz, 'apps/web/package.json'))) {
    process.exit(0);
  }

  // Lo que se va a subir: contra el upstream, o contra origin/<rama>.
  let tramo = null;
  if (git(raiz, 'rev-parse', '--abbrev-ref', '@{u}')) {
    tramo = '@{u}..HEAD';
  } else {
    const rama = (git(raiz, 'rev-parse', '--abbrev-ref', 'HEAD') || '').trim();
    for (const ref of [`origin/${rama}`, 'origin/main']) {
      if (git(raiz, 'rev-parse', '--verify', '-q', ref)) {
        tramo = `${ref}..HEAD`;
        break;
      }
    }
  }
  if (!tramo) process.exit(0);

  const log = git(raiz, 'log', tramo, '--format=%h%x1f%B%x1e') || '';
  for (const bloque of log.split('\x1e')) {
    if (!bloque.includes('\x1f')) continue;
    const [sha, ...resto] = bloque.trim().split('\x1f');
    const cuerpo = resto.join('\x1f');
    const asunto = cuerpo.trim() ? cuerpo.trim().split(/\r?\n/)[0] : '';
    if (ARREGLO.test(cuerpo) && !ESCAPE.test(cuerpo)) arreglos.push(`${sha} ${asunto.slice(0, 70)}`);
  }
  if (!arreglos.length) process.exit(0);

  const archivos = git(raiz, 'diff', '--name-only', tramo.replace('..HEAD', '...HEAD')) || '';
  if (archivos.split(/\r?\n/).some((a) => TEST.test(a.trim()))) process.exit(0);
} catch {
  process.exit(0); // ante la duda, el hook deja pasar
}

negar(
  'Push frenado (skill /calidad, tests.md): estos commits parecen arreglos y el push no trae ningún ' +
    'archivo de test:\n  ' + arreglos.slice(0, 6).join('\n  ') + '\n' +
    'Escribe el test que reproduce el bug (verlo fallar sin el arreglo, pasar con él), commitéalo y vuelve ' +
    'a subir. Si de verdad no hay nada que probar (copy, CSS, un color), enmienda el mensaje del commit ' +
    'sin subir con `[sin-test: motivo]`.',
);
