import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { diagnosticar, formatear } from '../setup/doctor.mjs';
import { INICIO_METODO, FIN_METODO } from '../setup/lib/claude.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function entorno() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-doctor-'));
  const repo = path.join(base, 'mi-claude');
  fs.mkdirSync(path.join(repo, 'skills', 'uno'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'skills', 'uno', 'SKILL.md'), 'x');
  fs.mkdirSync(path.join(repo, 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'setup'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'hooks', 'hooks.json'), JSON.stringify([{ archivo: 'h.mjs', evento: 'Stop', timeout: 5 }]));
  fs.writeFileSync(path.join(repo, 'setup', 'skills-terceros.json'), JSON.stringify({ repos: [{ fuente: 'a/b', rutas: { tercera: 'x' } }] }));
  const claude = path.join(base, 'claude');
  fs.mkdirSync(claude, { recursive: true });
  return { base, repo, claude, env: { CLAUDE_CONFIG_DIR: claude, MI_CLAUDE_DIR: path.join(base, 'datos'), PATH: '', HOME: base } };
}

const keys = (ok) => async () => [
  { id: 'APIMART', nombre: 'APIMart', opcional: false, key: ok ? 'sk-…abcd' : '—', ok, detalle: ok ? 'saldo 3' : 'falta la key' },
  { id: 'COMPOSIO', nombre: 'Composio', opcional: false, key: ok ? 'ck_…abcd' : '—', ok, detalle: ok ? 'key válida' : 'falta la key' },
  { id: 'ELEVENLABS', nombre: 'ElevenLabs', opcional: true, key: '—', ok: false, detalle: 'falta la key' },
];

test('doctor con todo vacío: filas con forma correcta y acciones en "qué falta"', async () => {
  const { base, repo, env } = entorno();
  const r = await diagnosticar({
    env, repo, version: '22.13.1', listarKeys: keys(false),
    fetch: async () => { throw new Error('sin servicio'); }, existe: () => false,
  });
  assert.ok(Array.isArray(r.filas) && Array.isArray(r.falta));
  assert.equal(r.todoBien, false);
  for (const f of r.filas) {
    assert.equal(typeof f.id, 'string');
    assert.equal(typeof f.nombre, 'string');
    assert.ok(['ok', 'aviso', 'error', 'opcional'].includes(f.estado));
    assert.equal(typeof f.detalle, 'string');
  }
  const por = Object.fromEntries(r.filas.map((f) => [f.id, f]));
  assert.equal(por.node.estado, 'ok');
  assert.equal(por['servicio:APIMART'].accion, 'Di: "conecta mi APIMart"');
  assert.equal(por['servicio:ELEVENLABS'].estado, 'opcional');
  assert.equal(por.whatsapp.estado, 'error');
  assert.equal(por.mcp.estado, 'error');
  assert.equal(por.skills.estado, 'error');
  assert.equal(por.hooks.estado, 'error');
  assert.equal(por.metodo.estado, 'error');
  assert.ok(r.falta.includes('Di: "conecta mi Composio"'));
  assert.ok(r.falta.some((a) => a.startsWith('Di: "arranca mi WhatsApp"') && a.includes('wsp.mjs')));
  assert.equal(new Set(r.falta).size, r.falta.length, 'sin acciones repetidas');
  assert.ok(formatear(r).includes('Qué falta:'));
  fs.rmSync(base, { recursive: true, force: true });
});

test('doctor con todo listo da todoBien', async () => {
  const { base, repo, claude, env } = entorno();
  fs.mkdirSync(path.join(claude, 'skills', 'uno'), { recursive: true });
  fs.writeFileSync(path.join(claude, 'skills', 'uno', 'SKILL.md'), 'x');
  fs.mkdirSync(path.join(claude, 'skills', 'tercera'), { recursive: true });
  fs.writeFileSync(path.join(claude, 'skills', 'tercera', 'SKILL.md'), 'x');
  fs.writeFileSync(path.join(claude, 'settings.json'), JSON.stringify({
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node "/a/mi-claude/hooks/h.mjs"' }] }] },
  }));
  fs.writeFileSync(path.join(claude, 'CLAUDE.md'), `${INICIO_METODO}\nx\n${FIN_METODO}\n`);
  const r = await diagnosticar({
    env, repo, version: '22.20.0', listarKeys: keys(true),
    fetch: async () => ({ json: async () => ({ conectado: true }) }),
    existe: (p) => /[\\/]\.local[\\/]bin[\\/]claude(\.exe)?$/.test(p),
    listarMcp: () => 'parallel-search: https://search.parallel.ai/mcp (HTTP) - ✔ Connected\ncomposio: https://connect.composio.dev/mcp (HTTP) - ✔ Connected\n',
  });
  assert.deepEqual(r.filas.filter((f) => !['ok', 'opcional'].includes(f.estado)), []);
  assert.equal(r.todoBien, true);
  assert.deepEqual(r.falta, []);
  fs.rmSync(base, { recursive: true, force: true });
});

test('doctor --json imprime JSON válido y sale con 0', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-doctor-cli-'));
  const r = spawnSync(process.execPath, [path.join(REPO, 'setup', 'doctor.mjs'), '--json'], {
    encoding: 'utf8', timeout: 120_000,
    env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(base, 'c'), MI_CLAUDE_DIR: path.join(base, 'd'), PATH: '', HOME: base, USERPROFILE: base, MI_CLAUDE_WSP_PUERTO: '1' },
  });
  assert.equal(r.status, 0, r.stderr);
  const datos = JSON.parse(r.stdout);
  assert.ok(Array.isArray(datos.filas) && Array.isArray(datos.falta));
  fs.rmSync(base, { recursive: true, force: true });
});
