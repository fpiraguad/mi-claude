import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main, esperarTarea, urlsDeResultado, BASE, MODELO_IMAGEN } from '../skills/apimart/scripts/apimart.mjs';

const KEY = 'sk-' + 'b'.repeat(40);
const ENV = { APIMART_API_KEY: KEY, MI_CLAUDE_DIR: '/no/existe' };
const sinEspera = { dormir: async () => {}, aviso: () => {} };

// fetch simulado: cada ruta puede ser una respuesta fija o una lista que se consume en orden.
function falsoFetch(rutas) {
  const llamadas = [];
  const fn = async (url, opciones = {}) => {
    const metodo = opciones.method || 'GET';
    llamadas.push({ url, metodo, headers: opciones.headers || {}, body: opciones.body });
    const clave = `${metodo} ${url.startsWith(BASE) ? url.slice(BASE.length) : url}`;
    let r = rutas[clave];
    if (r === undefined) return new Response(JSON.stringify({ error: { message: `no simulado: ${clave}` } }), { status: 404 });
    if (r?.secuencia) r = r.secuencia.length > 1 ? r.secuencia.shift() : r.secuencia[0];
    const [status, cuerpo] = Array.isArray(r) ? r : [200, r];
    const body = cuerpo instanceof Uint8Array || typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    return new Response(body, { status });
  };
  fn.llamadas = llamadas;
  return fn;
}

async function correr(argv, rutas, { env = ENV, espera = sinEspera } = {}) {
  const salida = [];
  const fetch = falsoFetch(rutas);
  const codigo = await main(argv, { env, fetch, out: (s) => salida.push(s), err: () => {}, espera });
  return { codigo, texto: salida.join('\n'), llamadas: fetch.llamadas };
}

const tarea = (status, extra = {}) => ({ code: 200, data: { id: 'task_1', status, ...extra } });

test('sin key: error claro en español', async () => {
  await assert.rejects(correr(['saldo'], {}, { env: { MI_CLAUDE_DIR: '/no/existe' } }), /Falta la key de APIMart \(APIMART_API_KEY\)/);
});

test('saldo: GET /v1/user/balance con Bearer, texto y --json', async () => {
  const saldo = { success: true, remain_balance: 12.5, remain_credits: 125, used_balance: 3, used_credits: 30 };
  const r = await correr(['saldo'], { 'GET /v1/user/balance': saldo });
  assert.equal(r.llamadas[0].headers.Authorization, `Bearer ${KEY}`);
  assert.match(r.texto, /Saldo disponible: \$12\.5/);
  assert.ok(!r.texto.includes(KEY));
  const j = await correr(['saldo', '--json'], { 'GET /v1/user/balance': saldo });
  assert.equal(JSON.parse(j.texto).remain_balance, 12.5);
});

test('401 y 402: mensajes claros', async () => {
  await assert.rejects(correr(['saldo'], { 'GET /v1/user/balance': [401, { error: { message: 'bad' } }] }), /rechazó la key/);
  await assert.rejects(correr(['saldo'], { 'GET /v1/user/balance': [402, { error: { message: 'no money' } }] }), /saldo suficiente/);
});

test('imagen: cuerpo correcto, sondea hasta completed y descarga', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-a-'));
  const salida = path.join(dir, 'gato.png');
  const r = await correr(['imagen', 'un gato astronauta', '--tamano', '2:3', '--salida', salida], {
    'POST /v1/images/generations': { code: 200, data: [{ status: 'submitted', task_id: 'task_1' }] },
    'GET /v1/tasks/task_1?language=es': { secuencia: [tarea('pending'), tarea('processing', { progress: 50 }),
      tarea('completed', { cost: 0.15, result: { images: [{ url: ['https://upload.apimart.ai/f/x.png'], expires_at: 1 }] } })] },
    'GET https://upload.apimart.ai/f/x.png': new Uint8Array([137, 80, 78, 71]),
  });
  const post = r.llamadas[0];
  assert.equal(post.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(post.body), { model: MODELO_IMAGEN, prompt: 'un gato astronauta', size: '2:3', n: 1 });
  assert.equal(r.llamadas.filter((l) => l.url.includes('/v1/tasks/')).length, 3);
  assert.deepEqual([...fs.readFileSync(salida)], [137, 80, 78, 71]);
  assert.match(r.texto, /Guardada en: .*gato\.png/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('esperarTarea: se detiene al fallar, con el motivo', async () => {
  let n = 0;
  const cli = { tarea: async () => (++n < 2 ? tarea('processing') : tarea('failed', { error: { message: 'contenido no permitido' } })) };
  await assert.rejects(esperarTarea(cli, 'task_1', sinEspera), /falló: contenido no permitido/);
  assert.equal(n, 2);
});

test('esperarTarea: se detiene por tiempo con espera creciente', async () => {
  let reloj = 0;
  const pausas = [];
  const cli = { tarea: async () => tarea('processing') };
  await assert.rejects(
    esperarTarea(cli, 'task_1', { maxMs: 30_000, ahora: () => reloj, dormir: async (ms) => { pausas.push(ms); reloj += ms; } }),
    /sigue en "processing" después de 30 s/,
  );
  assert.deepEqual(pausas.slice(0, 3), [2000, 3000, 4500]);
  assert.ok(pausas.every((p) => p <= 15_000));
  assert.ok(reloj <= 30_000);
});

test('video sin --confirmado: no gasta, solo vista previa', async () => {
  const r = await correr(['video', 'olas', '--formato', '9:16'], {});
  assert.equal(r.codigo, 2);
  assert.equal(r.llamadas.length, 0);
  assert.match(r.texto, /VISTA PREVIA/);
});

test('video --confirmado: POST /v1/videos/generations y descarga', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-a-'));
  const salida = path.join(dir, 'olas.mp4');
  const r = await correr(['video', 'olas', '--formato', '9:16', '--salida', salida, '--confirmado', '--json'], {
    'POST /v1/videos/generations': { code: 200, data: [{ task_id: 'task_1' }] },
    'GET /v1/tasks/task_1?language=es': tarea('completed', { result: { videos: [{ url: 'https://upload.apimart.ai/v.mp4' }] } }),
    'GET https://upload.apimart.ai/v.mp4': new Uint8Array([0, 0, 0, 24]),
  });
  assert.deepEqual(JSON.parse(r.llamadas[0].body), { model: 'veo3.1-fast', prompt: 'olas', aspect_ratio: '9:16', duration: 8 });
  const j = JSON.parse(r.texto);
  assert.equal(j.estado, 'completed');
  assert.ok(fs.existsSync(salida));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('transcribir: multipart con file, model whisper-1 e idioma', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-a-'));
  const audio = path.join(dir, 'nota.mp3');
  fs.writeFileSync(audio, Buffer.from('ID3fake'));
  const r = await correr(['transcribir', audio, '--idioma', 'es'], { 'POST /v1/audio/transcriptions': { text: 'Hola, esto es una prueba.' } });
  const { body, headers } = r.llamadas[0];
  assert.ok(body instanceof FormData);
  assert.equal(headers['Content-Type'], undefined, 'fetch pone el boundary del multipart');
  assert.equal(body.get('model'), 'whisper-1');
  assert.equal(body.get('language'), 'es');
  assert.equal(body.get('file').name, 'nota.mp3');
  assert.equal(body.get('file').type, 'audio/mpeg');
  assert.equal(r.texto, 'Hola, esto es una prueba.');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('tarea: muestra estado y URLs', async () => {
  const r = await correr(['tarea', 'task_1'], {
    'GET /v1/tasks/task_1?language=es': tarea('completed', { progress: 100, cost: 0.1, result: { images: [{ url: ['https://u/1.png', 'https://u/2.png'] }] } }),
  });
  assert.match(r.texto, /Tarea task_1: completed \(100%\)/);
  assert.match(r.texto, /https:\/\/u\/2\.png/);
});

test('urlsDeResultado acepta url como texto o lista', () => {
  assert.deepEqual(urlsDeResultado({ images: [{ url: 'https://a' }, { url: ['https://b', 'https://a'] }], x: 'no' }), ['https://a', 'https://b']);
  assert.deepEqual(urlsDeResultado(undefined), []);
});
