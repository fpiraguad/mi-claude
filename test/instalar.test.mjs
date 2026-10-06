import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  fusionarHooks, contarHooksNuestros, fusionarBloque, tieneBloque, buscarClaude,
  argsMcpAdd, argsParaMostrar, servidoresMcp, parsearMcpList, INICIO_METODO, FIN_METODO,
} from '../setup/lib/claude.mjs';
import { instalar, leerArgs, versionSuficiente, censurar } from '../setup/instalar.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporal = (p = 'mi-claude-test-') => fs.mkdtempSync(path.join(os.tmpdir(), p));

// ---------- settings.json ----------

const ajenos = {
  model: 'opus',
  permissions: { allow: ['Bash(ls:*)'] },
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node /otra/cosa.mjs', timeout: 5 }] }],
  },
};
const registros = [
  { evento: 'PreToolUse', matcher: 'Bash', command: 'node "/x/mi-claude/hooks/a.mjs"', timeout: 10 },
  { evento: 'PreToolUse', matcher: 'Bash', command: 'node "/x/mi-claude/hooks/b.mjs"', timeout: 10 },
  { evento: 'Stop', command: 'node "/x/mi-claude/hooks/c.mjs"', timeout: 30 },
];

test('fusionarHooks agrega los nuestros y conserva todo lo demás', () => {
  const r = fusionarHooks(ajenos, registros);
  assert.equal(r.model, 'opus');
  assert.deepEqual(r.permissions, ajenos.permissions);
  assert.equal(contarHooksNuestros(r), 3);
  assert.ok(r.hooks.PreToolUse.some((g) => g.hooks.some((h) => h.command === 'node /otra/cosa.mjs')));
  assert.equal(r.hooks.Stop[0].matcher, undefined);
  assert.equal(r.hooks.Stop[0].hooks[0].timeout, 30);
  assert.equal(ajenos.hooks.PreToolUse.length, 1, 'no muta el original');
});

test('fusionarHooks es idempotente y reemplaza hooks viejos', () => {
  const una = fusionarHooks(ajenos, registros);
  const dos = fusionarHooks(una, registros);
  assert.deepEqual(dos, una);
  const menos = fusionarHooks(dos, registros.slice(0, 1));
  assert.equal(contarHooksNuestros(menos), 1);
  assert.equal(menos.hooks.Stop, undefined, 'evento vacío se quita');
  assert.ok(menos.hooks.PreToolUse.some((g) => g.hooks.some((h) => h.command === 'node /otra/cosa.mjs')));
});

test('fusionarHooks funciona sin settings previos', () => {
  const r = fusionarHooks(undefined, registros.slice(2));
  assert.deepEqual(r, { hooks: { Stop: [{ hooks: [{ type: 'command', command: registros[2].command, timeout: 30 }] }] } });
});

// ---------- CLAUDE.md ----------

test('fusionarBloque agrega al final y reemplaza en la siguiente corrida', () => {
  const original = '# Mis reglas\n\nAlgo mío.\n';
  const una = fusionarBloque(original, 'Método v1');
  assert.ok(una.startsWith(original.trim()));
  assert.ok(tieneBloque(una));
  const dos = fusionarBloque(una, 'Método v2');
  assert.ok(dos.includes('Método v2') && !dos.includes('Método v1'));
  assert.ok(dos.includes('Algo mío.'));
  assert.equal(dos.split(INICIO_METODO).length, 2);
  assert.equal(fusionarBloque(dos, 'Método v2'), dos);
});

test('fusionarBloque respeta texto después del bloque', () => {
  const texto = `antes\n${INICIO_METODO}\nviejo\n${FIN_METODO}\ndespués\n`;
  assert.equal(fusionarBloque(texto, 'nuevo'), `antes\n${INICIO_METODO}\nnuevo\n${FIN_METODO}\ndespués\n`);
  assert.equal(fusionarBloque('', 'x'), `${INICIO_METODO}\nx\n${FIN_METODO}\n`);
});

// ---------- binario claude ----------

test('buscarClaude: PATH primero, luego ~/.local/bin y ~/.claude/local', () => {
  const env = { PATH: '/usr/bin:/opt/c', HOME: '/h' };
  assert.equal(buscarClaude({ env, plataforma: 'darwin', existe: (r) => r === '/opt/c/claude' }), '/opt/c/claude');
  assert.equal(buscarClaude({ env, plataforma: 'darwin', existe: (r) => r === '/h/.local/bin/claude' }), '/h/.local/bin/claude');
  assert.equal(buscarClaude({ env, plataforma: 'darwin', existe: (r) => r === '/h/.claude/local/claude' }), '/h/.claude/local/claude');
  assert.equal(buscarClaude({ env, plataforma: 'darwin', existe: () => false }), null);
});

test('buscarClaude en Windows usa USERPROFILE y claude.exe', () => {
  const env = { Path: 'C:\\Windows', USERPROFILE: 'C:\\Users\\ana' };
  const esperado = 'C:\\Users\\ana\\.local\\bin\\claude.exe';
  assert.equal(buscarClaude({ env, plataforma: 'win32', existe: (r) => r === esperado }), esperado);
});

// ---------- MCP ----------

test('servidoresMcp y argsMcpAdd: Composio solo con key; nunca se muestra el encabezado', () => {
  const sin = servidoresMcp({});
  assert.deepEqual(sin.map((s) => s.nombre), ['parallel-search']);
  assert.equal(sin[0].encabezados.length, 0);
  const falsa = 'ck_' + 'Z'.repeat(20);
  const con = servidoresMcp({ COMPOSIO_CONSUMER_KEY: falsa, PARALLEL_API_KEY: 'pk-secreta-123' });
  const args = argsMcpAdd(con[1]);
  assert.deepEqual(args.slice(0, 8), ['mcp', 'add', '--scope', 'user', '--transport', 'http', 'composio', 'https://connect.composio.dev/mcp']);
  assert.ok(args.includes(`x-consumer-api-key: ${falsa}`));
  const visible = argsParaMostrar(args).join(' ');
  assert.ok(!visible.includes(falsa));
  assert.ok(!argsParaMostrar(argsMcpAdd(con[0])).join(' ').includes('pk-secreta-123'));
  assert.ok(!censurar(`error con ${falsa}`, { K: falsa }).includes(falsa));
});

test('parsearMcpList entiende la salida de claude mcp list', () => {
  const salida = 'Checking MCP server health…\n\nparallel-search: https://search.parallel.ai/mcp (HTTP) - ✔ Connected\ncomposio: https://connect.composio.dev/mcp (HTTP) - ! Needs authentication\notro: npx algo - ✗ Failed to connect\n';
  const r = parsearMcpList(salida);
  assert.deepEqual(r.map((s) => [s.nombre, s.conectado, s.necesitaAuth]), [
    ['parallel-search', true, false], ['composio', false, true], ['otro', false, false],
  ]);
});

// ---------- instalar ----------

test('versionSuficiente y leerArgs', () => {
  assert.ok(versionSuficiente('22.13.0'));
  assert.ok(versionSuficiente('24.1.0'));
  assert.ok(!versionSuficiente('22.12.9'));
  assert.ok(!versionSuficiente('20.18.0'));
  assert.deepEqual(leerArgs(['--en-seco', '--solo', 'skills,método']), { enSeco: true, solo: ['skills', 'metodo'] });
  assert.throws(() => leerArgs(['--solo', 'nada']));
});

function fotografiar(dir) {
  const mapa = {};
  const recorrer = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { mapa[p] = 'dir'; recorrer(p); } else mapa[p] = fs.readFileSync(p, 'utf8');
    }
  };
  recorrer(dir);
  return mapa;
}

test('instalar --en-seco en carpetas temporales no cambia nada', () => {
  const casa = temporal();
  const claude = path.join(casa, 'claude');
  const datos = path.join(casa, 'datos');
  fs.mkdirSync(claude, { recursive: true });
  fs.writeFileSync(path.join(claude, 'settings.json'), JSON.stringify(ajenos));
  fs.writeFileSync(path.join(claude, 'CLAUDE.md'), '# mío\n');
  const antes = fotografiar(casa);
  const repoAntes = fotografiar(path.join(REPO, 'setup'));
  const r = spawnSync(process.execPath, [path.join(REPO, 'setup', 'instalar.mjs'), '--en-seco'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: casa, USERPROFILE: casa, CLAUDE_CONFIG_DIR: claude, MI_CLAUDE_DIR: datos, PATH: process.env.PATH },
    timeout: 120_000,
  });
  assert.ok(r.stdout.includes('Modo en seco'), r.stdout + r.stderr);
  assert.ok(r.stdout.includes('Resumen'));
  assert.deepEqual(fotografiar(casa), antes);
  assert.deepEqual(fotografiar(path.join(REPO, 'setup')), repoAntes);
  fs.rmSync(casa, { recursive: true, force: true });
});

test('instalar skills+hooks+metodo en un repo de prueba: idempotente y respeta lo ajeno', async () => {
  const base = temporal();
  const repo = path.join(base, 'mi-claude');
  fs.mkdirSync(path.join(repo, 'skills', 'uno'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'skills', 'uno', 'SKILL.md'), '---\nname: uno\n---\n');
  fs.mkdirSync(path.join(repo, 'skills', 'propia'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'skills', 'propia', 'SKILL.md'), 'del repo');
  fs.mkdirSync(path.join(repo, 'hooks'));
  fs.writeFileSync(path.join(repo, 'hooks', 'h.mjs'), '');
  fs.writeFileSync(path.join(repo, 'hooks', 'hooks.json'), JSON.stringify([{ archivo: 'h.mjs', evento: 'PreToolUse', matcher: 'Bash', timeout: 5 }]));
  fs.mkdirSync(path.join(repo, 'metodo'));
  fs.writeFileSync(path.join(repo, 'metodo', 'CLAUDE.md'), 'Trabaja con método.');

  const claude = path.join(base, 'claude');
  fs.mkdirSync(path.join(claude, 'skills', 'propia'), { recursive: true });
  fs.writeFileSync(path.join(claude, 'skills', 'propia', 'SKILL.md'), 'de la persona');
  fs.writeFileSync(path.join(claude, 'settings.json'), JSON.stringify(ajenos));
  fs.writeFileSync(path.join(claude, 'CLAUDE.md'), '# mío\n');
  const env = { CLAUDE_CONFIG_DIR: claude, MI_CLAUDE_DIR: path.join(base, 'datos') };
  const opciones = { repo, env, solo: ['skills', 'hooks', 'metodo'], log: () => {} };

  const r1 = await instalar(opciones);
  assert.deepEqual(r1.map((r) => r.estado), ['aviso', 'ok', 'ok']);
  const settings1 = fs.readFileSync(path.join(claude, 'settings.json'), 'utf8');
  const md1 = fs.readFileSync(path.join(claude, 'CLAUDE.md'), 'utf8');
  assert.equal(contarHooksNuestros(JSON.parse(settings1)), 1);
  assert.equal(JSON.parse(settings1).model, 'opus');
  assert.ok(md1.startsWith('# mío') && md1.includes('Trabaja con método.'));
  assert.ok(fs.existsSync(path.join(claude, 'skills', 'uno', 'SKILL.md')));
  assert.equal(fs.readFileSync(path.join(claude, 'skills', 'propia', 'SKILL.md'), 'utf8'), 'de la persona');
  assert.ok(fs.existsSync(path.join(claude, 'settings.json.antes-de-mi-claude')));

  await instalar(opciones);
  assert.equal(fs.readFileSync(path.join(claude, 'settings.json'), 'utf8'), settings1);
  assert.equal(fs.readFileSync(path.join(claude, 'CLAUDE.md'), 'utf8'), md1);
  const instalado = JSON.parse(fs.readFileSync(path.join(base, 'datos', 'instalado.json'), 'utf8'));
  assert.deepEqual(instalado.skills, ['uno']);
  fs.rmSync(base, { recursive: true, force: true });
});
