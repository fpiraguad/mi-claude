import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearTexto, cargarProhibidos, compilarProhibidos } from '../scripts/sin-datos-personales.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Las keys falsas se arman en tiempo de ejecución para que este archivo no dispare el escáner.
const FALSAS = {
  apimart: 'sk-' + 'A1b2C3d4E5f6G7h8J9k0',
  zernio: 'sk_' + 'Q'.repeat(24),
  ak: 'ak_' + 'm'.repeat(14),
  composio: 'ck_' + 'R7'.repeat(8),
  google: 'AIza' + 'B'.repeat(33),
  github: 'ghp_' + 'z9'.repeat(18),
  jwt: 'eyJ' + 'hbGciOiJIUzI1' + '.' + 'eyJzdWIiOiIxMjM0' + '.' + 'firma',
  pem: '-----BEGIN RSA PRIV' + 'ATE KEY-----',
};

test('detecta cada tipo de key y enmascara la coincidencia', () => {
  for (const [nombre, key] of Object.entries(FALSAS)) {
    const h = escanearTexto(`const k = "${key}";`, 'a.mjs');
    assert.equal(h.length, 1, nombre);
    assert.equal(h[0].tipo, 'key');
    assert.equal(h[0].linea, 1);
    assert.ok(!h[0].muestra.includes(key.slice(4)), `${nombre} no se imprime completa`);
  }
});

test('permite marcadores obvios', () => {
  const texto = [
    'APIMART_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx',
    'ZERNIO_API_KEY=sk_...',
    'COMPOSIO=ck_XXXXXXXXXXXXXXXX',
    'key: sk-tu-key',
    'sk_xxxxxxxxxxxxxxxxxxxxxxxx',
    'node setup/keys.mjs guardar APIMART sk-…',
  ].join('\n');
  assert.deepEqual(escanearTexto(texto, 'README.md'), []);
});

test('términos personales desde una lista temporal, sin distinguir mayúsculas', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-esc-'));
  const lista = path.join(dir, 'prohibidos.txt');
  fs.writeFileSync(lista, '# comentario\nJuana Pérez\nacme corp\n5550001\n\n');
  const terminos = cargarProhibidos(lista);
  assert.deepEqual(terminos, ['Juana Pérez', 'acme corp', '5550001']);
  const re = compilarProhibidos(terminos);
  const h = escanearTexto('Hola\nescribe a JUANA PÉREZ de Acme Corp al 3005550001', 'x.md', { prohibidos: re });
  assert.equal(h.length, 3);
  assert.ok(h.every((x) => x.linea === 2 && x.tipo === 'dato personal'));
  assert.ok(h.every((x) => !/juana|acme|5550001/i.test(x.muestra)));
  assert.equal(cargarProhibidos(path.join(dir, 'no-existe.txt')), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('la URL pública del repo no cuenta como dato personal', () => {
  const dueño = 'fpira' + 'guad';
  const re = compilarProhibidos([dueño]);
  const ok = `Instala desde https://github.com/${dueño}/mi-claude o https://${dueño}.github.io/mi-claude/`;
  assert.deepEqual(escanearTexto(ok, 'README.md', { prohibidos: re }), []);
  assert.equal(escanearTexto(`escríbele a ${dueño} en otro lado`, 'a.md', { prohibidos: re }).length, 1);
});

test('CLI: falla con exit 1 en un archivo con key y lista file:línea', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-esc-cli-'));
  fs.writeFileSync(path.join(dir, 'malo.txt'), `ok\nAPIMART=${FALSAS.apimart}\n`);
  fs.writeFileSync(path.join(dir, 'bueno.txt'), 'APIMART=sk-xxxx\n');
  const correr = (archivo) => spawnSync(process.execPath, [path.join(REPO, 'scripts', 'sin-datos-personales.mjs'), archivo], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, MI_CLAUDE_PROHIBIDOS: path.join(dir, 'no-hay.txt') },
  });
  const malo = correr('malo.txt');
  assert.equal(malo.status, 1);
  assert.ok(malo.stdout.includes('malo.txt:2'));
  assert.ok(!malo.stdout.includes(FALSAS.apimart));
  assert.ok(malo.stdout.includes('solo reviso patrones'));
  assert.equal(correr('bueno.txt').status, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
