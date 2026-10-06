#!/usr/bin/env node
// Hook PreToolUse(Bash): LOS ATAJOS QUE CUESTAN CAROS.
//
// Frena cuatro costumbres que el método (metodo/CLAUDE.md) ya prohíbe:
//
// - Leer archivos del proyecto con `cat` / `sed -n` / `Get-Content`. Lo que
//   entra por la terminal se queda en el contexto y se relee en cada turno.
//   Con Read se lee el tramo que hace falta, y no se repite.
// - `git add -A` / `git add .`: se lleva por delante lo que otra sesión esté
//   haciendo en el mismo repo. Se commitea por nombre de archivo.
// - `format:fix` / `lint:fix` sin ruta: reformatea el repo entero y llena el
//   commit de ruido.
// - Dev servers por Bash, que deberían ir por el preview con su puerto fijo.
// - Y además: imprimir un archivo de secretos.
//
// Se mira POR SENTENCIA y sin lo entrecomillado: `cat a.ts | grep x`,
// `cat > archivo`, `cat << EOF`, `tail -f` de un log y `git log | head -20`
// NO se frenan. Ante la duda, pasa.
import path from 'node:path';
import os from 'node:os';
import { leerEntrada, negar, limpiar, sentencias, sinHeredocs, partir, nombreOrden } from './comun.mjs';

const datos = await leerEntrada();
if (!datos) process.exit(0);

const crudo = String(datos.tool_input?.command || '');
const cwd = datos.cwd || process.cwd();

// En PowerShell `cat`, `type` y `gc` son alias de Get-Content.
const LECTORES = new Set(['cat', 'bat', 'head', 'tail', 'less', 'more', 'sed', 'get-content', 'gc', 'type']);
const NO_SON_ORDENES = new Set(['pkill', 'kill', 'killall', 'grep', 'rg', 'ps', 'echo', 'printf',
  'which', 'lsof', 'comm', 'man', 'write-output', 'write-host', 'select-string', 'stop-process']);
const GESTORES = new Set(['pnpm', 'npm', 'yarn', 'bun', 'npx', 'turbo']);
const BINARIOS_DEV = new Set(['next', 'vercel', 'vite', 'remix', 'astro', 'nest', 'expo']);

const LEER_POR_TERMINAL =
  'no es para leer archivos: lo que entra por la terminal se queda en el contexto y se relee en cada turno. ' +
  'Usa Read (con offset/limit si es largo) o Grep/Glob sobre';
const DEV_SERVER =
  'Los dev servers no se levantan con Bash: usa `preview_start` con el nombre del proyecto ' +
  '(puerto fijo en .claude/launch.json).';
const SIN_MOSTRAR =
  'Si necesitas saber si una key existe, compruébalo sin mostrar el valor ' +
  '(por ejemplo `node ~/mi-claude/setup/keys.mjs listar`).';

const pareceRuta = (arg) => /[\\/]/.test(arg) || /\.\w{1,5}$/.test(arg);

/** ¿El archivo es del proyecto en el que se está trabajando? Relativo = sí. Absoluto = solo si cuelga del cwd. */
function delProyecto(arg) {
  let ruta = arg.replace(/^\$HOME[\\/]/, '~/').replace(/^\$env:USERPROFILE[\\/]/i, '~/');
  if (ruta.startsWith('~/') || ruta.startsWith('~\\')) ruta = path.join(os.homedir(), ruta.slice(2));
  const absoluta = path.isAbsolute(ruta) || /^[a-z]:[\\/]/i.test(ruta);
  if (!absoluta) return true;
  const relativa = path.relative(path.resolve(cwd), path.resolve(ruta));
  return relativa === '' || (!relativa.startsWith('..') && !path.isAbsolute(relativa));
}

// --- 1. Leer archivos con la terminal -------------------------------------

for (const frase of sentencias(sinHeredocs(crudo))) {
  if (/[|<>]/.test(frase)) continue; // pipe o redirección: eso es acotar salida o escribir, no leer
  const tokens = partir(frase);
  if (!tokens.length) continue;
  const orden = nombreOrden(tokens[0]).toLowerCase();
  if (!LECTORES.has(orden)) continue;
  if (orden === 'sed' && !tokens.includes('-n')) continue;
  if (['tail', 'head'].includes(orden) && tokens.some((t) => ['-f', '-F', '--follow'].includes(t))) continue;
  if (['get-content', 'gc'].includes(orden) && tokens.some((t) => /^-(wait|tail|totalcount|first|head)$/i.test(t))) continue;
  // En `sed -n '10,20p' x.ts` el script no es un archivo: solo cuenta el último token.
  const candidatos = orden === 'sed' ? [tokens.at(-1)] : tokens.slice(1).filter((t) => !t.startsWith('-'));
  const archivos = candidatos.filter((a) => pareceRuta(a) && !/secrets\.env|\.env\b/.test(a) && delProyecto(a));
  if (archivos.length) negar(`\`${orden}\` ${LEER_POR_TERMINAL} ${archivos[0]}.`);
}

// --- 2, 3 y 4: sobre el comando sin texto muerto --------------------------

for (const frase of sentencias(limpiar(crudo))) {
  const tokens = partir(frase);
  if (!tokens.length) continue;
  const orden = nombreOrden(tokens[0]).toLowerCase();
  if (NO_SON_ORDENES.has(orden)) continue;

  if (/\bgit\s+add\s+(-A\b|--all\b|\.(\s|$))/.test(frase)) {
    negar(
      '`git add -A` / `git add .` no: commitea por nombre de archivo. Puede haber otra sesión ' +
        'trabajando en el mismo repo y te llevarías sus cambios por delante.',
    );
  }

  if (/\b(format|lint):fix\b/.test(frase)) {
    const resto = frase.split(':fix').slice(1).join(':fix');
    if (!partir(resto).some((t) => !t.startsWith('-') && pareceRuta(t))) {
      negar(
        '`format:fix` / `lint:fix` sin ruta reformatea el repo entero y llena el commit de cambios ' +
          'que nadie pidió. Acota la ruta del archivo que tocaste.',
      );
    }
  }

  if (GESTORES.has(orden) && tokens.slice(1).some((t) => t === 'dev' || t.startsWith('dev:'))) negar(DEV_SERVER);
  for (let i = 0; i < tokens.length - 1; i++) {
    if (BINARIOS_DEV.has(nombreOrden(tokens[i])) && tokens[i + 1] === 'dev') negar(DEV_SERVER);
  }
}

// --- 5. Los secretos no se imprimen ---------------------------------------
// Las keys viven en ~/.mi-claude/secrets.env. Copiarlas, moverlas o escribirlas
// es trabajo normal; IMPRIMIRLAS no, porque acaban en el contexto, en la
// pantalla y en el historial de la conversación.

const INTERPRETES = new Set(['python3', 'python', 'py', 'node', 'ruby', 'perl', 'php', 'deno', 'bun']);
const FLAGS_INLINE = new Set(['-c', '-e', '-p', '-', '--eval', '--print']);
const SECRETO = /secrets\.env|(^|[\s/\\'"=])\.env(\.[\w-]+)?\b/;
const NO_IMPRIMEN = new Set(['cp', 'mv', 'ln', 'rm', 'touch', 'chmod', 'test', '[', 'ls', 'stat', 'diff',
  'copy-item', 'move-item', 'remove-item', 'test-path', 'get-item', 'get-childitem', 'dir', 'icacls']);

const conInline = (tokens) => tokens.slice(1, 3).some((t) => FLAGS_INLINE.has(t));

// Un intérprete inline se mira CON su heredoc: `python3 - <<PY … PY` es la
// forma más cómoda de volcar un archivo, y el cuerpo es justo lo que hay que ver.
for (const frase of sentencias(sinHeredocs(crudo))) {
  const tokens = partir(frase);
  if (tokens.length && INTERPRETES.has(nombreOrden(tokens[0]).toLowerCase()) && conInline(tokens) && SECRETO.test(crudo)) {
    negar(
      'Ese comando estaría volcando un archivo de secretos: las keys acabarían en el contexto y en el ' +
        'historial. ' + SIN_MOSTRAR,
    );
  }
}

for (const frase of sentencias(sinHeredocs(crudo))) {
  if (!SECRETO.test(frase)) continue;
  const tokens = partir(frase);
  if (!tokens.length) continue;
  const orden = nombreOrden(tokens[0]).toLowerCase();
  // Mover, copiar o comprobar que existe: eso es montar un proyecto, no espiar.
  if (NO_IMPRIMEN.has(orden)) continue;
  if (LECTORES.has(orden)) {
    negar('Ahí estarías imprimiendo un archivo de secretos. ' + SIN_MOSTRAR);
  }
  if (INTERPRETES.has(orden) && conInline(tokens)) {
    negar('Ahí estarías imprimiendo un archivo de secretos. ' + SIN_MOSTRAR);
  }
  if (/\$\(\s*(cat|head|tail|less|bat|get-content|gc)\b[^)]*\.env/i.test(frase) ||
      /\b(xxd|od|strings|base64)\b[^|;]*\.env/.test(frase)) {
    negar('Ahí estarías volcando un archivo de secretos. Cópialo si hace falta en un proyecto, pero no lo imprimas.');
  }
}

process.exit(0);
