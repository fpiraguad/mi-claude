import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main, horario, tipoMedia, BASE } from '../skills/zernio/scripts/zernio.mjs';
import { leerKey } from '../skills/zernio/scripts/_keys.mjs';

const KEY = 'sk_' + 'a'.repeat(64);
const CUENTAS = [
  { _id: 'acc1', platform: 'instagram', username: 'mimarca', isActive: true },
  { _id: 'acc2', platform: 'tiktok', username: 'mimarca.tt', isActive: true },
];

// fetch simulado: responde según "MÉTODO ruta" y guarda cada llamada.
function falsoFetch(rutas) {
  const llamadas = [];
  const fn = async (url, opciones = {}) => {
    const metodo = opciones.method || 'GET';
    llamadas.push({ url, metodo, headers: opciones.headers || {}, body: opciones.body });
    const clave = `${metodo} ${url.replace(BASE, '')}`;
    const r = rutas[clave] ?? rutas[`${metodo} ${url}`];
    if (r === undefined) return new Response(JSON.stringify({ error: `no simulado: ${clave}` }), { status: 404 });
    const [status, cuerpo] = Array.isArray(r) ? r : [200, r];
    return new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), { status });
  };
  fn.llamadas = llamadas;
  return fn;
}

async function correr(argv, rutas, env = { ZERNIO_API_KEY: KEY, MI_CLAUDE_DIR: '/no/existe' }) {
  const salida = [];
  const fetch = falsoFetch(rutas);
  const codigo = await main(argv, { env, fetch, out: (s) => salida.push(s) });
  return { codigo, texto: salida.join('\n'), llamadas: fetch.llamadas };
}

test('sin key: error claro en español y sin llamar a la red', async () => {
  await assert.rejects(
    correr(['cuentas'], {}, { MI_CLAUDE_DIR: '/no/existe' }),
    /Falta la key de Zernio \(ZERNIO_API_KEY\)/,
  );
});

test('leerKey: entorno primero, luego secrets.env', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-z-'));
  fs.writeFileSync(path.join(dir, 'secrets.env'), '# comentario\nZERNIO_API_KEY="sk_archivo"\nOTRA=1\n');
  assert.equal(leerKey('ZERNIO_API_KEY', { MI_CLAUDE_DIR: dir }), 'sk_archivo');
  assert.equal(leerKey('ZERNIO_API_KEY', { MI_CLAUDE_DIR: dir, ZERNIO_API_KEY: 'sk_env' }), 'sk_env');
  assert.equal(leerKey('NO_ESTA', { MI_CLAUDE_DIR: dir }), '');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('cuentas: GET /accounts con Bearer y salida legible', async () => {
  const r = await correr(['cuentas'], { 'GET /accounts': { accounts: CUENTAS } });
  assert.equal(r.llamadas[0].url, `${BASE}/accounts`);
  assert.equal(r.llamadas[0].headers.Authorization, `Bearer ${KEY}`);
  assert.match(r.texto, /instagram @mimarca\s+id: acc1/);
  assert.ok(!r.texto.includes(KEY), 'nunca imprime la key');
});

test('cuentas --json devuelve JSON parseable', async () => {
  const r = await correr(['cuentas', '--json'], { 'GET /accounts': { accounts: CUENTAS } });
  assert.deepEqual(JSON.parse(r.texto).accounts.map((c) => c._id), ['acc1', 'acc2']);
});

test('401: mensaje de key inválida', async () => {
  await assert.rejects(correr(['perfiles'], { 'GET /profiles': [401, { error: 'Invalid API key' }] }), /rechazó la key \(401\)/);
});

test('conectar: crea perfil si no hay y devuelve authUrl', async () => {
  const r = await correr(['conectar', 'TikTok'], {
    'GET /profiles': { profiles: [] },
    'POST /profiles': [201, { profile: { _id: 'perf1', name: 'Mi perfil' } }],
    'GET /connect/tiktok?profileId=perf1': { authUrl: 'https://www.tiktok.com/auth?x=1' },
  });
  const post = r.llamadas.find((l) => l.metodo === 'POST');
  assert.deepEqual(JSON.parse(post.body), { name: 'Mi perfil' });
  assert.equal(post.headers['Content-Type'], 'application/json');
  assert.match(r.texto, /https:\/\/www\.tiktok\.com\/auth\?x=1/);
  assert.match(r.texto, /Creé un perfil nuevo/);
});

test('conectar: usa --perfil y traduce x -> twitter', async () => {
  const r = await correr(['conectar', 'x', '--perfil', 'p9', '--json'], {
    'GET /connect/twitter?profileId=p9': { authUrl: 'https://x.com/oauth' },
  });
  assert.equal(r.llamadas.length, 1);
  assert.equal(JSON.parse(r.texto).authUrl, 'https://x.com/oauth');
});

test('publicar sin --confirmado: solo vista previa, no crea el post', async () => {
  const r = await correr(['publicar', '--texto', 'Hola mundo', '--cuentas', 'acc1,acc2', '--media', 'https://cdn.x/a.jpg'], {
    'GET /accounts': { accounts: CUENTAS },
  });
  assert.equal(r.codigo, 2);
  assert.match(r.texto, /VISTA PREVIA/);
  assert.match(r.texto, /Hola mundo/);
  assert.match(r.texto, /instagram @mimarca, tiktok @mimarca\.tt/);
  assert.ok(!r.llamadas.some((l) => l.metodo === 'POST'));
});

test('publicar --confirmado: sube archivo local por presign y programa', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-z-'));
  const foto = path.join(dir, 'foto.png');
  fs.writeFileSync(foto, Buffer.from([1, 2, 3, 4]));
  const r = await correr(
    ['publicar', '--texto', 'Lanzamiento', '--cuentas', 'acc1', '--media', foto, 'https://cdn.x/clip.mp4',
      '--programar', '2027-01-01T12:00', '--zona', 'America/Bogota', '--confirmado'],
    {
      'GET /accounts': { accounts: CUENTAS },
      'POST /media/presign': { uploadUrl: 'https://s3.subida/put?sig=1', publicUrl: 'https://cdn.zernio/foto.png' },
      'PUT https://s3.subida/put?sig=1': '',
      'POST /posts': [201, { post: { _id: 'post1', status: 'scheduled' } }],
    },
  );
  const presign = r.llamadas.find((l) => l.url.endsWith('/media/presign'));
  assert.deepEqual(JSON.parse(presign.body), { filename: 'foto.png', contentType: 'image/png', size: 4 });
  const put = r.llamadas.find((l) => l.metodo === 'PUT');
  assert.equal(put.headers['Content-Type'], 'image/png');
  assert.ok(!put.headers.Authorization, 'no manda la key al almacenamiento externo');
  const cuerpo = JSON.parse(r.llamadas.find((l) => l.url.endsWith('/posts')).body);
  assert.deepEqual(cuerpo, {
    content: 'Lanzamiento',
    platforms: [{ platform: 'instagram', accountId: 'acc1' }],
    mediaItems: [{ type: 'image', url: 'https://cdn.zernio/foto.png' }, { type: 'video', url: 'https://cdn.x/clip.mp4' }],
    scheduledFor: '2027-01-01T12:00:00',
    timezone: 'America/Bogota',
  });
  assert.equal(r.codigo, 0);
  assert.match(r.texto, /quedó programado/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('publicar --confirmado sin programar: publishNow', async () => {
  const r = await correr(['publicar', '--texto', 'Ya', '--cuentas', 'acc2', '--confirmado', '--json'], {
    'GET /accounts': { accounts: CUENTAS },
    'POST /posts': [201, { post: { _id: 'p2', status: 'published', platforms: [{ platform: 'tiktok', platformPostUrl: 'https://tiktok.com/v/1' }] } }],
  });
  const cuerpo = JSON.parse(r.llamadas.at(-1).body);
  assert.equal(cuerpo.publishNow, true);
  assert.equal(cuerpo.scheduledFor, undefined);
  assert.equal(JSON.parse(r.texto).post._id, 'p2');
});

test('publicar con cuenta desconocida: error claro', async () => {
  await assert.rejects(
    correr(['publicar', '--texto', 'x', '--cuentas', 'nope', '--confirmado'], { 'GET /accounts': { accounts: CUENTAS } }),
    /No encuentro la cuenta con id nope/,
  );
});

test('estado y posts', async () => {
  const post = { _id: 'p1', status: 'failed', content: 'Hola', platforms: [{ platform: 'instagram', status: 'failed', errorMessage: 'formato' }] };
  const e = await correr(['estado', 'p1'], { 'GET /posts/p1': { post } });
  assert.match(e.texto, /p1\s+\[failed\]/);
  assert.match(e.texto, /instagram: failed \(formato\)/);
  const l = await correr(['posts', '--limite', '3'], { 'GET /posts?limit=3': { posts: [post], pagination: { page: 1 } } });
  assert.equal(l.llamadas[0].url, `${BASE}/posts?limit=3`);
  assert.match(l.texto, /Publicaciones:/);
});

test('horario y tipoMedia', () => {
  assert.deepEqual(horario('2027-01-01T17:00:00Z'), { scheduledFor: '2027-01-01T17:00:00', timezone: 'UTC' });
  assert.deepEqual(horario('2027-01-01T12:00-05:00'), { scheduledFor: '2027-01-01T17:00:00', timezone: 'UTC' });
  assert.throws(() => horario('mañana'), /no es válida/);
  assert.equal(tipoMedia('a/b/clip.MOV'), 'video');
  assert.equal(tipoMedia('https://x/y.jpg?v=2'), 'image');
});
