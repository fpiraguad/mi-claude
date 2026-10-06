#!/usr/bin/env node
// Instala o repara mi-claude. Cada paso se puede repetir sin romper nada.
//
//   node setup/instalar.mjs                     todo
//   node setup/instalar.mjs --en-seco           solo dice qué haría; no cambia nada
//   node setup/instalar.mjs --solo skills,mcp   solo esos pasos
//
// Pasos: node, dependencias, skills, terceros, hooks, metodo, mcp, whatsapp
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { REPO, dirClaude, dirDatos, esWindows } from './lib/rutas.mjs';
import { leerSecretos } from './lib/secretos.mjs';
import {
  MARCA, comandoHook, fusionarHooks, fusionarBloque, buscarClaude, instruccionesClaude,
  servidoresMcp, argsMcpAdd, argsParaMostrar,
} from './lib/claude.mjs';

export const PASOS = ['node', 'dependencias', 'skills', 'terceros', 'hooks', 'metodo', 'mcp', 'whatsapp'];
export const NODE_MINIMO = [22, 13];

const ICONO = { ok: '✅', aviso: '⚠️ ', error: '❌', nada: '⚪' };

// ---------- utilidades ----------

export function versionSuficiente(version = process.versions.node, minimo = NODE_MINIMO) {
  const [a, b] = String(version).replace(/^v/, '').split('.').map(Number);
  return a > minimo[0] || (a === minimo[0] && b >= minimo[1]);
}

export function instruccionesNode(plataforma = process.platform) {
  return plataforma === 'win32'
    ? 'Instala Node 22: pídele a Claude «instala Node como dice el Paso 2 de INSTALAR.md» (usa winget o, si no hay, el instalador oficial) y luego cierra y abre Claude.'
    : 'Instala Node 22 sin contraseña: pídele a Claude «instala Node como dice el Paso 2 de INSTALAR.md» (queda en ~/.local/node, sin Git) y luego cierra y abre Claude.';
}

// Con shell:true (necesario para .cmd en Windows) cmd.exe parte por espacios: se citan programa y args.
export function citarCmd(s) {
  const t = String(s);
  return /[\s"&|<>^()]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

// Ejecuta un programa y devuelve { codigo, salida }. Nunca lanza.
export function ejecutar(programa, args, opciones = {}) {
  const shell = esWindows && /\.(cmd|bat)$/i.test(programa);
  if (shell) {
    programa = citarCmd(programa);
    args = args.map(citarCmd);
  }
  const r = spawnSync(programa, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10 * 60 * 1000,
    windowsHide: true,
    shell,
    ...opciones,
  });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (r.error) return { codigo: -1, salida: `${salida}${r.error.message}` };
  return { codigo: r.status ?? -1, salida };
}

// npm/npx sin depender de npm.cmd en Windows: se usa el npm que viene junto a este Node.
export function comandoNpm(cual = 'npm', args = []) {
  const base = path.dirname(process.execPath);
  for (const c of [
    path.join(base, 'node_modules', 'npm', 'bin', `${cual}-cli.js`),
    path.join(base, '..', 'lib', 'node_modules', 'npm', 'bin', `${cual}-cli.js`),
  ]) {
    if (fs.existsSync(c)) return [process.execPath, [c, ...args]];
  }
  return [esWindows ? `${cual}.cmd` : cual, args];
}

// Quita de un texto cualquier secreto conocido (por si un error de otro programa lo repite).
export function censurar(texto, secretos) {
  let t = String(texto ?? '');
  for (const v of Object.values(secretos)) if (v && v.length >= 6) t = t.split(v).join('••••');
  return t;
}

const leerJson = (archivo, siFalta) => {
  if (!fs.existsSync(archivo)) return siFalta;
  return JSON.parse(fs.readFileSync(archivo, 'utf8'));
};

function escribirAtomico(archivo, contenido) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const temporal = `${archivo}.${process.pid}.tmp`;
  fs.writeFileSync(temporal, contenido);
  fs.renameSync(temporal, archivo);
}

const ultimaLinea = (t) => String(t).trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? '';

// El `tar` que trae el sistema (bsdtar: entiende ZIP). En Windows se usa el de System32 por ruta
// completa: si Git está en el PATH, su `tar` (GNU) va primero y no sabe abrir ZIP.
export function tarDelSistema({ plataforma = process.platform, env = process.env, existe = fs.existsSync } = {}) {
  const candidato = plataforma === 'win32'
    ? path.win32.join(env.SystemRoot || env.SYSTEMROOT || 'C:\\Windows', 'System32', 'tar.exe')
    : '/usr/bin/tar';
  return existe(candidato) ? candidato : 'tar';
}

// Descarga un ZIP y lo descomprime con el `tar` del sistema (Mac y Windows 10+). Devuelve la carpeta raíz.
// tolerante: si tar se queja (p. ej. enlaces simbólicos que Windows no deja crear) pero dejó la
// carpeta, se sigue con lo que salió; quien llama verifica lo que necesita.
export async function descargarYExtraer(url, destino, fetch = globalThis.fetch, { tolerante = false, log = () => {} } = {}) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`descarga respondió ${res.status}`);
  fs.mkdirSync(destino, { recursive: true });
  const zip = path.join(destino, 'descarga.zip');
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  const r = ejecutar(tarDelSistema(), ['-xf', zip, '-C', destino]);
  fs.rmSync(zip, { force: true });
  const carpetas = fs.readdirSync(destino, { withFileTypes: true }).filter((d) => d.isDirectory());
  if (r.codigo !== 0) {
    if (!tolerante || carpetas.length !== 1) throw new Error(`no se pudo descomprimir (${ultimaLinea(r.salida)})`);
    log(`   · tar avisó: ${ultimaLinea(r.salida)} (sigo con lo que se extrajo)`);
  }
  if (carpetas.length !== 1) throw new Error('el ZIP no tiene la forma esperada');
  return path.join(destino, carpetas[0].name);
}

// ¿Hay un Git de verdad? Se averigua SIN llamar a git:
// - Mac: /usr/bin/git existe siempre, pero en un Mac nuevo es un señuelo que abre la ventana de
//   "instalar herramientas de desarrollador". `xcode-select -p` sale 0 solo si están instaladas
//   (y no abre ninguna ventana). Homebrew también las exige, así que esto cubre su Git.
// - Windows: `where git` (where.exe) busca en el PATH sin ejecutar nada.
// - Otros: un archivo `git` en el PATH.
export function hayGitDeVerdad({ plataforma = process.platform, correr = ejecutar, env = process.env, existe = fs.existsSync } = {}) {
  if (plataforma === 'darwin') return correr('xcode-select', ['-p'], { env }).codigo === 0;
  if (plataforma === 'win32') return correr('where', ['git'], { env }).codigo === 0;
  const rutaPATH = env.PATH ?? '';
  return rutaPATH.split(':').filter(Boolean).some((d) => existe(path.posix.join(d, 'git')));
}

// ---------- registro de lo instalado ----------

const archivoInstalado = (env) => path.join(dirDatos(env), 'instalado.json');

function leerInstalado(env) {
  try { return leerJson(archivoInstalado(env), {}); } catch { return {}; }
}

function guardarInstalado(env, cambios) {
  const actual = { ...leerInstalado(env), ...cambios, actualizado: new Date().toISOString() };
  escribirAtomico(archivoInstalado(env), `${JSON.stringify(actual, null, 2)}\n`);
}

// ---------- pasos ----------

const PASO = {
  async node() {
    const v = process.versions.node;
    if (versionSuficiente(v)) return { estado: 'ok', detalle: `Node ${v}` };
    return { estado: 'error', detalle: `Node ${v} es viejo (se necesita 22.13 o más). ${instruccionesNode()}` };
  },

  async dependencias({ repo, enSeco, correr }) {
    const dir = path.join(repo, 'whatsapp');
    if (!fs.existsSync(path.join(dir, 'package.json'))) return { estado: 'aviso', detalle: 'no encontré whatsapp/package.json' };
    if (enSeco) return { estado: 'ok', detalle: 'instalaría las dependencias de WhatsApp (npm install)' };
    const [prog, args] = comandoNpm('npm', ['install', '--omit=dev', '--no-audit', '--no-fund']);
    const r = correr(prog, args, { cwd: dir });
    if (r.codigo !== 0) return { estado: 'error', detalle: `npm install falló: ${ultimaLinea(r.salida)}` };
    return { estado: 'ok', detalle: 'dependencias de WhatsApp listas' };
  },

  async skills({ repo, env, enSeco }) {
    const origen = path.join(repo, 'skills');
    if (!fs.existsSync(origen)) return { estado: 'aviso', detalle: 'el repo no trae carpeta skills/' };
    const nombres = fs.readdirSync(origen, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(origen, d.name, 'SKILL.md')))
      .map((d) => d.name).sort();
    const destino = path.join(dirClaude(env), 'skills');
    const previas = leerInstalado(env).skills ?? [];
    const copiadas = [];
    const ajenas = [];
    for (const n of nombres) {
      const d = path.join(destino, n);
      // Solo se pisa una carpeta que puso este repo; una skill propia de la persona no se toca.
      if (fs.existsSync(d) && !previas.includes(n)) { ajenas.push(n); continue; }
      if (!enSeco) {
        fs.rmSync(d, { recursive: true, force: true });
        fs.cpSync(path.join(origen, n), d, { recursive: true });
      }
      copiadas.push(n);
    }
    // Skills que este repo instaló antes y ya no trae: se quitan.
    const sobrantes = previas.filter((n) => !nombres.includes(n));
    if (!enSeco) {
      for (const n of sobrantes) fs.rmSync(path.join(destino, n), { recursive: true, force: true });
      guardarInstalado(env, { skills: copiadas });
    }
    const verbo = enSeco ? 'copiaría' : 'copiadas';
    let detalle = `${copiadas.length} skill(s) ${verbo}`;
    if (sobrantes.length) detalle += `, ${sobrantes.length} vieja(s) ${enSeco ? 'quitaría' : 'quitadas'}`;
    if (ajenas.length) {
      return { estado: 'aviso', detalle: `${detalle}; no toqué ${ajenas.join(', ')} porque ya tenías una skill con ese nombre` };
    }
    return { estado: 'ok', detalle };
  },

  async terceros({ repo, env, enSeco, correr, fetch, log, hayGit }) {
    const lista = leerJson(path.join(repo, 'setup', 'skills-terceros.json'), { repos: [] }).repos;
    const destino = path.join(dirClaude(env), 'skills');
    const instaladas = [];
    const fallidas = [];
    let pendientes = 0;
    // `npx skills add` clona con git. Sin un Git de verdad ni se intenta: se va directo al ZIP.
    let conGit = null;
    for (const { fuente, rutas } of lista) {
      const faltan = Object.keys(rutas).filter((n) => !fs.existsSync(path.join(destino, n, 'SKILL.md')));
      instaladas.push(...Object.keys(rutas).filter((n) => !faltan.includes(n)));
      if (!faltan.length) continue;
      pendientes += faltan.length;
      if (enSeco) { log(`   · instalaría ${faltan.join(', ')} desde ${fuente}`); continue; }
      log(`   · ${fuente}: ${faltan.join(', ')}`);
      if (conGit === null) {
        conGit = hayGit();
        if (!conGit) log('   · no hay Git en este computador: descargo cada repo como ZIP');
      }
      if (conGit) {
        const [prog, args] = comandoNpm('npx', [
          '-y', 'skills', 'add', fuente, '-g', '-y', '-a', 'claude-code', '--copy', '-s', ...faltan,
        ]);
        correr(prog, args, { env: { ...env, CI: '1', NO_COLOR: '1' } });
      }
      let siguen = faltan.filter((n) => !fs.existsSync(path.join(destino, n, 'SKILL.md')));
      if (siguen.length) {
        // Plan B (sin Git o si npx falló): bajar el ZIP del repo y copiar cada carpeta.
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-skill-'));
        try {
          // Repos grandes a veces cortan la descarga a medias ("terminated"): un reintento.
          const url = `https://github.com/${fuente}/archive/HEAD.zip`;
          let raiz;
          try {
            raiz = await descargarYExtraer(url, tmp, fetch, { tolerante: true, log });
          } catch (e) {
            log(`   · reintento ${fuente} (${e.message})`);
            fs.rmSync(tmp, { recursive: true, force: true });
            raiz = await descargarYExtraer(url, tmp, fetch, { tolerante: true, log });
          }
          for (const n of siguen) {
            const src = path.join(raiz, rutas[n]);
            if (!fs.existsSync(path.join(src, 'SKILL.md'))) { log(`   · ${n}: no está en ${rutas[n]} dentro del ZIP`); continue; }
            const d = path.join(destino, n);
            fs.rmSync(d, { recursive: true, force: true });
            // dereference: los repos a veces usan enlaces simbólicos; se copia el contenido real.
            fs.cpSync(src, d, { recursive: true, dereference: true });
          }
        } catch (e) {
          log(`   · plan B falló para ${fuente}: ${e.message}`);
        } finally {
          fs.rmSync(tmp, { recursive: true, force: true });
        }
        siguen = siguen.filter((n) => !fs.existsSync(path.join(destino, n, 'SKILL.md')));
      }
      fallidas.push(...siguen);
      instaladas.push(...faltan.filter((n) => !siguen.includes(n)));
    }
    if (!enSeco) guardarInstalado(env, { terceros: instaladas.sort() });
    if (enSeco) return { estado: 'ok', detalle: pendientes ? `instalaría ${pendientes} skill(s) de terceros` : 'todas ya instaladas' };
    if (fallidas.length) return { estado: 'aviso', detalle: `no se pudieron instalar: ${fallidas.join(', ')} (lo demás sí)` };
    return { estado: 'ok', detalle: `${instaladas.length} skill(s) de terceros listas` };
  },

  async hooks({ repo, env, enSeco }) {
    const lista = path.join(repo, 'hooks', 'hooks.json');
    if (!fs.existsSync(lista)) return { estado: 'aviso', detalle: 'el repo no trae hooks/hooks.json' };
    const definiciones = leerJson(lista, []);
    const registros = [];
    const faltan = [];
    for (const h of definiciones) {
      const ruta = path.join(repo, 'hooks', h.archivo);
      if (!fs.existsSync(ruta)) { faltan.push(h.archivo); continue; }
      registros.push({ evento: h.evento, matcher: h.matcher, command: comandoHook(ruta), timeout: h.timeout });
    }
    if (!repo.includes(MARCA)) {
      return { estado: 'error', detalle: `la carpeta del repo debe llamarse "${MARCA}" para poder reconocer sus hooks` };
    }
    const archivo = path.join(dirClaude(env), 'settings.json');
    let actual;
    try { actual = leerJson(archivo, {}); } catch {
      return { estado: 'error', detalle: 'tu settings.json tiene un error de formato; no lo toqué' };
    }
    const nuevo = fusionarHooks(actual, registros);
    const sufijo = faltan.length ? ` (faltan archivos: ${faltan.join(', ')})` : '';
    const estado = faltan.length ? 'aviso' : 'ok';
    if (JSON.stringify(nuevo) === JSON.stringify(actual)) return { estado, detalle: `${registros.length} hook(s) ya registrados${sufijo}` };
    if (enSeco) return { estado, detalle: `registraría ${registros.length} hook(s) en settings.json${sufijo}` };
    const copia = `${archivo}.antes-de-mi-claude`;
    if (fs.existsSync(archivo) && !fs.existsSync(copia)) fs.copyFileSync(archivo, copia);
    escribirAtomico(archivo, `${JSON.stringify(nuevo, null, 2)}\n`);
    return { estado, detalle: `${registros.length} hook(s) registrados${sufijo}` };
  },

  async metodo({ repo, env, enSeco }) {
    const origen = path.join(repo, 'metodo', 'CLAUDE.md');
    if (!fs.existsSync(origen)) return { estado: 'aviso', detalle: 'el repo no trae metodo/CLAUDE.md' };
    const archivo = path.join(dirClaude(env), 'CLAUDE.md');
    const actual = fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8') : '';
    const nuevo = fusionarBloque(actual, fs.readFileSync(origen, 'utf8'));
    if (nuevo === actual) return { estado: 'ok', detalle: 'el método ya está en tu CLAUDE.md' };
    if (enSeco) return { estado: 'ok', detalle: 'agregaría el método a tu CLAUDE.md (sin tocar lo demás)' };
    escribirAtomico(archivo, nuevo);
    return { estado: 'ok', detalle: 'método agregado a tu CLAUDE.md' };
  },

  async mcp({ env, enSeco, correr, existe, log }) {
    const secretos = { ...leerSecretos(env) };
    for (const k of ['PARALLEL_API_KEY', 'COMPOSIO_CONSUMER_KEY']) if (env[k]) secretos[k] = env[k];
    const servidores = servidoresMcp(secretos);
    const claude = buscarClaude({ env, existe });
    const notas = secretos.COMPOSIO_CONSUMER_KEY ? '' : ' · Composio (email) se agrega cuando guardes su key';
    if (!claude) {
      if (enSeco) return { estado: 'aviso', detalle: `no encontré "claude"; agregaría ${servidores.map((s) => s.nombre).join(', ')}${notas}` };
      return { estado: 'error', detalle: instruccionesClaude() };
    }
    const hechos = [];
    for (const s of servidores) {
      const args = argsMcpAdd(s);
      if (enSeco) { log(`   · claude ${argsParaMostrar(args).join(' ')}`); hechos.push(s.nombre); continue; }
      correr(claude, ['mcp', 'remove', s.nombre, '--scope', 'user'], { env });
      const r = correr(claude, args, { env });
      if (r.codigo !== 0) return { estado: 'error', detalle: `no se pudo agregar ${s.nombre}: ${censurar(ultimaLinea(r.salida), secretos)}` };
      hechos.push(s.nombre);
    }
    return { estado: 'ok', detalle: `${enSeco ? 'agregaría' : 'conectados'}: ${hechos.join(', ')}${notas}` };
  },

  async whatsapp({ repo, enSeco, correr, env }) {
    const arranque = path.join(repo, 'whatsapp', 'arranque.mjs');
    if (!fs.existsSync(arranque)) return { estado: 'aviso', detalle: 'el repo no trae whatsapp/arranque.mjs' };
    const args = [arranque, 'instalar', ...(enSeco ? ['--en-seco'] : [])];
    const r = correr(process.execPath, args, { cwd: path.dirname(arranque), env });
    if (r.codigo !== 0) return { estado: 'error', detalle: `el servicio de WhatsApp no arrancó: ${ultimaLinea(r.salida)}` };
    if (enSeco) return { estado: 'ok', detalle: 'el arranque del servicio respondió bien en seco (no instaló nada)' };
    // La salida puede traer el contenido de archivos de configuración (XML, VBS): se toma la última frase legible.
    const frase = String(r.salida).trim().split(/\r?\n/).reverse().find((l) => l.trim() && !/^\s*</.test(l));
    return { estado: 'ok', detalle: frase?.trim() || 'servicio de WhatsApp instalado' };
  },
};

const NOMBRE = {
  node: 'Node', dependencias: 'Dependencias', skills: 'Skills', terceros: 'Skills de terceros',
  hooks: 'Hooks', metodo: 'Método (CLAUDE.md)', mcp: 'Búsqueda y email (MCP)', whatsapp: 'Servicio de WhatsApp',
};

export function leerArgs(argv) {
  const opciones = { enSeco: false, solo: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--en-seco') opciones.enSeco = true;
    else if (a === '--solo') opciones.solo = argv[++i];
    else if (a.startsWith('--solo=')) opciones.solo = a.slice(7);
  }
  if (opciones.solo) {
    opciones.solo = opciones.solo.split(',').map((s) => s.trim().toLowerCase().replace('é', 'e')).filter(Boolean);
    const malos = opciones.solo.filter((s) => !PASOS.includes(s));
    if (malos.length) throw new Error(`Paso desconocido: ${malos.join(', ')}. Opciones: ${PASOS.join(', ')}`);
    // El servicio de WhatsApp necesita sus dependencias: "--solo whatsapp" las incluye.
    if (opciones.solo.includes('whatsapp') && !opciones.solo.includes('dependencias')) opciones.solo.push('dependencias');
  }
  return opciones;
}

export async function instalar({
  enSeco = false, solo = null, env = process.env, repo = REPO, log = console.log,
  correr = ejecutar, fetch = globalThis.fetch, existe = (r) => { try { return fs.statSync(r).isFile(); } catch { return false; } },
  hayGit = () => hayGitDeVerdad({ correr, env }),
} = {}) {
  const pasos = solo ? PASOS.filter((p) => solo.includes(p)) : PASOS;
  log(enSeco ? '🔎 Modo en seco: muestro lo que haría, sin cambiar nada.\n' : '🛠  Instalando mi-claude…\n');
  const resultados = [];
  for (const id of pasos) {
    let r;
    try {
      r = await PASO[id]({ repo, env, enSeco, correr, fetch, existe, log, hayGit });
    } catch (e) {
      r = { estado: 'error', detalle: e.message };
    }
    resultados.push({ paso: id, ...r });
    log(`${ICONO[r.estado]} ${NOMBRE[id]}: ${r.detalle}`);
  }
  const errores = resultados.filter((r) => r.estado === 'error').length;
  const avisos = resultados.filter((r) => r.estado === 'aviso').length;
  log('\n— Resumen —');
  if (!errores && !avisos) log(`✅ Todo listo (${resultados.length} pasos).`);
  else log(`${resultados.length - errores - avisos} bien · ${avisos} con aviso · ${errores} con error`);
  if (!enSeco) log('Siguiente: corre  node setup/doctor.mjs  para ver qué falta.');
  return resultados;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const r = await instalar(leerArgs(process.argv.slice(2)));
    if (r.some((x) => x.estado === 'error')) process.exitCode = 1;
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exitCode = 1;
  }
}
