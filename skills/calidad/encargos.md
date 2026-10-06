# Encargos en lista

El reclamo más común es trabajo que se dio por hecho y no estaba: llega una lista de 8 a 30 puntos
(a veces dictada, mezclando idiomas) y se entregan 5. Cuando un encargo trae causa, archivo y
prueba, se cierra en uno o dos mensajes; cuando es lista suelta, vuelve al día siguiente. Esto
convierte la lista suelta en lo primero.

## Al recibirla

1. **Numerar todo**, incluso lo que viene suelto en un párrafo o en un audio. Un pedido por
   número. Si una frase trae dos cosas, son dos números.
2. **A cada punto, su «hecho cuando…»**: una línea observable. «Hecho cuando: en la bandeja,
   filtrando WhatsApp, no aparece ninguna conversación de Instagram». Si no se puede escribir, el
   punto es ambiguo: se pregunta solo ese, en una línea, y se sigue con los demás.
3. **Crear una tarea por punto** (`TaskCreate`), con el «hecho cuando» en la descripción.
4. Mostrar la lista numerada en el primer mensaje, corta. No se pide aprobación salvo que haya
   un punto ambiguo.
5. Partir en subagentes lo que no toque los mismos archivos.

## Al trabajar

- Si un punto es un bug, va por «Bug → test → arreglo» (`tests.md`).
- Si toca una integración, pasa el checklist de `datos.md`.

## Al cerrar

Una tabla, un renglón por punto, sin excepción:

| # | Punto | Estado | Evidencia |
|---|---|---|---|
| 1 | … | Hecho | test `canal de Instagram…` pasa / pantallazo |
| 2 | … | No hecho | falta la llave de X (se nombra por qué) |

- «Hecho» sin evidencia no existe. Evidencia es el nombre del test que pasa, el pantallazo del
  flujo recorrido o el dato consultado en la base.
- Lo que no se hizo se nombra en su renglón. Lo que no se nombre se da por hecho.
- Si la conversación se va a cortar con puntos abiertos, se dejan escritos (en un archivo de notas
  del proyecto o en la lista de tareas) antes de cortar.
