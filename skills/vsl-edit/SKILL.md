---
name: vsl-edit
description: >
  Edita un video de talking head crudo y lo convierte en un VSL, reel o video
  de YouTube de alta retención con Remotion: transcribe la locución, la parte en
  beats de guion, genera B-roll cinematográfico con APIMart (Omni-Flash-Ext) y
  monta rótulos, contadores, tachados y llamadas a la acción animadas sobre el
  plano original. Úsalo siempre que el usuario traiga un .mp4 hablado y pida
  "editarlo", "meterle B-roll", "ponerle animaciones", "hacerlo más retentivo" o
  lo describa por estilo — VSL brasileño, estilo Iman Gadzhi, reel viral, short,
  video de ventas, anuncio. Úsalo también cuando pida sólo una parte del
  proceso: generar B-roll para un video, transcribir con timestamps para
  sincronizar gráficos, o añadir rótulos animados a un video existente. No lo
  uses para animaciones de Remotion sin video base (usa remotion-create) ni para
  recortes o conversiones simples de formato (usa ffmpeg).
license: MIT
---

# Montaje de VSL y videos de retención

Un talking head plano pierde al espectador en los primeros diez segundos. Lo que
lo retiene no es el guion —ese ya está grabado— sino la **densidad de estímulo**:
que la imagen cambie antes de que el ojo se aburra, y que cada cambio refuerce lo
que se está diciendo en ese instante exacto.

Este skill monta esa capa encima del material existente. El plano original no se
toca: se le añaden insertos, rótulos y movimiento.

## Antes de empezar

- **Keys**: `APIMART_API_KEY` (B-roll y transcripción) y, solo para editar imágenes con
  referencia, `OPENAI_API_KEY`. Viven en `~/.mi-claude/secrets.env`; los scripts las leen de ahí
  (o del entorno) y nunca las imprimen. Si falta una, se guarda con
  `node ~/mi-claude/setup/keys.mjs guardar APIMART <key>`.
- **Herramientas**: Node (ya está) y ffmpeg (el del sistema o el que trae mi-claude). Los scripts
  son `.mjs` y corren igual en Mac y Windows. Remotion se instala en el proyecto del video
  (`npx create-video@latest` o el proyecto que ya exista).
- Los scripts viven en `~/.claude/skills/vsl-edit/scripts/` y se corren desde la carpeta del
  proyecto del video.

## El principio que ordena todo lo demás

**Los tiempos se declaran en segundos del audio original.** No en frames, no en
un timeline abstracto. Es lo único que se puede verificar a oído: pones el video
en el segundo 34.6 y compruebas que ahí dice lo que el rótulo afirma. Un montaje
declarado en frames es imposible de auditar y se desincroniza en cuanto alguien
toca una duración.

De ahí sale la arquitectura: una tabla de datos con el edit entero, y componentes
que la consumen.

## Flujo

### 1. Medir el material

```bash
ffprobe -v error -show_entries format=duration -show_entries stream=codec_type,width,height,r_frame_rate -of default=noprint_wrappers=1 entrada.mp4
```

(Si no hay `ffprobe`, `ffmpeg -hide_banner -i entrada.mp4` muestra lo mismo en su cabecera.)
Fíjate en el fps y las dimensiones: el B-roll generado debe coincidir o habrá
reescalados sucios.

**Busca subtítulos quemados antes de diseñar nada.** Mucho material que llega ya
viene con captions incrustados, y si no los localizas vas a superponer dos textos.

```bash
node ~/.claude/skills/vsl-edit/scripts/find-captions.mjs entrada.mp4
```

mide la franja que ocupan; el resultado define una zona prohibida para todos los gráficos.

Mira también media docena de fotogramas repartidos: revelan si el material ya
tiene multicámara, qué lado ocupa la cara y cómo está etalonado.

### 2. Transcribir con timestamps

```bash
node ~/.claude/skills/vsl-edit/scripts/transcribe.mjs entrada.mp4 transcript.json
```

Devuelve segmentos y palabras con tiempos (otro idioma: variable `LANG_CODE`, por defecto `es`).
Es la partitura del montaje: cada rótulo se ancla a la frase que lo justifica.

### 3. Partir el guion en beats

Lee la transcripción y localiza la estructura. Un VSL de venta casi siempre
recorre: hook → a quién le habla → promesa → mecanismo negativo ("sin X, sin Y")
→ agitación del problema → mecanismo → entregable → prueba → oferta → precio →
bono/escasez → garantía → CTA.

No todos los videos son VSL. Un video de YouTube va por capítulos y tensión
narrativa; un reel es un solo beat estirado. Pero el trabajo es el mismo:
**una idea por beat, un gráfico por idea**. Dos gráficos compitiendo en pantalla
se anulan.

`references/beats.md` desarrolla cada tipo de beat y qué gráfico le corresponde.

### 4. Generar el B-roll

```bash
node ~/.claude/skills/vsl-edit/scripts/gen-broll.mjs          # genera lo que falte
node ~/.claude/skills/vsl-edit/scripts/gen-broll.mjs 03 07    # fuerza esos ids
```

Encola los clips en APIMart y los descarga. Los prompts viven en un
`scripts/shots.json` propio del proyecto (el formato está en la cabecera del script).

Lee `references/apimart.md` antes de la primera llamada: tiene los modelos, los
endpoints, los costes y el detalle de que Omni-Flash-Ext devuelve **video de 8s**
por un endpoint que se llama `images/generations`. **Cada clip cuesta dinero de la
persona**: di el coste estimado de la tanda antes de lanzarla.

Sobre qué pedir:

- **Un sustantivo concreto por clip.** El B-roll ilustra cosas, no conceptos. "30
  videos" se ilustra con una rejilla de miniaturas; "libertad" no se ilustra.
- **Fija el look en todos los prompts** (misma óptica, mismo etalonaje, misma
  profundidad de campo) o los insertos parecerán robados de doce videos distintos.
- **Prohíbe el texto explícitamente** — "no text, no captions, no watermark". Los
  modelos meten letreros ilegibles que delatan la generación.
- **Revisa lo generado antes de montarlo.** Extrae una tira de contactos del clip
  (`ffmpeg -i clip.mp4 -vf "select='not(mod(n\,16))',tile=6x2" -frames:v 1 tira.jpg`) y elige
  el tramo. Los clips llegan con 8s y sólo vas a usar 2: el trozo importa.

### 5. Colocar los insertos

- **1,5 a 2,5 segundos.** Más corto no se lee; más largo y el espectador olvida
  que hay una persona hablando.
- **Entre el 20% y el 30% del metraje.** Por debajo se siente estático, por
  encima el presentador desaparece y con él la confianza.
- **Nunca sobre el momento de prueba.** Cuando el guion dice "esto lo hice yo",
  "míralo tú mismo" o revela el truco, hay que ver la cara. Tapar ese instante con
  B-roll destruye justo lo que lo hacía creíble. Es el error más caro del montaje.
- **El audio sale siempre del plano base**, que nunca se desmonta. El B-roll va
  con `muted` por encima.

### 6. Montar la capa gráfica

Estructura que funciona y aguanta cambios:

```
src/<Pieza>/
  script.ts    — el edit entero en segundos: beats, insertos, destellos, zooms
  blocks.tsx   — un componente por beat
  atoms.tsx    — tipografía, grano, viñeta, letterbox, contador, tachado
  motion.ts    — una sola curva de entrada/salida para toda la pieza
  theme.ts     — color, escalones tipográficos, zonas seguras
```

Que el montaje entero se lea en un archivo de datos es lo que permite ajustarlo
sin tocar componentes.

`references/motion.md` cubre el sistema de movimiento: por qué una sola curva,
cómo escalonar elementos hermanos, y los recursos de retención (acercamiento
continuo, punch-in seco en los giros, destello de dos fotogramas sobre los cortes,
contadores, tachados que se dibujan).

### 7. Verificar por fotogramas, no por intuición

```bash
npx remotion still <Comp> out/f_620.png --frame=620
node ~/.claude/skills/vsl-edit/scripts/contact-sheet.mjs out/hoja.jpg out/f_*.png --cols 3
```

Renderiza los frames de cada beat y de cada inserto, y móntalos en una hoja de
contactos para verlos de golpe. Es la forma rápida de cazar lo que no se ve
leyendo código: un rótulo que pisa los subtítulos quemados, un gráfico sobre la
cara, o un B-roll que contradice el texto.

Ese último caso es más frecuente de lo que parece. Un clip de calendario que
enseña un "9" enorme debajo del rótulo "7 DÍAS" pasa el typecheck y arruina la
toma. Si el inserto y el rótulo dicen cosas distintas, cambia el tramo del clip.

Después abre Remotion Studio (en el preview) para revisar el movimiento, que en
fotogramas fijos no se ve.

**No renderices el video final salvo que te lo pidan.** Un render de 110s son
varios minutos y el usuario suele querer iterar antes.

## Zonas seguras

Las tres restricciones que definen dónde puede vivir un gráfico:

1. La franja de subtítulos quemados, si los hay.
2. La cara del presentador — mírala en varios fotogramas, en material multicámara
   se mueve de lado.
3. El recorte de las plataformas: en vertical, los ~15% inferiores se los come la
   interfaz de Reels y TikTok.

Lo que queda suele ser la columna izquierda y la franja superior. Anclar todos los
bloques a un mismo borde inferior por encima de los subtítulos da además ritmo
visual: los rótulos se relevan en el mismo sitio en lugar de saltar por la pantalla.

## Recursos

- `references/apimart.md` — API de generación: modelos, endpoints, costes, saldo.
- `references/beats.md` — estructura de guion y qué gráfico pide cada beat.
- `references/motion.md` — sistema de movimiento y recursos de retención.
- `scripts/transcribe.mjs` — transcripción con timestamps.
- `scripts/gen-broll.mjs` — generación y descarga de B-roll, resumible.
- `scripts/find-captions.mjs` — localiza subtítulos quemados.
- `scripts/contact-sheet.mjs` — hoja de contactos a partir de PNGs sueltos.
- `scripts/comun.mjs` — lectura de keys y búsqueda de ffmpeg (lo usan los demás).
