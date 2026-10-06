// Página /vincular: la que abre la persona para escanear el QR con su celular.
// Se recarga sola; cuando ya está vinculado muestra «✅ Conectado».

const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ESTADOS = {
  arrancando: 'Arrancando el servicio…',
  conectando: 'Conectando con WhatsApp…',
  reconectando: 'Reconectando con WhatsApp…',
  desvinculado: 'Se cerró la sesión. Preparando un código nuevo…',
};

export function htmlVincular({ conexion, qrDataUrl, numero, mensajes = 0 }) {
  const conectado = conexion === 'conectado';
  let cuerpo;
  if (conectado) {
    cuerpo = `<div class="icono">✅</div>
<h1>Conectado</h1>
<p>Tu WhatsApp${numero ? ` <b>+${escapar(numero)}</b>` : ''} está vinculado a Claude.</p>
<p class="suave">${Number(mensajes).toLocaleString('es')} mensajes guardados en este computador. Ya puedes cerrar esta página.</p>`;
  } else if (qrDataUrl) {
    cuerpo = `<h1>Vincula tu WhatsApp</h1>
<ol>
  <li>Abre <b>WhatsApp</b> en tu celular.</li>
  <li>Ve a <b>Dispositivos vinculados</b> (en Ajustes o en el menú ⋮).</li>
  <li>Toca <b>Vincular un dispositivo</b>.</li>
  <li><b>Escanea</b> este código con la cámara.</li>
</ol>
<img src="${escapar(qrDataUrl)}" width="300" height="300" alt="Código QR para vincular WhatsApp">
<p class="suave">El código cambia solo cada pocos segundos. Esta página se actualiza sola.</p>`;
  } else {
    cuerpo = `<div class="girando"></div>
<h1>${escapar(ESTADOS[conexion] || 'Preparando…')}</h1>
<p class="suave">En unos segundos aparece el código para escanear.</p>`;
  }
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="${conectado ? 30 : 4}">
<title>Vincular WhatsApp</title>
<style>
  :root { --fondo:#f3f5f1; --tarjeta:#fff; --texto:#1b1d1a; --suave:#5d6359; --acento:#1f9d55; }
  @media (prefers-color-scheme: dark) { :root { --fondo:#121412; --tarjeta:#1d201c; --texto:#eef1ec; --suave:#a3aa9e; } }
  * { box-sizing:border-box }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px;
         background:var(--fondo); color:var(--texto); font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif }
  main { background:var(--tarjeta); border-radius:18px; padding:28px 24px; max-width:440px; width:100%;
         text-align:center; box-shadow:0 4px 24px #0000001a }
  h1 { font-size:22px; margin:0 0 12px }
  ol { text-align:left; margin:0 auto 18px; padding-left:22px; max-width:340px }
  li { margin:4px 0 }
  img { max-width:100%; height:auto; background:#fff; padding:10px; border-radius:12px }
  .suave { color:var(--suave); font-size:14px; margin:12px 0 0 }
  .icono { font-size:48px; line-height:1; margin-bottom:8px }
  .girando { width:36px; height:36px; margin:0 auto 14px; border-radius:50%;
             border:4px solid #0002; border-top-color:var(--acento); animation:g 1s linear infinite }
  @keyframes g { to { transform:rotate(360deg) } }
</style></head>
<body><main>
${cuerpo}
</main></body></html>`;
}
