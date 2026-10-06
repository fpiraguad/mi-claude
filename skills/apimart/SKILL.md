---
name: apimart
description: Genera imágenes y videos con IA, transcribe audios y consulta el saldo usando la API de APIMart con la key de la persona. Usar cuando diga /apimart, "genera una imagen", "hazme una miniatura", "crea una portada", "hazme un video con IA", "transcribe este audio", "pásame a texto esta nota de voz" o "cuánto saldo tengo en apimart".
---

# APIMart: imágenes, video, transcripción y saldo

Todo pasa por un solo script, sin dependencias:

```
node "<carpeta de esta skill>/scripts/apimart.mjs" <comando> [opciones] [--json]
```

En Mac la carpeta es `~/.claude/skills/apimart`; en Windows, `%USERPROFILE%\.claude\skills\apimart`.
La key (`APIMART_API_KEY`, empieza por `sk-`) se lee del entorno o de `~/.mi-claude/secrets.env`.
Si falta, el script lo dice en español: la persona la crea en https://apimart.ai/keys.
Nunca muestres ni copies la key.

| Comando | Qué hace |
|---|---|
| `saldo` | Saldo disponible y gastado (en dólares y créditos) |
| `imagen "prompt" [--modelo gpt-image-1-official] [--tamano 1:1\|3:2\|2:3] [--salida archivo.png]` | Genera la imagen, espera a que esté (máximo unos 3 minutos) y la descarga |
| `video "prompt" [--modelo veo3.1-fast] [--formato 16:9\|9:16] [--salida archivo.mp4] --confirmado` | Genera un video de 8 s (VEO 3.1). Sin `--confirmado` solo muestra lo que haría |
| `transcribir archivo [--idioma es] [--formato text\|json\|srt\|vtt]` | Pasa a texto un audio o video (whisper-1) |
| `tarea <id>` | Estado de una generación que tardó más de la cuenta |

## Costos: confirma antes de gastar

- **Todo cuesta dinero del saldo de la persona.** Una imagen cuesta poco, un video bastante más.
- Antes de un **video**, o de muchas imágenes seguidas, dile qué vas a generar y que tiene costo, y espera
  un "sí". El script no genera video sin `--confirmado`. Si hay dudas, mira el `saldo` primero.
- Si APIMart responde 402, no hay saldo: la persona recarga en https://apimart.ai. No reintentes en bucle.

## Notas

- Miniaturas de YouTube: usa `--tamano 3:2`. Historias, reels y TikTok: `--tamano 2:3` (o `--formato 9:16` en video).
- Guarda el resultado en una carpeta que la persona entienda (por ejemplo, Escritorio o la carpeta del proyecto)
  con `--salida`, y dile la ruta. Los enlaces de APIMart caducan, por eso el script descarga el archivo.
- Si una imagen o video pasa el tiempo máximo, el script da el id. Revisa más tarde con `tarea <id>`.
  No la vuelvas a pedir, porque se cobraría dos veces.
- `--modelo` acepta otros modelos de la lista de APIMart (https://docs.apimart.ai/en/quickstart), por ejemplo
  `gpt-image-1.5-official` o `veo3.1-quality`.
- `--json` da la respuesta completa para que la leas tú. Al usuario muéstrale el texto normal.
