# Tests

## Las herramientas

- **Vitest** para lógica y reglas del negocio: archivos `*.test.ts` al lado del código
  (`lib/canales.ts` → `lib/canales.test.ts`). Config en `vitest.config.ts` y script
  `"test": "vitest run"` en el `package.json` de la app. Se corre con el gestor del proyecto
  (`npm test`, `pnpm test`, o `pnpm --filter <app> test` en un monorepo).
- **Playwright** para 3 a 5 flujos de punta a punta por app (por ejemplo en `e2e/flujos/`).
  Necesitan dev server y sesión; se corren a pedido o antes de entregarle algo grande a un cliente,
  no en cada push.
- **El freno**: `.githooks/pre-push` corre los tests; `git config core.hooksPath .githooks` lo
  activa (conviene ponerlo en el script `prepare` del `package.json`). Si un test falla, el push no sale.

## Qué se prueba (y qué no)

Se prueba lo que, si se rompe, le cuesta plata o confianza al cliente:
1. **Reglas del negocio**: a quién se le asigna un contacto, cuánto suma una venta, qué canal tiene
   un mensaje, qué cuenta como reembolso.
2. **Lo que entra de afuera**: el parseo de cada webhook con un fixture real guardado en
   `__fixtures__/` (el JSON que mandó la pasarela, el CRM, la red social…). Un fixture real vale más
   que diez inventados (sin datos personales: se reemplazan nombres, correos y teléfonos).
3. **Bugs que ya volvieron**: cada uno, un test de regresión con el nombre del comportamiento.
4. **Permisos**: que una cuenta no vea datos de otra (con una base local, con sus reglas de verdad).

No se prueba: que un componente pinte, estilos, textos, ni código de plantilla que no se tocó.

## Cómo se escribe

- El nombre del test es una frase en español de lo que la persona espera:
  `it('un mensaje de Instagram nunca cae en la pestaña WhatsApp')`.
- Arrange / act / assert, sin lógica en el test. Un test, una razón para fallar.
- Si la lógica está enredada con la base o con `fetch`, se extrae la parte que decide a una
  función pura y se prueba esa. Es el cambio de diseño que más paga.
- Mocks solo en el borde (cliente de la base, `fetch`); nunca se mockea la función que se está
  probando.
- Fechas: se fija la hora (`vi.useFakeTimers()`, `vi.setSystemTime`) y la zona se dice explícita.

## Bug → test → arreglo

1. Reproducir el bug con un test. **Correrlo y verlo fallar**; si pasa, el test no captura el bug.
2. Arreglar lo mínimo.
3. Correr el test (pasa) y la suite entera.
4. Commit con el arreglo y el test juntos.
5. Si el bug solo se ve en el navegador, el test es un flujo de Playwright, y además se corre una
   vez con el dev server arriba.

## Montar (proyecto sin tests)

1. Leer el `CLAUDE.md` / `README` del proyecto y ver qué base usa. Si es una base en la nube,
   **ningún test toca la base**: todo puro o mockeado.
2. Instalar Vitest como dependencia de desarrollo, crear `vitest.config.ts` (entorno node, los
   mismos alias del `tsconfig`), el script `test`, `.githooks/pre-push`, el `prepare` y
   `git config core.hooksPath .githooks`.
3. Sacar de `git log --oneline -80` los bugs que volvieron y escribir sus tests de regresión.
4. Un test de parseo por cada webhook, con fixture real si existe.
5. La prueba de doble entrega de cada integración (ver `datos.md`).
6. 3 a 5 flujos E2E: login, crear lo principal, cobrar, lo que vea el cliente todos los días.
7. Tests y typecheck en verde. Si un test destapa un bug real, se marca `it.fails` con comentario
   y se reporta; no se arregla en el mismo cambio sin decirlo.
8. Commit por nombre de archivo y push.

## Cuando `exigir-pruebas` frena un push

El push lleva un commit que parece arreglo y no trae archivo de test. Se escribe el test que
reproduce el bug, se agrega en un commit nuevo y se vuelve a subir. Si de verdad no hay nada
que probar (copy, CSS, un color), se enmienda el mensaje del commit sin subir con
`[sin-test: motivo]`. Nunca se usa el escape para ahorrarse un test que sí aplica.
