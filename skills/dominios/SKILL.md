---
name: dominios
description: Encuentra el dominio para un proyecto — propone nombres con criterio de marca y verifica de verdad cuáles están libres consultando WHOIS y RDAP, nunca adivinando. Usar cuando la persona diga /dominios, "qué dominio le pongo a X", "está libre tal.com", "consígueme un nombre para esta app", "busca dominios", "necesito una URL para el cliente", "revisa si este dominio existe", o cuando al publicar algo haga falta decidir el dominio.
---

# Dominios — proponer nombres y confirmar cuáles están libres

La parte creativa es proponer nombres; la verificación es real — sale del registro oficial de cada
dominio, gratis y sin cuenta. Un modelo que «cree» que un dominio está libre suele equivocarse.

**La regla que no se rompe: ningún nombre se presenta como disponible sin haberlo pasado por
`dominios.mjs`.** Un «creo que está libre» puede costar una conversación con un cliente hablando de
una URL que ya es de otro.

---

## Paso 0 — Entender qué se va a nombrar

Antes de proponer nada:

1. **Qué es** — la app, el producto, el negocio o el cliente. Si es un proyecto con `CLAUDE.md` o
   `README`, leerlo: el nombre debe cuadrar con lo que ya existe.
2. **Para quién** — quién lo va a escribir y a dictar. Un nombre que el público no pueda dictar por
   teléfono, no sirve.
3. **De quién va a ser el dominio** — si es para un cliente, el nombre lleva *su* marca, no una idea
   nueva. Ahí el trabajo es encontrar la variante libre más cercana a como ya se llaman.
4. **Si ya hay un candidato**, no hay que inventar nada: se verifica ese y se ofrecen alternativas
   solo si está ocupado.

Si algo de esto no está claro y cambia lo que se propone, preguntarlo. Una ronda de veinte nombres
para el público equivocado se bota entera.

---

## Paso 1 — Proponer nombres

Sacar **entre 8 y 15 candidatos** que cumplan:

- **Corto** — menos de 15 caracteres; lo bueno cabe en 8.
- **Dictable por teléfono** — sin guiones, sin números, sin dobles letras raras. La prueba real:
  decirlo en voz alta y ver si hay que deletrearlo.
- **Sin ambigüedad de escritura en español** — cuidado con b/v, s/c/z, y/ll, y con palabras en
  inglés que la gente escribiría como suenan.
- **Pronunciable en español** aunque la palabra sea inventada.
- **Que insinúe qué hace**, o que sea lo bastante raro para volverse marca.
- **Que aguante cinco años** — nada de «ai» pegado al final por moda si el producto no es eso.

Mezclar tres fuentes para que la lista no sea toda del mismo molde: la palabra literal del negocio,
una palabra evocativa (no descriptiva), y una inventada corta.

### Qué TLD probar

Por defecto el script prueba `.com .co .com.co .ai .app .io`. Criterio para recomendar:

- **.com** — lo que la gente teclea por defecto. Para un negocio que va a poner la URL en una
  factura o un catálogo, es el que vale.
- **El del país** (`.co`, `.com.co`, `.mx`, `.com.ar`, `.es`…) — segunda mejor opción y muchas veces
  libre cuando el `.com` no lo está. Se cambia con `TLDS` (abajo).
- **.ai** — solo si el producto realmente es de IA. Cuesta ~USD 70/año.
- **.app**, **.io**, **.dev** — para producto técnico o interno, no para un negocio tradicional.

No recomendar un TLD exótico para el dominio principal de un negocio. Sirve para un proyecto
lateral, no para donde llega la plata.

---

## Paso 2 — Verificar de verdad

Correr el script con los candidatos (funciona igual en Mac y Windows; solo necesita Node):

```bash
node ~/.claude/skills/dominios/dominios.mjs nombre1 nombre2 nombre3
```

- Un argumento **sin punto** se expande a todos los TLD por defecto.
- Un argumento **con punto** (`miempresa.com`) se consulta tal cual.
- Para cambiar la lista, la variable `TLDS` (ej. `.com .mx .com.mx`): en Mac
  `TLDS=".com .mx" node …`; en PowerShell `$env:TLDS=".com .mx"; node …`.

Devuelve una línea por dominio:

- `LIBRE` — el registro dice que no existe. Se puede registrar.
- `OCUPADO` — existe, con la fecha de vencimiento cuando el registro la da.
- `REVISAR` — ni WHOIS ni RDAP contestaron. **No es libre ni ocupado**: se vuelve a correr ese
  dominio solo. Si insiste, se reporta como no verificado, nunca se presenta como disponible.

Se puede correr con muchos nombres de una: son consultas gratis.

### Cómo funciona (para no romperlo)

WHOIS es la consulta oficial de cada registro y no pide llave ni tiene cupo. El script habla WHOIS
directo (puerto 43), sin depender del comando `whois` del sistema, que Windows no trae:

- Primero le pregunta a `whois.iana.org` qué servidor atiende ese TLD (campo `whois:`/`refer:`),
  y luego le pregunta a ese servidor por el dominio.
- Algunos registros (`.app` y otros de Google) **no contestan por WHOIS**. Para esos cae a **RDAP**
  (`rdap.org`), el protocolo nuevo, también gratis; necesita un `user-agent` o responde 403. Ojo:
  RDAP vía `rdap.org` responde 404 para `.co` aunque el dominio exista, así que RDAP es solo
  respaldo — el `.co` siempre por WHOIS.

---

## Paso 3 — Presentar el resultado

Agrupado, corto, y con una recomendación — no un volcado de la salida del script.

```
Libres
  miempresa.co        ← recomendado
  miempresa.com.co
  miempresa.io

Ocupados
  miempresa.com       (vence 2027-05-29)
  miempresa.app
```

Y debajo, **dos o tres frases**: cuál recomendar y por qué (audiencia, longitud, si se dicta bien),
y qué se pierde con el que está ocupado. Si el `.com` que se quería está tomado, decir si vence
pronto — un vencimiento cercano a veces vale la pena esperarlo.

**Nunca inventar precios.** El script da disponibilidad, no precio. De referencia: un `.com` ronda
USD 12/año, un `.co` USD 25, un `.ai` USD 70 — pero si el precio importa para la decisión, se mira
en el registrador (Namecheap, Cloudflare, Porkbun…) antes de decirlo.

---

## Paso 4 — Cerrar

Claude no compra dominios: el registro lo hace la persona en el registrador. Terminar con qué
sigue, no con un «listo».

- Si es para un cliente, recordar que **el dominio se registra a nombre del cliente**.
- Los dominios buenos se van rápido: si hay un ganador claro, decirlo con esas palabras.

---

## Cosas que no hacer

- Presentar como libre algo que no pasó por el script.
- Proponer nombres con guiones o números «porque el limpio está ocupado».
- Recomendar un TLD raro para el dominio principal de un negocio real.
- Prometer que un nombre no tiene problema de marca registrada — eso no lo dice WHOIS y toca
  revisarlo aparte en la oficina de marcas del país.
