#!/usr/bin/env node
// Hook PostToolUse (Edit/Write/MultiEdit): LO QUE ENTRA DE AFUERA NO SE DUPLICA.
//
// Los bugs que más vuelven son de datos entre sistemas: una importación que
// entra tres veces, registros reasignados, canales duplicados o mezclados.
//
// Cuando Claude toca un webhook, un import, un sync o un cron, le llega el
// checklist de /calidad (datos.md) UNA sola vez por sesión y por proyecto:
// repetirlo en cada edición enseña a ignorarlo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { leerEntrada, agregarContexto } from './comun.mjs';

const datos = await leerEntrada();
if (!datos) process.exit(0);

// En Windows las rutas vienen con `\`: se normalizan para poder mirarlas igual.
const ruta = String(datos.tool_input?.file_path || '').replace(/\\/g, '/');
if (!ruta) process.exit(0);

const INTEGRACION = new RegExp(
  '/api/webhooks?/|/webhooks?/|/crons?/|' +
    '/(importar|importacion|importaciones|imports?|sync|sincroniz\\w*)(/|[-_.])|' +
    '/(importar|sincronizar|sync)[\\w-]*\\.(ts|tsx|js|mjs|py)$',
  'i',
);
const NO_ES_CODIGO = /\.(test|spec)\.|__fixtures__|\.(md|json|sql)$/i;

if (!INTEGRACION.test(ruta) || NO_ES_CODIGO.test(ruta)) process.exit(0);

// Una vez por sesión y por proyecto (el proyecto = la carpeta donde corre la sesión).
const proyecto = String(datos.cwd || path.dirname(ruta));
const sesion = String(datos.session_id || 'sin-sesion').replace(/\W/g, '');
const estado = path.join(os.tmpdir(), `claude-datos-idempotentes-${sesion}.json`);
let vistos = new Set();
try {
  vistos = new Set(JSON.parse(fs.readFileSync(estado, 'utf8')));
} catch {
  // primera vez en esta sesión
}
if (vistos.has(proyecto)) process.exit(0);
vistos.add(proyecto);
try {
  fs.writeFileSync(estado, JSON.stringify([...vistos].sort()));
} catch {
  // si no se puede guardar, el aviso puede repetirse: no es grave
}

agregarContexto(
  'PostToolUse',
  'INTEGRACIÓN TOCADA (skill /calidad, datos.md). Antes de darla por hecha: llave de origen con UNIQUE ' +
    '(account_id, origen, id_externo) y escritura por upsert con onConflict; el lote deduplicado en ' +
    'memoria antes de mandarlo; el evento repetido, tardío o desordenado no duplica ni pisa lo nuevo; ' +
    'nada se adivina (canal, moneda, persona); UTC guardado y zona del cliente al mostrar; paginar más ' +
    'allá de 1.000 filas; el crudo en un JSONB. Sale con su PRUEBA DE DOBLE ENTREGA: el mismo evento ' +
    'dos veces deja una sola fila.',
);
