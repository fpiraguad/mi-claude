// Catálogo de servicios con key: dónde se saca y cómo se comprueba que sirve.
// Cada verificador hace una llamada que NO gasta saldo ni cambia nada.

const json = async (res) => {
  try { return await res.json(); } catch { return null; }
};

export const SERVICIOS = {
  APIMART: {
    nombre: 'APIMart (imágenes, video y transcripción)',
    variable: 'APIMART_API_KEY',
    prefijo: 'sk-',
    opcional: false,
    pagina: 'https://apimart.ai/keys',
    async verificar(key, fetch) {
      const res = await fetch('https://api.apimart.ai/v1/user/balance', {
        headers: { Authorization: `Bearer ${key}` },
      });
      const datos = await json(res);
      if (!res.ok || datos?.success === false) return { ok: false, detalle: `APIMart respondió ${res.status}` };
      const saldo = datos?.remain_balance ?? datos?.data?.remain_balance;
      return { ok: true, detalle: saldo != null ? `saldo ${saldo}` : 'key válida' };
    },
  },
  ZERNIO: {
    nombre: 'Zernio (publicar en redes)',
    variable: 'ZERNIO_API_KEY',
    prefijo: 'sk_',
    opcional: false,
    pagina: 'https://zernio.com/dashboard/api-keys',
    async verificar(key, fetch) {
      const res = await fetch('https://zernio.com/api/v1/accounts', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return { ok: false, detalle: `Zernio respondió ${res.status}` };
      const datos = await json(res);
      const cuentas = Array.isArray(datos) ? datos : datos?.accounts ?? datos?.data ?? [];
      return { ok: true, detalle: `${cuentas.length} cuenta(s) conectada(s)` };
    },
  },
  COMPOSIO: {
    nombre: 'Composio (Gmail y otras apps)',
    variable: 'COMPOSIO_CONSUMER_KEY',
    prefijo: 'ck_',
    opcional: false,
    pagina: 'https://dashboard.composio.dev',
    // Composio no documenta un endpoint REST para claves ck_: se abre una sesión MCP (initialize),
    // que no ejecuta ninguna herramienta. 401/403 = key mala.
    async verificar(key, fetch) {
      const res = await fetch('https://connect.composio.dev/mcp', {
        method: 'POST',
        headers: {
          'x-consumer-api-key': key,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'initialize',
          params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mi-claude', version: '0.1.0' } },
        }),
      });
      if (res.status === 401 || res.status === 403) return { ok: false, detalle: 'Composio rechazó la key' };
      if (!res.ok) return { ok: false, detalle: `Composio respondió ${res.status}` };
      return { ok: true, detalle: 'key válida' };
    },
  },
  PARALLEL: {
    nombre: 'Parallel (investigación profunda; la búsqueda funciona sin key)',
    variable: 'PARALLEL_API_KEY',
    prefijo: '',
    opcional: true,
    pagina: 'https://platform.parallel.ai',
    // Petición a propósito incompleta: una key mala da 401/403; una buena da error de validación (sin costo).
    async verificar(key, fetch) {
      const res = await fetch('https://api.parallel.ai/v1beta/search', {
        method: 'POST',
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: '{}',
      });
      if (res.status === 401 || res.status === 403) return { ok: false, detalle: 'Parallel rechazó la key' };
      return { ok: true, detalle: 'key válida' };
    },
  },
  ELEVENLABS: {
    nombre: 'ElevenLabs (notas de voz con tu voz, opcional)',
    variable: 'ELEVENLABS_API_KEY',
    prefijo: '',
    opcional: true,
    pagina: 'https://elevenlabs.io/app/settings/api-keys',
    async verificar(key, fetch) {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
      if (!res.ok) return { ok: false, detalle: `ElevenLabs respondió ${res.status}` };
      return { ok: true, detalle: 'key válida' };
    },
  },
};

export function servicio(id) {
  const s = SERVICIOS[String(id).toUpperCase()];
  if (!s) throw new Error(`Servicio desconocido: ${id}. Opciones: ${Object.keys(SERVICIOS).join(', ')}`);
  return s;
}

export async function verificarServicio(id, key, fetch = globalThis.fetch) {
  const s = servicio(id);
  if (!key) return { ok: false, detalle: 'falta la key' };
  if (s.prefijo && !key.startsWith(s.prefijo)) {
    return { ok: false, detalle: `la key de ${id} debería empezar por "${s.prefijo}"` };
  }
  try {
    return await s.verificar(key, fetch);
  } catch (error) {
    return { ok: false, detalle: `sin conexión (${error.cause?.code || error.message})` };
  }
}
