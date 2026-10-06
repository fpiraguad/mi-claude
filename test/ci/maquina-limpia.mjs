// Ayudante del job `maquina-limpia` de la CI (no es una prueba de node --test).
//   node test/ci/maquina-limpia.mjs bloque "<primera línea>" <salida>   copia ese bloque de INSTALAR.md
//   node test/ci/maquina-limpia.mjs comprobar                          revisa lo que dejó instalar.mjs
import fs from 'node:fs';
import path from 'node:path';

const [accion, ...args] = process.argv.slice(2);

if (accion === 'bloque') {
  const [inicio, salida] = args;
  const md = fs.readFileSync('INSTALAR.md', 'utf8').replace(/\r\n/g, '\n');
  const a = md.indexOf(`\n${inicio}\n`);
  if (a === -1) throw new Error(`no encontré «${inicio}» en INSTALAR.md`);
  const b = md.indexOf('\n```', a + 1);
  fs.writeFileSync(salida, md.slice(a + 1, b + 1));
  console.log(fs.readFileSync(salida, 'utf8'));
} else if (accion === 'comprobar') {
  const c = process.env.CLAUDE_CONFIG_DIR;
  const lista = JSON.parse(fs.readFileSync('setup/skills-terceros.json', 'utf8')).repos.flatMap((r) => Object.keys(r.rutas));
  const hay = lista.filter((n) => fs.existsSync(path.join(c, 'skills', n, 'SKILL.md')));
  console.log(`skills de terceros: ${hay.length} de ${lista.length}`);
  const faltan = lista.filter((n) => !hay.includes(n));
  if (faltan.length) console.log(`faltan: ${faltan.join(', ')}`);
  if (hay.length < 20) throw new Error('menos de 20 skills de terceros');
  if (!fs.existsSync('whatsapp/node_modules/baileys/package.json')) throw new Error('falta whatsapp/node_modules');
  const s = JSON.parse(fs.readFileSync(path.join(c, 'settings.json'), 'utf8'));
  if (!JSON.stringify(s.hooks ?? {}).includes('mi-claude')) throw new Error('settings.json sin hooks');
  if (!fs.readFileSync(path.join(c, 'CLAUDE.md'), 'utf8').includes('<!-- mi-claude:inicio -->')) throw new Error('CLAUDE.md sin el método');
  console.log('todo en su sitio');
} else {
  throw new Error('uso: bloque|comprobar');
}
