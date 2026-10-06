# Receta: Parallel (opcional)

**Para qué:** investigación profunda y búsquedas en volumen. **La búsqueda normal ya funciona sin key**
(`recetas/busqueda.md`); esto es solo para quien quiera más.

**Costo:** Parallel da créditos gratis cada mes (alrededor de 5 USD) al registrar una tarjeta.
Por encima de eso, pago por uso.

**Qué se abre:** `https://platform.parallel.ai`

**Variable que se guarda:** `PARALLEL_API_KEY` (no tiene un prefijo fijo).

## Lo que hace la persona

1. Entrar o registrarse en Parallel. **Claude no crea la cuenta ni escribe la contraseña.**
2. Si quiere los créditos gratis, registrar la tarjeta **ella misma**. Claude no escribe datos de tarjeta.

## Lo que hace Claude

1. Pregunta primero si la quiere: *"Esto es opcional: sirve para investigaciones largas. La búsqueda
   normal ya te funciona gratis. ¿La configuramos?"* Si dice que no, sigue con el siguiente servicio.
2. Abre `https://platform.parallel.ai` en el navegador integrado. Espera a la persona.
3. Busca la sección **API Keys** y el botón para crear una. **Pregunta antes** de crearla; nómbrala **mi-claude**.
4. Lee la key del texto de la página o pide que la pegue en el chat. No la escribas en tus mensajes.
5. Guárdala (dentro de `~/mi-claude`):
   ```
   node setup/keys.mjs guardar PARALLEL '<la key>'
   ```
6. *"Investigación profunda lista ✅"*

## Si algo falla

- **"Parallel rechazó la key" (401/403):** mal copiada o revocada. Copia de nuevo o crea otra (con permiso).
- **Errores de crédito al usarla:** se acabaron los créditos del mes; la persona decide si recarga.
- **Sin conexión:** internet o firewall; reintenta.

## Si la página cambió

La intención: el panel de desarrollador de Parallel, sección de **API keys**. Busca "API", "Keys",
"Settings". Si no aparece en 2 intentos, que la persona la cree y la pegue en el chat.
