#!/usr/bin/env node
// Guardar, verificar y listar las keys de la persona. Nunca imprime una key completa.
//
//   node setup/keys.mjs guardar APIMART sk-xxxx      (o la key por stdin)
//   node setup/keys.mjs verificar APIMART            (o "todos")
//   node setup/keys.mjs listar
import { pathToFileURL } from 'node:url';
import { SERVICIOS, servicio, verificarServicio } from './lib/servicios.mjs';
import { guardarSecreto, leerSecretos, enmascarar, limpiarKey } from './lib/secretos.mjs';
import { archivoSecretos } from './lib/rutas.mjs';

const AJUSTES = ['ELEVENLABS_VOICE_ID'];

async function leerStdin() {
  if (process.stdin.isTTY) return '';
  let datos = '';
  for await (const trozo of process.stdin) datos += trozo;
  return datos.trim();
}

export async function verificar(id, { env = process.env, fetch = globalThis.fetch } = {}) {
  const s = servicio(id);
  const key = env[s.variable] || leerSecretos(env)[s.variable] || '';
  return verificarServicio(id, key, fetch);
}

export async function guardar(id, valor, { env = process.env, fetch = globalThis.fetch } = {}) {
  const s = servicio(id);
  const key = limpiarKey(valor);
  // Se verifica ANTES de guardar: una key mala no reemplaza una buena.
  const resultado = await verificarServicio(id, key, fetch);
  if (!resultado.ok) return { ...resultado, guardada: false };
  guardarSecreto(s.variable, key, env);
  return { ...resultado, guardada: true };
}

export async function listar({ env = process.env, fetch = globalThis.fetch } = {}) {
  const secretos = leerSecretos(env);
  const filas = [];
  for (const [id, s] of Object.entries(SERVICIOS)) {
    const key = env[s.variable] || secretos[s.variable] || '';
    const r = key ? await verificarServicio(id, key, fetch) : { ok: false, detalle: 'falta la key' };
    filas.push({ id, nombre: s.nombre, opcional: s.opcional, key: key ? enmascarar(key) : '—', ...r });
  }
  return filas;
}

async function main([accion, id, valor]) {
  if (accion === 'guardar') {
    if (!id) throw new Error('Uso: node setup/keys.mjs guardar <SERVICIO> <key>');
    const r = await guardar(id, valor || (await leerStdin()));
    if (r.guardada) console.log(`✅ ${servicio(id).nombre}: guardada y verificada (${r.detalle}).`);
    else { console.log(`❌ No se guardó: ${r.detalle}.`); process.exitCode = 1; }
  } else if (accion === 'fijar') {
    // Ajustes que no son keys de un servicio (p. ej. ELEVENLABS_VOICE_ID): se guardan sin verificar.
    const nombre = String(id || '').toUpperCase();
    if (!AJUSTES.includes(nombre)) throw new Error(`Solo se pueden fijar: ${AJUSTES.join(', ')}`);
    guardarSecreto(nombre, valor || (await leerStdin()));
    console.log(`✅ ${nombre} guardado.`);
  } else if (accion === 'verificar') {
    const ids = !id || id === 'todos' ? Object.keys(SERVICIOS) : [id];
    for (const i of ids) {
      const r = await verificar(i);
      console.log(`${r.ok ? '✅' : '❌'} ${i}: ${r.detalle}`);
      if (!r.ok && !(SERVICIOS[i.toUpperCase()]?.opcional && r.detalle === 'falta la key')) process.exitCode = 1;
    }
  } else if (accion === 'listar') {
    for (const f of await listar()) {
      const marca = f.ok ? '✅' : f.opcional && f.key === '—' ? '⚪' : '❌';
      console.log(`${marca} ${f.id.padEnd(11)} ${f.key.padEnd(12)} ${f.detalle}`);
    }
    console.log(`\nArchivo: ${archivoSecretos()}`);
  } else {
    console.log('Uso: node setup/keys.mjs guardar|verificar|listar [SERVICIO] [key]');
    console.log(`     node setup/keys.mjs fijar ${AJUSTES.join('|')} <valor>`);
    console.log(`Servicios: ${Object.keys(SERVICIOS).join(', ')}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
}
