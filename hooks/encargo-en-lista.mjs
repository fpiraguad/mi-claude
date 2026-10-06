#!/usr/bin/env node
// Hook UserPromptSubmit: UNA LISTA SE CIERRA PUNTO POR PUNTO, CON EVIDENCIA.
//
// El error más caro es dar por hecho un trabajo que no estaba: llegan 8 a 30
// puntos y se entregan 5, y lo que falta reaparece al día siguiente. Este aviso
// llega pegado a la lista, que es cuando se decide cómo se va a llevar la cuenta.
//
// Salta con 6 viñetas o numerales, o con un dictado largo que trae 6 pedidos o
// más aunque vengan en un párrafo.
import { leerEntrada, agregarContexto } from './comun.mjs';

const datos = await leerEntrada();
if (!datos) process.exit(0);

const prompt = String(datos.prompt || '').trim();
if (prompt.length < 60 || prompt.startsWith('/')) process.exit(0);
// El resumen de una sesión compactada no es un encargo nuevo.
if (prompt.startsWith('This session is being continued')) process.exit(0);

const VINETAS = (prompt.match(/^\s*(?:[-*•]|\d+[.)]|[a-z][.)])\s+\S/gm) || []).length;

// Un dictado: pedidos sueltos separados por punto, salto de línea o «y también».
const PEDIDO = new RegExp(
  '\\b(agrega\\w*|añad\\w*|quita\\w*|elimina\\w*|borra\\w*|cambia\\w*|pon\\w*|arregl\\w*|corrig\\w*|' +
    'haz\\w*|hazme|crea\\w*|mueve\\w*|revisa\\w*|ajusta\\w*|reemplaza\\w*|conecta\\w*|' +
    'que (?:se|aparezca|salga|quede|diga|no)|falta\\w*|necesito|quiero|deber[ií]a|' +
    'add|remove|change|fix|make|move|should)\\b',
  'i',
);
const frases = prompt
  .split(/[.\n;!?]+|\by tambi[eé]n\b|\badem[aá]s\b|\botra cosa\b/)
  .filter((f) => f && f.trim());
const PEDIDOS = frases.filter((f) => PEDIDO.test(f)).length;

if (VINETAS < 6 && !(prompt.length >= 450 && PEDIDOS >= 6)) process.exit(0);

agregarContexto(
  'UserPromptSubmit',
  'ENCARGO EN LISTA (skill /calidad, encargos.md). Numera TODOS los pedidos, también los que vienen ' +
    'sueltos en un párrafo; a cada uno su «hecho cuando…» observable y una tarea con TaskCreate. ' +
    'Pregunta en una línea solo el punto ambiguo y sigue con los demás. Cierra con una tabla: ' +
    '# · punto · estado · evidencia (test que pasa, pantallazo o dato comprobado). Lo que no quedó ' +
    'se nombra en su renglón.',
);
