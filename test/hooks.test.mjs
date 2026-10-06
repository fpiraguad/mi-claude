import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks');

function correr(hook, entrada) {
  const r = spawnSync(process.execPath, [path.join(HOOKS, hook)], {
    input: typeof entrada === 'string' ? entrada : JSON.stringify(entrada),
    encoding: 'utf8',
    timeout: 15000,
  });
  const salida = r.stdout.trim();
  return { codigo: r.status, salida, json: salida ? JSON.parse(salida) : null, err: r.stderr };
}

const bash = (command, extra = {}) => ({
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command, ...extra.input },
  cwd: extra.cwd || process.cwd(),
  session_id: 'prueba',
});
const prompt = (texto) => ({ hook_event_name: 'UserPromptSubmit', prompt: texto, cwd: process.cwd(), session_id: 'prueba' });

function negado(r) {
  assert.equal(r.codigo, 0);
  assert.equal(r.json?.hookSpecificOutput?.permissionDecision, 'deny', `debía negar; salida: ${r.salida}`);
  assert.equal(r.json.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.ok(r.json.hookSpecificOutput.permissionDecisionReason.length > 10);
}
function pasa(r) {
  assert.equal(r.codigo, 0);
  assert.equal(r.salida, '', `debía pasar en silencio; salida: ${r.salida}`);
}
function contexto(r, evento) {
  assert.equal(r.codigo, 0);
  assert.equal(r.json?.hookSpecificOutput?.hookEventName, evento);
  assert.ok(r.json.hookSpecificOutput.additionalContext.length > 20);
}

describe('manifiesto hooks.json', () => {
  test('cada entrada apunta a un archivo que existe y tiene evento', () => {
    const lista = JSON.parse(fs.readFileSync(path.join(HOOKS, 'hooks.json'), 'utf8'));
    assert.equal(lista.length, 6);
    for (const h of lista) {
      assert.ok(fs.existsSync(path.join(HOOKS, h.archivo)), h.archivo);
      assert.ok(['PreToolUse', 'PostToolUse', 'UserPromptSubmit'].includes(h.evento));
      assert.ok(h.timeout > 0);
    }
  });
});

describe('todos los hooks toleran entrada rota', () => {
  for (const h of ['sin-atajos.mjs', 'en-paralelo.mjs', 'encargo-en-lista.mjs', 'exigir-pruebas.mjs', 'datos-idempotentes.mjs', 'sin-sondeo.mjs']) {
    test(h, () => {
      pasa(correr(h, 'esto no es json'));
      pasa(correr(h, ''));
    });
  }
});

describe('sin-atajos', () => {
  test('frena git add -A y git add .', () => {
    negado(correr('sin-atajos.mjs', bash('git add -A && git commit -m x')));
    negado(correr('sin-atajos.mjs', bash('git add .')));
  });
  test('deja pasar comandos inofensivos', () => {
    pasa(correr('sin-atajos.mjs', bash('git add src/a.ts && git commit -m "arreglo"')));
    pasa(correr('sin-atajos.mjs', bash('ls -la')));
    pasa(correr('sin-atajos.mjs', bash('git log --oneline | head -20')));
    pasa(correr('sin-atajos.mjs', bash('tail -f server.log')));
    pasa(correr('sin-atajos.mjs', bash('echo "git add -A"')));
  });
  test('frena leer archivos del proyecto con cat / sed -n / Get-Content', () => {
    negado(correr('sin-atajos.mjs', bash('cat src/index.ts')));
    negado(correr('sin-atajos.mjs', bash("sed -n '1,20p' src/index.ts")));
    negado(correr('sin-atajos.mjs', bash('Get-Content .\\src\\index.ts')));
  });
  test('cat con pipe o redirección pasa', () => {
    pasa(correr('sin-atajos.mjs', bash('cat src/a.ts | grep x')));
    pasa(correr('sin-atajos.mjs', bash('cat > nota.txt << EOF\nhola\nEOF')));
  });
  test('frena dev servers por Bash y format:fix sin ruta', () => {
    negado(correr('sin-atajos.mjs', bash('pnpm dev')));
    negado(correr('sin-atajos.mjs', bash('npx next dev')));
    negado(correr('sin-atajos.mjs', bash('pnpm format:fix')));
    pasa(correr('sin-atajos.mjs', bash('pnpm format:fix src/a.ts')));
  });
  test('frena imprimir secretos pero deja copiarlos', () => {
    negado(correr('sin-atajos.mjs', bash('cat ~/.mi-claude/secrets.env')));
    negado(correr('sin-atajos.mjs', bash('Get-Content $HOME/.mi-claude/secrets.env')));
    negado(correr('sin-atajos.mjs', bash('python3 -c "print(open(\'secrets.env\').read())"')));
    pasa(correr('sin-atajos.mjs', bash('cp ~/.mi-claude/secrets.env /tmp/x.env')));
    pasa(correr('sin-atajos.mjs', bash('grep -q APIMART_API_KEY ~/.mi-claude/secrets.env && echo presente')));
  });
});

describe('sin-sondeo', () => {
  test('frena bucles de sondeo y siestas antes de mirar el deploy', () => {
    negado(correr('sin-sondeo.mjs', bash('until vercel ls | grep Ready; do sleep 5; done')));
    negado(correr('sin-sondeo.mjs', bash('sleep 90; curl -s https://ejemplo.com/version')));
    negado(correr('sin-sondeo.mjs', bash('while ($true) { Invoke-WebRequest https://ejemplo.com/version; Start-Sleep -Seconds 15 }')));
  });
  test('frena deploy en primer plano pero no en background', () => {
    negado(correr('sin-sondeo.mjs', bash('vercel deploy --prod')));
    pasa(correr('sin-sondeo.mjs', bash('vercel deploy --prod', { input: { run_in_background: true } })));
  });
  test('deja pasar esperas locales y la comprobación única', () => {
    pasa(correr('sin-sondeo.mjs', bash('until curl -s http://localhost:3000; do sleep 2; done')));
    pasa(correr('sin-sondeo.mjs', bash('curl -s --max-time 12 https://ejemplo.com/version')));
    pasa(correr('sin-sondeo.mjs', bash('git status | while read l; do echo $l; done')));
  });
});

describe('en-paralelo', () => {
  test('una tarea divisible recibe additionalContext', () => {
    const r = correr('en-paralelo.mjs', prompt('Revisa todos los archivos de la carpeta src y dime cuáles tienen funciones muy largas que convenga partir, uno por uno por favor'));
    contexto(r, 'UserPromptSubmit');
    assert.match(r.json.hookSpecificOutput.additionalContext, /paralelo/);
  });
  test('un bug puntual o un prompt corto no', () => {
    pasa(correr('en-paralelo.mjs', prompt('sí, dale')));
    pasa(correr('en-paralelo.mjs', prompt('El botón de guardar no funciona cuando le doy clic en la pantalla de configuración, revísalo porfa')));
  });
});

describe('encargo-en-lista', () => {
  test('seis puntos en lista reciben additionalContext', () => {
    const lista = ['Cambia el título', 'Agrega un botón', 'Quita el banner', 'Pon el logo', 'Arregla el pie', 'Crea la página de contacto']
      .map((x, i) => `${i + 1}. ${x}`)
      .join('\n');
    const r = correr('encargo-en-lista.mjs', prompt(`Por favor haz esto:\n${lista}`));
    contexto(r, 'UserPromptSubmit');
    assert.match(r.json.hookSpecificOutput.additionalContext, /ENCARGO EN LISTA/);
  });
  test('un pedido corto no', () => {
    pasa(correr('encargo-en-lista.mjs', prompt('Cambia el color del botón principal a verde y avísame cuando esté.')));
  });
});

describe('datos-idempotentes', () => {
  const editar = (file_path, session_id) => ({
    hook_event_name: 'PostToolUse',
    tool_name: 'Edit',
    tool_input: { file_path },
    cwd: '/proyecto-prueba',
    session_id,
  });
  test('avisa una sola vez por sesión al tocar un webhook', () => {
    const sesion = `prueba${process.pid}${Date.now()}`;
    const r = correr('datos-idempotentes.mjs', editar('/proyecto-prueba/app/api/webhooks/pagos/route.ts', sesion));
    contexto(r, 'PostToolUse');
    pasa(correr('datos-idempotentes.mjs', editar('/proyecto-prueba/app/api/webhooks/pagos/route.ts', sesion)));
    fs.rmSync(path.join(os.tmpdir(), `claude-datos-idempotentes-${sesion}.json`), { force: true });
  });
  test('rutas de Windows también cuentan; archivos normales no', () => {
    const sesion = `win${process.pid}${Date.now()}`;
    contexto(correr('datos-idempotentes.mjs', editar('C:\\proyecto\\src\\sync\\clientes.ts', sesion)), 'PostToolUse');
    fs.rmSync(path.join(os.tmpdir(), `claude-datos-idempotentes-${sesion}.json`), { force: true });
    pasa(correr('datos-idempotentes.mjs', editar('/proyecto-prueba/src/components/Boton.tsx', 'otra')));
  });
});

describe('exigir-pruebas', () => {
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8' });

  function repoDePrueba() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-claude-exigir-pruebas-'));
    const origen = path.join(dir, 'origen.git');
    const trabajo = path.join(dir, 'trabajo');
    git(dir, 'init', '--bare', '-q', origen);
    git(dir, 'clone', '-q', origen, trabajo);
    git(trabajo, 'config', 'user.email', 'prueba@example.com');
    git(trabajo, 'config', 'user.name', 'Prueba');
    git(trabajo, 'checkout', '-q', '-b', 'main');
    fs.writeFileSync(path.join(trabajo, 'package.json'), '{"devDependencies":{"vitest":"^2.0.0"}}');
    git(trabajo, 'add', 'package.json');
    git(trabajo, 'commit', '-q', '-m', 'inicio');
    git(trabajo, 'push', '-q', '-u', 'origin', 'main');
    return { dir, trabajo };
  }

  test('frena el push de un arreglo sin test y deja pasar con test', () => {
    const { dir, trabajo } = repoDePrueba();
    try {
      fs.writeFileSync(path.join(trabajo, 'a.js'), 'x');
      git(trabajo, 'add', 'a.js');
      git(trabajo, 'commit', '-q', '-m', 'arregla el guardado');
      negado(correr('exigir-pruebas.mjs', bash('git push', { cwd: trabajo })));

      fs.writeFileSync(path.join(trabajo, 'a.test.js'), 'y');
      git(trabajo, 'add', 'a.test.js');
      git(trabajo, 'commit', '-q', '-m', 'test del guardado');
      pasa(correr('exigir-pruebas.mjs', bash('git push', { cwd: trabajo })));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('el escape [sin-test] y los comandos que no son push pasan', () => {
    const { dir, trabajo } = repoDePrueba();
    try {
      fs.writeFileSync(path.join(trabajo, 'b.css'), 'x');
      git(trabajo, 'add', 'b.css');
      git(trabajo, 'commit', '-q', '-m', 'corrige el color [sin-test: solo CSS]');
      pasa(correr('exigir-pruebas.mjs', bash('git push', { cwd: trabajo })));
      pasa(correr('exigir-pruebas.mjs', bash('git status', { cwd: trabajo })));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
