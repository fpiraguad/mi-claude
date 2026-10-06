# Receta: Zernio

**Para qué:** publicar y programar posts en tus redes (Instagram, Facebook, TikTok, LinkedIn, X, YouTube…)
pidiéndoselo a Claude.

**Costo:** gratis hasta 2 cuentas conectadas. Planes de pago para más cuentas. Publicar en X puede
tener costo por uso.

**Qué se abre:** `https://zernio.com/dashboard/api-keys`

**Variable que se guarda:** `ZERNIO_API_KEY` — la key empieza por `sk_` (con guion bajo).

## Lo que hace la persona

1. Entrar o registrarse en Zernio. **Claude no crea la cuenta ni escribe la contraseña.**
2. Al conectar una red: iniciar sesión en esa red (Instagram, TikTok…) y aprobar el permiso.

## Lo que hace Claude

### A. La key

1. Dile: *"Ahora Zernio, para publicar en tus redes. Es gratis para 2 cuentas. Entra a tu cuenta y me avisas."*
2. Abre `https://zernio.com/dashboard/api-keys` en el navegador integrado. Espera a la persona.
3. Busca **Create API key**. **Pregunta antes:** *"¿Creo una key llamada «mi-claude»?"*
4. Con el sí: haz clic, nombre **mi-claude**, confirma.
5. **La key se muestra una sola vez.** Léela de inmediato del texto de la página (empieza por `sk_`).
   Si no puedes leerla, pídele a la persona que la copie **antes de cerrar la ventana** y la pegue en el chat.
   No la escribas en tus mensajes.
6. Guárdala y verifícala (dentro de `~/mi-claude`):
   ```
   node setup/keys.mjs guardar ZERNIO '<la key>'
   ```

### B. Conectar al menos una red

1. Pregunta: *"¿Qué red quieres conectar primero? (Instagram, Facebook, TikTok, LinkedIn, X, YouTube…)"*
2. Revisa perfiles y cuentas:
   ```
   node ~/.claude/skills/zernio/scripts/zernio.mjs perfiles
   node ~/.claude/skills/zernio/scripts/zernio.mjs cuentas
   ```
3. Pide el enlace de conexión:
   ```
   node ~/.claude/skills/zernio/scripts/zernio.mjs conectar <plataforma>
   ```
   El comando imprime un `authUrl`. Ábrelo en el navegador integrado.
4. La persona inicia sesión en la red y aprueba. (Para Instagram suele hacer falta una cuenta
   profesional o de creador vinculada a una página de Facebook; si no la tiene, explícaselo y
   que elija otra red o lo deje para después.)
5. Verifica con `zernio.mjs cuentas` (o `node setup/keys.mjs verificar ZERNIO`, que reporta
   cuántas cuentas hay conectadas). Debe haber al menos 1.
6. *"Zernio listo ✅ Ya puedes decirme «publica esto en <red>»."* **Nunca publiques sin que la persona
   apruebe el texto y la imagen.**

## Si algo falla

- **"debería empezar por sk_":** se copió otra cosa. Ojo: APIMart usa `sk-` (guion), Zernio `sk_` (guion bajo).
- **"Zernio respondió 401":** key incompleta o revocada. Como solo se muestra una vez, crea otra (con permiso).
- **"0 cuenta(s) conectada(s)" después de aprobar:** espera unos segundos y verifica otra vez; si sigue,
  repite `conectar` (el enlace caduca).
- **Límite de cuentas:** el plan gratis permite 2. Para más, la persona decide si paga.
- **La red rechaza el permiso:** cuenta personal vs. profesional, o permisos negados. Que lo intente otra vez
  aceptando todos los permisos que pide.

## Si la página cambió

La intención: en el dashboard de Zernio, la sección **API Keys** (a veces en Settings / Developers)
con un botón para crear una. Si `conectar` cambió, `zernio.mjs` sin argumentos muestra la ayuda.
Si en 2 intentos no encuentras la sección, que la persona cree la key y la pegue en el chat.
