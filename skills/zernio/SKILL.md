---
name: zernio
description: Publica, programa y revisa posts en las redes sociales de la persona (Instagram, TikTok, Facebook, LinkedIn, YouTube, X, Threads, Pinterest y más) con la API REST de Zernio, y le da el enlace para conectar una red nueva. Usar cuando diga /zernio, "publica en instagram", "programa un post", "sube esto a tiktok", "conecta mi tiktok", "qué redes tengo conectadas", "cómo va mi publicación" o "qué he publicado".
---

# Zernio: publicar y programar en redes

Todo pasa por un solo script, sin MCP y sin dependencias:

```
node "<carpeta de esta skill>/scripts/zernio.mjs" <comando> [opciones] [--json]
```

En Mac la carpeta es `~/.claude/skills/zernio`; en Windows, `%USERPROFILE%\.claude\skills\zernio`.
La key (`ZERNIO_API_KEY`, empieza por `sk_`) se lee del entorno o de `~/.mi-claude/secrets.env`.
Si falta, el script lo dice en español: la persona la crea en https://zernio.com/dashboard/api-keys.
Nunca muestres, pidas por chat ni copies la key en ningún archivo.

| Comando | Qué hace |
|---|---|
| `cuentas` | Redes conectadas, cada una con su **id** (lo necesitas para publicar) |
| `perfiles` | Perfiles (grupos de cuentas) |
| `conectar <plataforma> [--perfil id]` | Devuelve el enlace (`authUrl`) para conectar esa red. Si no hay perfil, crea "Mi perfil" |
| `publicar --texto "..." --cuentas id1,id2 [--media archivo-o-url ...] [--programar 2026-12-01T10:00] [--zona America/Bogota]` | Vista previa. **No publica** |
| `publicar ... --confirmado` | Publica ahora o programa (con `--programar`) |
| `estado <postId>` | Estado por red: `scheduled`, `publishing`, `published`, `failed`, `partial`, y el enlace del post |
| `posts [--limite 10]` | Últimas publicaciones |

Plataformas para `conectar`: `instagram`, `tiktok`, `facebook`, `youtube`, `linkedin`, `twitter` (o `x`),
`threads`, `pinterest`, `bluesky`, `reddit`, `googlebusiness`, entre otras.

## Reglas de seguridad (obligatorias)

1. **Nunca publiques ni programes sin un "sí" explícito.** Corre primero `publicar` SIN `--confirmado`.
   Muéstrale a la persona, tal cual: el texto exacto, cada archivo o URL de media y las cuentas destino
   (red y @usuario), además de cuándo sale. Solo si responde que sí, repite el mismo comando con
   `--confirmado`. Si cambia algo, vuelve a mostrar la vista previa.
2. Un "sí" vale para esa publicación, no para las siguientes.
3. **Conectar una red lo hace la persona**, no tú. Corre `conectar <plataforma>`, abre el `authUrl`
   en el navegador y dile que inicie sesión y autorice. No escribas contraseñas en el formulario.
   Después confirma con `cuentas`.
4. Si Zernio responde 409, ese mismo contenido ya está programado o salió hace menos de 24 horas.
   No lo reintentes cambiando el texto a escondidas: pregúntale a la persona.

## Flujo típico

1. "Publica esta foto en Instagram": `cuentas`, y eliges el id de Instagram (si no hay, sigue el paso de conectar).
2. `publicar --texto "..." --cuentas <id> --media foto.jpg` y le muestras la vista previa.
3. Si dice que sí: el mismo comando con `--confirmado`. Le das el id y, si ya salió, el enlace.
4. "¿Cómo va?": `estado <id>`.

Notas:
- Los archivos locales se suben solos (Zernio da una URL firmada y el script sube el archivo ahí).
  Las URLs `https://` se usan tal cual.
- `--programar` sin zona horaria se lee en la hora local del computador (o en la que diga `--zona`).
  Con `Z` u offset (`-05:00`) se respeta ese offset.
- Las 2 primeras cuentas conectadas son gratis. X (Twitter) pide tarjeta en Zernio.
- `--json` da la respuesta completa para que la leas tú. Al usuario muéstrale el texto normal.
