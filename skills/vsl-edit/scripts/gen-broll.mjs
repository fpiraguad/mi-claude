/**
 * Genera B-roll con Omni-Flash-Ext (APIMart) y lo descarga.
 *
 * Se ejecuta desde la raíz del proyecto:
 *   node <skill>/scripts/gen-broll.mjs                 # genera lo que falte
 *   node <skill>/scripts/gen-broll.mjs 03 07           # fuerza esos ids
 *   SHOTS=x.json OUT=public/b node ... gen-broll.mjs   # rutas a medida
 *
 * Lee APIMART_API_KEY del entorno o del archivo de keys de mi-claude, y los prompts de
 * scripts/shots.json:
 *
 *   {
 *     "model": "Omni-Flash-Ext",
 *     "look": "texto de estilo que se añade a todos los prompts",
 *     "shots": [{ "id": "01-algo", "prompt": "..." }]
 *   }
 *
 * El estado vive en un manifiesto junto a shots.json: relanzarlo sólo pide lo
 * que falta, que a $0.35 el clip importa.
 */
import fs from "node:fs";
import path from "node:path";
import { clave } from "./comun.mjs";

const ROOT = process.cwd();
const SHOTS = path.resolve(ROOT, process.env.SHOTS ?? "scripts/shots.json");
const OUT_DIR = path.resolve(ROOT, process.env.OUT ?? "public/broll");
const MANIFEST = path.join(path.dirname(SHOTS), "broll.manifest.json");
const BASE = "https://api.apimart.ai";
const COST_PER_CLIP = 0.35;

const KEY = clave("APIMART_API_KEY");

const auth = { Authorization: `Bearer ${KEY}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readManifest = () =>
  fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};

const writeManifest = (m) =>
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + "\n");

/** El saldo real de la cuenta; /v1/balance sólo mide el gasto de esta clave */
const balance = async () => {
  const r = await fetch(`${BASE}/v1/user/balance`, { headers: auth });
  const { remain_balance } = await r.json();
  return remain_balance;
};

/** Encola el clip y devuelve el task_id */
const submit = async (model, prompt) => {
  const r = await fetch(`${BASE}/v1/images/generations`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, n: 1, size: "1280x720" }),
  });
  const body = await r.json();
  const task = body?.data?.[0]?.task_id;
  if (!task) throw new Error(`Sin task_id: ${JSON.stringify(body)}`);
  return task;
};

/** Espera a que la tarea termine y devuelve la URL del mp4 */
const waitFor = async (taskId, label) => {
  for (let i = 0; i < 90; i++) {
    await sleep(10_000);
    const r = await fetch(`${BASE}/v1/tasks/${taskId}`, { headers: auth });
    const { data } = await r.json();
    if (data.status === "completed") {
      const url = data.result?.videos?.[0]?.url?.[0];
      if (!url) throw new Error(`Completado sin video: ${JSON.stringify(data)}`);
      return url;
    }
    if (data.status === "failed") {
      throw new Error(`falló: ${JSON.stringify(data)}`);
    }
    process.stdout.write(`\r   ${label}: ${data.status} ${data.progress}%   `);
  }
  throw new Error("timeout");
};

/** Las URL de resultado caducan en 24h, así que se baja el archivo ya */
const download = async (url, dest) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Descarga ${r.status}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
};

const main = async () => {
  if (!fs.existsSync(SHOTS)) throw new Error(`No existe ${SHOTS}`);
  const {
    model = "Omni-Flash-Ext",
    look = "",
    shots,
  } = JSON.parse(fs.readFileSync(SHOTS, "utf8"));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const force = process.argv.slice(2);
  const manifest = readManifest();
  const todo = shots.filter((shot) =>
    force.length
      ? force.some((f) => shot.id.startsWith(f))
      : !fs.existsSync(path.join(OUT_DIR, `${shot.id}.mp4`)),
  );

  if (!todo.length) return console.log("Todo el B-roll ya está descargado.");

  const before = await balance();
  const cost = todo.length * COST_PER_CLIP;
  console.log(
    `${todo.length} clips · saldo $${before.toFixed(2)} · coste estimado $${cost.toFixed(2)}\n`,
  );
  if (before > 0 && cost > before) {
    throw new Error("El saldo no cubre la tanda. Recorta shots.json o recarga.");
  }

  // Se encolan todas de golpe: corren en paralelo y la tanda tarda lo que el
  // clip más lento en vez de la suma
  const queued = [];
  for (const shot of todo) {
    const prompt = [shot.prompt, look].filter(Boolean).join("\n\n");
    const taskId = await submit(model, prompt);
    queued.push({ shot, taskId });
    console.log(`-> ${shot.id.padEnd(24)} ${taskId}`);
  }

  console.log("\nEsperando renders...\n");
  let failed = 0;
  for (const { shot, taskId } of queued) {
    try {
      const url = await waitFor(taskId, shot.id);
      const dest = path.join(OUT_DIR, `${shot.id}.mp4`);
      await download(url, dest);
      manifest[shot.id] = { taskId, url, at: new Date().toISOString() };
      writeManifest(manifest);
      console.log(`\r[ok] ${shot.id.padEnd(24)} ${dest}`);
    } catch (err) {
      failed++;
      console.error(`\r[!!] ${shot.id.padEnd(24)} ${err.message}`);
    }
  }

  console.log(`\nSaldo restante: $${(await balance()).toFixed(2)}`);
  if (failed) console.log(`${failed} fallaron · relanza con sus ids`);
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
