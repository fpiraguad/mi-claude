# mi-claude

Tu asistente de Claude con **WhatsApp, correo, búsqueda web, imágenes y redes sociales** — instalado
en 10 minutos, en Mac o Windows, sin saber programar y **con tus propias cuentas**.

👉 **Página de instalación:** https://fpiraguad.github.io/mi-claude/

## Qué obtienes

- 💬 **WhatsApp conectado a Claude:** "¿qué tengo sin leer?", "resume el grupo de la familia", "respóndele a Ana que llego a las 6". Transcribe tus notas de voz.
- 📧 **Tu Gmail:** leer, buscar y redactar correos (vía Composio).
- 🔎 **Búsqueda web** con fuentes, gratis (Parallel).
- 🎨 **Imágenes y transcripciones** con APIMart.
- 📣 **Publicar en tus redes** (Instagram, TikTok, LinkedIn, Facebook, X…) con Zernio.

Además, un método de trabajo para Claude (skills y reglas) que lo hace más ordenado y cuidadoso.

## Instalar en 2 pasos

1. Descarga la app de Claude (https://claude.ai/download), ábrela y entra a la pestaña **Code**.
2. Pega esta instrucción y sigue lo que Claude te diga:

   ```
   Instala mi asistente desde https://github.com/fpiraguad/mi-claude siguiendo su INSTALAR.md
   ```

Claude descarga todo, instala lo necesario y te abre cada página en su navegador integrado.
Tú solo entras a tus cuentas, escaneas un QR con el celular y apruebas permisos.
**Claude nunca crea cuentas, ni escribe tus contraseñas, ni paga por ti.**

### Mac

- Funciona en macOS reciente. No necesita contraseña de administrador: Node se instala con nvm en tu usuario.
- WhatsApp corre en segundo plano como servicio de tu usuario y arranca solo al encender.

### Windows

- Windows 10 u 11. **No necesitas Git.** Claude usa PowerShell.
- Node se instala con `winget`; Windows puede pedirte que aceptes una ventana de permiso.
- WhatsApp arranca solo al iniciar sesión (sin permisos de administrador).

## Qué necesitas

- Una cuenta de Claude con un plan que incluya Claude Code.
- Un celular con WhatsApp.
- Unos 10 minutos.

## Qué cuesta

| Servicio | Costo |
|---|---|
| WhatsApp | Gratis (corre en tu computador) |
| Búsqueda web | Gratis |
| Composio (Gmail) | Plan gratuito |
| Zernio (redes) | Gratis hasta 2 cuentas conectadas |
| APIMart (imágenes, audio) | Pago por uso: recargas saldo y se descuenta centavos por imagen o audio |
| Parallel (investigación profunda) | Opcional; créditos gratis mensuales al registrar tarjeta |
| ElevenLabs (voz) | Opcional; plan gratis limitado, clonar tu voz es de pago |

## Privacidad

- Tus keys se guardan **solo en tu computador**, en `~/.mi-claude/secrets.env`
  (Windows: `%USERPROFILE%\.mi-claude\secrets.env`). Nunca en este repositorio ni en ningún servidor nuestro.
- Los scripts nunca imprimen una key completa; `node setup/keys.mjs listar` las muestra enmascaradas.
- Tus chats de WhatsApp se guardan localmente en tu computador.
- Cada servicio (Composio, APIMart, Zernio…) tiene su propia política de privacidad: tus datos pasan
  por ellos solo cuando le pides a Claude usar ese servicio.

## Actualizar

Dile a Claude: **"actualiza mi asistente"**. O, dentro de la carpeta `~/mi-claude`:

```
node setup/actualizar.mjs
```

No toca tus keys (`~/.mi-claude`). Para revisar que todo funcione: `node setup/doctor.mjs`.

## Desinstalar

Dile a Claude: **"desinstala mi-claude"** y pídele que:

1. Detenga y quite el servicio de WhatsApp en segundo plano.
2. Quite los MCP agregados (`claude mcp list` para verlos, `claude mcp remove <nombre>` para quitarlos).
3. Borre las carpetas `~/mi-claude` y, si ya no quieres tus keys, `~/.mi-claude`.

Desvincula también el dispositivo en tu celular: WhatsApp → Dispositivos vinculados.

## Para contribuir

Requiere Node ≥ 22.13.

```
node --test                         # pruebas
node scripts/sin-datos-personales.mjs   # escáner: falla si encuentra keys o datos personales
node scripts/pre-commit.mjs         # lo mismo que corre antes de cada commit
```

- Nunca subas keys, rutas personales, nombres ni datos de clientes. El escáner bloquea patrones
  de key (`sk-`, `sk_`, `ck_`, `ghp_`, JWT…); la lista de términos personales vive fuera del repo.
- Las recetas (`recetas/*.md`) describen la **intención** ("busca la sección API Keys"), no coordenadas,
  porque los dashboards cambian.
- La CI corre en macOS y Windows: pruebas + `node setup/instalar.mjs --en-seco`.

## Licencia

MIT — ver [LICENSE](LICENSE).
