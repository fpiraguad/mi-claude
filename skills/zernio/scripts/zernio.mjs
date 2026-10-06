#!/usr/bin/env node
// Zernio por API REST (https://docs.zernio.com). Publica y programa posts en las redes de la persona.
// Uso: node zernio.mjs <cuentas|perfiles|conectar|publicar|estado|posts> [opciones] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { leerKey } from './_keys.mjs';

export const BASE = 'https://zernio.com/api/v1';

const AYUDA = `Uso: node zernio.mjs <comando> [opciones] [--json]

  cuentas                                   Lista las redes conectadas (con su id)
  perfiles                                  Lista los perfiles (grupos de cuentas)
  conectar <plataforma> [--perfil id]       Da el enlace para conectar una red en el navegador
  publicar --texto "..." --cuentas id1,id2  Muestra la vista previa (NO publica)
           [--media archivo-o-url ...] [--programar 2026-12-01T10:00] [--zona America/Bogota]
           --confirmado                     Publica o programa de verdad (solo tras el "sí" de la persona)
  estado <postId>                           Estado de una publicación
  posts [--limite 10]                       Últimas publicaciones`;

const ALIAS_PLATAFORMA = { x: 'twitter', 'twitter/x': 'twitter', ig: 'instagram', fb: 'facebook', yt: 'youtube', 'google-business': 'googlebusiness' };
const EXT_VIDEO = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']);
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v', '.webm': 'video/webm',
  '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska', '.pdf': 'application/pdf',
};

// --- argumentos ---------------------------------------------------------------
export function parsearArgs(argv) {
  const pos = [];
  const op = { media: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const nombre = a.slice(2);
    if (nombre === 'json' || nombre === 'confirmado' || nombre === 'ayuda' || nombre === 'help') { op[nombre] = true; continue; }
    if (nombre === 'media') {
      while (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) op.media.push(...argv[++i].split(',').filter(Boolean));
      continue;
    }
    op[nombre] = argv[i + 1];
    i++;
  }
  return { pos, op };
}

// --- cliente HTTP -------------------------------------------------------------
export function crearCliente({ key, fetch = globalThis.fetch }) {
  if (!key) {
    throw new Error('Falta la key de Zernio (ZERNIO_API_KEY). Créala en https://zernio.com/dashboard/api-keys ' +
      '(empieza por sk_) y guárdala con: node setup/keys.mjs guardar ZERNIO <key>');
  }
  async function pedir(metodo, ruta, cuerpo) {
    const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json' };
    if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
    let r;
    try {
      r = await fetch(`${BASE}${ruta}`, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    } catch (e) {
      throw new Error(`No pude conectar con Zernio (${e.message}). Revisa tu internet.`);
    }
    const texto = await r.text();
    let datos;
    try { datos = texto ? JSON.parse(texto) : {}; } catch { datos = { error: texto.slice(0, 300) }; }
    if (!r.ok) {
      const detalle = typeof datos.error === 'string' ? datos.error : datos.message || `HTTP ${r.status}`;
      if (r.status === 401) throw new Error('Zernio rechazó la key (401). Revisa que ZERNIO_API_KEY sea correcta y no esté revocada.');
      if (r.status === 409) throw new Error(`Zernio dice que esa publicación ya existe o se publicó hace poco (409): ${detalle}`);
      throw new Error(`Zernio respondió ${r.status}: ${detalle}`);
    }
    return datos;
  }
  return {
    pedir,
    cuentas: () => pedir('GET', '/accounts'),
    perfiles: () => pedir('GET', '/profiles'),
    crearPerfil: (name) => pedir('POST', '/profiles', { name }),
    urlConexion: (plataforma, profileId) =>
      pedir('GET', `/connect/${encodeURIComponent(plataforma)}?profileId=${encodeURIComponent(profileId)}`),
    crearPost: (cuerpo) => pedir('POST', '/posts', cuerpo),
    post: (id) => pedir('GET', `/posts/${encodeURIComponent(id)}`),
    posts: (limite) => pedir('GET', `/posts?limit=${encodeURIComponent(limite)}`),
    presign: (filename, contentType, size) => pedir('POST', '/media/presign', { filename, contentType, size }),
    async subirArchivo(ruta) {
      const ext = path.extname(ruta).toLowerCase();
      const contentType = MIME[ext];
      if (!contentType) throw new Error(`No sé qué tipo de archivo es ${path.basename(ruta)} (usa jpg, png, gif, webp, mp4, mov o webm).`);
      if (!fs.existsSync(ruta)) throw new Error(`No encuentro el archivo: ${ruta}`);
      const bytes = fs.readFileSync(ruta);
      const { uploadUrl, publicUrl } = await this.presign(path.basename(ruta), contentType, bytes.length);
      if (!uploadUrl || !publicUrl) throw new Error('Zernio no devolvió la URL de subida.');
      const r = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes });
      if (!r.ok) throw new Error(`No pude subir ${path.basename(ruta)} (HTTP ${r.status}).`);
      return publicUrl;
    },
  };
}

// --- utilidades ---------------------------------------------------------------
export function tipoMedia(rutaOUrl) {
  const limpio = rutaOUrl.split('?')[0].toLowerCase();
  return EXT_VIDEO.has(path.extname(limpio)) ? 'video' : 'image';
}

// "2026-12-01T10:00" se lee en la zona de la persona; con Z u offset se pasa a UTC.
export function horario(iso, zona) {
  if (!iso) return null;
  const conZona = /(Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  if (conZona) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error(`La fecha "${iso}" no es válida. Usa formato 2026-12-01T10:00`);
    return { scheduledFor: d.toISOString().slice(0, 19), timezone: 'UTC' };
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(iso)) throw new Error(`La fecha "${iso}" no es válida. Usa formato 2026-12-01T10:00`);
  return { scheduledFor: iso.length === 16 ? `${iso}:00` : iso, timezone: zona || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
}

const nombreCuenta = (c) => `${c.platform} @${c.username || c.displayName || c.name || '?'}`;

// --- comandos -----------------------------------------------------------------
export async function cmdCuentas(cli) {
  const { accounts = [] } = await cli.cuentas();
  const lineas = accounts.length
    ? accounts.map((c) => `• ${nombreCuenta(c)}  id: ${c._id}${c.isActive === false ? '  (desconectada: hay que reconectarla)' : ''}`)
    : ['No hay redes conectadas todavía. Usa: conectar <plataforma>'];
  return { datos: { accounts }, texto: ['Cuentas conectadas:', ...lineas].join('\n') };
}

export async function cmdPerfiles(cli) {
  const { profiles = [] } = await cli.perfiles();
  const lineas = profiles.length ? profiles.map((p) => `• ${p.name}  id: ${p._id}`) : ['No hay perfiles. "conectar" crea uno solo.'];
  return { datos: { profiles }, texto: ['Perfiles:', ...lineas].join('\n') };
}

export async function cmdConectar(cli, plataformaCruda, op) {
  if (!plataformaCruda) throw new Error('Dime qué red conectar. Ejemplo: conectar instagram');
  const plataforma = ALIAS_PLATAFORMA[plataformaCruda.toLowerCase()] || plataformaCruda.toLowerCase();
  let profileId = op.perfil;
  let creado = false;
  if (!profileId) {
    const { profiles = [] } = await cli.perfiles();
    if (profiles.length) profileId = profiles[0]._id;
    else {
      const r = await cli.crearPerfil('Mi perfil');
      profileId = r.profile?._id;
      creado = true;
      if (!profileId) throw new Error('Zernio no devolvió el id del perfil nuevo.');
    }
  }
  const { authUrl } = await cli.urlConexion(plataforma, profileId);
  if (!authUrl) throw new Error(`Zernio no devolvió el enlace para conectar ${plataforma}.`);
  return {
    datos: { plataforma, profileId, perfilCreado: creado, authUrl },
    texto: [
      creado ? 'Creé un perfil nuevo llamado "Mi perfil".' : null,
      `Abre este enlace en el navegador e inicia sesión en ${plataforma} para autorizar a Zernio:`,
      authUrl,
      'Cuando termines, revisa con: cuentas',
    ].filter(Boolean).join('\n'),
  };
}

export async function cmdPublicar(cli, op) {
  const texto = op.texto;
  if (!texto && !op.media.length) throw new Error('Falta el contenido: usa --texto "..." y/o --media archivo');
  const ids = String(op.cuentas || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) throw new Error('Falta --cuentas id1,id2 (los ids salen con el comando "cuentas").');

  const { accounts = [] } = await cli.cuentas();
  const destino = ids.map((id) => {
    const c = accounts.find((a) => a._id === id);
    if (!c) throw new Error(`No encuentro la cuenta con id ${id}. Revisa los ids con "cuentas".`);
    return c;
  });
  const cuando = horario(op.programar, op.zona);
  const vista = {
    texto: texto || '',
    media: op.media,
    cuentas: destino.map((c) => ({ id: c._id, platform: c.platform, username: c.username })),
    programado: cuando ? `${cuando.scheduledFor} (${cuando.timezone})` : 'ahora mismo',
  };
  const resumen = [
    `Texto: ${vista.texto || '(sin texto)'}`,
    `Media: ${vista.media.length ? vista.media.join(', ') : '(ninguna)'}`,
    `Cuentas: ${destino.map(nombreCuenta).join(', ')}`,
    `Cuándo: ${vista.programado}`,
  ];

  if (!op.confirmado) {
    return {
      codigo: 2,
      datos: { vistaPrevia: vista, publicado: false },
      texto: ['VISTA PREVIA (no se publicó nada):', ...resumen,
        'Muéstrale esto a la persona. Solo si dice que sí, repite el comando con --confirmado.'].join('\n'),
    };
  }

  const mediaItems = [];
  for (const m of op.media) {
    const url = /^https?:\/\//i.test(m) ? m : await cli.subirArchivo(m);
    mediaItems.push({ type: tipoMedia(m), url });
  }
  const cuerpo = { content: texto || '', platforms: destino.map((c) => ({ platform: c.platform, accountId: c._id })) };
  if (mediaItems.length) cuerpo.mediaItems = mediaItems;
  if (cuando) Object.assign(cuerpo, cuando);
  else cuerpo.publishNow = true;

  const r = await cli.crearPost(cuerpo);
  const post = r.post || {};
  const enlaces = (post.platforms || []).filter((p) => p.platformPostUrl).map((p) => `${p.platform}: ${p.platformPostUrl}`);
  return {
    datos: { publicado: true, post },
    texto: [cuando ? 'Listo, quedó programado.' : 'Listo, enviado a publicar.', ...resumen,
      `Id: ${post._id}  estado: ${post.status || '?'}`, ...enlaces].join('\n'),
  };
}

function lineasPost(p) {
  const plataformas = (p.platforms || []).map((x) => `${x.platform}: ${x.status || '?'}${x.platformPostUrl ? ` ${x.platformPostUrl}` : ''}${x.errorMessage ? ` (${x.errorMessage})` : ''}`);
  return [`• ${p._id}  [${p.status || '?'}]${p.scheduledFor ? `  ${p.scheduledFor}` : ''}`,
    `  ${String(p.content || '').replace(/\s+/g, ' ').slice(0, 80)}`, ...plataformas.map((l) => `  ${l}`)];
}

export async function cmdEstado(cli, id) {
  if (!id) throw new Error('Dime el id de la publicación. Ejemplo: estado 65f1c0a9e2b5af0012ab34cd');
  const { post } = await cli.post(id);
  return { datos: { post }, texto: lineasPost(post || {}).join('\n') };
}

export async function cmdPosts(cli, op) {
  const limite = Number(op.limite || 10);
  if (!Number.isInteger(limite) || limite < 1) throw new Error('--limite debe ser un número entero mayor que 0');
  const { posts = [], pagination } = await cli.posts(limite);
  const texto = posts.length ? ['Publicaciones:', ...posts.flatMap(lineasPost)].join('\n') : 'No hay publicaciones todavía.';
  return { datos: { posts, pagination }, texto };
}

// --- entrada ------------------------------------------------------------------
export async function main(argv, { env = process.env, fetch = globalThis.fetch, out = console.log } = {}) {
  const { pos, op } = parsearArgs(argv);
  const [comando, ...resto] = pos;
  if (!comando || op.ayuda || op.help) { out(AYUDA); return 0; }
  const cli = crearCliente({ key: leerKey('ZERNIO_API_KEY', env), fetch });
  const acciones = {
    cuentas: () => cmdCuentas(cli),
    perfiles: () => cmdPerfiles(cli),
    conectar: () => cmdConectar(cli, resto[0], op),
    publicar: () => cmdPublicar(cli, op),
    estado: () => cmdEstado(cli, resto[0]),
    posts: () => cmdPosts(cli, op),
  };
  if (!acciones[comando]) throw new Error(`No conozco el comando "${comando}".\n${AYUDA}`);
  const r = await acciones[comando]();
  out(op.json ? JSON.stringify(r.datos, null, 2) : r.texto);
  return r.codigo ?? 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((codigo) => { process.exitCode = codigo; })
    .catch((e) => { console.error(`Error: ${e.message}`); process.exitCode = 1; });
}
