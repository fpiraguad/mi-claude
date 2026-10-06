#!/usr/bin/env node
// Trae la última versión de mi-claude y vuelve a correr la instalación.
// Nunca toca tus datos (keys, sesión de WhatsApp): viven fuera del repo, en ~/.mi-claude.
//
//   node setup/actualizar.mjs            actualiza
//   node setup/actualizar.mjs --en-seco  descarga y compara, pero no cambia nada
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO, dirDatos } from './lib/rutas.mjs';
import { descargarYExtraer, ejecutar } from './instalar.mjs';

const REPO_PUBLICO = 'https://github.com/fpiraguad/mi-claude';
const NO_COPIAR = new Set(['.git', 'node_modules']);

// Dueño del repo en GitHub: del campo "repository" de package.json, o el repo público por defecto.
export function urlZip(paquete) {
  const repo = typeof paquete?.repository === 'string' ? paquete.repository : paquete?.repository?.url ?? '';
  const m = String(repo).match(/github\.com[/:]([^/]+)\/([^/.]+)/) ?? REPO_PUBLICO.match(/github\.com\/([^/]+)\/([^/]+)/);
  return `https://github.com/${m[1]}/${m[2]}/archive/refs/heads/main.zip`;
}

const dentroDe = (hijo, padre) => {
  const rel = path.relative(padre, hijo);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

// Lista de archivos (rutas relativas) que cambiarían al copiar `origen` sobre `destino`.
export function planDeCopia(origen, destino, { excluir = () => false } = {}) {
  const cambios = [];
  const recorrer = (rel) => {
    for (const d of fs.readdirSync(path.join(origen, rel), { withFileTypes: true })) {
      if (NO_COPIAR.has(d.name)) continue;
      const r = path.join(rel, d.name);
      if (excluir(path.join(destino, r))) continue;
      if (d.isDirectory()) recorrer(r);
      else if (d.isFile()) {
        const dst = path.join(destino, r);
        const nuevo = fs.readFileSync(path.join(origen, r));
        if (!fs.existsSync(dst) || !nuevo.equals(fs.readFileSync(dst))) cambios.push(r);
      }
    }
  };
  recorrer('');
  return cambios;
}

export async function actualizar({ enSeco = false, repo = REPO, env = process.env, log = console.log, fetch = globalThis.fetch } = {}) {
  const paquete = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
  const url = urlZip(paquete);
  const datos = path.resolve(dirDatos(env));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-actualizar-'));
  try {
    log(`⬇️  Descargando la última versión…`);
    const nueva = await descargarYExtraer(url, tmp, fetch);
    const cambios = planDeCopia(nueva, repo, { excluir: (p) => dentroDe(path.resolve(p), datos) });
    if (!cambios.length) log('✅ Ya tienes la última versión de los archivos.');
    else log(`${enSeco ? '🔎 Cambiaría' : '📝 Actualizando'} ${cambios.length} archivo(s).`);
    if (enSeco) {
      cambios.slice(0, 20).forEach((c) => log(`   · ${c}`));
      if (cambios.length > 20) log(`   · …y ${cambios.length - 20} más`);
    } else {
      for (const c of cambios) {
        fs.mkdirSync(path.dirname(path.join(repo, c)), { recursive: true });
        fs.copyFileSync(path.join(nueva, c), path.join(repo, c));
      }
    }
  } catch (e) {
    log(`❌ No pude descargar la actualización (${e.message}). Revisa tu internet e inténtalo de nuevo.`);
    return { ok: false };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  log('\n🛠  Corriendo la instalación de nuevo…\n');
  const args = [path.join(repo, 'setup', 'instalar.mjs'), ...(enSeco ? ['--en-seco'] : [])];
  const r = ejecutar(process.execPath, args, { stdio: 'inherit', env });
  return { ok: r.codigo === 0 };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await actualizar({ enSeco: process.argv.includes('--en-seco') });
  if (!r.ok) process.exitCode = 1;
}
