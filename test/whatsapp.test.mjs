import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  sinTildes, coincide, pareceNumero, normalizarNumero, indicativoInferido,
  interpretarReferencia, elegirChat, MENSAJE_SIN_INDICATIVO,
} from '../whatsapp/lib/resolver.mjs';
import {
  peticionTranscripcion, transcribirAudio, configuracionVoz, vozElevenLabs, URL_TRANSCRIPCION,
  MENSAJE_SIN_APIMART, MENSAJE_SIN_ELEVENLABS_KEY, MENSAJE_SIN_ELEVENLABS_VOZ,
} from '../whatsapp/lib/apis.mjs';
import { nodeCompatible, mensajeNodeViejo, puerto, rutasDatos } from '../whatsapp/lib/config.mjs';
import { duracionDeSalidaFfmpeg } from '../whatsapp/lib/medios.mjs';
import { htmlVincular } from '../whatsapp/lib/pagina.mjs';
import { generarPlist, generarVbs, generarCmd, generarWrapperMac, rutasArranque, plan, agregarAlPathMac } from '../whatsapp/arranque.mjs';
import { parsearArgs, qs, mencionesDe } from '../whatsapp/wsp.mjs';

const entorno = (extra = {}) => ({ MI_CLAUDE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-wsp-')), ...extra });

// ─── Resolver chats ──────────────────────────────────────────────────────────

test('sinTildes y coincide ignoran tildes, mayúsculas y orden de palabras', () => {
  assert.equal(sinTildes('  Mamá Ñandú '), 'mama nandu');
  assert.ok(coincide('maria jose', { nombre: 'José María Pérez', jid: '1@s.whatsapp.net' }));
  assert.ok(coincide('5730012', { nombre: 'Ana', jid: '573001234567@s.whatsapp.net' }));
  assert.ok(!coincide('pedro', { nombre: 'Ana', jid: '1@s.whatsapp.net' }));
});

test('pareceNumero distingue teléfonos de nombres', () => {
  assert.ok(pareceNumero('+57 300 123 4567'));
  assert.ok(pareceNumero('(300) 123-4567'));
  assert.ok(!pareceNumero('Ana 2'));
  assert.ok(!pareceNumero('123'));
});

test('normalizarNumero: internacional, con indicativo configurado, inferido o error', () => {
  assert.deepEqual(normalizarNumero('+57 300 123 4567'), { numero: '573001234567' });
  assert.deepEqual(normalizarNumero('0034 612 345 678'), { numero: '34612345678' });
  assert.deepEqual(normalizarNumero('573001234567'), { numero: '573001234567' });
  assert.deepEqual(normalizarNumero('300 123 4567', { indicativo: '+57' }), { numero: '573001234567' });
  assert.deepEqual(normalizarNumero('07700 900123', { indicativo: '44' }), { numero: '447700900123' });
  assert.deepEqual(normalizarNumero('612345678', { numeroPropio: '34600000000' }), { numero: '34612345678' });
  assert.deepEqual(normalizarNumero('3001234567'), { error: MENSAJE_SIN_INDICATIVO });
});

test('indicativoInferido saca el indicativo del número propio', () => {
  assert.equal(indicativoInferido('573009998888', '3001234567'), '57');
  assert.equal(indicativoInferido(null, '3001234567'), null);
  assert.equal(indicativoInferido('3001234567', '3001234567'), null);
});

test('interpretarReferencia: jid, número o nombre', () => {
  assert.deepEqual(interpretarReferencia('123-456@g.us'), { jid: '123-456@g.us' });
  assert.deepEqual(interpretarReferencia('+52 55 1234 5678'), { jid: '525512345678@s.whatsapp.net', porNumero: true });
  assert.deepEqual(interpretarReferencia('Tía Rosa'), { nombre: 'Tía Rosa' });
  assert.ok(interpretarReferencia('').error);
  assert.ok(interpretarReferencia('3001234567').error.includes('indicativo'));
});

test('elegirChat: exacto gana, único gana, varios piden aclarar, ninguno avisa', () => {
  const ana = { jid: 'a@s.whatsapp.net', nombre: 'Ana' };
  const anaMaria = { jid: 'b@s.whatsapp.net', nombre: 'Ana María' };
  const grupo = { jid: 'c@g.us', nombre: 'Ana y amigos', es_grupo: 1 };
  assert.deepEqual(elegirChat('ana', [ana, anaMaria]), { jid: ana.jid, nombre: 'Ana' });
  assert.deepEqual(elegirChat('María', [anaMaria]), { jid: anaMaria.jid, nombre: 'Ana María' });
  const r = elegirChat('an', [anaMaria, grupo]);
  assert.equal(r.ambiguo.length, 2);
  assert.equal(r.ambiguo[1].grupo, true);
  assert.match(elegirChat('Luis', []).error, /Luis/);
});

// ─── Transcripción con APIMart ───────────────────────────────────────────────

test('peticionTranscripcion arma el multipart con whisper-1 y Bearer', async () => {
  const { url, init } = peticionTranscripcion({ audio: Buffer.from('ogg'), nombreArchivo: 'x.ogg', key: 'sk-prueba', idioma: 'es' });
  assert.equal(url, URL_TRANSCRIPCION);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.authorization, 'Bearer sk-prueba');
  assert.equal(init.body.get('model'), 'whisper-1');
  assert.equal(init.body.get('language'), 'es');
  const archivo = init.body.get('file');
  assert.equal(archivo.name, 'x.ogg');
  assert.equal(await archivo.text(), 'ogg');
  const sinIdioma = peticionTranscripcion({ audio: Buffer.from('a'), key: 'k' });
  assert.equal(sinIdioma.init.body.get('language'), null);
});

test('sin key de APIMart el mensaje dice «configura APIMart»', async () => {
  assert.throws(() => peticionTranscripcion({ audio: Buffer.from('a'), key: '' }), { message: MENSAJE_SIN_APIMART });
  assert.match(MENSAJE_SIN_APIMART, /configura APIMart/i);
  let llamado = false;
  await assert.rejects(transcribirAudio(Buffer.from('a'), { env: entorno(), fetch: async () => { llamado = true; } }), /APIMart/);
  assert.equal(llamado, false);
});

test('transcribirAudio usa la key del entorno y devuelve el texto limpio', async () => {
  let visto;
  const fetch = async (url, init) => {
    visto = { url, init };
    return new Response(JSON.stringify({ text: '  hola\n  qué tal ' }), { status: 200 });
  };
  const texto = await transcribirAudio(Buffer.from('a'), { env: entorno({ APIMART_API_KEY: 'sk-x', WSP_IDIOMA: 'es' }), fetch });
  assert.equal(texto, 'hola qué tal');
  assert.equal(visto.url, URL_TRANSCRIPCION);
  assert.equal(visto.init.headers.authorization, 'Bearer sk-x');
});

test('transcribirAudio explica key rechazada y falta de saldo sin mostrar la key', async () => {
  const env = entorno({ APIMART_API_KEY: 'sk-secreta-123' });
  const con = (status) => async () => new Response('{}', { status });
  await assert.rejects(transcribirAudio(Buffer.from('a'), { env, fetch: con(401) }), (e) => /rechazó/.test(e.message) && !e.message.includes('sk-secreta'));
  await assert.rejects(transcribirAudio(Buffer.from('a'), { env, fetch: con(402) }), /saldo/);
});

// ─── ElevenLabs opcional ─────────────────────────────────────────────────────

test('voz: explica cómo configurar la key y el ID, sin voz por defecto', async () => {
  assert.deepEqual(configuracionVoz(entorno()), { error: MENSAJE_SIN_ELEVENLABS_KEY });
  assert.deepEqual(configuracionVoz(entorno({ ELEVENLABS_API_KEY: 'k' })), { error: MENSAJE_SIN_ELEVENLABS_VOZ });
  assert.deepEqual(configuracionVoz(entorno({ ELEVENLABS_API_KEY: 'k', ELEVENLABS_VOICE_ID: 'v1' })), { key: 'k', voz: 'v1' });
  assert.match(MENSAJE_SIN_ELEVENLABS_VOZ, /wsp configurar voz/);
  await assert.rejects(vozElevenLabs('hola', { env: entorno(), fetch: async () => assert.fail('no debe llamar') }), { message: MENSAJE_SIN_ELEVENLABS_KEY });
});

test('voz: pide el MP3 con la voz configurada', async () => {
  let url;
  const mp3 = await vozElevenLabs('hola', {
    env: entorno({ ELEVENLABS_API_KEY: 'k', ELEVENLABS_VOICE_ID: 'mi-voz' }),
    fetch: async (u) => {
      url = u;
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    },
  });
  assert.match(url, /text-to-speech\/mi-voz\?/);
  assert.equal(mp3.length, 3);
});

// ─── Configuración y utilidades ──────────────────────────────────────────────

test('nodeCompatible exige 22.13+ (o 23.4+)', () => {
  assert.ok(nodeCompatible('22.13.0'));
  assert.ok(nodeCompatible('v24.1.0'));
  assert.ok(nodeCompatible('23.4.0'));
  assert.ok(!nodeCompatible('22.12.0'));
  assert.ok(!nodeCompatible('23.3.0'));
  assert.ok(!nodeCompatible('20.20.2'));
  assert.match(mensajeNodeViejo('20.1.0'), /22\.13/);
});

test('puerto por defecto 7717 y datos en ~/.mi-claude/whatsapp', () => {
  assert.equal(puerto({}), 7717);
  assert.equal(puerto({ WSP_PUERTO: '7799' }), 7799);
  assert.equal(puerto({ WSP_PUERTO: 'basura' }), 7717);
  const r = rutasDatos({ MI_CLAUDE_DIR: '/tmp/x' });
  assert.equal(r.dir, path.join('/tmp/x', 'whatsapp'));
  assert.equal(r.db, path.join('/tmp/x', 'whatsapp', 'whatsapp.db'));
});

test('duracionDeSalidaFfmpeg toma el último time=', () => {
  assert.equal(duracionDeSalidaFfmpeg('size= 1kB time=00:00:01.00 x\nsize= 9kB time=00:01:03.60 bitrate'), 64);
  assert.equal(duracionDeSalidaFfmpeg('sin datos'), 1);
});

test('página /vincular: pasos en español, QR, y «✅ Conectado»', () => {
  const qr = htmlVincular({ conexion: 'esperando_qr', qrDataUrl: 'data:image/png;base64,AAA' });
  assert.match(qr, /Dispositivos vinculados/);
  assert.match(qr, /Vincular un dispositivo/);
  assert.match(qr, /data:image\/png;base64,AAA/);
  assert.match(qr, /http-equiv="refresh"/);
  const ok = htmlVincular({ conexion: 'conectado', numero: '15550001111', mensajes: 12 });
  assert.match(ok, /✅/);
  assert.match(ok, /Conectado/);
  assert.match(htmlVincular({ conexion: 'arrancando' }), /Arrancando/);
});

test('wsp: parsea argumentos, query y menciones', () => {
  const { opciones, posicionales } = parsearArgs(['Ana', 'hola', 'qué', '--limite', '5', '--no-leidos']);
  assert.deepEqual(posicionales, ['Ana', 'hola', 'qué']);
  assert.deepEqual(opciones, { limite: '5', 'no-leidos': true });
  assert.equal(qs({ q: 'a b', limite: undefined, x: false }), '?q=a+b');
  assert.deepEqual(mencionesDe({ mencionar: 'Ana, Luis' }), ['Ana', 'Luis']);
  assert.equal(mencionesDe({ 'a-todos': true }), true);
  assert.equal(mencionesDe({}), false);
});

// ─── Arranque en segundo plano ───────────────────────────────────────────────

const opcionesMac = {
  node: '/Users/persona/.nvm/versions/node/v22.13.0/bin/node',
  script: '/Users/persona/mi-claude/whatsapp/servicio.mjs',
  dirTrabajo: '/Users/persona/mi-claude/whatsapp',
  log: '/Users/persona/.mi-claude/whatsapp/servicio.log',
  variables: { WSP_PUERTO: '7717' },
};

test('generarPlist: etiqueta, node absoluto, puerto, KeepAlive y log', () => {
  const plist = generarPlist(opcionesMac);
  assert.match(plist, /<string>local\.mi-claude\.whatsapp<\/string>/);
  assert.match(plist, /<string>\/Users\/persona\/\.nvm\/versions\/node\/v22\.13\.0\/bin\/node<\/string>/);
  assert.match(plist, /<key>WSP_PUERTO<\/key>\s*<string>7717<\/string>/);
  assert.match(plist, /<key>KeepAlive<\/key>\s*<true\/>/);
  assert.match(plist, /<key>StandardOutPath<\/key>\s*<string>\/Users\/persona\/\.mi-claude\/whatsapp\/servicio\.log<\/string>/);
  assert.throws(() => generarPlist({ ...opcionesMac, node: 'node' }), /absoluta/);
  assert.match(generarPlist({ ...opcionesMac, dirTrabajo: '/a & b' }), /\/a &amp; b/);
});

test('generarPlist es un plist válido (plutil, solo en Mac)', { skip: process.platform !== 'darwin' }, () => {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'plist-')), 'x.plist');
  fs.writeFileSync(tmp, generarPlist({ ...opcionesMac, script: '/Users/a/Application Support/x.mjs' }));
  const r = spawnSync('plutil', ['-lint', tmp], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('generarVbs: node absoluto, oculto, con log, puerto y reinicio', () => {
  const vbs = generarVbs({
    node: 'C:\\Program Files\\nodejs\\node.exe',
    script: 'C:\\Users\\José\\mi-claude\\whatsapp\\servicio.mjs',
    dirTrabajo: 'C:\\Users\\José\\mi-claude\\whatsapp',
    log: 'C:\\Users\\José\\.mi-claude\\whatsapp\\servicio.log',
    variables: { WSP_PUERTO: '7717' },
  });
  assert.match(vbs, /sh\.Environment\("PROCESS"\)\("WSP_PUERTO"\) = "7717"/);
  // Comillas de VBScript dobladas: cmd /c ""node" "script" >> "log" 2>&1"
  assert.ok(vbs.includes('comando = "cmd /c """"C:\\Program Files\\nodejs\\node.exe"" ""C:\\Users\\José\\mi-claude\\whatsapp\\servicio.mjs"" >> ""C:\\Users\\José\\.mi-claude\\whatsapp\\servicio.log"" 2>&1"""'));
  assert.match(vbs, /sh\.Run comando, 0, True/);
  assert.match(vbs, /\r\n/);
  assert.throws(() => generarVbs({ node: 'node.exe', script: 'x', dirTrabajo: 'x', log: 'x', variables: {} }), /absoluta/);
});

test('lanzadores del comando wsp', () => {
  assert.equal(generarWrapperMac({ node: '/n/node', wsp: '/r/wsp.mjs' }), '#!/bin/sh\n# Comando wsp de mi-claude (lo crea whatsapp/arranque.mjs).\nexec "/n/node" "/r/wsp.mjs" "$@"\n');
  assert.equal(generarCmd({ node: 'C:\\n\\node.exe', wsp: 'C:\\r\\wsp.mjs' }), '@echo off\r\nrem Comando wsp de mi-claude (lo crea whatsapp\\arranque.mjs).\r\n"C:\\n\\node.exe" "C:\\r\\wsp.mjs" %*\r\n');
  assert.match(generarCmd({ node: 'C:\\n\\node.exe', wsp: 'C:\\Users\\José\\wsp.mjs' }), /chcp 65001/);
});

test('rutasArranque y plan por sistema', () => {
  const mac = rutasArranque({ plataforma: 'darwin', home: '/Users/persona' });
  assert.equal(mac.lanzador, '/Users/persona/Library/LaunchAgents/local.mi-claude.whatsapp.plist');
  assert.equal(mac.comando, '/Users/persona/.local/bin/wsp');
  const win = rutasArranque({ plataforma: 'win32', home: 'C:\\Users\\Ana', env: { APPDATA: 'C:\\Users\\Ana\\AppData\\Roaming', LOCALAPPDATA: 'C:\\Users\\Ana\\AppData\\Local' } });
  assert.equal(win.lanzador, 'C:\\Users\\Ana\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\mi-claude-whatsapp.vbs');
  assert.equal(win.comando, 'C:\\Users\\Ana\\AppData\\Local\\Microsoft\\WindowsApps\\wsp.cmd');
  assert.equal(rutasArranque({ plataforma: 'linux' }), null);

  const p = plan({ plataforma: 'darwin', home: '/Users/persona', env: { MI_CLAUDE_DIR: '/tmp/d' }, node: '/opt/node/bin/node', puerto: 7799 });
  assert.match(p.lanzador, /<string>7799<\/string>/);
  assert.match(p.lanzador, /<key>MI_CLAUDE_DIR<\/key>\s*<string>\/tmp\/d<\/string>/);
  assert.match(p.comando, /exec "\/opt\/node\/bin\/node"/);
  const w = plan({ plataforma: 'win32', home: 'C:\\Users\\Ana', env: {}, node: 'C:\\node\\node.exe', puerto: 7717 });
  assert.match(w.lanzador, /WSP_PUERTO"\) = "7717"/);
  assert.match(w.comando, /%\*/);
});

test('arranque --en-seco no cambia nada', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'datos-'));
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, '..', 'whatsapp', 'arranque.mjs'), 'instalar', '--en-seco', '--puerto', '7799'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home, MI_CLAUDE_DIR: datos, APPDATA: path.join(home, 'r'), LOCALAPPDATA: path.join(home, 'l') },
  });
  if (process.platform === 'darwin' || process.platform === 'win32') {
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\[en seco\]/);
  }
  assert.deepEqual(fs.readdirSync(home), []);
  assert.deepEqual(fs.readdirSync(datos), []);
});

test('agregarAlPathMac agrega ~/.local/bin una sola vez y respeta el perfil existente', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-path-'));
  fs.writeFileSync(path.join(home, '.zshrc'), 'alias ll="ls -l"');
  agregarAlPathMac('/h/.local/bin', home);
  agregarAlPathMac('/h/.local/bin', home);
  const zshrc = fs.readFileSync(path.join(home, '.zshrc'), 'utf8');
  assert.ok(zshrc.startsWith('alias ll="ls -l"\n'));
  assert.equal(zshrc.match(/export PATH="\/h\/\.local\/bin:\$PATH"/g).length, 1);
  assert.equal(fs.existsSync(path.join(home, '.bash_profile')), false);
});
