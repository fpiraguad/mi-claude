// Computador recién estrenado: sin Git (o con el señuelo de /usr/bin/git en Mac), sin Python y
// con PowerShell bloqueando npm.ps1. Nada del instalador debe llamar a git en ese caso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { instalar, hayGitDeVerdad, tarDelSistema, citarCmd, comandoNpm } from '../setup/instalar.mjs';
import { comandoHook } from '../setup/lib/claude.mjs';

const temporal = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-limpia-'));

// Un `correr` falso que anota cada programa y responde con el código pedido.
function espia(codigos = {}) {
  const llamadas = [];
  const correr = (programa, args) => {
    llamadas.push([programa, ...args].join(' '));
    return { codigo: codigos[path.basename(programa)] ?? 0, salida: '' };
  };
  return { correr, llamadas };
}

test('hayGitDeVerdad en Mac: pregunta a xcode-select y nunca invoca git', () => {
  const nuevo = espia({ 'xcode-select': 2 });
  assert.equal(hayGitDeVerdad({ plataforma: 'darwin', correr: nuevo.correr }), false);
  assert.deepEqual(nuevo.llamadas, ['xcode-select -p']);

  const conHerramientas = espia({ 'xcode-select': 0 });
  assert.equal(hayGitDeVerdad({ plataforma: 'darwin', correr: conHerramientas.correr }), true);
  assert.ok(!conHerramientas.llamadas.some((l) => /^git\b/.test(l)));
});

test('hayGitDeVerdad en Windows usa where.exe; en otros, busca el archivo en el PATH', () => {
  const sin = espia({ where: 1 });
  assert.equal(hayGitDeVerdad({ plataforma: 'win32', correr: sin.correr }), false);
  assert.deepEqual(sin.llamadas, ['where git']);
  assert.equal(hayGitDeVerdad({ plataforma: 'win32', correr: espia({ where: 0 }).correr }), true);

  const existe = (r) => r === '/opt/bin/git';
  assert.equal(hayGitDeVerdad({ plataforma: 'linux', env: { PATH: '/usr/bin:/opt/bin' }, existe }), true);
  assert.equal(hayGitDeVerdad({ plataforma: 'linux', env: { PATH: '/usr/bin' }, existe }), false);
});

test('tarDelSistema: bsdtar de System32 en Windows (no el GNU tar de Git) y /usr/bin/tar en Mac', () => {
  const todo = () => true;
  assert.equal(tarDelSistema({ plataforma: 'win32', env: { SystemRoot: 'C:\\Windows' }, existe: todo }), 'C:\\Windows\\System32\\tar.exe');
  assert.equal(tarDelSistema({ plataforma: 'darwin', existe: todo }), '/usr/bin/tar');
  assert.equal(tarDelSistema({ plataforma: 'win32', env: {}, existe: () => false }), 'tar');
});

test('citarCmd protege rutas con espacios y encabezados para cmd.exe', () => {
  assert.equal(citarCmd('mcp'), 'mcp');
  assert.equal(citarCmd('C:\\Users\\Ana María\\claude.cmd'), '"C:\\Users\\Ana María\\claude.cmd"');
  assert.equal(citarCmd('Authorization: Bearer x'), '"Authorization: Bearer x"');
  assert.equal(citarCmd('a"b c'), '"a""b c"');
});

test('comandoNpm corre npm con el mismo node (sin npm.ps1 ni npm.cmd)', () => {
  const [prog, args] = comandoNpm('npx', ['-y', 'x']);
  assert.equal(prog, process.execPath);
  assert.match(args[0], /npx-cli\.js$/);
  assert.deepEqual(args.slice(1), ['-y', 'x']);
});

test('comandoHook: ruta completa de node en Mac, `node` en Windows', () => {
  assert.equal(
    comandoHook('/Users/a/mi-claude/hooks/h.mjs', { plataforma: 'darwin', node: '/Users/a/.local/node/bin/node' }),
    '"/Users/a/.local/node/bin/node" "/Users/a/mi-claude/hooks/h.mjs"',
  );
  assert.equal(comandoHook('C:\\a\\mi-claude\\hooks\\h.mjs', { plataforma: 'win32', node: 'C:\\n\\node.exe' }), 'node "C:\\a\\mi-claude\\hooks\\h.mjs"');
});

function repoConTerceros(base) {
  const repo = path.join(base, 'mi-claude');
  fs.mkdirSync(path.join(repo, 'setup'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'setup', 'skills-terceros.json'), JSON.stringify({
    repos: [{ fuente: 'alguien/skills', rutas: { tercera: 'skills/tercera', otra: 'anidada/otra' } }],
  }));
  return repo;
}

test('terceros sin Git: no llama a npx ni a git y va directo al ZIP', async () => {
  const base = temporal();
  const repo = repoConTerceros(base);
  const { correr, llamadas } = espia();
  const pedidas = [];
  const fetch = async (url) => { pedidas.push(url); return { ok: false, status: 404 }; };
  const [r] = await instalar({
    repo, env: { CLAUDE_CONFIG_DIR: path.join(base, 'claude'), MI_CLAUDE_DIR: path.join(base, 'datos') },
    solo: ['terceros'], log: () => {}, correr, fetch, hayGit: () => false,
  });
  assert.deepEqual(llamadas, []);
  assert.ok(pedidas.length >= 1);
  for (const u of pedidas) assert.equal(u, 'https://github.com/alguien/skills/archive/HEAD.zip');
  assert.equal(r.estado, 'aviso');
  assert.match(r.detalle, /tercera/);
  fs.rmSync(base, { recursive: true, force: true });
});

test('terceros con Git: intenta npx primero (con el node actual) y el ZIP solo si falta algo', async () => {
  const base = temporal();
  const repo = repoConTerceros(base);
  const { correr, llamadas } = espia();
  const fetch = async () => ({ ok: false, status: 404 });
  await instalar({
    repo, env: { CLAUDE_CONFIG_DIR: path.join(base, 'claude'), MI_CLAUDE_DIR: path.join(base, 'datos') },
    solo: ['terceros'], log: () => {}, correr, fetch, hayGit: () => true,
  });
  assert.equal(llamadas.length, 1);
  assert.ok(llamadas[0].startsWith(process.execPath));
  assert.match(llamadas[0], /skills add alguien\/skills/);
  fs.rmSync(base, { recursive: true, force: true });
});

// Arma un ZIP de verdad con el tar del sistema (bsdtar: Mac y Windows 10+). En Linux con GNU tar no se puede.
function zipDePrueba(base) {
  const fuente = path.join(base, 'fuente');
  const raiz = path.join(fuente, 'skills-main');
  fs.mkdirSync(path.join(raiz, 'skills', 'tercera'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'skills', 'tercera', 'SKILL.md'), '---\nname: tercera\n---\n');
  fs.mkdirSync(path.join(raiz, 'anidada', 'otra', 'datos'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'anidada', 'otra', 'SKILL.md'), '---\nname: otra\n---\n');
  fs.writeFileSync(path.join(raiz, 'anidada', 'otra', 'datos', 'a.txt'), 'hola');
  const zip = path.join(base, 'repo.zip');
  const r = spawnSync(tarDelSistema(), ['-a', '-cf', zip, '-C', fuente, 'skills-main'], { encoding: 'utf8' });
  return r.status === 0 && fs.existsSync(zip) ? fs.readFileSync(zip) : null;
}

test('terceros sin Git: el plan B baja el ZIP, lo extrae con tar y copia cada carpeta', async (t) => {
  const base = temporal();
  const datosZip = zipDePrueba(base);
  if (!datosZip) { t.skip('este tar no crea ZIP'); return; }
  const repo = repoConTerceros(base);
  const claude = path.join(base, 'claude');
  const fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => datosZip });
  const opciones = {
    repo, env: { CLAUDE_CONFIG_DIR: claude, MI_CLAUDE_DIR: path.join(base, 'datos') },
    solo: ['terceros'], log: () => {}, correr: espia().correr, fetch, hayGit: () => false,
  };
  const [r] = await instalar(opciones);
  assert.equal(r.estado, 'ok', r.detalle);
  assert.ok(fs.existsSync(path.join(claude, 'skills', 'tercera', 'SKILL.md')));
  assert.equal(fs.readFileSync(path.join(claude, 'skills', 'otra', 'datos', 'a.txt'), 'utf8'), 'hola');
  const [r2] = await instalar(opciones);
  assert.match(r2.detalle, /2 skill/);
  fs.rmSync(base, { recursive: true, force: true });
});
