import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { guardar, verificar } from '../setup/keys.mjs';
import { leerSecretos, enmascarar } from '../setup/lib/secretos.mjs';

const entorno = () => ({ MI_CLAUDE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-')) });
const respuesta = (status, cuerpo = {}) => async () =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

test('guarda la key solo si la verificación pasa', async () => {
  const env = entorno();
  const r = await guardar('APIMART', 'sk-buena-123456', { env, fetch: respuesta(200, { success: true, remain_balance: 5 }) });
  assert.equal(r.guardada, true);
  assert.equal(leerSecretos(env).APIMART_API_KEY, 'sk-buena-123456');
});

test('una key rechazada no reemplaza la buena', async () => {
  const env = entorno();
  await guardar('APIMART', 'sk-buena-123456', { env, fetch: respuesta(200, { success: true }) });
  const r = await guardar('APIMART', 'sk-mala-999999', { env, fetch: respuesta(401) });
  assert.equal(r.guardada, false);
  assert.equal(leerSecretos(env).APIMART_API_KEY, 'sk-buena-123456');
});

test('rechaza la key con prefijo equivocado sin llamar a la red', async () => {
  let llamadas = 0;
  const r = await guardar('ZERNIO', 'ak_otra_cosa', { env: entorno(), fetch: async () => { llamadas++; } });
  assert.equal(r.guardada, false);
  assert.match(r.detalle, /sk_/);
  assert.equal(llamadas, 0);
});

test('limpia comillas y espacios de una key pegada', async () => {
  const env = entorno();
  await guardar('ZERNIO', '  "sk_pegada_con_comillas"  ', { env, fetch: respuesta(200, []) });
  assert.equal(leerSecretos(env).ZERNIO_API_KEY, 'sk_pegada_con_comillas');
});

test('conserva las demás keys al guardar una nueva', async () => {
  const env = entorno();
  await guardar('APIMART', 'sk-uno-123456', { env, fetch: respuesta(200, { success: true }) });
  await guardar('ZERNIO', 'sk_dos_123456', { env, fetch: respuesta(200, []) });
  const s = leerSecretos(env);
  assert.equal(s.APIMART_API_KEY, 'sk-uno-123456');
  assert.equal(s.ZERNIO_API_KEY, 'sk_dos_123456');
});

test('sin conexión no revienta: devuelve el motivo', async () => {
  const r = await verificar('APIMART', {
    env: { ...entorno(), APIMART_API_KEY: 'sk-x-123456' },
    fetch: async () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } }); },
  });
  assert.equal(r.ok, false);
  assert.match(r.detalle, /ENOTFOUND/);
});

test('el archivo de keys queda privado (600) en Mac/Linux', { skip: process.platform === 'win32' }, async () => {
  const env = entorno();
  await guardar('APIMART', 'sk-buena-123456', { env, fetch: respuesta(200, { success: true }) });
  const modo = fs.statSync(path.join(env.MI_CLAUDE_DIR, 'secrets.env')).mode & 0o777;
  assert.equal(modo, 0o600);
});

test('enmascarar nunca muestra la key entera', () => {
  const key = ['sk', 'abcdefghijklmnop1234'].join('-');
  const m = enmascarar(key);
  assert.ok(!m.includes('defghijklmnop'));
  assert.ok(m.endsWith('1234'));
});

test('servicio desconocido da un error claro', async () => {
  await assert.rejects(() => guardar('NOEXISTE', 'x', { env: entorno() }), /Servicio desconocido/);
});
