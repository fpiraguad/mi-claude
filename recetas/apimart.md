# Receta: APIMart

**Para qué:** generar imágenes (y video) y transcribir audios, incluidas las notas de voz de WhatsApp.

**Costo:** pago por uso (prepago). Recargas el saldo que quieras y se descuenta por cada imagen o
audio; una imagen cuesta centavos de dólar. Sin saldo, la key es válida pero no genera nada.

**Qué se abre:** `https://apimart.ai/keys`

**Variable que se guarda:** `APIMART_API_KEY` — la key empieza por `sk-` (con guion).

## Lo que hace la persona

1. Entrar o registrarse en APIMart. **Claude no crea la cuenta ni escribe la contraseña.**
2. Recargar saldo si quiere usarlo ya (la sección de recarga / billing). **La recarga y la tarjeta
   las pone ella; Claude no paga.** Puede hacerlo después.

## Lo que hace Claude

1. Dile: *"Ahora APIMart, para generar imágenes y transcribir audios. Se paga por uso (centavos por
   imagen). Te abro la página: entra a tu cuenta y me avisas."*
2. Abre `https://apimart.ai/keys` en el navegador integrado. Si redirige al login, espera a la persona.
3. Busca el botón **Create API Key**. **Pregunta antes:** *"¿Creo una key llamada «mi-claude»?"*
4. Con el sí: haz clic, escribe el nombre **mi-claude** si lo pide y confirma.
5. Lee la key (empieza por `sk-`) del texto de la página o del modal. En algunas listas la key se ve
   recortada con `****`: en ese caso usa el botón de copiar/ver o pídele a la persona que la copie y la
   pegue en el chat. No la escribas en tus mensajes.
6. Guárdala y verifícala (dentro de `~/mi-claude`):
   ```
   node setup/keys.mjs guardar APIMART '<la key>'
   ```
   La verificación consulta el saldo (no gasta nada). Dile el saldo que reporta.
7. Si el saldo es 0: *"La key quedó lista ✅ Para generar imágenes necesitas recargar saldo; eso lo haces
   tú en la sección de recarga cuando quieras."*
8. Opcional: `node ~/.claude/skills/apimart/scripts/apimart.mjs saldo` para confirmar desde la skill.

## Si algo falla

- **"debería empezar por sk-":** se copió otra cosa o una key de otro servicio. Ojo: Zernio usa `sk_`
  (guion bajo); APIMart usa `sk-` (guion).
- **"APIMart respondió 401":** key mal copiada (incompleta o con `****`) o borrada. Copia de nuevo o crea otra (con permiso).
- **Error de saldo / "insufficient balance" al generar:** la key sirve; falta recargar. Lo hace la persona.
- **Sin conexión:** internet o firewall; reintenta.

## Si la página cambió

La intención: en el panel de APIMart, la sección de **API keys / tokens** con un botón para crear una
nueva. Busca "API Key", "Token", "Keys", "Create". Si en 2 intentos no la encuentras, pídele a la
persona que cree la key ella y la pegue en el chat.
