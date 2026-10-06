# APIMart — generación de B-roll y transcripción

Pasarela compatible con OpenAI en `https://api.apimart.ai`. La clave `APIMART_API_KEY` vive en
`~/.mi-claude/secrets.env` (la guarda el instalador de mi-claude); los scripts de este skill la leen
de ahí o del entorno. No la escribas nunca en el código, en un archivo versionado ni en la terminal.

Los ejemplos con `curl` de abajo usan `$KEY` solo para mostrar la forma de la petición; en la
práctica se usan los scripts (`scripts/*.mjs`), que leen la key sin imprimirla.

## Video — Omni-Flash-Ext

**El endpoint se llama `images/generations` pero el modelo devuelve video.** Es la trampa principal
de esta API: si asumes que genera imágenes, el resultado (`result.videos[]`) no encaja con lo que
esperas.

- **Salida**: mp4 de **8 segundos**, 1280x720, 24 fps, con audio (silenciarlo al montar).
- **Coste**: ~USD 0,35 por clip (3,5 créditos).
- **Tiempo real**: ~60 s, aunque `estimated_time` anuncie 600.
- **Asíncrono**: encola y devuelve `task_id`.

```bash
# Encolar
curl -s https://api.apimart.ai/v1/images/generations \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"model":"Omni-Flash-Ext","prompt":"...","n":1,"size":"1280x720"}'
# -> {"code":200,"data":[{"status":"submitted","task_id":"task_01K..."}]}

# Consultar (ojo: /v1/tasks/, en plural; /v1/task/ y /v1/images/tasks/ dan 404)
curl -s https://api.apimart.ai/v1/tasks/$TASK -H "Authorization: Bearer $KEY"
# -> {"data":{"status":"completed","result":{"videos":[{"url":["https://..."]}]}}}
```

Las URL de resultado **caducan en 24 h** (`expires_at`): descarga los clips a `public/` en cuanto
terminen, no guardes la URL.

Encola todos los clips de golpe y luego recorre las tareas esperando: corren en paralelo y doce
clips salen en ~2 minutos en vez de ~12. `scripts/gen-broll.mjs` ya lo hace así.

## Imagen

**El modelo por defecto es `gpt-image-2`** (OpenAI por APIMart).

- `POST /v1/images/generations` con `gpt-image-2` — asíncrono, devuelve `task_id`, se consulta en
  `/v1/tasks/<id>` y `result.images[0].url` **es una lista**. ~USD 0,0085 y ~38 s.
- Para editar (mandar una imagen de referencia) hay que ir a **OpenAI directo** con
  `OPENAI_API_KEY` (también en `~/.mi-claude/secrets.env`): el `/v1/images/edits` de APIMart solo
  acepta modelos Grok.
- El catálogo trae además `dall-e-3`, `flux-2-pro`, `flux-kontext-max`, `gpt-image-1.5`,
  `imagen-4.0-apimart` y modelos Gemini de imagen por `/v1/chat/completions` (devuelven la imagen en
  línea como `![image](data:image/jpeg;base64,...)`).

## Transcripción

`whisper-1` por el endpoint estándar. Evita descargar modelos locales. `scripts/transcribe.mjs`
hace todo: extrae el audio con ffmpeg y lo manda.

```bash
ffmpeg -y -i entrada.mp4 -ar 16000 -ac 1 -c:a pcm_s16le audio.wav
curl -s https://api.apimart.ai/v1/audio/transcriptions \
  -H "Authorization: Bearer $KEY" \
  -F file=@audio.wav -F model=whisper-1 -F language=es \
  -F response_format=verbose_json \
  -F "timestamp_granularities[]=word" \
  -F "timestamp_granularities[]=segment"
```

Devuelve `segments[]` (frases con `start`/`end`) y `words[]` (palabra a palabra). Los segmentos
sirven para anclar rótulos; las palabras, para captions animados.

## Saldo

```bash
curl -s https://api.apimart.ai/v1/user/balance -H "Authorization: Bearer $KEY"
# -> {"remain_balance": 9.15, "remain_credits": 91.5, ...}
```

`/v1/balance` (sin `user/`) devuelve el consumo de **la clave**, no el de la cuenta, y con la cuota
ilimitada marca `remain_balance: -1`. Para saber si queda dinero, usa `/v1/user/balance`.

Consulta el saldo antes de una tanda y avisa del coste. Generar veinte clips son unos siete dólares
de la persona: que sepa lo que va a gastar antes de gastarlo, y si el saldo no da para la tanda
entera, dilo en vez de descubrirlo a mitad.
