#!/usr/bin/env node
// APIMart por API REST (https://docs.apimart.ai): imágenes, video, transcripción y saldo.
// Uso: node apimart.mjs <saldo|imagen|video|transcribir|tarea> [opciones] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { leerKey } from './_keys.mjs';

export const BASE = 'https://api.apimart.ai';
export const MODELO_IMAGEN = 'gpt-image-1-official';
export const MODELO_VIDEO = 'veo3.1-fast';

const AYUDA = `Uso: node apimart.mjs <comando> [opciones] [--json]

  saldo                                       Saldo disponible y gastado
  imagen "prompt" [--modelo ${MODELO_IMAGEN}] [--tamano 1:1|3:2|2:3] [--salida archivo.png]
  video "prompt" [--modelo ${MODELO_VIDEO}] [--formato 16:9|9:16] [--salida archivo.mp4] --confirmado
                                              (cuesta más: sin --confirmado solo muestra lo que haría)
  transcribir archivo [--idioma es] [--formato text|json|srt|vtt]
  tarea <id>                                  Estado de una tarea (imagen o video)`;

const MIME_AUDIO = {
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.webm': 'audio/webm', '.mpeg': 'audio/mpeg', '.mpga': 'audio/mpeg', '.flac': 'audio/flac',
};

export function parsearArgs(argv) {
  const pos = [];
  const op = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const nombre = a.slice(2);
    if (['json', 'confirmado', 'ayuda', 'help'].includes(nombre)) { op[nombre] = true; continue; }
    op[nombre] = argv[++i];
  }
  return { pos, op };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export function crearCliente({ key, fetch = globalThis.fetch }) {
  if (!key) {
    throw new Error('Falta la key de APIMart (APIMART_API_KEY). Créala en https://apimart.ai/keys ' +
      '(empieza por sk-) y guárdala con: node setup/keys.mjs guardar APIMART <key>');
  }
  async function pedir(metodo, ruta, { json, form } = {}) {
    const headers = { Authorization: `Bearer ${key}` };
    let body;
    if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) body = form; // fetch pone el boundary del multipart solo
    let r;
    try { r = await fetch(`${BASE}${ruta}`, { method: metodo, headers, body }); } catch (e) {
      throw new Error(`No pude conectar con APIMart (${e.message}). Revisa tu internet.`);
    }
    const texto = await r.text();
    let datos;
    try { datos = texto ? JSON.parse(texto) : {}; } catch { datos = { texto }; }
    const msg = datos?.error?.message || datos?.message;
    if (r.status === 401) throw new Error('APIMart rechazó la key (401). Revisa que APIMART_API_KEY sea correcta.');
    if (r.status === 402) throw new Error('No tienes saldo suficiente en APIMart (402). Recarga en https://apimart.ai');
    if (!r.ok) throw new Error(`APIMart respondió ${r.status}: ${msg || 'error desconocido'}`);
    return datos;
  }
  return {
    pedir,
    saldo: () => pedir('GET', '/v1/user/balance'),
    generarImagen: (cuerpo) => pedir('POST', '/v1/images/generations', { json: cuerpo }),
    generarVideo: (cuerpo) => pedir('POST', '/v1/videos/generations', { json: cuerpo }),
    tarea: (id) => pedir('GET', `/v1/tasks/${encodeURIComponent(id)}?language=es`),
    transcribir: (form) => pedir('POST', '/v1/audio/transcriptions', { form }),
    async descargar(url, destino) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`No pude descargar el resultado (HTTP ${r.status}).`);
      fs.mkdirSync(path.dirname(path.resolve(destino)), { recursive: true });
      fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
      return path.resolve(destino);
    },
  };
}

// Todas las URLs http(s) dentro del resultado de una tarea (images[].url puede ser texto o lista).
export function urlsDeResultado(resultado) {
  const urls = [];
  const recorrer = (v) => {
    if (typeof v === 'string') { if (/^https?:\/\//i.test(v)) urls.push(v); }
    else if (Array.isArray(v)) v.forEach(recorrer);
    else if (v && typeof v === 'object') Object.values(v).forEach(recorrer);
  };
  recorrer(resultado);
  return [...new Set(urls)];
}

export function idDeTarea(respuesta) {
  const d = respuesta?.data;
  const id = (Array.isArray(d) ? d[0]?.task_id : d?.task_id) || respuesta?.task_id;
  if (!id) throw new Error(`APIMart no devolvió el id de la tarea: ${JSON.stringify(respuesta).slice(0, 200)}`);
  return id;
}

// Consulta la tarea con espera creciente hasta que termine, falle o se acabe el tiempo.
export async function esperarTarea(cli, id, { maxMs = 180_000, inicialMs = 2000, topeMs = 15_000, dormir = esperar, ahora = Date.now, aviso = () => {} } = {}) {
  const inicio = ahora();
  let pausa = inicialMs;
  for (;;) {
    const r = await cli.tarea(id);
    const t = r?.data || r;
    if (t.status === 'completed') return t;
    if (t.status === 'failed' || t.status === 'cancelled') {
      throw new Error(`La tarea ${id} ${t.status === 'failed' ? 'falló' : 'fue cancelada'}: ${t.error?.message || 'sin detalle'}`);
    }
    aviso(t);
    if (ahora() - inicio + pausa > maxMs) {
      throw new Error(`La tarea ${id} sigue en "${t.status}" después de ${Math.round(maxMs / 1000)} s. Revisa luego con: tarea ${id}`);
    }
    await dormir(pausa);
    pausa = Math.min(Math.round(pausa * 1.5), topeMs);
  }
}

function rutasSalida(salida, n, extPorDefecto) {
  const base = salida || `${extPorDefecto === '.mp4' ? 'video' : 'imagen'}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}${extPorDefecto}`;
  if (n <= 1) return [base];
  const ext = path.extname(base) || extPorDefecto;
  const sin = base.slice(0, base.length - path.extname(base).length);
  return Array.from({ length: n }, (_, i) => (i === 0 ? `${sin}${ext}` : `${sin}-${i + 1}${ext}`));
}

async function terminarYDescargar(cli, id, op, extPorDefecto, opcionesEspera) {
  const t = await esperarTarea(cli, id, opcionesEspera);
  const urls = urlsDeResultado(t.result);
  if (!urls.length) throw new Error(`La tarea ${id} terminó pero no trajo archivos.`);
  const destinos = rutasSalida(op.salida, urls.length, extPorDefecto);
  const archivos = [];
  for (let i = 0; i < urls.length; i++) archivos.push(await cli.descargar(urls[i], destinos[i]));
  return { tarea: id, estado: t.status, costo: t.cost, urls, archivos };
}

// --- comandos -----------------------------------------------------------------
export async function cmdSaldo(cli) {
  const r = await cli.saldo();
  if (r.success === false) throw new Error(`APIMart no pudo leer el saldo: ${r.message || 'sin detalle'}`);
  return { datos: r, texto: `Saldo disponible: $${r.remain_balance ?? '?'} (${r.remain_credits ?? '?'} créditos)\nGastado: $${r.used_balance ?? '?'}` };
}

export async function cmdImagen(cli, prompt, op, espera) {
  if (!prompt) throw new Error('Falta el prompt. Ejemplo: imagen "un gato astronauta" --tamano 1:1');
  const cuerpo = { model: op.modelo || MODELO_IMAGEN, prompt, size: op.tamano || '1:1', n: 1 };
  const id = idDeTarea(await cli.generarImagen(cuerpo));
  const r = await terminarYDescargar(cli, id, op, '.png', espera);
  return { datos: r, texto: [`Imagen lista (${cuerpo.model}, ${cuerpo.size}).`, ...r.archivos.map((a) => `Guardada en: ${a}`)].join('\n') };
}

export async function cmdVideo(cli, prompt, op, espera) {
  if (!prompt) throw new Error('Falta el prompt. Ejemplo: video "olas al atardecer" --formato 9:16 --confirmado');
  const cuerpo = { model: op.modelo || MODELO_VIDEO, prompt, aspect_ratio: op.formato || '16:9' };
  if (cuerpo.model.startsWith('veo3')) cuerpo.duration = 8;
  if (!op.confirmado) {
    return {
      codigo: 2,
      datos: { vistaPrevia: cuerpo, enviado: false },
      texto: ['VISTA PREVIA (no se generó nada; un video cuesta bastante más que una imagen):',
        `Modelo: ${cuerpo.model}  Formato: ${cuerpo.aspect_ratio}${cuerpo.duration ? `  Duración: ${cuerpo.duration} s` : ''}`,
        `Prompt: ${prompt}`, 'Si la persona dice que sí, repite el comando con --confirmado.'].join('\n'),
    };
  }
  const id = idDeTarea(await cli.generarVideo(cuerpo));
  const r = await terminarYDescargar(cli, id, op, '.mp4', { maxMs: 600_000, topeMs: 20_000, ...espera });
  return { datos: r, texto: [`Video listo (${cuerpo.model}).`, ...r.archivos.map((a) => `Guardado en: ${a}`)].join('\n') };
}

export async function cmdTranscribir(cli, archivo, op) {
  if (!archivo) throw new Error('Dime qué archivo transcribir. Ejemplo: transcribir nota.mp3 --idioma es');
  if (!fs.existsSync(archivo)) throw new Error(`No encuentro el archivo: ${archivo}`);
  const tipo = MIME_AUDIO[path.extname(archivo).toLowerCase()] || 'application/octet-stream';
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(archivo)], { type: tipo }), path.basename(archivo));
  form.append('model', 'whisper-1');
  if (op.idioma) form.append('language', op.idioma);
  const formato = op.formato || 'json';
  form.append('response_format', formato);
  const r = await cli.transcribir(form);
  const texto = typeof r.text === 'string' ? r.text : (r.texto ?? '');
  return { datos: { texto, formato, respuesta: r }, texto };
}

export async function cmdTarea(cli, id) {
  if (!id) throw new Error('Dime el id de la tarea. Ejemplo: tarea task_01K...');
  const r = await cli.tarea(id);
  const t = r?.data || r;
  const urls = urlsDeResultado(t.result);
  const lineas = [`Tarea ${t.id || id}: ${t.status}${t.progress !== undefined ? ` (${t.progress}%)` : ''}`];
  if (t.cost !== undefined) lineas.push(`Costo: $${t.cost}`);
  if (t.error?.message) lineas.push(`Error: ${t.error.message}`);
  lineas.push(...urls);
  return { datos: t, texto: lineas.join('\n') };
}

export async function main(argv, { env = process.env, fetch = globalThis.fetch, out = console.log, err = console.error, espera = {} } = {}) {
  const { pos, op } = parsearArgs(argv);
  const [comando, ...resto] = pos;
  if (!comando || op.ayuda || op.help) { out(AYUDA); return 0; }
  const cli = crearCliente({ key: leerKey('APIMART_API_KEY', env), fetch });
  const avisos = { aviso: (t) => { if (!op.json) err(`… ${t.status || 'en cola'}${t.progress !== undefined ? ` ${t.progress}%` : ''}`); }, ...espera };
  const acciones = {
    saldo: () => cmdSaldo(cli),
    imagen: () => cmdImagen(cli, resto.join(' '), op, avisos),
    video: () => cmdVideo(cli, resto.join(' '), op, avisos),
    transcribir: () => cmdTranscribir(cli, resto[0], op),
    tarea: () => cmdTarea(cli, resto[0]),
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
