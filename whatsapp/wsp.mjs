#!/usr/bin/env node
// CLI de WhatsApp de mi-claude. Habla con el servicio local (127.0.0.1, puerto 7717 por defecto).
//
//   wsp estado
//   wsp chats [texto] [--no-leidos] [--limite N]
//   wsp leer <chat> [--limite N]
//   wsp buscar <texto> [--chat <chat>] [--limite N]
//   wsp recientes [--horas N] [--entrantes] [--limite N]
//   wsp enviar <chat> [texto…] [--archivo ruta] [--como imagen|video|audio|nota|documento] [--a-todos] [--mencionar "Ana,Luis"]
//   wsp archivos <chat> [--limite N] [--tipo document|image|video|audio|sticker]
//   wsp audios <chat> [--limite N]          transcribe con APIMart los audios del chat
//   wsp voz <texto…>                        nota de voz con tu voz (ElevenLabs); NO la envía
//   wsp configurar indicativo|voz|idioma <valor>
//
// Todo envío: solo con el sí explícito de la persona, viendo destinatario y contenido.
// <chat> acepta un nombre, un teléfono («+57 300 123 4567») o el jid.
// Sin el comando `wsp`: node <carpeta de mi-claude>/whatsapp/wsp.mjs …

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { urlBase, DIR_WHATSAPP_CODIGO } from './lib/config.mjs';
import { guardarSecreto } from '../setup/lib/secretos.mjs';

export function parsearArgs(args) {
  const opciones = {};
  const posicionales = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const clave = a.slice(2);
      const sig = args[i + 1];
      if (sig !== undefined && !sig.startsWith('--')) {
        opciones[clave] = sig;
        i++;
      } else opciones[clave] = true;
    } else posicionales.push(a);
  }
  return { opciones, posicionales };
}

// Hora en la zona horaria del computador de la persona (sin zona fija).
export const hora = (ts) =>
  new Date(ts * 1000).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const corto = (t, n = 90) => (t && t.length > n ? t.slice(0, n - 1) + '…' : t || '');

export const qs = (o) => '?' + new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== false && v !== true)).toString();

// `--a-todos` etiqueta a todo el grupo; `--mencionar "Ana,Luis"` solo a esas personas.
export function mencionesDe(opciones) {
  if (typeof opciones.mencionar === 'string' && opciones.mencionar.trim()) {
    return opciones.mencionar.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return opciones['a-todos'] === true;
}

const CONFIGURABLES = {
  indicativo: { variable: 'WSP_INDICATIVO', ayuda: 'indicativo de tu país sin «+», ej. 57, 52, 34', limpiar: (v) => v.replace(/\D/g, '') },
  voz: { variable: 'ELEVENLABS_VOICE_ID', ayuda: 'ID de tu voz en ElevenLabs', limpiar: (v) => v.trim() },
  idioma: { variable: 'WSP_IDIOMA', ayuda: 'idioma de los audios para transcribir, ej. es, en, pt', limpiar: (v) => v.trim().toLowerCase() },
};

const USO =
  'Uso: wsp estado | chats [texto] [--no-leidos] | leer <chat> | buscar <texto> [--chat X] | ' +
  'recientes [--horas N] [--entrantes] | enviar <chat> [texto] [--archivo ruta] [--como nota] [--a-todos] | ' +
  'archivos <chat> [--limite N] [--tipo document] | audios <chat> [--limite N] | voz <texto> | ' +
  'configurar indicativo|voz|idioma <valor>';

function crearPedir(base) {
  return async function pedir(ruta, cuerpo) {
    let r;
    try {
      r = await fetch(base + ruta, cuerpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) } : undefined);
    } catch {
      const arranque = path.join(DIR_WHATSAPP_CODIGO, 'arranque.mjs');
      console.error(`El servicio de WhatsApp no está corriendo. Arráncalo con:\n  node "${arranque}" instalar`);
      process.exit(2);
    }
    const datos = await r.json().catch(() => ({ error: `Respuesta inesperada (${r.status}).` }));
    if (r.status === 409) {
      console.error('Hay varios chats que encajan, di cuál:');
      for (const c of datos.ambiguo) console.error(`  - ${c.nombre}${c.grupo ? ' (grupo)' : ''}  [${c.jid}]`);
      process.exit(3);
    }
    if (!r.ok) {
      console.error(datos.error || JSON.stringify(datos));
      for (const c of datos.candidatos || []) console.error(`  - ${c.nombres.join(' / ') || '(sin nombre)'}  [${c.jid}]`);
      process.exit(1);
    }
    return datos;
  };
}

export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...resto] = argv;
  const { opciones, posicionales } = parsearArgs(resto);
  const base = urlBase();
  const pedir = crearPedir(base);
  const quien = (m) => (m.de_mi ? 'Yo' : m.autor_nombre || 'Ellos');

  switch (cmd) {
    case 'estado': {
      const e = await pedir('/estado');
      console.log(`${e.conexion}${e.numero ? ` · +${e.numero}` : ''} · ${e.chats} chats · ${e.mensajes} mensajes${e.error ? ` · último error: ${e.error}` : ''}`);
      if (e.conexion !== 'conectado') console.log(`Para vincular: abre ${base}/vincular`);
      break;
    }
    case 'chats': {
      const { chats } = await pedir('/chats' + qs({ q: posicionales.join(' ') || undefined, limite: opciones.limite, no_leidos: opciones['no-leidos'] ? '1' : undefined }));
      for (const c of chats) {
        const nl = c.no_leidos ? ` (${c.no_leidos} sin leer)` : '';
        console.log(`${hora(c.ultimo_ts)}  ${c.nombre}${c.es_grupo ? ' [grupo]' : ''}${nl}\n    ${c.ultimo_de_mi ? 'Yo: ' : ''}${corto(c.ultimo)}`);
      }
      if (!chats.length) console.log('Sin chats.');
      break;
    }
    case 'leer': {
      const d = await pedir('/leer' + qs({ chat: posicionales.join(' '), limite: opciones.limite }));
      console.log(`── ${d.chat.nombre} [${d.chat.jid}]`);
      for (const m of d.mensajes) console.log(`${hora(m.ts)}  ${quien(m)}: ${m.texto}${m.transcripcion ? ` «${m.transcripcion}»` : ''}`);
      break;
    }
    case 'buscar': {
      const { resultados } = await pedir('/buscar' + qs({ q: posicionales.join(' '), chat: opciones.chat, limite: opciones.limite }));
      for (const m of resultados) console.log(`${hora(m.ts)}  [${m.chat}] ${quien(m)}: ${corto(m.texto, 160)}`);
      if (!resultados.length) console.log('Nada.');
      break;
    }
    case 'recientes': {
      const { mensajes } = await pedir('/recientes' + qs({ horas: opciones.horas, entrantes: opciones.entrantes ? '1' : undefined, limite: opciones.limite }));
      for (const m of mensajes.reverse()) console.log(`${hora(m.ts)}  [${m.chat}] ${quien(m)}: ${corto(m.texto, 160)}`);
      if (!mensajes.length) console.log('Nada en ese rango.');
      break;
    }
    case 'enviar': {
      const [chat, ...palabras] = posicionales;
      const d = await pedir('/enviar', {
        chat,
        texto: palabras.join(' ') || undefined,
        archivo: typeof opciones.archivo === 'string' ? path.resolve(opciones.archivo) : undefined,
        como: opciones.como,
        mencionar: mencionesDe(opciones),
      });
      console.log(`Enviado a ${d.chat.nombre}.` + (d.mencionados ? ` Etiquetadas ${d.mencionados} personas.` : ''));
      break;
    }
    case 'archivos': {
      const d = await pedir('/archivos', { chat: posicionales.join(' '), limite: opciones.limite ? Number(opciones.limite) : undefined, tipo: opciones.tipo });
      for (const a of d.archivos.reverse()) console.log(`${hora(a.ts)}  ${a.de_mi ? 'Yo' : 'Ellos'}  ${a.texto}\n    ${a.ruta || `(no se pudo: ${a.error})`}`);
      console.log(`${d.archivos.length} archivos · ${d.sin_recuperar} sin recuperar (llegaron sin su llave: solo vuelven si los reenvían)`);
      break;
    }
    case 'audios': {
      const d = await pedir('/audios', { chat: posicionales.join(' '), limite: opciones.limite ? Number(opciones.limite) : undefined });
      for (const a of d.audios.reverse()) console.log(`${hora(a.ts)}  ${a.de_mi ? 'Yo' : 'Ellos'}: ${a.transcripcion ? `«${a.transcripcion}»` : `(no se pudo: ${a.error})`}`);
      console.log(`${d.audios.length} transcritos · ${d.sin_recuperar} sin recuperar (llegaron antes de vincular: WhatsApp no los vuelve a mandar)`);
      break;
    }
    case 'voz': {
      const d = await pedir('/voz', { texto: posicionales.join(' ') });
      console.log(`${d.archivo}  (${d.segundos} s)`);
      break;
    }
    case 'configurar': {
      const [que, ...valor] = posicionales;
      const c = CONFIGURABLES[que];
      if (!c) {
        console.error('Uso: wsp configurar indicativo|voz|idioma <valor>');
        for (const [k, v] of Object.entries(CONFIGURABLES)) console.error(`  ${k}: ${v.ayuda}`);
        process.exit(1);
      }
      const limpio = c.limpiar(valor.join(' '));
      if (!limpio) {
        console.error(`Falta el valor (${c.ayuda}).`);
        process.exit(1);
      }
      guardarSecreto(c.variable, limpio);
      console.log(`Listo: ${que} guardado. El servicio lo usa desde ya, sin reiniciar.`);
      break;
    }
    default:
      console.log(USO);
  }
}

const esPrincipal = () => {
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
};

if (process.argv[1] && esPrincipal()) {
  main().catch((e) => {
    console.error(e?.message || e);
    process.exit(1);
  });
}
