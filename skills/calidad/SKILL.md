---
name: calidad
description: El sistema de calidad de tus proyectos — tests (Vitest + Playwright), integraciones que no duplican datos (webhooks, imports, syncs) y encargos en lista que se cierran punto por punto con evidencia. Tres modos: montar los tests en un proyecto que no los tiene, arreglar un bug con el test que lo reproduce primero, y auditar un proyecto. Usar cuando la persona diga /calidad, "monta los tests", "audita la calidad", "que no vuelva a pasar", "esto ya lo habías arreglado", "corrige de raíz", cuando un bug reaparece, cuando se toque un webhook, un import o un sync, cuando un hook (exigir-pruebas, datos-idempotentes, encargo-en-lista) lo nombre, o cuando llegue una lista larga de cambios.
---

# Calidad — que lo arreglado no vuelva

Los bugs que más cansan son los que vuelven: se arreglan, se da por hecho, y a las dos semanas
reaparecen. Casi siempre es porque el que probaba era una persona (y después sus clientes). Aquí el
que prueba es el código.

Tres playbooks. Se lee solo el que toca:

| Situación | Playbook |
|---|---|
| Montar tests, arreglar un bug, escribir un test, un push frenado por `exigir-pruebas` | `tests.md` |
| Tocar un webhook, un import, un sync, un cron o una cifra que se compara con otro sistema | `datos.md` |
| Llega una lista de 6 puntos o más, o un dictado con varios pedidos | `encargos.md` |

## Modos

**`/calidad montar <proyecto>`**: el proyecto no tiene tests. Seguir «Montar» en `tests.md`. Termina
con Vitest corriendo, el pre-push puesto, los tests de regresión de los bugs que ya volvieron
(se sacan de `git log`) y 3 a 5 flujos E2E de los caminos que mueven plata o clientes.

**`/calidad arreglar`** (o cualquier bug): primero el test que falla, después el arreglo. Ver
«Bug → test → arreglo» en `tests.md`. Es el modo por defecto ante un «no funciona».

**`/calidad auditar <proyecto>`**: no se toca código. Se entrega una tabla corta:
- Flujos críticos (login, crear lo principal, cobrar, el webhook que entra): ¿tienen test?
- Cada integración (`app/api/webhooks/*`, imports, syncs, crons): ¿llave única de origen en la
  base?, ¿upsert?, ¿prueba de doble entrega?
- Bugs que volvieron según `git log` (mensajes con «otra vez», «vuelve», «ya no», «arregla»): ¿tienen
  test de regresión?
- Nota final de 0 a 10 y los 3 tests que más valen, en orden.

## Lo que no se negocia

- **Todo arreglo sale con el test que reproduce el bug.** El test se ve fallar antes del arreglo y
  pasar después. Lo hace cumplir el hook `exigir-pruebas` en cada `git push` de un repo que ya tiene
  Vitest. Excepción honesta: copy, CSS o diseño puro → `[sin-test: motivo]` en el mensaje del
  commit.
- **Toda integración sale con su prueba de doble entrega**: el mismo evento dos veces deja una
  sola fila.
- **Los tests nunca escriben en una base de producción ni llaman APIs externas.** Todo puro o
  mockeado; la integración real contra una base solo con una base local.
- **«Listo» con evidencia**: el nombre del test que pasa, o el pantallazo del flujo. Abrir la
  pantalla no es evidencia.
- **Explicado en llano**: al cerrar, una línea en español sencillo de qué protege cada test nuevo
  («si la pasarela manda la misma venta dos veces, sigue contando una»). Nada de jerga.
