#!/usr/bin/env node
// Hook PreToolUse(Bash): NINGÚN DEPLOY SE ESPERA.
//
// Frena, antes de que corran, las formas en que una sesión se queda colgada
// esperando un deploy:
//
// 1. Bucle de sondeo — `until vercel ls | grep Ready; do sleep 5; done`, con o
//    sin sleep, o `while ($true) { …; Start-Sleep 10 }` en PowerShell.
// 2. Siesta y chequeo — `sleep 90; vercel ls` / `sleep 95; curl …/version`. No
//    es un bucle, pero es la misma espera: el turno se queda quieto.
// 3. Deploy en primer plano — `vercel deploy --prod`, `railway up`: bloquea el
//    turno mientras compila. En background el arnés avisa solo al terminar.
// 4. Esperas sin tope — `vercel inspect --wait`, `railway logs`/`vercel logs`
//    que se quedan siguiendo el log.
// 5. Comprobar en bucle SIN nombrar al proveedor — `until [ "$(curl -s
//    https://x/version)" = "$HEAD" ]; do sleep 10; done`. Cuenta cualquier
//    bucle o siesta con una petición a un host que NO es este computador.
//
// Lo que NO frena: esperas de cosas locales (Docker, un dev server en
// localhost), `while read` que recorre una salida, `for` que recorre sin
// dormir, y la comprobación única (`curl …/version`, `vercel ls`).
//
// Se mira POR REGIÓN: la palabra sospechosa tiene que estar DENTRO del bucle,
// o DESPUÉS del sleep. Dos partes sin relación del mismo comando no se suman.
import { leerEntrada, negar, limpiar, esLocal, peticionRemota, segmentos } from './comun.mjs';

const datos = await leerEntrada();
if (!datos) process.exit(0);

const entrada = datos.tool_input || {};
const crudo = String(entrada.command || '');
const enBackground = Boolean(entrada.run_in_background);
const cmd = limpiar(crudo);

const DEPLOY = /\bvercel\b|\brailway\b|\bnetlify\b|\bflyctl\b|\bfly\s+(status|logs|deploy)|\/version\b|deploy|\bReady\b|\bBuilding\b/i;
// until/while cuentan siempre (con o sin sleep); `for` solo si duerme de verdad,
// porque `for p in a b c; do vercel env ls; done` es recorrer, no esperar.
const BUCLE_SIEMPRE = /\b(until|while)\b(?!\s+(IFS=\S*\s+)?read\b)[\s\S]*?(\bdone\b|$)/gi;
const BUCLE_FOR = /\b(for|foreach)\b[\s\S]*?(\bdo\b|\{)[\s\S]*?(\bdone\b|$)/gi;
const WATCH = /\bwatch\s+-[\s\S]*/gi;
// `sleep 30`, `Start-Sleep 30`, `Start-Sleep -Seconds 30` (y -s).
const SIESTA = /\b(?:sleep|start-sleep)\s+(?:-s(?:econds)?\s+)?(\d+)/gi;
const DEPLOY_BLOQUEANTE = /\bvercel\s+(deploy\b|--prod\b|[^|;&\n]*\s--prod\b)|\brailway\s+up\b/i;
const NO_BLOQUEA = /--no-wait\b|--detach\b/i;
const INSPECT_WAIT = /\bvercel\s+inspect\b[^|;&\n]*--wait\b/i;
const LOGS_VIVOS = /\b(railway|vercel)\s+logs\b/i;
const CON_TOPE = /\|\s*(head|select-object)\b|--lines\b|--limit\b|\s-n\s*\d|grep\s+(-\S+\s+)*-m\s*\d|--no-follow\b/i;

const UNA_PETICION =
  'Un deploy NO se espera. Comprueba AHORA con UNA sola petición (por ejemplo ' +
  '`curl -s --max-time 12 https://<dominio>/version`); si aún no está, di «el build sigue» en una ' +
  'línea y sigue con otra cosa o cierra el turno. Si de verdad hay que esperar, lanza el comando ' +
  'una vez con run_in_background: true y el arnés avisa cuando termine.';

const esperaAlgoRemoto = (texto) => DEPLOY.test(texto) || peticionRemota(texto);
const siestasDe = (texto) => [...texto.matchAll(SIESTA)].map((m) => Number(m[1]));
const duermeDeVerdad = (texto) => {
  const s = siestasDe(texto);
  return s.length > 0 && Math.max(...s) >= 10;
};

// Las cosas locales (Docker, un dev server en localhost) no son deploys
// aunque digan «/version» o duerman un rato.
if (!esLocal(cmd)) {
  const regiones = [...cmd.matchAll(BUCLE_SIEMPRE), ...cmd.matchAll(WATCH)].map((m) => m[0]);
  for (const region of regiones) {
    if (esperaAlgoRemoto(region)) negar('Bucle de sondeo sobre un deploy: prohibido. ' + UNA_PETICION);
  }

  for (const m of cmd.matchAll(BUCLE_FOR)) {
    if (esperaAlgoRemoto(m[0]) && duermeDeVerdad(m[0])) {
      negar('Bucle de sondeo sobre un deploy: prohibido. ' + UNA_PETICION);
    }
  }

  // Siesta y chequeo: el sleep importa solo si DESPUÉS se mira el deploy.
  const partes = segmentos(cmd);
  partes.forEach((parte, i) => {
    const s = siestasDe(parte);
    if (!s.length || Math.max(...s) < 10) return;
    if (partes.slice(i + 1).some(esperaAlgoRemoto)) {
      negar(`\`sleep ${Math.max(...s)}\` antes de mirar un deploy es esperarlo con otro nombre. ` + UNA_PETICION);
    }
  });
}

if (DEPLOY_BLOQUEANTE.test(cmd) && !enBackground && !NO_BLOQUEA.test(cmd)) {
  negar(
    'Este deploy en primer plano bloquea el turno mientras compila. Vuelve a lanzarlo igual pero con ' +
      'run_in_background: true: el arnés avisa solo cuando termine, y mientras tanto sigues con lo demás ' +
      '(o cierras el turno). Nada de sondear después.',
  );
}

if (INSPECT_WAIT.test(cmd) && (!cmd.includes('--timeout') || !enBackground)) {
  negar(
    '`vercel inspect --wait` se queda bloqueado hasta que el build acabe. Sin `--wait` da el estado al ' +
      'instante, que es lo que toca.',
  );
}

if (LOGS_VIVOS.test(cmd) && !enBackground && !CON_TOPE.test(cmd)) {
  negar(
    '`railway logs` / `vercel logs` se quedan siguiendo el log y el turno no vuelve. Ponle tope: ' +
      '`… | head -40`, `--lines 40`, o `grep -m 5 <lo que buscas>`.',
  );
}

process.exit(0);
