#!/usr/bin/env node
// Transcribe un video con timestamps de palabra y de frase (whisper-1 por APIMart).
//
//   node transcribe.mjs entrada.mp4 [salida.json]
//   LANG_CODE=en node transcribe.mjs ...     -> otro idioma (por defecto es)
//
// La key APIMART_API_KEY sale del entorno o de ~/.mi-claude/secrets.env.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clave, correrFfmpeg } from './comun.mjs';

const [entrada, salida = 'transcript.json'] = process.argv.slice(2);
if (!entrada) {
  console.error('uso: node transcribe.mjs entrada.mp4 [salida.json]');
  process.exit(1);
}

try {
  const key = clave('APIMART_API_KEY');
  const wav = path.join(os.tmpdir(), `vsl-audio-${process.pid}.wav`);
  try {
    // 16 kHz mono es lo que espera whisper; de paso el archivo baja del límite de 25 MB.
    const r = correrFfmpeg(['-y', '-v', 'error', '-i', entrada, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    if (r.status !== 0) throw new Error(`ffmpeg falló: ${r.stderr.slice(0, 300)}`);

    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(wav)], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', 'whisper-1');
    form.append('language', process.env.LANG_CODE || 'es');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    form.append('timestamp_granularities[]', 'segment');

    const resp = await fetch('https://api.apimart.ai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(600_000),
    });
    const texto = await resp.text();
    fs.writeFileSync(salida, texto);
    const d = JSON.parse(texto);
    if (!d.segments) throw new Error(`respuesta inesperada: ${texto.slice(0, 300)}`);

    console.log(`${Number(d.duration).toFixed(1)}s · ${d.segments.length} frases · ${(d.words || []).length} palabras\n`);
    for (const s of d.segments) {
      console.log(`[${s.start.toFixed(2).padStart(6)} - ${s.end.toFixed(2).padStart(6)}] ${s.text.trim()}`);
    }
    console.log(`\n-> ${salida}`);
  } finally {
    fs.rmSync(wav, { force: true });
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
