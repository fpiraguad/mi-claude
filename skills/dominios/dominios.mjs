#!/usr/bin/env node
// Consulta disponibilidad real de dominios usando WHOIS (gratis, sin API key, sin cupo)
// y RDAP como respaldo. Funciona igual en Mac y Windows: habla WHOIS directo por el
// puerto 43, sin depender del comando `whois` del sistema.
//
// Uso:
//   node dominios.mjs miempresa                 -> prueba miempresa en los TLD por defecto
//   node dominios.mjs miempresa.com otra.co     -> prueba esos dominios exactos
//   TLDS=".com .co .app" node dominios.mjs x    -> cambia la lista de TLD
//
// Salida: LIBRE / OCUPADO / REVISAR (cuando el registro no responde claro).
import net from 'node:net';

const TLDS = (process.env.TLDS || '.com .co .com.co .ai .app .io').split(/\s+/).filter(Boolean);
const PARALELO = Number(process.env.PARALELO || 4);

const LIBRE = /no match|not found|no data found|no entries found|does not exist|is free|available for registration/i;
const OCUPADO = /^\s*(registrar:|creation date|created|registered on|registry expiry)/im;
const VENCE = /(?:expiry date|expiration date|expires)[^:]*:\s*([^\r\n]+)/i;

function whois(servidor, consulta, ms = 15000) {
  return new Promise((resolve) => {
    let datos = '';
    const s = net.createConnection({ host: servidor, port: 43 });
    const fin = (r) => {
      s.destroy();
      resolve(r);
    };
    s.setTimeout(ms, () => fin(datos || null));
    s.on('connect', () => s.write(consulta + '\r\n'));
    s.on('data', (d) => (datos += d.toString('utf8')));
    s.on('end', () => fin(datos));
    s.on('error', () => fin(datos || null));
  });
}

// Qué servidor WHOIS atiende cada TLD lo dice IANA ("whois:" o "refer:"). Se pregunta una vez por TLD.
const servidores = new Map();
function servidorDe(tld) {
  if (!servidores.has(tld)) {
    servidores.set(
      tld,
      whois('whois.iana.org', tld).then((r) => (r && r.match(/^(?:refer|whois):\s*(\S+)/im)?.[1]) || null),
    );
  }
  return servidores.get(tld);
}

// Algunos registros (.app y otros de Google) no contestan por WHOIS.
// RDAP es el protocolo nuevo que los reemplaza, también gratis y sin llave.
// Ojo: rdap.org responde 404 para .co aunque el dominio exista: solo es respaldo.
async function rdap(dominio) {
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(`https://rdap.org/domain/${dominio}`, {
        redirect: 'follow',
        // Sin user-agent, rdap.org responde 403.
        headers: { 'user-agent': 'mi-claude-dominios/1.0', accept: 'application/rdap+json' },
        signal: AbortSignal.timeout(25000),
      });
      if (r.status === 200) return `OCUPADO   ${dominio}  (vía RDAP)`;
      if (r.status === 404) return `LIBRE     ${dominio}  (vía RDAP)`;
      return `REVISAR   ${dominio}  (ni WHOIS ni RDAP contestaron)`;
    } catch {
      // reintenta
    }
  }
  return `REVISAR   ${dominio}  (ni WHOIS ni RDAP contestaron)`;
}

export function clasificar(dominio, cuerpo) {
  if (!cuerpo) return null;
  // "No encontrado" es la señal inequívoca, así que manda sobre la otra.
  if (LIBRE.test(cuerpo)) return `LIBRE     ${dominio}`;
  if (OCUPADO.test(cuerpo)) {
    const vence = cuerpo.match(VENCE)?.[1]?.split('T')[0].trim();
    return vence ? `OCUPADO   ${dominio}  (vence ${vence})` : `OCUPADO   ${dominio}`;
  }
  return null;
}

async function estado(dominio) {
  const tld = dominio.split('.').pop();
  const servidor = await servidorDe(tld);
  if (servidor) {
    const cuerpo = await whois(servidor, dominio);
    const r = clasificar(dominio, cuerpo);
    if (r) return r;
  }
  return rdap(dominio);
}

export function expandir(args, tlds = TLDS) {
  // Un argumento con punto es un dominio exacto; sin punto se expande a los TLD.
  return args.flatMap((a) => {
    const limpio = a.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return limpio.includes('.') ? [limpio] : tlds.map((t) => limpio + t);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('uso: node dominios.mjs <nombre|dominio> [...]');
    process.exit(1);
  }
  const lista = expandir(args);
  const resultados = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALELO, lista.length) }, async () => {
      while (i < lista.length) {
        const d = lista[i++];
        resultados.push(await estado(d));
      }
    }),
  );
  console.log(resultados.sort().join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('dominios.mjs')) {
  await main();
}
