# Receta: Composio (Gmail)

**Para qué:** que Claude lea, busque y redacte correos de tu Gmail (y, si quieres, otras apps como
Calendar o Drive).

**Costo:** plan gratuito de Composio, suficiente para uso personal. No pide tarjeta.

**Qué se abre:** `https://dashboard.composio.dev`

**Variable que se guarda:** `COMPOSIO_CONSUMER_KEY` — la key empieza por `ck_`.

## Lo que hace la persona

1. Entrar o registrarse en Composio (con Google es lo más rápido). **Claude no crea la cuenta ni escribe la contraseña.**
2. Si aparece un formulario de bienvenida (nombre, para qué lo usa), llenarlo ella.
3. Más adelante, aprobar el acceso a Gmail en la pantalla de Google (elige su cuenta y da "Permitir").

## Lo que hace Claude

1. Dile: *"Ahora tu correo. Usamos Composio, que es gratis. Te abro la página: entra con tu cuenta
   (con Google es lo más fácil) y me avisas cuando estés dentro."*
2. Abre `https://dashboard.composio.dev` en el navegador integrado. Espera el aviso de la persona.
3. Ve a **For You** y busca la sección **Sessions & API Key** (o "API Key" / "Consumer key").
4. Si ya hay una key visible que empiece por `ck_`, úsala. Si hay que generarla, **pregunta antes**:
   *"¿Genero tu key de Composio?"* y, con el sí, haz clic en el botón para crearla/mostrarla.
   Si te deja ponerle nombre, usa **mi-claude**.
5. Lee la key del texto de la página (`get_page_text` o `find "ck_"`). No la escribas en el chat.
   Si no la puedes leer: *"Haz clic en el botón de copiar de la key y pégala aquí."*
6. Guárdala y verifícala (dentro de `~/mi-claude`):
   ```
   node setup/keys.mjs guardar COMPOSIO '<la key>'
   ```
7. Registra el MCP con la key nueva:
   ```
   node setup/instalar.mjs --solo mcp
   ```
8. Autorizar Gmail — cualquiera de las dos formas:
   - **Por adelantado (recomendado):** en el dashboard, **For You → Connect Apps → Gmail** → Connect.
     La persona elige su cuenta de Google y aprueba los permisos. **Pregunta antes de hacer clic en Connect.**
   - **La primera vez que se use:** cuando pidas leer el correo, Composio devuelve un *Connect Link*;
     ábrelo en el navegador integrado y la persona aprueba.
9. Prueba: si las herramientas de Composio ya están en esta conversación, lee los asuntos de los
   últimos 3 correos. Si no aparecen, explica que estarán disponibles en una conversación nueva.
10. *"Correo conectado ✅"*

## Si algo falla

- **"debería empezar por ck_":** copiaste otra cosa (un ID de usuario, una key de proyecto `ak_`
  u otra). Busca la que empieza por `ck_` en **Sessions & API Key**.
- **"Composio rechazó la key" (401/403):** la key fue revocada o está incompleta. Genera otra (con permiso) y guarda de nuevo.
- **Sin conexión:** internet o firewall; reintenta.
- **Google dice "Esta app no está verificada" o bloquea el acceso:** en cuentas de trabajo (Google
  Workspace) el administrador puede bloquearlo. Que pruebe con una cuenta personal o hable con su admin.
  No hagas clic en "Avanzado / continuar" por ella; es su decisión.
- **Las herramientas de Gmail no aparecen:** abre una conversación nueva (los MCP se cargan al inicio)
  y confirma que `node setup/instalar.mjs --solo mcp` terminó sin error.

## Si la página cambió

La intención: encontrar la **clave de consumidor** (empieza por `ck_`) que permite conectar Composio
como MCP en Claude. Busca palabras como "API Key", "Consumer", "MCP", "Sessions", "Settings".
Si no la encuentras en 2 intentos, pídele a la persona que la busque ella y la pegue en el chat.
