// Lectura y escritura de ~/.mi-claude/secrets.env. Nunca imprime valores.
import fs from 'node:fs';
import path from 'node:path';
import { archivoSecretos, esWindows } from './rutas.mjs';

const NOMBRE_VALIDO = /^[A-Z][A-Z0-9_]*$/;

export function leerSecretos(env = process.env) {
  const archivo = archivoSecretos(env);
  if (!fs.existsSync(archivo)) return {};
  const secretos = {};
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    secretos[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return secretos;
}

// Valor de una variable: primero el entorno, luego secrets.env.
export function secreto(nombre, env = process.env) {
  return env[nombre] || leerSecretos(env)[nombre] || '';
}

// Una key pegada desde el navegador suele traer espacios o comillas alrededor.
export function limpiarKey(valor) {
  return String(valor ?? '').trim().replace(/^(['"`])(.*)\1$/, '$2').trim();
}

export function guardarSecreto(nombre, valor, env = process.env) {
  if (!NOMBRE_VALIDO.test(nombre)) throw new Error(`Nombre de variable inválido: ${nombre}`);
  const limpio = limpiarKey(valor);
  if (!limpio) throw new Error(`La key de ${nombre} está vacía`);
  if (/[\r\n]/.test(limpio)) throw new Error(`La key de ${nombre} tiene saltos de línea; cópiala de nuevo`);

  const archivo = archivoSecretos(env);
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const actuales = leerSecretos(env);
  actuales[nombre] = limpio;
  const contenido =
    '# Keys de mi-claude. NO compartas este archivo.\n' +
    Object.entries(actuales).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';

  // Escritura atómica: si algo falla a mitad, el archivo anterior queda intacto.
  const temporal = `${archivo}.${process.pid}.tmp`;
  fs.writeFileSync(temporal, contenido, { mode: 0o600 });
  fs.renameSync(temporal, archivo);
  if (!esWindows) fs.chmodSync(archivo, 0o600);
}

export function enmascarar(valor) {
  if (!valor) return '(vacía)';
  if (valor.length <= 8) return '••••';
  return `${valor.slice(0, 3)}…${valor.slice(-4)}`;
}
