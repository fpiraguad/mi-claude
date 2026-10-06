# Datos entre sistemas

Integrar sistemas (pasarelas de pago, CRMs, Meta, WhatsApp, correo, Google, plataformas de cursos)
es donde más vuelven los bugs: ventas importadas tres veces con cifras que no cuadran, contactos
reasignados, canales duplicados, Instagram mezclado con WhatsApp, un contacto que «se convirtió» en
otro. Todo webhook, import, sync o cron pasa este checklist **antes** de darse por hecho.

## El checklist

1. **Llave de origen.** ¿Cuál es el id que manda el otro sistema (id de la transacción, `event.id`
   de Stripe, id del mensaje)? Va en una columna con restricción `UNIQUE` junto con la cuenta y el
   origen: `unique (account_id, origen, id_externo)`. Sin eso, no hay deduplicación: hay suerte.
2. **Upsert, no insert.** La escritura es `upsert(..., { onConflict: 'account_id,origen,id_externo' })`
   (o `INSERT … ON CONFLICT` en SQL). En lote, se deduplica el lote en memoria ANTES de mandarlo:
   dos filas del mismo lote que chocan entre sí tumban el lote entero.
3. **Llega dos veces, llega tarde, llega desordenado.** Los webhooks son «al menos una vez». Un
   evento viejo no pisa uno nuevo: se compara la fecha del evento, no la hora de llegada.
4. **Escrituras parciales.** Un PATCH a un JSONB, o a una API ajena, borra lo que no mandaste.
   Se mezcla con lo que había (`datos || nuevo`), nunca se reemplaza a ciegas.
5. **Nada se adivina.** El canal sale de por dónde llegó el mensaje, la moneda del payload, la
   persona de una llave exacta. Si falta el dato, se guarda como desconocido, no con un default.
6. **Hora y zona.** Se guarda en UTC (`timestamptz`); se muestra en la zona de la cuenta. Todo
   «hoy» o «este mes» se calcula en la zona del cliente.
7. **Topes.** Muchas APIs (PostgREST, por ejemplo) devuelven 1.000 filas por defecto: todo lo que
   recorra una tabla pagina o usa `count`. Un cron nunca corre más seguido de lo que tarda su corrida.
8. **La cifra cuadra con la fuente.** Si la pantalla muestra una suma que el cliente puede
   comparar (ventas del mes contra la pasarela, contactos contra el CRM), se deja un test o un
   script de conciliación con los números reales de un día, y se dice qué cuenta y qué no
   (reembolsos, cuotas, order bumps).
9. **El crudo se guarda.** El payload original va a un JSONB (`datos.crudo`) para poder
   reinterpretar sin volver a importar.
10. **Borrar nunca es automático** en un sync con un sistema del cliente (Google Contacts, Notion,
    un CRM). Un sync en dos sentidos necesita decidir quién gana en un conflicto; eso se le
    pregunta a la persona, no se asume.

## La prueba de doble entrega

Toda integración sale con este test:

- El mismo evento procesado dos veces → una sola fila.
- Dos eventos distintos → dos filas.
- Sin base en los tests: se mockea el cliente de la base y se verifica que la escritura es un
  upsert con la llave correcta, y con `grep` sobre las migraciones que la restricción `UNIQUE` existe.
- Con base local: contra la base de verdad, contando filas.

Molde (Vitest, con el cliente de la base mockeado):

```ts
import { describe, it, expect, vi } from 'vitest';
import { procesarEvento } from './procesar-evento';

describe('webhook de ventas', () => {
  it('el mismo evento dos veces deja una sola venta', async () => {
    const filas = new Map<string, unknown>();
    const db = {
      upsert: vi.fn(async (fila: { origen: string; id_externo: string }, opciones: { onConflict: string }) => {
        expect(opciones.onConflict).toBe('account_id,origen,id_externo');
        filas.set(`${fila.origen}:${fila.id_externo}`, fila);
      }),
    };
    const evento = { id: 'evt_123', monto: 50000 };
    await procesarEvento(db, 'cuenta-1', evento);
    await procesarEvento(db, 'cuenta-1', evento);
    expect(filas.size).toBe(1);
  });
});
```
