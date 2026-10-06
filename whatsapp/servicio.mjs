// Servicio local de WhatsApp de mi-claude.
//
// Se vincula como un «dispositivo» más de tu WhatsApp (Baileys), guarda chats y mensajes en
// SQLite y los sirve por HTTP SOLO en 127.0.0.1 (por defecto el puerto 7717). Nada sale hacia
// internet salvo la conexión con WhatsApp y, cuando tú lo pides, APIMart (transcribir audios)
// o ElevenLabs (notas de voz). Los datos viven en ~/.mi-claude/whatsapp, fuera del repo.
//
// Arranque: node whatsapp/servicio.mjs   (o en segundo plano con: node whatsapp/arranque.mjs instalar)

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nodeCompatible, mensajeNodeViejo, puerto as leerPuerto, rutasDatos } from './lib/config.mjs';

if (!nodeCompatible()) {
  console.error(mensajeNodeViejo());
  process.exit(1);
}

// node:sqlite avisa que es «experimental» en cada arranque; el aviso solo ensucia el log.
const emitirAviso = process.emitWarning;
process.emitWarning = (aviso, ...resto) => (String(aviso?.message ?? aviso).includes('SQLite') ? undefined : emitirAviso.call(process, aviso, ...resto));

// Se importan después de revisar la versión, para que un Node viejo dé el mensaje claro.
const { DatabaseSync } = await import('node:sqlite');
const { default: pino } = await import('pino');
const { default: QRCode } = await import('qrcode');
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestWaWebVersion,
  fetchLatestBaileysVersion,
  normalizeMessageContent,
  getContentType,
  jidNormalizedUser,
  isJidGroup,
  proto,
  downloadMediaMessage,
} = await import('baileys');
const { interpretarReferencia, elegirChat, coincide } = await import('./lib/resolver.mjs');
const { transcribirAudio, vozElevenLabs, configuracionVoz, MENSAJE_SIN_APIMART } = await import('./lib/apis.mjs');
const { aNotaDeVoz } = await import('./lib/medios.mjs');
const { htmlVincular } = await import('./lib/pagina.mjs');
const { secreto } = await import('../setup/lib/secretos.mjs');

const PUERTO = leerPuerto();
const RUTAS = rutasDatos();
for (const d of [RUTAS.dir, RUTAS.auth, RUTAS.medios, RUTAS.voz]) fs.mkdirSync(d, { recursive: true });

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ─── Base ────────────────────────────────────────────────────────────────────

const db = new DatabaseSync(RUTAS.db);
db.exec('pragma journal_mode = WAL');
db.exec(`
  create table if not exists chats (
    jid text primary key,
    nombre text,
    es_grupo integer not null default 0,
    ultimo_ts integer,
    no_leidos integer not null default 0
  );
  create table if not exists contactos (
    jid text primary key,
    nombre text,
    notify text
  );
  create table if not exists mensajes (
    chat_jid text not null,
    id text not null,
    de_mi integer not null,
    autor text,
    autor_nombre text,
    ts integer not null,
    tipo text,
    texto text,
    crudo blob,
    transcripcion text,
    primary key (chat_jid, id)
  );
  create table if not exists lids (
    lid text primary key,
    pn text not null
  );
  create index if not exists mensajes_chat_ts on mensajes (chat_jid, ts desc);
  create index if not exists mensajes_ts on mensajes (ts desc);
`);

// node:sqlite no trae db.transaction(): este envoltorio la imita y permite anidar
// (registrarLid corre suelto o dentro de un lote).
let profundidad = 0;
function transaccion(fn) {
  return (...args) => {
    if (profundidad > 0) return fn(...args);
    profundidad++;
    db.exec('begin');
    try {
      const r = fn(...args);
      db.exec('commit');
      return r;
    } catch (e) {
      db.exec('rollback');
      throw e;
    } finally {
      profundidad--;
    }
  };
}

const sql = {
  chat: db.prepare(`
    insert into chats (jid, nombre, es_grupo, ultimo_ts, no_leidos)
    values (@jid, @nombre, @es_grupo, @ultimo_ts, coalesce(@no_leidos, 0))
    on conflict (jid) do update set
      nombre = coalesce(excluded.nombre, chats.nombre),
      ultimo_ts = max(coalesce(excluded.ultimo_ts, 0), coalesce(chats.ultimo_ts, 0)),
      no_leidos = coalesce(@no_leidos, chats.no_leidos)`),
  // WhatsApp manda como «nombre» un número enmascarado («+57∙∙∙∙∙∙61») cuando el contacto no
  // está en la agenda; taparía el nombre real (notify), así que se descarta.
  contacto: db.prepare(`
    insert into contactos (jid, nombre, notify)
    values (@jid, case when @nombre like '%∙%' then null else @nombre end, case when @notify like '%∙%' then null else @notify end)
    on conflict (jid) do update set
      nombre = coalesce(excluded.nombre, contactos.nombre),
      notify = coalesce(excluded.notify, contactos.notify)`),
  mensaje: db.prepare(`
    insert or ignore into mensajes (chat_jid, id, de_mi, autor, autor_nombre, ts, tipo, texto)
    values (@chat_jid, @id, @de_mi, @autor, @autor_nombre, @ts, @tipo, @texto)`),
  crudo: db.prepare(`update mensajes set crudo = ? where chat_jid = ? and id = ? and crudo is null`),
  sumarNoLeido: db.prepare(`update chats set no_leidos = no_leidos + 1 where jid = ?`),
  pnDeLid: db.prepare(`select pn from lids where lid = ?`),
  lid: db.prepare(`insert into lids (lid, pn) values (?, ?) on conflict (lid) do update set pn = excluded.pn`),
};

const contar = (consulta, ...p) => Number(db.prepare(consulta).get(...p).n);

// ─── LID ↔ número ────────────────────────────────────────────────────────────
// WhatsApp direcciona a muchos contactos por un LID (…@lid) en vez del número. Si no se
// traduce, la misma persona queda partida en dos chats y sin nombre. Todo se guarda por
// número cuando se conoce, y cada mapeo nuevo fusiona lo que ya estaba bajo el LID.

const aPn = (jid) => (jid?.endsWith('@lid') ? sql.pnDeLid.get(jid)?.pn || jid : jid);

const registrarLid = transaccion((lid, pn) => {
  lid = jidNormalizedUser(lid);
  pn = jidNormalizedUser(pn);
  if (!lid?.endsWith('@lid') || !pn?.endsWith('@s.whatsapp.net')) return;
  sql.lid.run(lid, pn);
  const contactoLid = db.prepare('select nombre, notify from contactos where jid = ?').get(lid);
  if (contactoLid) sql.contacto.run({ jid: pn, nombre: contactoLid.nombre ?? null, notify: contactoLid.notify ?? null });
  const viejo = db.prepare('select * from chats where jid = ?').get(lid);
  if (!viejo) return;
  db.prepare('update or ignore mensajes set chat_jid = ? where chat_jid = ?').run(pn, lid);
  db.prepare('delete from mensajes where chat_jid = ?').run(lid);
  sql.chat.run({ jid: pn, nombre: viejo.nombre ?? null, es_grupo: 0, ultimo_ts: viejo.ultimo_ts ?? null, no_leidos: null });
  db.prepare('update chats set no_leidos = no_leidos + ? where jid = ?').run(viejo.no_leidos, pn);
  db.prepare('delete from chats where jid = ?').run(lid);
});

// ─── Estado del socket ───────────────────────────────────────────────────────

const estado = { conexion: 'arrancando', qr: null, numero: null, desde: Date.now(), error: null };
let sock = null;
let intentos = 0;

// ─── Traducir lo que llega de WhatsApp ───────────────────────────────────────

// Un chat 1 a 1 puede llegar como @lid con el número al lado en remoteJidAlt.
function jidDelChat(key) {
  const principal = key.remoteJid;
  const alterno = key.remoteJidAlt;
  if (principal?.endsWith('@lid') && alterno?.endsWith('@s.whatsapp.net')) {
    registrarLid(principal, alterno);
    return jidNormalizedUser(alterno);
  }
  return principal ? aPn(jidNormalizedUser(principal)) : null;
}

const ETIQUETAS = {
  imageMessage: '[imagen]',
  videoMessage: '[video]',
  audioMessage: '[audio]',
  documentMessage: '[documento]',
  stickerMessage: '[sticker]',
  locationMessage: '[ubicación]',
  liveLocationMessage: '[ubicación en vivo]',
  contactMessage: '[contacto]',
  pollCreationMessage: '[encuesta]',
  pollCreationMessageV3: '[encuesta]',
};

// Tipos cuyo contenido es un archivo cifrado en los servidores de WhatsApp: de estos se
// guarda el mensaje crudo (con su llave) para poder bajarlos después.
const CON_ARCHIVO = new Set(['audio', 'document', 'image', 'video', 'sticker']);

function contenidoDe(message) {
  const m = normalizeMessageContent(message);
  if (!m) return null;
  const tipo = getContentType(m);
  if (!tipo) return null;
  // Acuses, cifrado, reacciones y borrados no son mensajes que una persona lea.
  if (['protocolMessage', 'reactionMessage', 'senderKeyDistributionMessage', 'messageContextInfo', 'pollUpdateMessage'].includes(tipo)) return null;
  const c = m[tipo];
  let texto = m.conversation || c?.text || c?.caption || c?.fileName || c?.name || c?.displayName || (typeof c === 'string' ? c : null);
  const etiqueta = ETIQUETAS[tipo];
  if (etiqueta) texto = texto ? `${etiqueta} ${texto}` : etiqueta;
  if (tipo === 'audioMessage' && c?.seconds) texto = `[audio ${c.seconds}s]`;
  return { tipo: tipo.replace(/Message$/, ''), texto: texto || `[${tipo}]` };
}

function guardarMensaje(msg, { contarNoLeido = false } = {}) {
  if (!msg?.key?.id || !msg.message) return;
  const chat = jidDelChat(msg.key);
  if (!chat || chat === 'status@broadcast' || chat.endsWith('@newsletter')) return;
  const contenido = contenidoDe(msg.message);
  if (!contenido) return;
  const ts = Number(msg.messageTimestamp?.low ?? msg.messageTimestamp ?? 0) || Math.floor(Date.now() / 1000);
  const deMi = msg.key.fromMe ? 1 : 0;
  const autor = deMi ? 'yo' : aPn(jidNormalizedUser(msg.key.participantAlt || msg.key.participant || chat));
  const r = sql.mensaje.run({
    chat_jid: chat,
    id: msg.key.id,
    de_mi: deMi,
    autor: autor ?? null,
    autor_nombre: deMi ? 'Yo' : msg.pushName || null,
    ts,
    tipo: contenido.tipo,
    texto: contenido.texto,
  });
  sql.chat.run({ jid: chat, nombre: null, es_grupo: isJidGroup(chat) ? 1 : 0, ultimo_ts: ts, no_leidos: null });
  if (!deMi && msg.pushName && !isJidGroup(chat)) sql.contacto.run({ jid: chat, nombre: null, notify: msg.pushName });
  if (CON_ARCHIVO.has(contenido.tipo)) sql.crudo.run(Buffer.from(proto.WebMessageInfo.encode(msg).finish()), chat, msg.key.id);
  if (r.changes && contarNoLeido && !deMi) sql.sumarNoLeido.run(chat);
}

const guardarLote = transaccion(({ chats = [], contacts = [], messages = [] }) => {
  for (const c of contacts) {
    if (!c?.id) continue;
    const ids = [c.id, c.lid, c.phoneNumber].filter(Boolean).map(jidNormalizedUser).filter(Boolean);
    const lid = ids.find((j) => j.endsWith('@lid'));
    const pn = ids.find((j) => j.endsWith('@s.whatsapp.net'));
    if (lid && pn) registrarLid(lid, pn);
    // Bajo las dos direcciones, para que el nombre aparezca aunque el chat siga en LID.
    for (const jid of new Set(ids)) sql.contacto.run({ jid, nombre: c.name || null, notify: c.notify || c.verifiedName || null });
  }
  for (const c of chats) {
    if (!c?.id) continue;
    if (c.id.endsWith('@lid') && c.pnJid) registrarLid(c.id, c.pnJid);
    const jid = aPn(jidNormalizedUser(c.pnJid || c.id));
    if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) continue;
    const ts = Number(c.conversationTimestamp?.low ?? c.conversationTimestamp ?? 0) || null;
    sql.chat.run({ jid, nombre: c.name || c.subject || null, es_grupo: isJidGroup(jid) ? 1 : 0, ultimo_ts: ts, no_leidos: c.unreadCount ?? null });
  }
  for (const m of messages) guardarMensaje(m);
});

// ─── Conexión ────────────────────────────────────────────────────────────────

async function version() {
  try {
    return (await fetchLatestWaWebVersion({})).version;
  } catch {
    try {
      return (await fetchLatestBaileysVersion()).version;
    } catch {
      return undefined;
    }
  }
}

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState(RUTAS.auth);
  const primeraVez = !state.creds.registered;
  estado.conexion = 'conectando';

  sock = makeWASocket({
    auth: state,
    version: await version(),
    logger: pino({ level: process.env.WSP_LOG || 'silent' }),
    // «Desktop» hace que WhatsApp mande el historial completo al vincular (solo llega esa
    // primera vez). Con 'Mac OS' o 'Windows' delante WhatsApp corta con 428 antes del QR
    // en Baileys 7.0.0-rc14; con 'Ubuntu' sí da QR.
    browser: Browsers.ubuntu('Desktop'),
    syncFullHistory: true,
    shouldSyncHistoryMessage: () => true,
    markOnlineOnConnect: false,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    getMessage: async () => undefined,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      estado.conexion = 'esperando_qr';
      estado.qr = qr;
      log(`Código QR listo: abre http://127.0.0.1:${PUERTO}/vincular`);
    }
    if (connection === 'open') {
      intentos = 0;
      estado.conexion = 'conectado';
      estado.qr = null;
      estado.error = null;
      estado.desde = Date.now();
      estado.numero = sock.user?.id ? jidNormalizedUser(sock.user.id).split('@')[0] : null;
      traducirLidsPendientes();
      log('Conectado', primeraVez ? '(vinculación nueva)' : '');
      try {
        const grupos = await sock.groupFetchAllParticipating();
        transaccion(() => {
          for (const g of Object.values(grupos)) sql.chat.run({ jid: g.id, nombre: g.subject || null, es_grupo: 1, ultimo_ts: null, no_leidos: null });
        })();
      } catch (e) {
        log('No pude leer los nombres de los grupos:', e?.message);
      }
    }
    if (connection === 'close') {
      const codigo = lastDisconnect?.error?.output?.statusCode;
      estado.error = lastDisconnect?.error?.message || null;
      if (codigo === DisconnectReason.loggedOut) {
        // Lo desvincularon desde el celular: las credenciales ya no sirven. Se borran para
        // volver a ofrecer un QR; los mensajes guardados se quedan.
        log('Desvinculado desde el celular. Preparo un código QR nuevo.');
        estado.conexion = 'desvinculado';
        estado.numero = null;
        fs.rmSync(RUTAS.auth, { recursive: true, force: true });
        fs.mkdirSync(RUTAS.auth, { recursive: true });
        setTimeout(conectar, 2_000);
        return;
      }
      intentos += 1;
      const espera = codigo === DisconnectReason.restartRequired ? 500 : Math.min(60_000, 2_000 * 2 ** Math.min(intentos, 5));
      estado.conexion = 'reconectando';
      log(`Conexión cerrada (${codigo ?? 'sin código'}). Reintento en ${Math.round(espera / 1000)} s`);
      setTimeout(conectar, espera);
    }
  });

  sock.ev.on('lid-mapping.update', (m) => {
    for (const { lid, pn } of Array.isArray(m) ? m : [m]) if (lid && pn) registrarLid(lid, pn);
  });
  sock.ev.on('messaging-history.set', (lote) => {
    guardarLote(lote);
    log(`Historial: ${lote.chats?.length ?? 0} chats, ${lote.contacts?.length ?? 0} contactos, ${lote.messages?.length ?? 0} mensajes`);
  });
  sock.ev.on('chats.upsert', (chats) => guardarLote({ chats }));
  sock.ev.on('chats.update', (cambios) => {
    for (const c of cambios) {
      if (!c?.id) continue;
      const jid = jidNormalizedUser(c.id);
      if (typeof c.unreadCount === 'number') db.prepare('update chats set no_leidos = ? where jid = ?').run(Math.max(0, c.unreadCount), jid);
      if (c.name) db.prepare('update chats set nombre = ? where jid = ?').run(c.name, jid);
    }
  });
  sock.ev.on('contacts.upsert', (contacts) => guardarLote({ contacts }));
  sock.ev.on('contacts.update', (contacts) => guardarLote({ contacts }));
  sock.ev.on('groups.update', (grupos) => {
    for (const g of grupos) if (g?.id && g.subject) db.prepare('update chats set nombre = ? where jid = ?').run(g.subject, g.id);
  });
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    transaccion(() => {
      for (const m of messages) guardarMensaje(m, { contarNoLeido: type === 'notify' });
    })();
  });
}

// Los chats que siguen en LID se le preguntan a la tabla de mapeos de Baileys, que se llena
// sola con el cifrado. Se repite cada hora porque los mapeos van llegando.
async function traducirLidsPendientes() {
  const repo = sock?.signalRepository?.lidMapping;
  if (!repo?.getPNForLID) return;
  const pendientes = db.prepare(`select jid from chats where jid like '%@lid'`).all();
  let traducidos = 0;
  for (const { jid } of pendientes) {
    try {
      const pn = await repo.getPNForLID(jid);
      if (pn) {
        registrarLid(jid, pn);
        traducidos++;
      }
    } catch {}
  }
  if (pendientes.length) log(`LID: ${traducidos} de ${pendientes.length} chats traducidos a número`);
}
setInterval(() => estado.conexion === 'conectado' && traducirLidsPendientes(), 60 * 60 * 1000).unref();

// ─── Resolver «de quién me hablan» ───────────────────────────────────────────

const NOMBRE_SQL = `coalesce(c.nombre, k.nombre, k.notify, substr(c.jid, 1, instr(c.jid, '@') - 1))`;

function listarChats({ q, limite = 30, noLeidos = false } = {}) {
  const filas = db
    .prepare(
      `select c.jid, ${NOMBRE_SQL} as nombre, c.es_grupo, c.ultimo_ts, c.no_leidos,
              (select texto from mensajes m where m.chat_jid = c.jid order by ts desc limit 1) as ultimo,
              (select de_mi from mensajes m where m.chat_jid = c.jid order by ts desc limit 1) as ultimo_de_mi
       from chats c left join contactos k on k.jid = c.jid
       where c.ultimo_ts is not null ${noLeidos ? 'and c.no_leidos > 0' : ''}
       order by c.ultimo_ts desc`,
    )
    .all();
  return (q ? filas.filter((f) => coincide(q, f)) : filas).slice(0, limite);
}

// Acepta lo que la gente dice: un nombre, un teléfono o el jid.
function resolverChat(ref) {
  const r = interpretarReferencia(ref, { indicativo: secreto('WSP_INDICATIVO'), numeroPropio: estado.numero });
  if (r.error || r.jid) return r;
  return elegirChat(r.nombre, listarChats({ q: r.nombre, limite: 8 }));
}

function nombreDe(jid) {
  return db.prepare(`select ${NOMBRE_SQL} as nombre from chats c left join contactos k on k.jid = c.jid where c.jid = ?`).get(jid)?.nombre || jid.split('@')[0];
}

// ─── Archivos y voz ──────────────────────────────────────────────────────────

const EXT = {
  imagen: ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
  video: ['.mp4', '.mov', '.m4v', '.3gp'],
  audio: ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.opus', '.oga'],
};
const MIME = { '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.zip': 'application/zip', '.txt': 'text/plain', '.csv': 'text/csv' };

const tipoPorExtension = (archivo) => {
  const ext = path.extname(archivo).toLowerCase();
  return Object.keys(EXT).find((t) => EXT[t].includes(ext)) || 'documento';
};

async function generarVoz(texto) {
  const mp3 = path.join(RUTAS.voz, `voz-${Date.now()}.mp3`);
  fs.writeFileSync(mp3, await vozElevenLabs(texto));
  try {
    return await aNotaDeVoz(mp3, RUTAS.voz);
  } finally {
    fs.rmSync(mp3, { force: true });
  }
}

async function contenidoParaEnviar({ texto, archivo, como }) {
  if (!archivo) return { text: texto };
  archivo = path.resolve(archivo.replace(/^~(?=[/\\]|$)/, os.homedir()));
  if (!fs.existsSync(archivo)) throw Object.assign(new Error(`No existe el archivo ${archivo}.`), { codigo: 404 });
  const tipo = como || tipoPorExtension(archivo);
  const ext = path.extname(archivo).toLowerCase();
  const caption = texto || undefined;
  if (tipo === 'imagen') return { image: { url: archivo }, caption };
  if (tipo === 'video') return { video: { url: archivo }, caption };
  if (tipo === 'nota') {
    const nota = await aNotaDeVoz(archivo, RUTAS.voz);
    return { audio: { url: nota.archivo }, mimetype: 'audio/ogg; codecs=opus', ptt: true, seconds: nota.segundos };
  }
  if (tipo === 'audio') return { audio: { url: archivo }, mimetype: MIME[ext] || 'audio/mpeg' };
  return { document: { url: archivo }, mimetype: MIME[ext] || 'application/octet-stream', fileName: path.basename(archivo), caption };
}

const EXTENSION = { image: '.jpg', video: '.mp4', audio: '.ogg', sticker: '.webp' };

// Nombre legible: el del archivo original cuando viene (documentos), con el id del mensaje
// delante para que dos «contrato.pdf» no se pisen.
function nombreDeArchivo(fila, msg) {
  const c = msg.message?.documentMessage || msg.message?.documentWithCaptionMessage?.message?.documentMessage;
  const original = c?.fileName?.trim();
  if (original) return `${fila.id}-${original.replace(/[/\\:*?"<>|]/g, '_')}`;
  return `${fila.id}${EXTENSION[fila.tipo] || ''}`;
}

async function descargar(msg) {
  // Si el archivo ya no está en el servidor de WhatsApp, `updateMediaMessage` le pide al
  // celular que lo vuelva a subir.
  return downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
}

async function bajarArchivo(fila) {
  const msg = proto.WebMessageInfo.decode(fila.crudo);
  const destino = path.join(RUTAS.medios, nombreDeArchivo(fila, msg));
  if (fs.existsSync(destino)) return destino;
  fs.writeFileSync(destino, await descargar(msg));
  return destino;
}

async function transcribir(fila) {
  const ogg = path.join(RUTAS.medios, `${fila.id}.ogg`);
  if (!fs.existsSync(ogg)) fs.writeFileSync(ogg, await descargar(proto.WebMessageInfo.decode(fila.crudo)));
  return transcribirAudio(fs.readFileSync(ogg), { nombreArchivo: `${fila.id}.ogg` });
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

function responder(res, codigo, cuerpo) {
  res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(cuerpo));
}

async function leerCuerpo(req) {
  let datos = '';
  for await (const trozo of req) {
    datos += trozo;
    if (datos.length > 1_000_000) throw Object.assign(new Error('Cuerpo demasiado grande.'), { codigo: 413 });
  }
  try {
    return datos ? JSON.parse(datos) : {};
  } catch {
    throw Object.assign(new Error('El cuerpo no es JSON válido.'), { codigo: 400 });
  }
}

const noConectado = () => [503, { error: `WhatsApp no está conectado (${estado.conexion}). Abre http://127.0.0.1:${PUERTO}/vincular` }];

const rutas = {
  'GET /estado': () => ({
    ...estado,
    qr: estado.qr ? 'abrir /vincular' : null,
    puerto: PUERTO,
    chats: contar('select count(*) n from chats where ultimo_ts is not null'),
    mensajes: contar('select count(*) n from mensajes'),
  }),

  'GET /chats': (p) => ({ chats: listarChats({ q: p.get('q'), limite: Number(p.get('limite') || 30), noLeidos: p.get('no_leidos') === '1' }) }),

  'GET /leer': (p) => {
    const r = resolverChat(p.get('chat'));
    if (r.error || r.ambiguo) return [r.ambiguo ? 409 : 404, r];
    const mensajes = db
      .prepare('select id, de_mi, coalesce(autor_nombre, (select coalesce(k.nombre, k.notify) from contactos k where k.jid = mensajes.autor)) as autor_nombre, ts, tipo, texto, transcripcion from mensajes where chat_jid = ? order by ts desc limit ?')
      .all(r.jid, Number(p.get('limite') || 30))
      .reverse();
    return { chat: { jid: r.jid, nombre: nombreDe(r.jid) }, mensajes };
  },

  'GET /buscar': (p) => {
    const q = p.get('q');
    if (!q) return [400, { error: 'Falta qué buscar.' }];
    let chatJid = null;
    if (p.get('chat')) {
      const r = resolverChat(p.get('chat'));
      if (r.error || r.ambiguo) return [r.ambiguo ? 409 : 404, r];
      chatJid = r.jid;
    }
    const filas = db
      .prepare(
        `select m.chat_jid, m.de_mi, coalesce(autor_nombre, (select coalesce(k.nombre, k.notify) from contactos k where k.jid = m.autor)) as autor_nombre, m.ts, m.texto
         from mensajes m where (m.texto like ? or m.transcripcion like ?) ${chatJid ? 'and m.chat_jid = ?' : ''}
         order by m.ts desc limit ?`,
      )
      .all(`%${q}%`, `%${q}%`, ...(chatJid ? [chatJid] : []), Number(p.get('limite') || 30));
    return { resultados: filas.map((f) => ({ ...f, chat: nombreDe(f.chat_jid) })) };
  },

  'GET /recientes': (p) => {
    const desde = Math.floor(Date.now() / 1000) - Number(p.get('horas') || 24) * 3600;
    const filas = db
      .prepare(
        `select chat_jid, de_mi, coalesce(autor_nombre, (select coalesce(k.nombre, k.notify) from contactos k where k.jid = mensajes.autor)) as autor_nombre, ts, texto from mensajes
         where ts >= ? ${p.get('entrantes') === '1' ? 'and de_mi = 0' : ''}
         order by ts desc limit ?`,
      )
      .all(desde, Number(p.get('limite') || 200));
    return { mensajes: filas.map((f) => ({ ...f, chat: nombreDe(f.chat_jid) })) };
  },

  // Cierra la vinculación limpio (desaparece de «Dispositivos vinculados») y deja listo un QR
  // nuevo. Los mensajes guardados se conservan.
  'POST /desvincular': async () => {
    if (!sock) return [503, { error: 'No hay sesión.' }];
    await sock.logout().catch(() => {});
    return { ok: true, siguiente: `abrir http://127.0.0.1:${PUERTO}/vincular` };
  },

  // Genera una nota de voz con la voz de la persona (ElevenLabs) SIN enviarla, para que la
  // escuche antes. Se manda después con /enviar { archivo, como: 'nota' }.
  'POST /voz': async (_p, req) => {
    const { texto } = await leerCuerpo(req);
    if (!texto?.trim()) return [400, { error: 'Falta el texto.' }];
    const cfg = configuracionVoz();
    if (cfg.error) return [412, { error: cfg.error }];
    return await generarVoz(texto);
  },

  // Baja y transcribe (con APIMart, whisper-1) los audios de un chat que aún no tengan
  // transcripción. Queda guardada y `leer` la muestra junto al audio.
  'POST /audios': async (_p, req) => {
    if (estado.conexion !== 'conectado') return noConectado();
    if (!secreto('APIMART_API_KEY')) return [412, { error: MENSAJE_SIN_APIMART }];
    const { chat, limite = 20 } = await leerCuerpo(req);
    const r = resolverChat(chat);
    if (r.error || r.ambiguo) return [r.ambiguo ? 409 : 404, r];
    const filas = db
      .prepare("select id, ts, de_mi, texto, crudo from mensajes where chat_jid = ? and tipo = 'audio' and crudo is not null and transcripcion is null order by ts desc limit ?")
      .all(r.jid, Number(limite));
    const salida = [];
    for (const f of filas) {
      try {
        const transcripcion = await transcribir(f);
        db.prepare('update mensajes set transcripcion = ? where chat_jid = ? and id = ?').run(transcripcion, r.jid, f.id);
        salida.push({ id: f.id, ts: f.ts, de_mi: f.de_mi, transcripcion });
      } catch (e) {
        salida.push({ id: f.id, ts: f.ts, de_mi: f.de_mi, error: e?.message || String(e) });
      }
    }
    const sinCrudo = contar("select count(*) n from mensajes where chat_jid = ? and tipo = 'audio' and crudo is null", r.jid);
    return { chat: nombreDe(r.jid), audios: salida, sin_recuperar: sinCrudo };
  },

  // Baja los archivos de un chat (documentos, fotos, videos) y devuelve dónde quedaron. Solo
  // se pueden bajar los que llegaron con su llave guardada; el resto sale en `sin_recuperar`.
  'POST /archivos': async (_p, req) => {
    if (estado.conexion !== 'conectado') return noConectado();
    const { chat, limite = 10, tipo } = await leerCuerpo(req);
    const r = resolverChat(chat);
    if (r.error || r.ambiguo) return [r.ambiguo ? 409 : 404, r];
    const tipos = tipo ? [tipo] : ['document', 'image', 'video', 'audio', 'sticker'];
    const huecos = tipos.map(() => '?').join(',');
    const filas = db
      .prepare(`select id, ts, de_mi, tipo, texto, crudo from mensajes where chat_jid = ? and tipo in (${huecos}) and crudo is not null order by ts desc limit ?`)
      .all(r.jid, ...tipos, Number(limite));
    const salida = [];
    for (const f of filas) {
      const base = { id: f.id, ts: f.ts, de_mi: f.de_mi, tipo: f.tipo, texto: f.texto };
      try {
        salida.push({ ...base, ruta: await bajarArchivo(f) });
      } catch (e) {
        salida.push({ ...base, error: e?.message || String(e) });
      }
    }
    const sinCrudo = contar(`select count(*) n from mensajes where chat_jid = ? and tipo in (${huecos}) and crudo is null`, r.jid, ...tipos);
    return { chat: nombreDe(r.jid), archivos: salida, sin_recuperar: sinCrudo };
  },

  'POST /enviar': async (_p, req) => {
    if (estado.conexion !== 'conectado') return noConectado();
    const { chat, texto, archivo, como, mencionar } = await leerCuerpo(req);
    if (!texto?.trim() && !archivo) return [400, { error: 'Falta el texto o el archivo.' }];
    if (como && !['imagen', 'video', 'audio', 'nota', 'documento'].includes(como)) return [400, { error: 'como: imagen | video | audio | nota | documento.' }];
    const r = resolverChat(chat);
    if (r.error || r.ambiguo) return [r.ambiguo ? 409 : 404, r];
    if (r.porNumero) {
      const [existe] = (await sock.onWhatsApp(r.jid.split('@')[0])) || [];
      if (!existe?.exists) return [404, { error: `El número +${r.jid.split('@')[0]} no tiene WhatsApp.` }];
      r.jid = jidNormalizedUser(existe.jid);
    }
    let contenido;
    try {
      contenido = await contenidoParaEnviar({ texto, archivo, como });
    } catch (e) {
      return [e.codigo || 400, { error: e.message }];
    }

    // Etiquetar en un grupo: WhatsApp no tiene «@todos». Una mención es el jid en `mentions`
    // Y el «@<número>» escrito en el texto; si falta uno de los dos, a nadie le suena.
    let menciones;
    if (mencionar && isJidGroup(r.jid)) {
      try {
        const meta = await sock.groupMetadata(r.jid);
        const yo = jidNormalizedUser(sock.user?.id ?? '');
        // Por número y no por LID: un «@<lid>» en el texto se ve como un número largo raro.
        menciones = meta.participants
          .map((p) => ({ lid: jidNormalizedUser(p.id), jid: aPn(jidNormalizedUser(p.id)) }))
          .filter(({ jid }) => jid !== yo && jid !== aPn(yo));

        // `mencionar` puede ser una lista de nombres: cada uno debe caer en UNA sola persona,
        // porque etiquetar a quien no era es peor que no etiquetar.
        if (Array.isArray(mencionar)) {
          const nombres = ({ lid, jid }) =>
            db
              .prepare(
                `select coalesce(nombre, notify) n from contactos where jid in (?, ?)
                 union select autor_nombre from mensajes where chat_jid = ? and autor in (?, ?) and autor_nombre is not null`,
              )
              .all(lid, jid, r.jid, lid, jid)
              .map((f) => f.n?.toLowerCase())
              .filter(Boolean);
          const elegidos = [];
          for (const buscado of mencionar) {
            const q = String(buscado).toLowerCase();
            const hits = menciones.filter((p) => nombres(p).some((n) => n.includes(q)));
            if (hits.length !== 1) {
              return [422, { error: `«${buscado}» coincide con ${hits.length} personas del grupo.`, candidatos: hits.map((p) => ({ jid: p.jid, nombres: nombres(p) })) }];
            }
            elegidos.push(hits[0]);
          }
          menciones = elegidos;
        }
        menciones = menciones.map((p) => p.jid);
        if (menciones.length) {
          const arrobas = menciones.map((jid) => `@${jid.split('@')[0]}`).join(' ');
          const campo = contenido.text !== undefined ? 'text' : 'caption';
          contenido[campo] = `${contenido[campo] ?? ''}\n\n${arrobas}`.trim();
          contenido.mentions = menciones;
        }
      } catch (e) {
        return [502, { error: `No se pudo leer quién está en el grupo: ${e?.message || e}` }];
      }
    }

    const enviado = await sock.sendMessage(r.jid, contenido);
    guardarMensaje(enviado);
    return { ok: true, chat: { jid: r.jid, nombre: nombreDe(r.jid) }, id: enviado?.key?.id, ...(menciones ? { mencionados: menciones.length } : {}) };
  },
};

async function paginaVincular(res) {
  const qrDataUrl = estado.qr ? await QRCode.toDataURL(estado.qr, { margin: 1, width: 360 }) : null;
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(htmlVincular({ conexion: estado.conexion, qrDataUrl, numero: estado.numero, mensajes: contar('select count(*) n from mensajes') }));
}

// Solo se aceptan pedidos dirigidos a este computador. Esto bloquea que una página web
// abierta en el navegador (con un dominio que apunte a 127.0.0.1) use el servicio.
const HOSTS_VALIDOS = new Set([`127.0.0.1:${PUERTO}`, `localhost:${PUERTO}`, `[::1]:${PUERTO}`]);

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PUERTO}`);
  try {
    if (!HOSTS_VALIDOS.has(String(req.headers.host).toLowerCase())) return responder(res, 403, { error: 'Solo se acepta 127.0.0.1.' });
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/vincular')) return await paginaVincular(res);
    // Los POST deben ser JSON: un formulario o un fetch «simple» desde otra página no pasa.
    if (req.method === 'POST' && !String(req.headers['content-type'] || '').startsWith('application/json')) {
      return responder(res, 415, { error: 'Envía content-type: application/json.' });
    }
    const ruta = rutas[`${req.method} ${url.pathname}`];
    if (!ruta) return responder(res, 404, { error: 'Ruta desconocida.', rutas: Object.keys(rutas) });
    const salida = await ruta(url.searchParams, req);
    if (Array.isArray(salida)) return responder(res, salida[0], salida[1]);
    responder(res, 200, salida);
  } catch (e) {
    log('Error en', req.method, url.pathname, e?.message || e);
    responder(res, e?.codigo || 500, { error: e?.message || String(e) });
  }
});

servidor.on('error', (e) => {
  if (e.code === 'EADDRINUSE') log(`El puerto ${PUERTO} ya está en uso: probablemente el servicio ya está corriendo.`);
  else log('Error del servidor:', e?.message || e);
  process.exit(1);
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  log(`Servicio de WhatsApp en http://127.0.0.1:${PUERTO} (datos en ${RUTAS.dir})`);
  conectar().catch((e) => {
    log('No pude arrancar la conexión con WhatsApp:', e?.message || e);
    process.exit(1);
  });
});

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    try {
      sock?.end?.(undefined);
      db.close();
    } catch {}
    process.exit(0);
  });
}
