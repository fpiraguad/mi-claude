// Ayudantes puros para tocar la configuración de Claude Code sin pisar lo que la persona ya tiene.
// Nada aquí lee ni escribe disco por su cuenta: reciben datos (o funciones) y devuelven datos.
import path from 'node:path';

export const MARCA = 'mi-claude';
export const INICIO_METODO = '<!-- mi-claude:inicio -->';
export const FIN_METODO = '<!-- mi-claude:fin -->';

// ---------- settings.json: hooks ----------

const esNuestro = (hook, marca) => typeof hook?.command === 'string' && hook.command.includes(marca);

// Comando con el que Claude Code ejecuta un hook del repo. Comillas para rutas con espacios.
export function comandoHook(rutaAbsoluta) {
  return `node "${rutaAbsoluta}"`;
}

// Quita todos los hooks nuestros (por la marca en la ruta) y vuelve a poner los de `registros`.
// registros: [{ evento, matcher?, command, timeout }]
// Devuelve un objeto nuevo; el original queda igual. Todo lo demás de settings se conserva.
export function fusionarHooks(settings, registros, marca = MARCA) {
  const nuevo = structuredClone(settings && typeof settings === 'object' ? settings : {});
  const hooks = nuevo.hooks && typeof nuevo.hooks === 'object' ? nuevo.hooks : {};

  for (const [evento, grupos] of Object.entries(hooks)) {
    if (!Array.isArray(grupos)) continue;
    const limpios = [];
    for (const grupo of grupos) {
      if (!Array.isArray(grupo?.hooks)) { limpios.push(grupo); continue; }
      const resto = grupo.hooks.filter((h) => !esNuestro(h, marca));
      if (resto.length) limpios.push({ ...grupo, hooks: resto });
    }
    if (limpios.length) hooks[evento] = limpios;
    else delete hooks[evento];
  }

  for (const r of registros) {
    const lista = (hooks[r.evento] ??= []);
    const matcher = r.matcher ?? undefined;
    // Un grupo propio por evento+matcher (se reconoce porque solo tiene hooks nuestros).
    let grupo = lista.find((g) => (g.matcher ?? undefined) === matcher
      && Array.isArray(g.hooks) && g.hooks.length && g.hooks.every((h) => esNuestro(h, marca)));
    if (!grupo) {
      grupo = matcher === undefined ? { hooks: [] } : { matcher, hooks: [] };
      lista.push(grupo);
    }
    const hook = { type: 'command', command: r.command };
    if (r.timeout) hook.timeout = r.timeout;
    grupo.hooks.push(hook);
  }

  if (Object.keys(hooks).length) nuevo.hooks = hooks;
  else delete nuevo.hooks;
  return nuevo;
}

// Cuántos hooks nuestros hay registrados en settings.
export function contarHooksNuestros(settings, marca = MARCA) {
  let n = 0;
  for (const grupos of Object.values(settings?.hooks ?? {})) {
    if (!Array.isArray(grupos)) continue;
    for (const g of grupos) for (const h of g?.hooks ?? []) if (esNuestro(h, marca)) n++;
  }
  return n;
}

// ---------- CLAUDE.md: bloque del método ----------

// Reemplaza el bloque entre marcadores, o lo agrega al final si no existe. El resto queda igual.
export function fusionarBloque(texto, contenido, inicio = INICIO_METODO, fin = FIN_METODO) {
  const base = texto ?? '';
  const bloque = `${inicio}\n${String(contenido).trim()}\n${fin}`;
  const a = base.indexOf(inicio);
  const b = a === -1 ? -1 : base.indexOf(fin, a);
  if (a !== -1 && b !== -1) return base.slice(0, a) + bloque + base.slice(b + fin.length);
  if (!base.trim()) return `${bloque}\n`;
  return `${base.replace(/\s*$/, '')}\n\n${bloque}\n`;
}

export function tieneBloque(texto, inicio = INICIO_METODO, fin = FIN_METODO) {
  const a = (texto ?? '').indexOf(inicio);
  return a !== -1 && texto.indexOf(fin, a) !== -1;
}

// ---------- binario de Claude Code ----------

// Busca el ejecutable `claude`. `existe(ruta)` se inyecta para poder probarlo sin disco.
export function buscarClaude({ env = process.env, plataforma = process.platform, existe, home } = {}) {
  const win = plataforma === 'win32';
  const p = win ? path.win32 : path.posix;
  const casa = home || (win ? env.USERPROFILE || env.HOME : env.HOME) || '';
  const nombres = win ? ['claude.exe', 'claude.cmd', 'claude'] : ['claude'];
  const rutaPATH = env.PATH ?? env.Path ?? '';
  const candidatos = [];
  for (const dir of rutaPATH.split(win ? ';' : ':').filter(Boolean)) {
    for (const n of nombres) candidatos.push(p.join(dir, n));
  }
  if (casa) {
    if (win) {
      candidatos.push(p.join(casa, '.local', 'bin', 'claude.exe'));
    } else {
      candidatos.push(p.join(casa, '.local', 'bin', 'claude'));
      candidatos.push(p.join(casa, '.claude', 'local', 'claude'));
    }
  }
  return candidatos.find((c) => existe(c)) ?? null;
}

export function instruccionesClaude(plataforma = process.platform) {
  return plataforma === 'win32'
    ? 'No encontré el comando "claude". En PowerShell: irm https://claude.ai/install.ps1 | iex  — luego vuelve a correr la instalación.'
    : 'No encontré el comando "claude". En la Terminal: curl -fsSL https://claude.ai/install.sh | bash  — luego vuelve a correr la instalación.';
}

// ---------- MCP ----------

// Servidores MCP que pide mi-claude según las keys que haya. Los encabezados llevan secretos.
export function servidoresMcp(secretos) {
  const lista = [];
  const parallel = { nombre: 'parallel-search', url: 'https://search.parallel.ai/mcp', encabezados: [] };
  if (secretos.PARALLEL_API_KEY) parallel.encabezados.push(`Authorization: Bearer ${secretos.PARALLEL_API_KEY}`);
  lista.push(parallel);
  if (secretos.COMPOSIO_CONSUMER_KEY) {
    lista.push({
      nombre: 'composio',
      url: 'https://connect.composio.dev/mcp',
      encabezados: [`x-consumer-api-key: ${secretos.COMPOSIO_CONSUMER_KEY}`],
    });
  }
  return lista;
}

// Argumentos de `claude mcp add`. El nombre y la URL van antes de --header (que es variádico).
export function argsMcpAdd(servidor) {
  const args = ['mcp', 'add', '--scope', 'user', '--transport', 'http', servidor.nombre, servidor.url];
  for (const h of servidor.encabezados ?? []) args.push('--header', h);
  return args;
}

// Versión para mostrar en pantalla: el valor de cada encabezado se reemplaza.
export function argsParaMostrar(args) {
  return args.map((a, i) => (args[i - 1] === '--header' ? a.replace(/:\s*.*$/, ': ••••') : a));
}

// Parsea la salida de `claude mcp list`:
//   parallel-search: https://search.parallel.ai/mcp (HTTP) - ✔ Connected
export function parsearMcpList(texto) {
  const servidores = [];
  for (const linea of String(texto ?? '').split(/\r?\n/)) {
    const m = linea.match(/^([A-Za-z0-9_.:-]+?):\s+(.+?)\s+-\s+(.+)$/);
    if (!m) continue;
    const estado = m[3].trim();
    servidores.push({
      nombre: m[1],
      destino: m[2],
      estado,
      conectado: /connected/i.test(estado) && !/fail|not|needs/i.test(estado),
      necesitaAuth: /auth/i.test(estado),
    });
  }
  return servidores;
}
