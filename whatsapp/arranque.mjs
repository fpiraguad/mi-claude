#!/usr/bin/env node
// Deja el servicio de WhatsApp corriendo en segundo plano cada vez que inicias sesión,
// y crea el comando `wsp`. No necesita permisos de administrador.
//
//   node whatsapp/arranque.mjs instalar [--en-seco] [--puerto N]
//   node whatsapp/arranque.mjs quitar   [--en-seco]
//   node whatsapp/arranque.mjs estado
//
// Mac:     LaunchAgent ~/Library/LaunchAgents/local.mi-claude.whatsapp.plist (se reinicia solo si se cae)
//          + ~/.local/bin/wsp
// Windows: lanzador oculto mi-claude-whatsapp.vbs en la carpeta Inicio del usuario
//          + wsp.cmd en %LOCALAPPDATA%\Microsoft\WindowsApps (ya está en el PATH)
// --en-seco muestra lo que haría sin cambiar nada (lo usa la CI).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { DIR_WHATSAPP_CODIGO, ETIQUETA, puerto as puertoDeEntorno, rutasDatos } from './lib/config.mjs';
import { comandoNpm, ejecutar } from '../setup/instalar.mjs';

const escaparXml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const cadenaVbs = (s) => `"${String(s).replace(/"/g, '""')}"`;

// Variables que el servicio necesita ver aunque lo arranque el sistema y no una terminal.
export function variablesServicio({ puerto, env = process.env }) {
  const vars = { WSP_PUERTO: String(puerto) };
  if (env.MI_CLAUDE_DIR) vars.MI_CLAUDE_DIR = env.MI_CLAUDE_DIR;
  return vars;
}

export function generarPlist({ etiqueta = ETIQUETA, node, script, dirTrabajo, log, variables }) {
  if (!path.isAbsolute(node)) throw new Error('La ruta de node debe ser absoluta.');
  const env = Object.entries(variables)
    .map(([k, v]) => `      <key>${escaparXml(k)}</key>\n      <string>${escaparXml(v)}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escaparXml(etiqueta)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escaparXml(node)}</string>
    <string>${escaparXml(script)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escaparXml(dirTrabajo)}</string>
  <key>EnvironmentVariables</key>
  <dict>
${env}
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${escaparXml(log)}</string>
  <key>StandardErrorPath</key>
  <string>${escaparXml(log)}</string>
</dict>
</plist>
`;
}

// Lanzador oculto de Windows: corre node sin ventana, guarda la salida en el log y, si el
// servicio se cae, lo vuelve a arrancar a los 10 segundos.
export function generarVbs({ node, script, dirTrabajo, log, variables }) {
  if (!path.win32.isAbsolute(node)) throw new Error('La ruta de node debe ser absoluta.');
  const comando = `cmd /c ""${node}" "${script}" >> "${log}" 2>&1"`;
  const lineas = [
    "' mi-claude: arranca el servicio de WhatsApp sin ventana al iniciar sesión.",
    "' Lo crea whatsapp\\arranque.mjs; para quitarlo: node whatsapp\\arranque.mjs quitar",
    'Option Explicit',
    'Dim sh, comando',
    'Set sh = CreateObject("WScript.Shell")',
    ...Object.entries(variables).map(([k, v]) => `sh.Environment("PROCESS")(${cadenaVbs(k)}) = ${cadenaVbs(v)}`),
    `sh.CurrentDirectory = ${cadenaVbs(dirTrabajo)}`,
    `comando = ${cadenaVbs(comando)}`,
    'Do',
    '  sh.Run comando, 0, True',
    '  WScript.Sleep 10000',
    'Loop',
  ];
  return lineas.join('\r\n') + '\r\n';
}

export function generarWrapperMac({ node, wsp }) {
  return `#!/bin/sh\n# Comando wsp de mi-claude (lo crea whatsapp/arranque.mjs).\nexec "${node}" "${wsp}" "$@"\n`;
}

export function generarCmd({ node, wsp }) {
  // cmd lee el archivo con la página de códigos de la consola: si la ruta tiene tildes o eñes
  // se cambia a UTF-8 antes de leer la línea que la usa.
  const noAscii = /[^\x00-\x7f]/.test(node + wsp);
  return ['@echo off', 'rem Comando wsp de mi-claude (lo crea whatsapp\\arranque.mjs).', ...(noAscii ? ['chcp 65001 >nul'] : []), `"${node}" "${wsp}" %*`].join('\r\n') + '\r\n';
}

// Dónde va cada cosa según el sistema. `plataforma` y `home` se pueden fijar para probar.
export function rutasArranque({ plataforma = process.platform, home = os.homedir(), env = process.env } = {}) {
  if (plataforma === 'darwin') {
    return {
      lanzador: path.posix.join(home, 'Library', 'LaunchAgents', `${ETIQUETA}.plist`),
      comando: path.posix.join(home, '.local', 'bin', 'wsp'),
    };
  }
  if (plataforma === 'win32') {
    const appData = env.APPDATA || path.win32.join(home, 'AppData', 'Roaming');
    const localAppData = env.LOCALAPPDATA || path.win32.join(home, 'AppData', 'Local');
    return {
      lanzador: path.win32.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'mi-claude-whatsapp.vbs'),
      comando: path.win32.join(localAppData, 'Microsoft', 'WindowsApps', 'wsp.cmd'),
    };
  }
  return null;
}

// Arma todo lo que se va a escribir, sin tocar nada.
export function plan({ plataforma = process.platform, home = os.homedir(), env = process.env, node = process.execPath, puerto = puertoDeEntorno(env) } = {}) {
  const rutas = rutasArranque({ plataforma, home, env });
  if (!rutas) return null;
  const p = plataforma === 'win32' ? path.win32 : path;
  const datos = rutasDatos(env);
  const comun = {
    node,
    script: p.join(DIR_WHATSAPP_CODIGO, 'servicio.mjs'),
    dirTrabajo: DIR_WHATSAPP_CODIGO,
    log: datos.log,
    variables: variablesServicio({ puerto, env }),
  };
  const wsp = p.join(DIR_WHATSAPP_CODIGO, 'wsp.mjs');
  return {
    plataforma,
    puerto,
    rutas,
    dirLog: datos.dir,
    lanzador: plataforma === 'win32' ? generarVbs(comun) : generarPlist(comun),
    comando: plataforma === 'win32' ? generarCmd({ node, wsp }) : generarWrapperMac({ node, wsp }),
  };
}

// ─── Ejecución ───────────────────────────────────────────────────────────────

const correr = (cmd, args, opciones = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opciones });

function dependenciasListas() {
  return fs.existsSync(path.join(DIR_WHATSAPP_CODIGO, 'node_modules', 'baileys', 'package.json'));
}

// npm se corre con el mismo node (node npm-cli.js): no depende de npm.ps1 (bloqueado por la política
// de PowerShell) ni de npm.cmd con shell (cmd.exe parte "C:\Program Files\..." por el espacio).
function instalarDependencias() {
  const [prog, args] = comandoNpm('npm', ['install', '--omit=dev', '--no-audit', '--no-fund']);
  const r = ejecutar(prog, args, {
    cwd: DIR_WHATSAPP_CODIGO,
    stdio: 'inherit',
    env: { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}` },
  });
  if (r.codigo !== 0) throw new Error('No se pudieron instalar las dependencias de WhatsApp (npm install falló).');
}

function escribir(archivo, contenido, { modo, utf16 = false } = {}) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  // VBScript solo entiende tildes en la ruta si el archivo va en UTF-16 con BOM.
  const datos = utf16 ? Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(contenido, 'utf16le')]) : contenido;
  fs.writeFileSync(archivo, datos, modo ? { mode: modo } : undefined);
  if (modo && process.platform !== 'win32') fs.chmodSync(archivo, modo);
}

function launchctlDominio() {
  return `gui/${process.getuid()}`;
}

function detenerWindows(lanzador) {
  const servicio = path.join(DIR_WHATSAPP_CODIGO, 'servicio.mjs');
  const comillas = (s) => `'${s.replace(/'/g, "''")}'`;
  const filtro = (s) => `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains(${comillas(s)}) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  // Primero el lanzador (si no, vuelve a arrancar el servicio), después el servicio.
  correr('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `${filtro(path.basename(lanzador))}; ${filtro(servicio)}`], { windowsHide: true });
}

// Solo se toca un comando `wsp` que hayamos creado nosotros: otro programa podría tener uno.
const MARCA = 'Comando wsp de mi-claude';
export function esNuestro(archivo) {
  try {
    return fs.readFileSync(archivo, 'utf8').includes(MARCA);
  } catch {
    return false;
  }
}

function escribirComando(archivo, contenido, opciones) {
  if (fs.existsSync(archivo) && !esNuestro(archivo)) {
    console.log(`   Aviso: ya existe otro ${archivo} que no es de mi-claude; no lo toco. Usa node "${path.join(DIR_WHATSAPP_CODIGO, 'wsp.mjs')}".`);
    return;
  }
  escribir(archivo, contenido, opciones);
}

function enPath(dir) {
  return (process.env.PATH || '').split(path.delimiter).some((d) => path.resolve(d) === path.resolve(dir));
}

async function consultarEstado(puerto) {
  try {
    const r = await fetch(`http://127.0.0.1:${puerto}/estado`, { signal: AbortSignal.timeout(3000) });
    return await r.json();
  } catch {
    return null;
  }
}

async function instalar({ enSeco, puerto }) {
  const p = plan({ puerto });
  if (!p) throw new Error('Este sistema no es Mac ni Windows: arranca el servicio a mano con node whatsapp/servicio.mjs');
  const pasos = [];
  if (!dependenciasListas()) pasos.push('instalar dependencias (npm install en la carpeta whatsapp)');
  pasos.push(`crear carpeta de datos ${p.dirLog}`);
  pasos.push(`escribir ${p.rutas.lanzador}`);
  pasos.push(`escribir el comando wsp en ${p.rutas.comando}`);
  pasos.push(p.plataforma === 'darwin' ? `cargar ${ETIQUETA} con launchctl` : 'arrancar el lanzador oculto ahora mismo');

  if (enSeco) {
    console.log(`[en seco] Node: ${process.execPath} · puerto ${p.puerto}`);
    for (const paso of pasos) console.log(`[en seco] ${paso}`);
    console.log(`[en seco] --- ${path.basename(p.rutas.lanzador)} ---\n${p.lanzador}`);
    return;
  }

  if (!dependenciasListas()) instalarDependencias();
  fs.mkdirSync(p.dirLog, { recursive: true });

  if (p.plataforma === 'darwin') {
    escribir(p.rutas.lanzador, p.lanzador);
    escribirComando(p.rutas.comando, p.comando, { modo: 0o755 });
    const dominio = launchctlDominio();
    correr('launchctl', ['bootout', `${dominio}/${ETIQUETA}`]);
    let r = correr('launchctl', ['bootstrap', dominio, p.rutas.lanzador]);
    if (r.status !== 0) {
      correr('launchctl', ['unload', p.rutas.lanzador]);
      r = correr('launchctl', ['load', '-w', p.rutas.lanzador]);
      if (r.status !== 0) throw new Error(`launchctl no pudo cargar el servicio: ${(r.stderr || '').trim()}`);
    }
  } else {
    detenerWindows(p.rutas.lanzador);
    escribir(p.rutas.lanzador, p.lanzador, { utf16: true });
    escribirComando(p.rutas.comando, p.comando);
    spawn('wscript.exe', [p.rutas.lanzador], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  }

  console.log(`✅ Servicio de WhatsApp instalado: arranca solo al iniciar sesión (puerto ${p.puerto}).`);
  console.log(`   Para vincular tu celular abre: http://127.0.0.1:${p.puerto}/vincular`);
  if (p.plataforma === 'darwin' && !enPath(path.dirname(p.rutas.comando))) {
    const perfiles = agregarAlPathMac(path.dirname(p.rutas.comando));
    console.log(`   Agregué ${path.dirname(p.rutas.comando)} al PATH en ${perfiles.join(', ')}: \`wsp\` funciona en terminales nuevas.`);
    console.log(`   Mientras tanto: node "${path.join(DIR_WHATSAPP_CODIGO, 'wsp.mjs')}" estado`);
  }
}

const MARCA_PATH = '# mi-claude: comando wsp';

// Mac: ~/.local/bin no siempre está en el PATH. Se agrega una sola vez a los perfiles de zsh y bash.
export function agregarAlPathMac(dir, home = os.homedir()) {
  const linea = `${MARCA_PATH}\nexport PATH="${dir}:$PATH"\n`;
  const tocados = [];
  for (const nombre of ['.zshrc', '.bash_profile']) {
    const archivo = path.join(home, nombre);
    const actual = fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8') : '';
    if (nombre === '.bash_profile' && !actual) continue;
    if (!actual.includes(MARCA_PATH)) fs.writeFileSync(archivo, `${actual}${actual && !actual.endsWith('\n') ? '\n' : ''}${linea}`);
    tocados.push(`~/${nombre}`);
  }
  return tocados;
}

function quitar({ enSeco }) {
  const p = plan();
  if (!p) throw new Error('Este sistema no es Mac ni Windows: no hay nada que quitar.');
  if (enSeco) {
    console.log(`[en seco] detener el servicio y borrar ${p.rutas.lanzador} y ${p.rutas.comando}`);
    console.log('[en seco] los datos (sesión y mensajes) en ~/.mi-claude/whatsapp se quedan');
    return;
  }
  if (p.plataforma === 'darwin') {
    const r = correr('launchctl', ['bootout', `${launchctlDominio()}/${ETIQUETA}`]);
    if (r.status !== 0 && fs.existsSync(p.rutas.lanzador)) correr('launchctl', ['unload', p.rutas.lanzador]);
  } else {
    detenerWindows(p.rutas.lanzador);
  }
  fs.rmSync(p.rutas.lanzador, { force: true });
  // El comando wsp solo se borra si es el nuestro.
  if (esNuestro(p.rutas.comando)) fs.rmSync(p.rutas.comando, { force: true });
  console.log('Servicio de WhatsApp quitado. Tus datos (sesión y mensajes) siguen guardados en ~/.mi-claude/whatsapp.');
}

async function estado() {
  const p = plan();
  if (p) {
    console.log(`Arranque automático: ${fs.existsSync(p.rutas.lanzador) ? 'instalado' : 'NO instalado'} (${p.rutas.lanzador})`);
    const cmd = !fs.existsSync(p.rutas.comando) ? 'no creado' : esNuestro(p.rutas.comando) ? p.rutas.comando : `${p.rutas.comando} existe pero NO es de mi-claude`;
    console.log(`Comando wsp: ${cmd}`);
  }
  const puerto = puertoDeEntorno();
  const e = await consultarEstado(puerto);
  if (!e) {
    console.log(`Servicio: no responde en http://127.0.0.1:${puerto}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Servicio: ${e.conexion} · ${e.chats} chats · ${e.mensajes} mensajes`);
  if (e.conexion !== 'conectado') console.log(`Para vincular: http://127.0.0.1:${puerto}/vincular`);
}

export async function main(argv = process.argv.slice(2)) {
  const [accion, ...resto] = argv;
  const enSeco = resto.includes('--en-seco');
  const i = resto.indexOf('--puerto');
  const puerto = i >= 0 ? Number(resto[i + 1]) : puertoDeEntorno();
  if (!Number.isInteger(puerto) || puerto <= 0 || puerto >= 65536) throw new Error('--puerto debe ser un número entre 1 y 65535.');
  if (accion === 'instalar') return instalar({ enSeco, puerto });
  if (accion === 'quitar') return quitar({ enSeco });
  if (accion === 'estado') return estado();
  console.log('Uso: node whatsapp/arranque.mjs instalar|quitar|estado [--en-seco] [--puerto N]');
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(`❌ ${e?.message || e}`);
    process.exit(1);
  });
}
