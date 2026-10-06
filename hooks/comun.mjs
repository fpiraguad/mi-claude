// Piezas compartidas por los hooks de mi-claude.
//
// Un comando de shell NO es un string plano. Mirarlo entero hace que el arnés
// frene cosas que no tocaba: un `echo 'deploy'`, un `sleep` que no tiene nada
// que ver con el deploy de la otra punta, o la cadena `git push` escrita dentro
// de un script. Aquí se limpia lo que es texto y se parte lo que es ejecución.
//
import { writeSync } from "node:fs";

// Funciona igual si el comando viene de bash/zsh (Mac) o de PowerShell (Windows).

// --- Entrada y salida del hook -------------------------------------------

/** Lee el JSON que Claude Code manda por stdin. Devuelve null si no hay o no se entiende. */
export async function leerEntrada() {
  // Sin entrada por tubería (terminal, o un proceso que nunca cierra stdin) no se espera:
  // un hook colgado congela la sesión.
  if (process.stdin.isTTY) return null;
  let texto = '';
  try {
    process.stdin.setEncoding('utf8');
    texto = await new Promise((resolve) => {
      let acumulado = '';
      const reloj = setTimeout(() => {
        process.stdin.destroy();
        resolve(acumulado);
      }, 3000);
      process.stdin.on('data', (trozo) => (acumulado += trozo));
      process.stdin.on('end', () => {
        clearTimeout(reloj);
        resolve(acumulado);
      });
      process.stdin.on('error', () => {
        clearTimeout(reloj);
        resolve(acumulado);
      });
    });
  } catch {
    return null;
  }
  try {
    const datos = JSON.parse(texto);
    return datos && typeof datos === 'object' ? datos : null;
  } catch {
    return null;
  }
}

/** Escribe la respuesta JSON del hook en stdout. */
export function responder(objeto) {
  // Escritura síncrona: así nada se pierde aunque el proceso termine enseguida.
  writeSync(1, JSON.stringify(objeto) + '\n');
}

/** PreToolUse: niega la herramienta con un motivo que Claude lee. Termina el proceso con 0. */
export function negar(motivo) {
  responder({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: motivo,
    },
  });
  process.exit(0);
}

/** Inyecta contexto extra (UserPromptSubmit, PostToolUse…). */
export function agregarContexto(evento, texto) {
  responder({
    hookSpecificOutput: {
      hookEventName: evento,
      additionalContext: texto,
    },
  });
}

// --- Limpieza -------------------------------------------------------------

// El cuerpo de un heredoc es texto que se le pasa a otro programa, no algo que
// el shell ejecute. También los here-strings de PowerShell: @' … '@ y @" … "@.
const HEREDOC = /<<-?\s*['"]?(\w+)['"]?[\s\S]*?(\n\1\b|$)/g;
const HERESTRING_PS = /@(['"])\r?\n[\s\S]*?\r?\n\1@/g;

// Lo entrecomillado casi siempre es texto. Se conservan los tramos con
// sustitución de comando ($(...) o backticks) y los que traen una URL, porque
// ahí sí hay ejecución o un destino que hay que poder mirar (local contra remoto).
const COMILLAS = /'[^']*'|"[^"]*"/g;
const VIVO = /\$\(|`|:\/\//;

export function sinHeredocs(cmd) {
  return cmd.replace(HERESTRING_PS, ' ').replace(HEREDOC, ' ');
}

export function sinComillas(cmd) {
  return cmd.replace(COMILLAS, (m) => (VIVO.test(m) ? m : ' '));
}

/** Comando sin texto muerto: listo para buscarle palabras sospechosas. */
export function limpiar(cmd) {
  return sinComillas(sinHeredocs(cmd));
}

// --- Partido --------------------------------------------------------------

const SEGMENTO = /\|\||&&|;|\r?\n|\||&/;
const SENTENCIA = /\|\||&&|;|\r?\n/;

/** Trozos separados por ; && || | & — para ver qué va ANTES y qué DESPUÉS. */
export function segmentos(cmd) {
  return cmd.split(SEGMENTO).filter((s) => s.trim());
}

/** Como segmentos, pero SIN partir por `|`: dentro queda el pipe completo. */
export function sentencias(cmd) {
  return cmd.split(SENTENCIA).filter((s) => s.trim());
}

/**
 * Parte una sentencia en palabras, respetando comillas (como shlex.split).
 * La barra invertida solo escapa espacios y comillas, para no romper rutas de Windows.
 */
export function partir(texto) {
  const tokens = [];
  let actual = '';
  let hay = false;
  let comilla = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comilla) {
      if (c === comilla) comilla = null;
      else actual += c;
      continue;
    }
    if (c === "'" || c === '"') {
      comilla = c;
      hay = true;
      continue;
    }
    if (c === '\\' && i + 1 < texto.length && /[\s'"]/.test(texto[i + 1])) {
      actual += texto[++i];
      hay = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (hay) tokens.push(actual);
      actual = '';
      hay = false;
      continue;
    }
    actual += c;
    hay = true;
  }
  if (comilla) return texto.split(/\s+/).filter(Boolean); // comillas sin cerrar: partir a lo bruto
  if (hay) tokens.push(actual);
  return tokens;
}

/** Nombre del programa sin ruta ni extensión .exe/.cmd: `/usr/bin/git` → `git`. */
export function nombreOrden(token) {
  return (token || '').split(/[\\/]/).pop().replace(/\.(exe|cmd|bat|ps1)$/i, '');
}

// --- Local contra remoto --------------------------------------------------

export const LOCAL =
  /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\.local\b|\bcolima\b|\bdocker\b|\bsupabase\b/i;
export const PROVEEDOR = /\bvercel\b|\brailway\b|\bnetlify\b|\bflyctl\b/i;

const URL_REMOTA = /https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])[^\s"'`;|)&]+/i;
const HOST_REMOTO = /\b[\w-]+\.(ai|com|co|app|dev|io|net|org|me)\b/i;
const TRAE = /\b(curl|wget|http|https|Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b/i;

/** ¿Todo lo que hay apunta a este computador? Entonces las reglas de deploy no aplican. */
export function esLocal(cmd) {
  return LOCAL.test(cmd) && !PROVEEDOR.test(cmd);
}

/** Un curl/wget/Invoke-WebRequest contra un host que NO es este computador. */
export function peticionRemota(texto) {
  if (!TRAE.test(texto)) return false;
  if (URL_REMOTA.test(texto)) return true;
  return HOST_REMOTO.test(texto) && !LOCAL.test(texto);
}
