# INSTALAR.md — guion para Claude

> Este archivo está escrito **para ti, Claude**. La persona te pegó una instrucción como
> *"Instala mi asistente: lee https://raw.githubusercontent.com/fpiraguad/mi-claude/main/INSTALAR.md y sigue sus pasos."*.
> Síguelo en orden, en español, con mensajes cortos y amables. La persona **no es técnica**:
> no le pidas que abra una terminal ni que entienda comandos. Tú corres los comandos; ella solo
> hace lo que únicamente ella puede hacer (entrar a sus cuentas, escanear un QR, aprobar permisos).

## Objetivo

Al terminar, la persona tiene en su computador (Mac o Windows):

- Un asistente con método de trabajo (skills y hooks instalados en `~/.claude`).
- Su **WhatsApp** conectado (leer, buscar, responder, transcribir notas de voz).
- **Búsqueda web** (Parallel, sin key).
- Su **correo Gmail** vía Composio.
- **APIMart** para generar imágenes y transcribir audio.
- **Zernio** para publicar en sus redes sociales, con al menos una red conectada.
- `node setup/doctor.mjs` **todo en verde** (los opcionales pueden quedar en blanco).

Todo con **sus propias keys**, guardadas solo en su computador en `~/.mi-claude/secrets.env`.

## Límites que nunca cruzas (y explicas con cariño)

Díselos a la persona al empezar, en 3 líneas, y recuérdalos cuando toque:

1. **Tú no creas cuentas ni escribes contraseñas.** Si una página pide registrarse o iniciar sesión,
   le dices: *"Esta parte la haces tú: entra con tu correo o con Google y me avisas cuando estés dentro."*
   Tampoco resuelves captchas ni códigos de verificación.
2. **Tú no pagas ni escribes datos de tarjeta.** Si un servicio pide recargar saldo o una tarjeta,
   lo hace la persona. Tú solo explicas cuánto cuesta y para qué.
3. **Pides permiso antes de hacer clic en "Crear key"** (o cualquier botón que cree, borre, publique
   o acepte términos). Una pregunta corta: *"¿Creo la key con el nombre «mi-claude»?"* y esperas el sí.
4. **Las keys nunca se muestran.** No escribas una key en tus mensajes, no la repitas, no la resumas,
   no la imprimas con `echo`, `cat` ni `type`. Solo viaja dentro del comando `keys.mjs guardar`,
   que la verifica y nunca la imprime. Si te refieres a ella, di "tu key de APIMart" o muestra solo
   lo que devuelve `keys.mjs listar` (ya viene enmascarada).
5. **Si no puedes leer la key de la página** (está oculta, en un modal raro, o la página cambió),
   pídele a la persona: *"Haz clic en el botón de copiar de la key y pégala aquí en el chat."*
   Apenas la pegue, guárdala con `keys.mjs guardar` y no la vuelvas a mencionar.
6. Nunca aceptes términos, cookies ni permisos OAuth por la persona sin preguntarle. En banners de
   cookies elige la opción más privada (rechazar las no esenciales) salvo que ella diga otra cosa.

## Cómo trabajas

- **Una acción a la vez.** Antes de cada paso, un mensaje corto: qué vas a hacer y por qué
  (*"Ahora conecto tu WhatsApp. Te voy a mostrar un código QR."*). Después, un mensaje corto con el
  resultado (*"Listo, WhatsApp conectado ✅"*).
- **Usa el navegador integrado** de Claude (las herramientas `mcp__Claude_Browser__*`: `preview_start`
  con `url` o `navigate` para abrir, `get_page_text` / `read_page` / `find` para leer, `computer` para
  hacer clic, `screenshot` para ver). Ábrele cada página ahí; así la persona ve lo mismo que tú.
  Si el navegador integrado no está disponible, dale el enlace para que lo abra ella en su navegador
  y pídele que te pegue la key en el chat.
- Cada servicio tiene su receta en `recetas/<servicio>.md`. **Léela antes de empezar ese servicio.**
- Si un comando falla, lee el error, intenta arreglarlo tú (máximo 2 intentos razonables) y, si no,
  explícale a la persona en una frase qué pasó y qué opción tiene. No la llenes de texto técnico.
- No inventes. Si algo no se pudo verificar, dilo.
- **Mac sin herramientas de desarrollador:** si aparece una ventana de macOS pidiendo instalar
  "herramientas de desarrollador" (o "command line developer tools"), dile a la persona que toque
  **Cancelar**: nada de esta instalación las necesita. Sigue con el paso en el que ibas.

## Regla de retomar

Si la instalación se interrumpió (se cerró Claude, se fue el internet, la persona dice "sigue" o
"termina lo que falta"):

1. Si existe `~/mi-claude/setup/doctor.mjs`, corre `node setup/doctor.mjs` dentro de `~/mi-claude`.
2. Lee la sección **"Qué falta"** y continúa **solo con lo que está en rojo**, en el orden del Paso 4.
3. No repitas lo que ya está en verde ni vuelvas a pedir keys que ya funcionan.

---

## Paso 0 — Detectar el sistema y la terminal

Averigua (sin preguntarle a la persona) si estás en **Mac** o **Windows** y qué terminal usa tu
herramienta de comandos:

- **Mac** → `bash`/`zsh`. Usa los comandos marcados *Mac*.
- **Windows** → normalmente **PowerShell** (si tu herramienta es Git Bash, usa los comandos *Mac*
  pero con rutas de Windows). Usa los comandos marcados *Windows (PowerShell)*.
  - En PowerShell escribe **`curl.exe`** (no `curl`, que es otro comando) y **`tar.exe`**.
  - Pon las keys entre comillas simples `'...'`.

La carpeta de instalación es siempre **`~/mi-claude`** (en Windows `%USERPROFILE%\mi-claude`,
o sea `$HOME\mi-claude` en PowerShell). Todos los comandos `node setup/...` se corren **dentro** de
esa carpeta.

Mensaje para la persona: *"Hola 👋 Voy a instalar tu asistente. Son unos 10 minutos. Yo hago la
parte técnica; tú solo vas a entrar a tus cuentas cuando te lo pida y escanear un QR con tu celular."*
(Y luego los límites de arriba, en corto.)

## Paso 1 — Descargar mi-claude

**Si `~/mi-claude` ya existe**, no descargues de nuevo: entra y corre `node setup/actualizar.mjs`
(actualiza sin tocar las keys en `~/.mi-claude`). Luego aplica la **regla de retomar**.

Si no existe:

*Mac*
```bash
cd ~ && curl -L -o mi-claude.zip https://github.com/fpiraguad/mi-claude/archive/refs/heads/main.zip \
  && tar -xf mi-claude.zip && mv mi-claude-main mi-claude && rm mi-claude.zip
```

*Windows (PowerShell)*
```powershell
Set-Location $HOME
curl.exe -L -o mi-claude.zip https://github.com/fpiraguad/mi-claude/archive/refs/heads/main.zip
tar.exe -xf mi-claude.zip
Rename-Item mi-claude-main mi-claude
Remove-Item mi-claude.zip
```

Comprueba que existe `~/mi-claude/INSTALAR.md`. **No uses `git clone` ni ningún comando `git`**:
la persona puede no tener Git, y en un Mac nuevo el simple hecho de llamar a `git` abre una ventana
pidiendo instalar "herramientas de desarrollador". El ZIP es suficiente.

## Paso 2 — Node.js 22.13 o más nuevo

Revisa con `node --version`. Si da `v22.13` o mayor (o `v23`, `v24`…), sigue al Paso 3.

*Mac* (sin contraseña de administrador y **sin Git**: el Node oficial queda en `~/.local/node`):
```bash
# Instalar Node 22 en ~/.local/node
ARQ=$(uname -m); if [ "$ARQ" = x86_64 ]; then ARQ=x64; fi
ARCHIVO=$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | grep -o "node-v22[0-9.]*-darwin-$ARQ\.tar\.gz" | head -1)
mkdir -p "$HOME/.local/node" && curl -fsSL "https://nodejs.org/dist/latest-v22.x/$ARCHIVO" | tar -xz -C "$HOME/.local/node" --strip-components 1
for f in .zprofile .zshrc .bash_profile; do grep -qs '.local/node/bin' "$HOME/$f" || printf '\nexport PATH="$HOME/.local/node/bin:$PATH"\n' >> "$HOME/$f"; done
export PATH="$HOME/.local/node/bin:$PATH"; node --version
```
No uses el instalador de nvm: en un Mac sin herramientas de desarrollador se detiene (y con
`METHOD=git`, o sin `METHOD`, llama a `git`, que abre la ventana de "instalar herramientas").
Como cada comando abre una terminal nueva, si luego `node` no aparece, antepón
`export PATH="$HOME/.local/node/bin:$PATH";` a tus comandos.

*Windows (PowerShell)*:
```powershell
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
node --version
```
Antes de correr `winget`, dile a la persona que Windows puede mostrar una ventana pidiendo permiso
y que debe aceptarla ella.

**Si `winget` no existe** (pasa en algunos Windows 10), usa el instalador oficial. Primero averigua
cuál es el último Node 22:
```powershell
# Resolver el instalador de Node 22 (MSI)
$arq = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$indice = (curl.exe -fsSL https://nodejs.org/dist/index.json) -join "`n" | ConvertFrom-Json
$version = ($indice | Where-Object { $_.version -like 'v22.*' -and $_.files -contains "win-$arq-msi" } | Select-Object -First 1).version
$url = "https://nodejs.org/dist/$version/node-$version-$arq.msi"
$msi = Join-Path $env:TEMP "node-$version-$arq.msi"
$url
```
Luego descárgalo e instálalo (dile antes a la persona que va a salir una ventana de Windows pidiendo
permiso y que la acepte ella):
```powershell
curl.exe -fL -o $msi $url
Start-Process msiexec -Wait -ArgumentList '/i', "`"$msi`"", '/passive'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
node --version
```
Si `node` sigue sin aparecer, pídele que cierre y vuelva a abrir Claude, y retoma con la regla de retomar.

**npm en Windows:** el instalador corre npm por su cuenta; tú no lo necesitas. Si alguna vez corres
npm o npx tú mismo en PowerShell, escribe **`npm.cmd`** / **`npx.cmd`** (no `npm`/`npx`, que PowerShell
puede bloquear con un error de "ejecución de scripts deshabilitada"). **Nunca cambies la política de
ejecución** (`Set-ExecutionPolicy`) del computador de la persona.

## Paso 3 — Instalar todo

Dentro de `~/mi-claude`:

```
node setup/instalar.mjs
```

Instala skills, hooks, el método de trabajo, los MCP (búsqueda y, si ya hay key, Composio) y el
servicio de WhatsApp en segundo plano. Si falla un paso puntual, puedes repetir solo ese con
`node setup/instalar.mjs --solo <paso>`. Para ver qué haría sin cambiar nada: `--en-seco`.

No necesita Git ni Python: si el computador no tiene Git, las skills de terceros se bajan como ZIP
(el instalador lo detecta solo, sin llamar a `git`). En Mac, si `node` no aparece, antepón
`export PATH="$HOME/.local/node/bin:$PATH";` al comando.

Mensaje: *"Listo lo básico ✅ Ahora conectamos tus servicios, uno por uno."*

## Paso 4 — Conectar los servicios (en este orden)

Para cada uno: lee la receta, cuéntale a la persona en una línea para qué sirve y cuánto cuesta,
hazlo, verifica y celebra corto.

| # | Servicio | Receta | Listo cuando |
|---|---|---|---|
| 1 | WhatsApp (QR) | `recetas/whatsapp.md` | `wsp estado` dice conectado |
| 2 | Búsqueda web | `recetas/busqueda.md` | el MCP de Parallel aparece conectado (no hay nada que hacer) |
| 3 | Composio / Gmail | `recetas/composio.md` | `node setup/keys.mjs verificar COMPOSIO` ✅ y MCP registrado |
| 4 | APIMart | `recetas/apimart.md` | `node setup/keys.mjs verificar APIMART` ✅ |
| 5 | Zernio | `recetas/zernio.md` | key ✅ **y** al menos una red conectada |
| 6 | Parallel (opcional) | `recetas/parallel.md` | solo si la persona quiere investigación profunda |
| 7 | ElevenLabs (opcional, avanzado) | `recetas/elevenlabs.md` | solo si quiere notas de voz con su voz |

Pregunta por los opcionales en una sola frase al final: *"¿Quieres además investigación profunda
(Parallel) o notas de voz con tu propia voz (ElevenLabs)? Son opcionales; podemos dejarlos para después."*

Forma general de guardar una key (detalles en cada receta):
```
node setup/keys.mjs guardar <SERVICIO> '<la key>'
node setup/keys.mjs verificar <SERVICIO>
```
`guardar` verifica la key **antes** de guardarla: si sale ❌, no se guardó nada y la key anterior
(si había) sigue intacta.

## Paso 5 — Doctor

```
node setup/doctor.mjs
```

Si hay algo en rojo, vuelve solo a esa receta. Muéstrale a la persona un resumen corto (no la tabla
cruda si es muy larga): qué quedó ✅ y qué quedó pendiente.

## Paso 6 — Prueba de fuego

Pídele a la persona que pruebe estas tres cosas, una a la vez, escribiéndolas ella:

1. *"¿Qué mensajes tengo sin leer en WhatsApp?"*
2. *"Busca las noticias de hoy sobre <un tema que le interese>"*
3. *"Genera una imagen de <lo que quiera>"*

Si conectó Gmail y una red: *"Resume mis últimos 5 correos"* o *"¿Qué cuentas tengo conectadas
en Zernio?"*.

Cierre: *"¡Quedó listo! 🎉 Tus keys están solo en tu computador. Cuando quieras actualizar, dime
«actualiza mi asistente». Si algo deja de funcionar, dime «revisa mi asistente» y corro el doctor."*

Cuando la persona diga *"actualiza mi asistente"*: `node setup/actualizar.mjs` dentro de `~/mi-claude`.
Cuando diga *"revisa mi asistente"*: `node setup/doctor.mjs` y regla de retomar.
Si pide crear o publicar apps: lee `fase2/LEEME.md`.
