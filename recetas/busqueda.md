# Receta: Búsqueda web

**Para qué:** que Claude busque en internet información actual (noticias, precios, datos) con fuentes.

**Costo:** gratis. Usa el MCP hospedado de Parallel `https://search.parallel.ai/mcp`, que **no necesita key**.

**Qué se abre:** nada.

## Lo que hace la persona

Nada. 🙂

## Lo que hace Claude

1. Dile: *"La búsqueda web ya viene incluida y es gratis; solo compruebo que esté activa."*
2. Verifica que el MCP esté registrado: `claude mcp list` y busca la línea de Parallel / search
   con estado conectado.
3. Si no aparece: `node setup/instalar.mjs --solo mcp` (dentro de `~/mi-claude`) y vuelve a revisar.
4. Prueba rápida: haz una búsqueda corta (por ejemplo, el clima de hoy en su ciudad) y muéstrale una línea.
5. *"Búsqueda lista ✅"*

## Si algo falla

- **`claude` no se encuentra como comando:** sáltate la verificación por terminal; el doctor
  (`node setup/doctor.mjs`) revisa el MCP por su cuenta.
- **El MCP aparece pero falla al conectar:** casi siempre es internet o un firewall corporativo.
  Pide que pruebe con otra red; reintenta más tarde.
- **Las herramientas de búsqueda no aparecen en esta conversación:** los MCP nuevos se cargan al
  iniciar una conversación nueva. Dile que al terminar la instalación abra una conversación nueva.
- **Quiere búsquedas más profundas o con más volumen:** eso es la key opcional → `recetas/parallel.md`.

## Si la página cambió

No hay página. Si cambió la dirección del MCP, revisa el README del repo actualizado
(`node setup/actualizar.mjs`) y vuelve a correr `node setup/instalar.mjs --solo mcp`.
