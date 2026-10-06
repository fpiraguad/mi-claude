#!/usr/bin/env node
// Hook UserPromptSubmit: VARIOS AGENTES A LA VEZ ES EL DEFAULT.
//
// Una regla leída al arrancar la sesión se diluye a los veinte turnos. Este
// aviso llega pegado al encargo, que es cuando se decide cómo partirlo.
//
// Solo sale con señales REALES de tarea divisible (varios frentes nombrados,
// verbo de barrido en plural, lista con viñetas, «todos los»), y nunca en un
// reporte de bug, en una continuación corta ni en la respuesta a una pregunta:
// un aviso que sale siempre enseña a ignorarlo.
import { leerEntrada, agregarContexto } from './comun.mjs';

const datos = await leerEntrada();
if (!datos) process.exit(0);

const prompt = String(datos.prompt || '').trim();
const bajo = prompt.toLowerCase();

if (prompt.length < 80 || prompt.startsWith('/')) process.exit(0);

// Contestar «sí, dale» o seguir con «ahora hazlo también en…» no es un encargo nuevo.
const RESPUESTA = new RegExp(
  '^(s[ií]|no|dale|ok|okey|listo|perfecto|exacto|correcto|claro|h[aá]zlo|sigue|' +
    'contin[uú]a|la primera|la segunda|la opci[oó]n|de corrido|fase por fase)\\b',
  'i',
);
// Reporte de un problema concreto: es UNA cosa, se mira de una.
const BUG = new RegExp(
  'no funciona|no sirve|no carga|no aparece|no guarda|no deja|no me deja|sigue sin|' +
    'est[aá] roto|se rompi[oó]|se cae|da error|sale error|me sale|falla\\b|fall[oó]\\b|' +
    'arregla|arr[eé]glalo|corrige|revert|devu[eé]lvete',
  'i',
);

// --- Señales de que SÍ se puede partir ------------------------------------

// Dos o más viñetas o numerales al principio de línea.
const LISTA = (prompt.match(/^\s*(?:[-*•]|\d+[.)])\s+\S/gm) || []).length >= 2;
// «todos los», «cada uno de», «uno por uno».
const TODOS = /todos los|todas las|cada uno|cada una|uno por uno|en todos/.test(bajo);
// Dos o más frentes nombrados: rutas o archivos con extensión.
const FRENTES =
  new Set(prompt.match(/\b[\w.-]+\/[\w./-]+|\b[\w-]+\.(?:tsx?|jsx?|py|sql|md|json)\b/g) || []).size >= 2;
// Verbo de barrido + algo en plural.
const VERBO = /\b(revisa|rev[ií]sate|compara|audita|busca|analiza|lee|mira|documenta|prueba|inventaria|resume|lista)\w*\b/i;
const PLURAL = new RegExp(
  '\\b(proyectos|archivos|pantallas|apps|aplicaciones|componentes|tablas|rutas|hooks|' +
    'skills|clientes|repos|carpetas|m[oó]dulos|endpoints|migraciones|varios|varias|ambos|' +
    'ambas|los dos|las dos|los tres)\\b',
  'i',
);
const BARRIDO = VERBO.test(bajo) && PLURAL.test(bajo);

const DIVISIBLE_FUERTE = LISTA || FRENTES || TODOS;

if (RESPUESTA.test(prompt) && !DIVISIBLE_FUERTE) process.exit(0);
if (BUG.test(bajo) && !DIVISIBLE_FUERTE) process.exit(0);
if (!(DIVISIBLE_FUERTE || BARRIDO)) process.exit(0);

agregarContexto(
  'UserPromptSubmit',
  'MÉTODO DE TRABAJO: esto se puede partir. Lanza los pedazos A LA VEZ — subagentes en paralelo en ' +
    'un solo mensaje, tandas de máximo CINCO, cada uno con encargo cerrado (qué buscar, dónde, qué ' +
    'devolver) y que devuelva conclusiones, no volcados. En serie solo lo que dependa del anterior o ' +
    'escriba los mismos archivos.',
);
