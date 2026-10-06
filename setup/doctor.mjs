#!/usr/bin/env node
// Revisa cómo está la instalación y dice qué falta, en palabras simples. Solo lee; no cambia nada.
//
//   node setup/doctor.mjs           tabla
//   node setup/doctor.mjs --json    lo mismo en JSON
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO, dirClaude, dirDatos } from './lib/rutas.mjs';
import { listar } from './keys.mjs';
import {
  buscarClaude, parsearMcpList, contarHooksNuestros, tieneBloque, instruccionesClaude,
} from './lib/claude.mjs';
import { versionSuficiente, instruccionesNode, ejecutar } from './instalar.mjs';

export const PUERTO_WHATSAPP = 7717;
const ICONO = { ok: '✅', aviso: '⚠️ ', error: '❌', opcional: '⚪' };

const CORTO = {
  APIMART: 'APIMart', ZERNIO: 'Zernio', COMPOSIO: 'Composio', PARALLEL: 'Parallel', ELEVENLABS: 'ElevenLabs',
};
const TERMINAR = 'Di: "termina la instalación de mi-claude"';

const leerJson = (archivo, siFalta) => {
  try { return fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, 'utf8')) : siFalta; } catch { return siFalta; }
};

async function estadoWhatsapp(fetch, puerto) {
  try {
    const res = await fetch(`http://127.0.0.1:${puerto}/estado`, { signal: AbortSignal.timeout(2500) });
    const datos = await res.json().catch(() => ({}));
    const conectado = datos?.conectado === true || datos?.connected === true
      || /^(conectado|open|connected)$/i.test(String(datos?.estado ?? datos?.status ?? ''));
    return { encendido: true, conectado };
  } catch {
    return { encendido: false, conectado: false };
  }
}

function listarMcpReal(claude, env) {
  // ejecutar cita la ruta si claude es un .cmd (cmd.exe parte por espacios, p. ej. "C:\Users\Ana María\...").
  return ejecutar(claude, ['mcp', 'list'], { timeout: 60_000, env }).salida;
}

const existeArchivo = (r) => { try { return fs.statSync(r).isFile(); } catch { return false; } };

// deps se inyectan en las pruebas.
export async function diagnosticar({
  env = process.env, repo = REPO, version = process.versions.node,
  listarKeys = listar, fetch = globalThis.fetch, existe = existeArchivo,
  listarMcp = listarMcpReal, puerto = Number(env.MI_CLAUDE_WSP_PUERTO) || PUERTO_WHATSAPP,
} = {}) {
  const filas = [];
  const fila = (id, nombre, estado, detalle, accion) => filas.push({ id, nombre, estado, detalle, ...(accion ? { accion } : {}) });

  // Node
  if (versionSuficiente(version)) fila('node', 'Node', 'ok', `versión ${version}`);
  else fila('node', 'Node', 'error', `versión ${version}; se necesita 22.13 o más`, instruccionesNode());

  // Servicios con key
  let servicios = [];
  try { servicios = await listarKeys({ env, fetch }); } catch (e) {
    fila('keys', 'Keys', 'error', `no pude revisar las keys (${e.message})`);
  }
  for (const s of servicios) {
    const corto = CORTO[s.id] ?? s.id;
    if (s.ok) fila(`servicio:${s.id}`, s.nombre, 'ok', s.detalle);
    else if (s.key === '—') {
      fila(`servicio:${s.id}`, s.nombre, s.opcional ? 'opcional' : 'error', s.opcional ? 'opcional, sin key' : 'falta la key',
        s.opcional ? undefined : `Di: "conecta mi ${corto}"`);
    } else {
      fila(`servicio:${s.id}`, s.nombre, 'error', s.detalle, `Di: "revisa mi key de ${corto}"`);
    }
  }

  // WhatsApp
  const wsp = await estadoWhatsapp(fetch, puerto);
  const wspCli = `node "${path.join(repo, 'whatsapp', 'wsp.mjs')}" estado`;
  if (!wsp.encendido) {
    fila('whatsapp', 'WhatsApp', 'error', 'el servicio no está corriendo',
      `Di: "arranca mi WhatsApp" (o revisa con: ${wspCli})`);
  } else if (!wsp.conectado) {
    fila('whatsapp', 'WhatsApp', 'aviso', 'el servicio corre pero falta vincular el teléfono',
      `Di: "vincula mi WhatsApp" (o revisa con: ${wspCli})`);
  }
  else fila('whatsapp', 'WhatsApp', 'ok', 'conectado');

  // MCP
  const claude = buscarClaude({ env, existe });
  if (!claude) {
    fila('mcp', 'Búsqueda y email (MCP)', 'error', 'no encontré el programa "claude"', instruccionesClaude());
  } else {
    const servidores = parsearMcpList(listarMcp(claude, env));
    const tieneComposioKey = servicios.some((s) => s.id === 'COMPOSIO' && s.key !== '—');
    for (const [nombre, etiqueta, requerido] of [
      ['parallel-search', 'Búsqueda web (MCP)', true],
      ['composio', 'Email con Composio (MCP)', tieneComposioKey],
    ]) {
      const s = servidores.find((x) => x.nombre === nombre);
      if (!s) {
        if (requerido) fila(`mcp:${nombre}`, etiqueta, 'error', 'no está agregado', TERMINAR);
        else fila(`mcp:${nombre}`, etiqueta, 'opcional', 'se agrega cuando conectes Composio');
      } else if (s.conectado) fila(`mcp:${nombre}`, etiqueta, 'ok', 'conectado');
      else if (s.necesitaAuth) fila(`mcp:${nombre}`, etiqueta, 'aviso', 'falta autorizar', `Di: "autoriza ${nombre === 'composio' ? 'mi correo en Composio' : 'la búsqueda'}"`);
      else fila(`mcp:${nombre}`, etiqueta, 'error', s.estado, TERMINAR);
    }
  }

  // Skills
  const instalado = leerJson(path.join(dirDatos(env), 'instalado.json'), {});
  const dirSkills = path.join(dirClaude(env), 'skills');
  const esperadas = fs.existsSync(path.join(repo, 'skills'))
    ? fs.readdirSync(path.join(repo, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(repo, 'skills', d.name, 'SKILL.md'))).map((d) => d.name)
    : instalado.skills ?? [];
  const faltanSkills = esperadas.filter((n) => !fs.existsSync(path.join(dirSkills, n, 'SKILL.md')));
  if (!esperadas.length) fila('skills', 'Skills', 'aviso', 'no hay skills para revisar', TERMINAR);
  else if (faltanSkills.length) fila('skills', 'Skills', 'error', `faltan ${faltanSkills.length} de ${esperadas.length}`, TERMINAR);
  else fila('skills', 'Skills', 'ok', `${esperadas.length} instaladas`);

  const terceros = Object.keys(Object.assign({}, ...(leerJson(path.join(repo, 'setup', 'skills-terceros.json'), { repos: [] }).repos.map((r) => r.rutas))));
  const faltanTerceros = terceros.filter((n) => !fs.existsSync(path.join(dirSkills, n, 'SKILL.md')));
  if (faltanTerceros.length) fila('terceros', 'Skills de terceros', 'aviso', `faltan ${faltanTerceros.length} de ${terceros.length}`, TERMINAR);
  else fila('terceros', 'Skills de terceros', 'ok', `${terceros.length} instaladas`);

  // Hooks
  const esperadosHooks = leerJson(path.join(repo, 'hooks', 'hooks.json'), []).length;
  const settings = leerJson(path.join(dirClaude(env), 'settings.json'), {});
  const registrados = contarHooksNuestros(settings);
  if (!esperadosHooks) fila('hooks', 'Hooks', 'aviso', 'el repo no trae hooks para revisar');
  else if (registrados >= esperadosHooks) fila('hooks', 'Hooks', 'ok', `${registrados} registrados`);
  else fila('hooks', 'Hooks', 'error', `${registrados} de ${esperadosHooks} registrados`, TERMINAR);

  // Método
  const claudeMd = path.join(dirClaude(env), 'CLAUDE.md');
  const texto = fs.existsSync(claudeMd) ? fs.readFileSync(claudeMd, 'utf8') : '';
  if (tieneBloque(texto)) fila('metodo', 'Método (CLAUDE.md)', 'ok', 'presente');
  else fila('metodo', 'Método (CLAUDE.md)', 'error', 'no está en tu CLAUDE.md', TERMINAR);

  const falta = [...new Set(filas.filter((f) => f.accion && f.estado !== 'ok').map((f) => f.accion))];
  return { filas, falta, todoBien: filas.every((f) => f.estado === 'ok' || f.estado === 'opcional') };
}

export function formatear({ filas, falta, todoBien }) {
  const ancho = Math.max(...filas.map((f) => f.nombre.length));
  const lineas = filas.map((f) => `${ICONO[f.estado]} ${f.nombre.padEnd(ancho)}  ${f.detalle}`);
  lineas.push('');
  if (todoBien) lineas.push('🎉 Todo está listo.');
  else {
    lineas.push('Qué falta:');
    falta.forEach((a, i) => lineas.push(`  ${i + 1}. ${a}`));
  }
  return lineas.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const r = await diagnosticar();
    console.log(process.argv.includes('--json') ? JSON.stringify(r, null, 2) : formatear(r));
  } catch (e) {
    console.log(`❌ No pude terminar la revisión: ${e.message}`);
  }
  process.exitCode = 0;
}
