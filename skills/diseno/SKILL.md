---
name: diseno
description: Dirección y auditoría visual de una pantalla o app — color, tipografía, layout, densidad, movimiento y accesibilidad — en un solo flujo que orquesta el paquete de diseño (74 sistemas de marcas reales de awesome-design-md, impeccable, taste-skill, los seis de Emil Kowalski para movimiento) junto a frontend-design y web-design-guidelines, con un catálogo de paletas propio como fuente de verdad del color. Usar cuando la persona diga /diseno, /diseño, "diseña esta pantalla", "esto se ve feo", "mejora el diseño", "revisa la UI", "qué colores le pongo", "hazlo estilo Stripe/Notion/Linear", "ponle animaciones", "esto se siente muerto", "no me gusta cómo se ve", "hazlo más bonito/profesional", o antes de construir una pantalla nueva.
---

# Diseño — dirección visual, movimiento y auditoría de UI

Un solo comando que junta todo el criterio de diseño y le pone tres reglas propias: el color sale
de un catálogo calculado (`paletas.md`), el celular manda, y lo que se agrega en pantalla también
tiene que poderse hacer hablando.

**Dos modos, se detectan solos:**

- **Modo dirección** — la pantalla todavía no existe. Se decide cómo se va a ver *antes* de escribir
  el primer componente. Pasos 0 → 1 → 2 → 3 → 6.
- **Modo auditoría** — la pantalla ya existe y algo no cuadra. Se revisa y se arregla.
  Pasos 0 → 2 → 3 → 4 → 5 → 6.

Si la persona no lo aclara, mirar si la ruta/componente ya existe en el proyecto.

---

## El paquete

Son skills de terceros que se instalan desde su repo (ver **`FUENTES.md`**, con el comando de cada
uno). Si al llegar a un paso falta la skill que pide, se instala ahí mismo y se sigue; si no se
puede, se aplica el criterio de este archivo y se dice cuál faltó.

| Playbook | Para qué | Cuándo |
|---|---|---|
| Catálogo de marcas (`catalogo-marcas.md`) | 74 sistemas de marcas reales (Stripe, Linear, Notion, Vercel, Apple, Figma…) con paleta, escala tipográfica, radios, sombras y motion en valores exactos | Paso 1: elegir dirección |
| `impeccable` | Motor de diseño de producto con playbooks (`shape`, `critique`, `audit`, `polish`, `bolder`, `quieter`, `typeset`, `colorize`, `harden`…) y un detector mecánico | Pasos 1, 4 y 5: producto, paneles, app |
| `design-taste-frontend` (taste-skill) | Anti-slop para landings, portafolios y rediseños. No para dashboards ni tablas | Paso 1: landing o página de venta |
| `animate` | Construir una animación decidiendo en el orden correcto: si debe animar, qué propiedad, qué curva, qué duración, cómo se interrumpe | Paso 3 |
| `review-animations` | Revisar el movimiento de un cambio concreto contra un listón alto | Paso 3 |
| `improve-animations` | Auditar el movimiento de una app entera y devolver un plan priorizado | Paso 3, app completa |
| `find-animation-opportunities` | Encontrar qué *debería* animarse y descartar lo que no | Paso 3, app completa |
| `animation-vocabulary` | Traducir «lo que rebota cuando abre» al término exacto | Cuando la persona describe un efecto sin nombre |
| `emil-design-eng` | La filosofía de fondo: detalles invisibles, decisiones de componente | Lectura de apoyo, no un paso |
| `frontend-design`, `web-design-guidelines` | Que no se sienta plantilla; reglas de cumplimiento de UI | Pasos 1 y 4 |

---

## Paso 0 — Ubicar el contexto

1. **Proyecto y pantalla.** La carpeta que la persona nombre o en la que se esté trabajando, y qué
   pantalla concreta (`/inicio`, la landing, un componente). Si dijo solo «la app», preguntar qué
   pantalla — auditar diez pantallas de una da un reporte que nadie lee.
2. **Leer el `CLAUDE.md` / `README` del proyecto.**
3. **Leer `paletas.md`** (en esta carpeta). Es la fuente de verdad del color. Ver si el proyecto ya
   tiene paleta asignada: el comentario `PALETA:` al principio de su hoja de estilos global.
4. **Detectar el stack** mirando el `package.json` (Next.js, Vite, Tailwind, shadcn/ui…) antes de
   asumir nada.
5. **Si el proyecto ya tiene un documento de sistema de diseño** (`DESIGN.md`,
   `design-system/…/MASTER.md`), leerlo y tratarlo como decisión tomada. No se regenera encima.
6. **Clasificar la superficie**, porque de eso depende qué playbook manda:
   **Persuadir** (landing, página de venta) · **Operar** (panel, dashboard, editor, ajustes) ·
   **Leer** (docs, guías) · **Mostrar** (portafolio, galería).

---

## Paso 1 — Dirección visual (solo modo dirección)

### 1a. Referencia de marca

Leer `catalogo-marcas.md` (las 74, con su lenguaje visual en una línea) y proponer **dos o tres
marcas** que le peguen al producto, con una línea de por qué cada una. Cuando la persona elija,
leer entero el `DESIGN.md` de esa marca desde GitHub (la URL está al principio del catálogo): no
solo los colores — lo que hace que algo se vea como Stripe es la tipografía fina con tracking
negativo y los radios apretados, no el índigo.

Es una interpretación inspirada, no el manual de la marca: se toman las decisiones de sistema
(relaciones, escalas, densidad), nunca su logo, su nombre ni su copy.

Si la persona ya dijo «estilo X», saltarse la propuesta y leer esa directo.

### 1b. Los diales

| Dial | Panel de operación / dashboard | Landing o página de venta |
|---|---|---|
| Densidad | Alta (cabe más dato por pantalla) | Baja (aire, respira) |
| Movimiento | Mínimo (el movimiento estorba cuando se trabaja) | Medio |
| Variación | Baja (predecible se usa más rápido) | Alta (tiene que distinguirse) |

Si `ui-ux-pro-max` está instalado, sirve para sacar patrón de página, estilo, jerarquía y la lista
de anti-patrones con esos diales. **Lo que NO se toma de ninguna skill: los colores hex ni las
fuentes por defecto.**

### 1c. Color — manda el catálogo

Ninguna skill del paquete decide el color; varias proponen hex de su propia base. El orden es:

1. Si el proyecto ya tiene paleta asignada (`PALETA:`), esa es y no se discute.
2. Si es pantalla nueva de un proyecto existente, hereda la paleta del proyecto.
3. Si el proyecto no tiene paleta, proponer 3 de `paletas.md` que le peguen al rubro y que la
   persona elija.

De la referencia de marca sí se toma **cómo se distribuye** el color (dónde va el acento, cuánto
peso tiene el fondo, si el modo oscuro es el primario), que es distinto de cuál es el color. Los
grises, bordes y superficies vienen del sistema de componentes (por ejemplo shadcn/ui).

### 1d. Ejecutar la dirección — un playbook, no dos

Según la superficie del paso 0:

- **Operar o Leer** (panel, dashboard, app, docs) → `impeccable`. Se carga su contexto una vez por
  sesión con el cwd en el proyecto y se siguen sus directivas; después el playbook del verbo que
  toque —`shape` para planear antes de escribir código— y su piso de calidad justo antes de tocar
  UI. Si su launcher falla, decirlo y seguir leyendo el contexto del proyecto a mano.
- **Persuadir o Mostrar** (landing, página de venta, portafolio) → `design-taste-frontend`, que es
  justo para eso y explícitamente no para tablas ni paneles. Para una landing, además
  `landing-page-copywriter` y `landing-page-design` si están instalados, y el copy pasa por
  `/copy-brasileno`.

No invocar los dos: opinan distinto sobre lo mismo y la pantalla sale a medio camino.

`frontend-design` va encima de cualquiera de los dos, para que no se sienta plantilla, y aterrizado
al negocio real: las decisiones salen del mundo de quien lo va a usar.

### 1e. Entregar la dirección

Antes de escribir código, mostrar a la persona en español y sin jerga: qué referencia, qué paleta,
qué fuentes, cómo se estructura la pantalla, y **una cosa que se sale de lo esperado y por qué**.
Si cambia algo grande (paleta, tipografía, patrón de página), que la persona elija; lo demás se
construye directo.

---

## Paso 2 — Tipografía

1. Fijar la escala si el proyecto no tiene una explícita (tamaños, pesos, interlineado, y su
   relación entre pasos) — `typography-scale` si está instalado. Si hay referencia de marca del
   paso 1a, su bloque de tipografía ya trae la escala con tracking: se adapta, no se reinventa.
2. Revisar la pantalla concreta: uso de la escala, legibilidad, consistencia y cumplimiento de
   tokens (`critique-typography` si está instalado).

Un tamaño escrito a mano en un componente es un hallazgo, no una decisión: la escala vive en los
tokens (Tailwind / variables CSS). Las escalas de las marcas están pensadas para escritorio: bajar
los display a la escala móvil antes de usarlos.

Mínimos que no se negocian, porque casi todo el mundo lee en el celular: cuerpo ≥16px,
interlineado 1.5, contraste 4.5:1.

---

## Paso 3 — Movimiento

El movimiento no es decoración ni se agrega al final: es parte de cómo se entiende la pantalla.

| Situación | Playbook |
|---|---|
| Construir una animación concreta | `animate` |
| Revisar el movimiento del cambio que acabo de hacer | `review-animations` |
| «La app se siente muerta», barrer todo | `find-animation-opportunities` y después `improve-animations` |
| La persona describe un efecto sin saber cómo se llama | `animation-vocabulary` |

Criterio encima:

- **En pantallas de operar, el movimiento estorba.** Un panel que se usa cincuenta veces al día no
  necesita entradas escalonadas.
- **Respetar `prefers-reduced-motion`** siempre.
- Nada de animar `width`, `height`, `top` o `left`: transform y opacity.
- Si la animación va en un video o en un reel, las reglas cambian: eso trabaja en frames, no en
  milisegundos (ver `/vsl-edit`).

---

## Paso 4 — Cumplimiento (solo modo auditoría)

1. `web-design-guidelines` sobre los archivos de la pantalla: hallazgos en formato `archivo:línea`.
2. El detector mecánico de `impeccable`, **una sola vez**, cuando la UI ya esté terminada (no
   durante la exploración), sobre los archivos cambiados.

Lo que más aparece y más duele en el celular: área de toque menor a 44×44px, foco de teclado
quitado, estados de carga sin retroalimentación, scroll horizontal, texto gris sobre gris, y emoji
usado como icono.

---

## Paso 5 — Verificar de verdad (solo modo auditoría)

La persona no tiene por qué abrir el navegador a comprobar. Se verifica y se le muestra:

1. `preview_start` con el nombre del proyecto (nunca levantar el server con Bash).
2. `resize_window` a **mobile (375×812) primero** — el celular manda y el escritorio se deriva.
   Después desktop.
3. Screenshot de ambos, y de modo claro y oscuro si el cambio toca color.
4. `read_console_messages` por si algo se rompió en el camino.
5. **Si el cambio toca un flujo y no solo una pantalla** —login, formulario de varios pasos,
   carrito, enlaces— recorrer el flujo entero (con `playwright-skill` si está instalado, que deja el
   script guardado para volver a correrlo).

Los screenshots van en la respuesta. Nunca pedirle a la persona que revise ella.

---

## Paso 6 — Entregar y decidir

Cerrar en español, sin jerga, ordenado por impacto:

1. **Lo que ya arreglé** — los hallazgos objetivos van aplicados, no propuestos.
2. **Top 3 decisiones de dirección** que sí son opinables, cada una con qué se gana.
3. **Lo cosmético que puede esperar.**
4. `AskUserQuestion` con las candidatas cuando haya que elegir.

Cuando el cambio quede verificado: checkpoint con `git commit` (por nombre de archivo).

---

## Reglas

- **El color sale de `paletas.md`, siempre.** Varias skills del paquete van a proponer hex propios;
  se ignoran. Si una paleta del catálogo de verdad no da para lo que se necesita, decirlo y proponer
  agregar una nueva **al catálogo** —en `oklch` y con el contraste verificado como las demás— no
  meter un color suelto en un proyecto. Ojo en Tailwind 4: pisar `--color-primary` en `:root` o los
  portales salen con el color viejo.
- **Un playbook por superficie.** `impeccable` para operar y leer, `design-taste-frontend` para
  persuadir y mostrar.
- **Los comandos de impeccable que escriben archivos (`init`, `document`) no se corren solos.**
  Escriben `PRODUCT.md` y `DESIGN.md` en el proyecto y pueden pisar decisiones ya tomadas. Solo si
  la persona lo pide.
- **Accesibilidad y cumplimiento se arreglan en la misma pasada.** Contraste, área de toque, foco de
  teclado, etiquetas de formulario, `alt`: eso es objetivo, no hay nada que consultar. Se arregla y
  se reporta.
- **La dirección visual grande se propone, no se impone.** Cambiar la paleta, la tipografía, el
  patrón de la página o la densidad son decisiones de la persona.
- **Mobile-first, un solo sistema.** Se diseña para 375px y de ahí se deriva el escritorio.
- **Lo que se puede hacer en pantalla, se puede hacer hablando.** Si el proyecto tiene un chat o un
  agente y el rediseño agrega un control (un selector, un filtro, un interruptor), en el **mismo
  cambio** va la acción equivalente para hacerlo por chat.
- **No romper los componentes compartidos para conseguir un efecto.** Si el efecto necesita
  salirse del componente, se envuelve, no se parcha el original.
- **Proyectos con estilo propio** se auditan igual, pero no se les propone migrar a otro sistema de
  componentes ni al catálogo de paletas salvo que la persona lo pida.
