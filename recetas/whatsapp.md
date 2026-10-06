# Receta: WhatsApp

**Para qué:** que Claude lea, busque y responda tus chats de WhatsApp, y transcriba tus notas de voz.

**Costo:** gratis. Corre en tu propio computador (servicio local en `http://127.0.0.1:7717`).
La transcripción de notas de voz usa APIMart (centavos por audio) y funciona cuando APIMart esté conectado.

**Qué se abre:** `http://127.0.0.1:7717/vincular` (página local con el código QR).

## Lo que hace la persona

1. Tener el celular a mano con WhatsApp abierto.
2. En el celular: **WhatsApp → Ajustes (o los tres puntos ⋮) → Dispositivos vinculados → Vincular un dispositivo**.
3. Escanear el QR que aparece en la pantalla del computador.

## Lo que hace Claude

1. Dile: *"Voy a conectar tu WhatsApp. Abre WhatsApp en tu celular y ve a Dispositivos vinculados →
   Vincular un dispositivo. Te muestro el QR aquí."*
2. Comprueba que el servicio esté corriendo: `node whatsapp/arranque.mjs estado` (dentro de `~/mi-claude`).
   Si no está activo: `node whatsapp/arranque.mjs instalar` y espera unos segundos.
3. Abre `http://127.0.0.1:7717/vincular` en el **navegador integrado**. Toma una captura para confirmar
   que se ve el QR.
4. Espera a que la persona diga que escaneó (el QR se renueva solo cada ~20 s; si caduca, recarga la página).
5. Verifica con `wsp estado` → debe decir **conectado**. La primera sincronización de chats puede
   tardar unos minutos; eso es normal.
6. Celebra: *"WhatsApp conectado ✅ Ya puedes preguntarme «¿qué tengo sin leer?»."*

Comandos útiles después (los usa la skill `/whatsapp`): `wsp estado | chats | leer | buscar | recientes |
enviar | archivos | audios | voz`. **Nunca envíes un mensaje sin que la persona lo pida y apruebe el texto.**

## Si algo falla

- **La página no abre / "no se puede conectar":** el servicio no está corriendo.
  `node whatsapp/arranque.mjs instalar`, espera 5 s y recarga. Si sigue, `node setup/instalar.mjs --solo whatsapp`.
- **`wsp` no se encuentra:** abre una terminal nueva (la ruta se actualizó al instalar) o corre
  `node setup/instalar.mjs --solo whatsapp` otra vez.
- **El QR caduca antes de escanear:** recarga la página y pídele que escanee de inmediato.
- **"No se pudo vincular" en el celular:** que revise que el celular tenga internet y que no tenga ya
  4 dispositivos vinculados (el máximo); si los tiene, que cierre uno viejo.
- **Se desconectó días después:** abre de nuevo `/vincular` y repite el escaneo. Los chats guardados no se pierden.
- **Notas de voz sin transcribir:** falta la key de APIMart o no tiene saldo → `recetas/apimart.md`.

## Si la página cambió

La intención es simple: mostrar un QR para vincular un dispositivo. Si `/vincular` no muestra un QR,
corre `wsp estado` y sigue lo que diga; como último recurso, `node setup/doctor.mjs` y revisa la fila de WhatsApp.
