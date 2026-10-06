# Receta: ElevenLabs (opcional, avanzado)

**Para qué:** enviar notas de voz de WhatsApp con una voz generada (incluida una voz clonada de la persona).
Es opcional: todo lo demás funciona sin esto.

**Costo:** tiene plan gratuito con pocos caracteres al mes; clonar la propia voz requiere un plan de pago.

**Qué se abre:** `https://elevenlabs.io/app/settings/api-keys`

**Variable que se guarda:** `ELEVENLABS_API_KEY` (no tiene un prefijo fijo que se valide).

## Lo que hace la persona

1. Entrar o registrarse en ElevenLabs. **Claude no crea la cuenta ni escribe la contraseña.**
2. Si quiere clonar su voz: elegir plan, pagar y grabar las muestras **ella misma**.

## Lo que hace Claude

1. Pregunta primero: *"Esto es opcional y algo avanzado: sirve para mandar notas de voz con una voz
   generada. ¿Lo configuramos ahora o lo dejamos para después?"* Si no, termina aquí.
2. Abre `https://elevenlabs.io/app/settings/api-keys` en el navegador integrado. Espera a la persona.
3. Busca el botón para crear una API key. **Pregunta antes**; nómbrala **mi-claude**. Si pide
   permisos, deja los que vienen por defecto (o los de texto a voz y voces).
4. La key suele mostrarse **una sola vez**: léela de inmediato o pide a la persona que la copie y la pegue en el chat.
   No la escribas en tus mensajes.
5. Guárdala (dentro de `~/mi-claude`):
   ```
   node setup/keys.mjs guardar ELEVENLABS '<la key>'
   ```
6. **Elegir la voz** (avanzado): `keys.mjs` no guarda el ID de la voz. Explica que la voz se configura
   siguiendo la documentación de la skill de WhatsApp (`~/.claude/skills/whatsapp/`, comando `wsp voz`);
   léela y sigue lo que indique. Si no está claro, deja la voz para después: la key ya quedó guardada.
7. *"Notas de voz listas ✅"* (o *"Key guardada; la voz la configuramos cuando quieras"*).

## Si algo falla

- **"ElevenLabs respondió 401":** key mal copiada o revocada; crea otra (con permiso).
- **Respondió 403 / permisos:** la key se creó con permisos restringidos; crea otra con acceso a voces y texto a voz.
- **Se acabaron los caracteres del mes:** límite del plan; la persona decide si paga.

## Si la página cambió

La intención: en ElevenLabs, **Settings / Developers → API Keys**. Busca "API Keys", "Developers",
"Create". Si no aparece en 2 intentos, que la persona la cree y la pegue en el chat.
