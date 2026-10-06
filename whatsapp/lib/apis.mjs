// Servicios externos que usa WhatsApp, siempre con las keys de la persona:
// - APIMart (whisper-1) para transcribir audios.
// - ElevenLabs (opcional) para notas de voz con su propia voz.
// Las keys se leen en cada uso con `secreto()` y nunca se imprimen.
import { secreto } from '../../setup/lib/secretos.mjs';

export const URL_TRANSCRIPCION = 'https://api.apimart.ai/v1/audio/transcriptions';

export const MENSAJE_SIN_APIMART =
  'Para transcribir audios hace falta tu key de APIMart. Configura APIMart: dile a Claude ' +
  '"configura APIMart" (o corre: node setup/keys.mjs guardar APIMART <tu key>).';

export const MENSAJE_SIN_ELEVENLABS_KEY =
  'Las notas de voz con tu voz son opcionales y usan ElevenLabs. Para activarlas: ' +
  'crea tu key en elevenlabs.io y guárdala con: node setup/keys.mjs guardar ELEVENLABS <tu key>. ' +
  'Después elige o clona tu voz y guarda su ID con: wsp configurar voz <ID de la voz>.';

export const MENSAJE_SIN_ELEVENLABS_VOZ =
  'Falta el ID de tu voz de ElevenLabs. Búscalo en elevenlabs.io → Voices → tu voz → "Copy voice ID" ' +
  'y guárdalo con: wsp configurar voz <ID de la voz>.';

// Arma la petición multipart para APIMart (sin enviarla), para poderla probar.
export function peticionTranscripcion({ audio, nombreArchivo = 'audio.ogg', tipo = 'audio/ogg', key, idioma }) {
  if (!key) throw Object.assign(new Error(MENSAJE_SIN_APIMART), { codigo: 412 });
  const form = new FormData();
  form.append('file', new Blob([audio], { type: tipo }), nombreArchivo);
  form.append('model', 'whisper-1');
  if (idioma) form.append('language', idioma);
  return { url: URL_TRANSCRIPCION, init: { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form } };
}

export async function transcribirAudio(audio, { nombreArchivo, env = process.env, fetch = globalThis.fetch } = {}) {
  const { url, init } = peticionTranscripcion({
    audio,
    nombreArchivo,
    key: secreto('APIMART_API_KEY', env),
    idioma: secreto('WSP_IDIOMA', env) || undefined,
  });
  const r = await fetch(url, init);
  const crudo = await r.text();
  if (r.status === 401 || r.status === 403) throw new Error('APIMart rechazó la key (revísala con: node setup/keys.mjs verificar APIMART).');
  if (r.status === 402) throw new Error('APIMart no tiene saldo: recarga en apimart.ai.');
  if (!r.ok) throw new Error(`APIMart respondió ${r.status}: ${crudo.slice(0, 200)}`);
  let datos;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return crudo.replace(/\s+/g, ' ').trim();
  }
  const texto = datos.text ?? datos.data?.text;
  if (typeof texto !== 'string') throw new Error('APIMart no devolvió texto en la transcripción.');
  return texto.replace(/\s+/g, ' ').trim();
}

// Revisa que ElevenLabs esté configurado; devuelve { key, voz } o { error }.
export function configuracionVoz(env = process.env) {
  const key = secreto('ELEVENLABS_API_KEY', env);
  if (!key) return { error: MENSAJE_SIN_ELEVENLABS_KEY };
  const voz = secreto('ELEVENLABS_VOICE_ID', env);
  if (!voz) return { error: MENSAJE_SIN_ELEVENLABS_VOZ };
  return { key, voz };
}

// Pide a ElevenLabs el MP3 del texto con la voz de la persona.
export async function vozElevenLabs(texto, { env = process.env, fetch = globalThis.fetch } = {}) {
  const cfg = configuracionVoz(env);
  if (cfg.error) throw Object.assign(new Error(cfg.error), { codigo: 412 });
  const velocidad = Number(env.WSP_VOZ_VELOCIDAD || 1);
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(cfg.voz)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': cfg.key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: texto,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { speed: velocidad, stability: 0.5, similarity_boost: 0.8 },
    }),
  });
  if (r.status === 401) throw new Error('ElevenLabs rechazó la key (revísala en elevenlabs.io).');
  if (!r.ok) throw new Error(`ElevenLabs respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}
