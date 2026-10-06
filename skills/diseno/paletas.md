# Catálogo de paletas

La **fuente de verdad del color** para tus proyectos: aquí están los valores exactos de
**24 paletas de acento**, más `tinta` (monocromo). Cada proyecto lleva una sola paleta; el
resto de la interfaz (grises, bordes, superficies) sale del sistema de componentes (por
ejemplo shadcn/ui).

**Una paleta no entra por verse bien, entra porque los contrastes le dan y porque no se
confunde con ninguna otra.** Las dos cosas se calcularon.

## Ampliar el catálogo no es repartir tonos por la rueda

La intuición («24 paletas, 15° de tono cada una») está mal, y se comprueba midiendo. En
la banda de los teales el gamut de sRGB aprieta tanto que a luminosidad 0.52 el croma
máximo es ~0.09 para todo el arco entre 180 y 231: un cian, un turquesa y un celeste
perfectamente espaciados salen siendo **el mismo verde azulado**.

Por eso el reparto va por **dos ejes**:

- **Tono** donde el gamut da croma — rojos, naranjas, azules, violetas, magentas.
- **Luminosidad** donde no lo da. De ahí salen las seis **profundas** (`marino`,
  `petroleo`, `acero`, `pino`, `cafe`, `ciruela`), en luminosidad 0.40–0.44. No son la
  versión oscura de su vecina: `marino` al lado de `azul` no es el mismo azul más oscuro,
  es otro color.

El piso de separación es la distancia del par más parecido del catálogo (cian ↔
aguamarina, 0.039 en OKLab): ninguna pareja es más confundible que esa.

## Cómo se usa

- En un proyecto nuevo, se proponen 3 paletas que le peguen al tema y la persona elige.
- Para cambiar el color de un proyecto existente, basta pedirlo («ponle la paleta
  esmeralda»): se copian los 10 valores de la paleta a la hoja de estilos global del
  proyecto (en un proyecto con shadcn/ui, `globals.css` o equivalente), 5 en el bloque
  `:root` (modo claro) y 5 en el bloque `.dark` (modo oscuro), y se deja un comentario
  `PALETA: <nombre>` al principio del archivo para que se sepa cuál tiene.

## Qué tiñe cada variable

| Variable | Qué pinta |
|---|---|
| `--primary` | Botones principales, enlaces, casillas, interruptores, insignias, barra de progreso, el cuadrito del logo |
| `--primary-foreground` | El texto encima de esos elementos (siempre blanco) |
| `--ring` | El borde que aparece al navegar con el teclado |
| `--sidebar-accent` | Fondo del ítem activo del menú lateral (tinte suave del color) |
| `--sidebar-accent-foreground` | Texto de ese ítem activo |

**No tocar** `--accent` (es el gris de los hovers, no el color de marca) ni invertir
`--primary` entre modos: el acento es el mismo color en claro y en oscuro.

## Accesibilidad

Todos los valores están calculados, no elegidos a ojo. Verificado con las fórmulas de
contraste WCAG sobre el hex que **de verdad se pinta** — oklch → sRGB con el recorte al
gamut incluido, porque un color fuera de gamut se recorta al renderizar y medir el valor
teórico es medir un color que nadie ve:

- Texto blanco sobre el color: **≥5.3:1** en claro, **≥4.6:1** en oscuro (mínimo exigido 4.5)
- El color contra el fondo de la página: **≥3.2:1** (mínimo exigido 3.0)
- Texto del ítem activo sobre su tinte: **≥6.6:1**

**Las dos variantes se miden por separado.** Un modo oscuro no es un claro invertido, así
que su contraste tampoco se hereda: una paleta que va sobrada en claro puede quedar por
debajo de 4.5 en oscuro.

Los colores se expresan en `oklch(luminosidad croma tono)`. **Para hacer una variante de
una paleta NO basta mover el tono**: en media rueda el gamut de sRGB no deja que el color
se mueva de verdad. Si hace falta un color nuevo, se calcula la luminosidad más alta que
aún deje blanco encima a 5.3:1 y se toma el croma máximo del gamut a esa luminosidad; luego
se verifican los tres contrastes de arriba en claro y en oscuro.

---

### Índigo — `indigo`

Tecnología, SaaS, productividad, herramientas internas

```css
/* MODO CLARO — en :root */
--primary: oklch(0.545 0.252 272);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.545 0.252 272);
--sidebar-accent: oklch(0.955 0.02 272);
--sidebar-accent-foreground: oklch(0.435 0.2 272);

/* MODO OSCURO — en .dark */
--primary: oklch(0.575 0.232 272);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.575 0.232 272);
--sidebar-accent: oklch(0.33 0.045 272);
--sidebar-accent-foreground: oklch(0.88 0.058 272);
```

### Violeta — `violeta`

IA, innovación, creatividad, educación

```css
/* MODO CLARO — en :root */
--primary: oklch(0.565 0.294 305);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.565 0.294 305);
--sidebar-accent: oklch(0.955 0.022 305);
--sidebar-accent-foreground: oklch(0.435 0.2 305);

/* MODO OSCURO — en .dark */
--primary: oklch(0.595 0.278 305);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.595 0.278 305);
--sidebar-accent: oklch(0.33 0.045 305);
--sidebar-accent-foreground: oklch(0.88 0.072 305);
```

### Azul — `azul`

Servicios, corporativo, finanzas, seguros, legal

```css
/* MODO CLARO — en :root */
--primary: oklch(0.525 0.132 245);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.525 0.132 245);
--sidebar-accent: oklch(0.955 0.022 245);
--sidebar-accent-foreground: oklch(0.435 0.11 245);

/* MODO OSCURO — en .dark */
--primary: oklch(0.56 0.14 245);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.56 0.14 245);
--sidebar-accent: oklch(0.33 0.045 245);
--sidebar-accent-foreground: oklch(0.88 0.062 245);
```

### Cian — `cian`

Salud, bienestar, logística, transporte

```css
/* MODO CLARO — en :root */
--primary: oklch(0.515 0.088 205);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.515 0.088 205);
--sidebar-accent: oklch(0.955 0.022 205);
--sidebar-accent-foreground: oklch(0.435 0.074 205);

/* MODO OSCURO — en .dark */
--primary: oklch(0.55 0.094 205);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.55 0.094 205);
--sidebar-accent: oklch(0.33 0.045 205);
--sidebar-accent-foreground: oklch(0.88 0.075 205);
```

### Aguamarina — `aguamarina`

Deporte, competencia, marcas con emblema metálico, paneles oscuros

Es el punto entre el cian y la esmeralda: sirve donde el verde se siente demasiado
"eco" y el cian demasiado "clínico".

```css
/* MODO CLARO — en :root */
--primary: oklch(0.51 0.09 180);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.51 0.09 180);
--sidebar-accent: oklch(0.955 0.022 180);
--sidebar-accent-foreground: oklch(0.435 0.085 180);

/* MODO OSCURO — en .dark */
--primary: oklch(0.545 0.096 180);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.545 0.096 180);
--sidebar-accent: oklch(0.33 0.045 180);
--sidebar-accent-foreground: oklch(0.88 0.075 180);
```

**Variante brillante para paneles oscuros fijos.** Si el panel es negro, el acento tiene
que emitir luz, no descansar sobre blanco: se usa uno mucho más luminoso.
acento tiene que emitir luz, no descansar sobre blanco. Si una app oscura pide lo
mismo, estos son los valores —y el texto encima deja de ser blanco:

```css
--primary: oklch(0.78 0.15 175);
--primary-foreground: oklch(0.13 0.02 180); /* oscuro: en blanco da 1.77:1 */
--primary-light: oklch(0.86 0.15 182);      /* un punto más brillante, para destellos */
```

### Esmeralda — `esmeralda`

Finanzas personales, crecimiento, ecología, agro

```css
/* MODO CLARO — en :root */
--primary: oklch(0.51 0.12 158);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.51 0.12 158);
--sidebar-accent: oklch(0.955 0.022 158);
--sidebar-accent-foreground: oklch(0.435 0.102 158);

/* MODO OSCURO — en .dark */
--primary: oklch(0.545 0.128 158);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.545 0.128 158);
--sidebar-accent: oklch(0.33 0.045 158);
--sidebar-accent-foreground: oklch(0.88 0.075 158);
```

### Lima — `lima`

Deporte, energía, agro, alimentos frescos

```css
/* MODO CLARO — en :root */
--primary: oklch(0.51 0.164 140);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.51 0.164 140);
--sidebar-accent: oklch(0.955 0.022 140);
--sidebar-accent-foreground: oklch(0.435 0.142 140);

/* MODO OSCURO — en .dark */
--primary: oklch(0.545 0.176 140);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.545 0.176 140);
--sidebar-accent: oklch(0.33 0.045 140);
--sidebar-accent-foreground: oklch(0.88 0.075 140);
```

### Ámbar — `ambar`

Comida, restaurantes, retail, hospitalidad

```css
/* MODO CLARO — en :root */
--primary: oklch(0.53 0.112 75);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.53 0.112 75);
--sidebar-accent: oklch(0.955 0.022 75);
--sidebar-accent-foreground: oklch(0.435 0.092 75);

/* MODO OSCURO — en .dark */
--primary: oklch(0.565 0.12 75);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.565 0.12 75);
--sidebar-accent: oklch(0.33 0.045 75);
--sidebar-accent-foreground: oklch(0.88 0.075 75);
```

### Naranja — `naranja`

Delivery, marketplace, retail, construcción

```css
/* MODO CLARO — en :root */
--primary: oklch(0.54 0.144 50);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.54 0.144 50);
--sidebar-accent: oklch(0.955 0.022 50);
--sidebar-accent-foreground: oklch(0.435 0.116 50);

/* MODO OSCURO — en .dark */
--primary: oklch(0.575 0.152 50);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.575 0.152 50);
--sidebar-accent: oklch(0.33 0.045 50);
--sidebar-accent-foreground: oklch(0.88 0.07 50);
```

### Rosa — `rosa`

Moda, belleza, comunidad, eventos

```css
/* MODO CLARO — en :root */
--primary: oklch(0.56 0.234 350);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.56 0.234 350);
--sidebar-accent: oklch(0.955 0.022 350);
--sidebar-accent-foreground: oklch(0.435 0.182 350);

/* MODO OSCURO — en .dark */
--primary: oklch(0.595 0.248 350);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.595 0.248 350);
--sidebar-accent: oklch(0.33 0.045 350);
--sidebar-accent-foreground: oklch(0.88 0.074 350);
```

### Rojo — `rojo`

Urgencia, deporte, comida rápida, promociones

```css
/* MODO CLARO — en :root */
--primary: oklch(0.555 0.226 28);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.555 0.226 28);
--sidebar-accent: oklch(0.955 0.022 28);
--sidebar-accent-foreground: oklch(0.435 0.178 28);

/* MODO OSCURO — en .dark */
--primary: oklch(0.59 0.242 28);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.59 0.242 28);
--sidebar-accent: oklch(0.33 0.045 28);
--sidebar-accent-foreground: oklch(0.88 0.062 28);
```

---

## Las doce de la ampliación

Van en el orden de la rueda, y las marcadas **profunda**
son las que se separan de su vecina por luminosidad y no por tono.

### Púrpura — `purpura`

Infoproductos, mentorías, academias, agencias, inteligencia artificial

```css
/* MODO CLARO — en :root */
--primary: oklch(0.555 0.26 290);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.555 0.26 290);
--sidebar-accent: oklch(0.955 0.022 290);
--sidebar-accent-foreground: oklch(0.435 0.2 290);

/* MODO OSCURO — en .dark */
--primary: oklch(0.575 0.252 290);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.575 0.252 290);
--sidebar-accent: oklch(0.33 0.045 290);
--sidebar-accent-foreground: oklch(0.88 0.063 290);
```

### Ciruela — `ciruela` — profunda

Relojería, licores premium, marca personal, consultoría, coaching

```css
/* MODO CLARO — en :root */
--primary: oklch(0.42 0.211 312);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.42 0.211 312);
--sidebar-accent: oklch(0.955 0.022 312);
--sidebar-accent-foreground: oklch(0.4 0.2 312);

/* MODO OSCURO — en .dark */
--primary: oklch(0.544 0.26 312);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.544 0.26 312);
--sidebar-accent: oklch(0.33 0.045 312);
--sidebar-accent-foreground: oklch(0.88 0.075 312);
```

### Magenta — `magenta`

Eventos, música, marketing, comunidad, contenido

```css
/* MODO CLARO — en :root */
--primary: oklch(0.56 0.26 326);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.56 0.26 326);
--sidebar-accent: oklch(0.955 0.022 326);
--sidebar-accent-foreground: oklch(0.435 0.2 326);

/* MODO OSCURO — en .dark */
--primary: oklch(0.58 0.26 326);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.58 0.26 326);
--sidebar-accent: oklch(0.33 0.045 326);
--sidebar-accent-foreground: oklch(0.88 0.075 326);
```

### Cobalto — `cobalto`

Software, plataformas, datos, integraciones, fintech

```css
/* MODO CLARO — en :root */
--primary: oklch(0.535 0.199 258);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.535 0.199 258);
--sidebar-accent: oklch(0.955 0.022 258);
--sidebar-accent-foreground: oklch(0.435 0.162 258);

/* MODO OSCURO — en .dark */
--primary: oklch(0.555 0.206 258);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.555 0.206 258);
--sidebar-accent: oklch(0.33 0.045 258);
--sidebar-accent-foreground: oklch(0.88 0.059 258);
```

### Marino — `marino` — profunda

Importación, aduanas, seguros, contabilidad, servicios legales

```css
/* MODO CLARO — en :root */
--primary: oklch(0.4 0.114 250);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.4 0.114 250);
--sidebar-accent: oklch(0.955 0.022 250);
--sidebar-accent-foreground: oklch(0.38 0.108 250);

/* MODO OSCURO — en .dark */
--primary: oklch(0.508 0.144 250);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.508 0.144 250);
--sidebar-accent: oklch(0.33 0.045 250);
--sidebar-accent-foreground: oklch(0.88 0.061 250);
```

### Acero — `acero` — profunda

Maquinaria, herramientas, autopartes, metalmecánica, dotación industrial

```css
/* MODO CLARO — en :root */
--primary: oklch(0.44 0.086 228);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.44 0.086 228);
--sidebar-accent: oklch(0.955 0.022 228);
--sidebar-accent-foreground: oklch(0.42 0.082 228);

/* MODO OSCURO — en .dark */
--primary: oklch(0.502 0.098 228);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.502 0.098 228);
--sidebar-accent: oklch(0.33 0.045 228);
--sidebar-accent-foreground: oklch(0.88 0.075 228);
```

### Petróleo — `petroleo` — profunda

Refrigeración, aire acondicionado, químicos, industria pesada, energía

```css
/* MODO CLARO — en :root */
--primary: oklch(0.42 0.071 198);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.42 0.071 198);
--sidebar-accent: oklch(0.955 0.022 198);
--sidebar-accent-foreground: oklch(0.4 0.068 198);

/* MODO OSCURO — en .dark */
--primary: oklch(0.5 0.085 198);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.5 0.085 198);
--sidebar-accent: oklch(0.33 0.045 198);
--sidebar-accent-foreground: oklch(0.88 0.075 198);
```

### Pino — `pino` — profunda

Agro, ganadería, madera, exportación, alimentos al por mayor

```css
/* MODO CLARO — en :root */
--primary: oklch(0.42 0.116 150);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.42 0.116 150);
--sidebar-accent: oklch(0.955 0.022 150);
--sidebar-accent-foreground: oklch(0.4 0.111 150);

/* MODO OSCURO — en .dark */
--primary: oklch(0.494 0.136 150);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.494 0.136 150);
--sidebar-accent: oklch(0.33 0.045 150);
--sidebar-accent-foreground: oklch(0.88 0.075 150);
```

### Musgo — `musgo`

Agroinsumos, semillas, reciclaje, empaques, ropa de trabajo

```css
/* MODO CLARO — en :root */
--primary: oklch(0.52 0.117 114);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.52 0.117 114);
--sidebar-accent: oklch(0.955 0.022 114);
--sidebar-accent-foreground: oklch(0.435 0.098 114);

/* MODO OSCURO — en .dark */
--primary: oklch(0.54 0.121 114);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.54 0.121 114);
--sidebar-accent: oklch(0.33 0.045 114);
--sidebar-accent-foreground: oklch(0.88 0.075 114);
```

### Café — `cafe` — profunda

Cuero, marroquinería, muebles de madera, chocolate, café de origen

```css
/* MODO CLARO — en :root */
--primary: oklch(0.42 0.105 55);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.42 0.105 55);
--sidebar-accent: oklch(0.955 0.022 55);
--sidebar-accent-foreground: oklch(0.4 0.1 55);

/* MODO OSCURO — en .dark */
--primary: oklch(0.52 0.129 55);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.52 0.129 55);
--sidebar-accent: oklch(0.33 0.045 55);
--sidebar-accent-foreground: oklch(0.88 0.074 55);
```

### Ladrillo — `ladrillo`

Cerámica, materiales de construcción, ferretería, tostión de café, artesanía en barro

```css
/* MODO CLARO — en :root */
--primary: oklch(0.545 0.183 37);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.545 0.183 37);
--sidebar-accent: oklch(0.955 0.022 37);
--sidebar-accent-foreground: oklch(0.435 0.146 37);

/* MODO OSCURO — en .dark */
--primary: oklch(0.565 0.189 37);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.565 0.189 37);
--sidebar-accent: oklch(0.33 0.045 37);
--sidebar-accent-foreground: oklch(0.88 0.065 37);
```

### Carmesí — `carmesi`

Licores, vinos, carnes, repuestos, marcas con carácter

```css
/* MODO CLARO — en :root */
--primary: oklch(0.555 0.222 9);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.555 0.222 9);
--sidebar-accent: oklch(0.955 0.022 9);
--sidebar-accent-foreground: oklch(0.435 0.175 9);

/* MODO OSCURO — en .dark */
--primary: oklch(0.575 0.23 9);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.575 0.23 9);
--sidebar-accent: oklch(0.33 0.045 9);
--sidebar-accent-foreground: oklch(0.88 0.065 9);
```

---

### Tinta — `tinta` — monocromo

**Blanco y negro, elegante, minimalista.** Es la única paleta sin tono:
la acción va en **negro** y la navegación entera (barra lateral, cabecera del celular y
barra de pestañas) va **negra con texto blanco** en los dos modos. Sirve para marcas de moda
o de lujo donde el color lo ponen las fotos.

Dos cosas que la separan de las demás, con la cuenta hecha:

- **Es la única que invierte `--primary` entre modos.** Un botón negro sobre el lienzo
  oscuro no se ve, así que en `.dark` el botón es casi blanco con texto negro (19:1).
  En claro, blanco sobre `#171717` da 18.1:1.
- **Toca las variables de la barra lateral enteras**, no solo el ítem activo:
  `--sidebar-background` `oklch(0.145 0 0)` (`#0a0a0a`), texto `oklch(0.83 0 0)` (11.7:1),
  ítem activo `oklch(0.269 0 0)` con texto blanco (15.2:1), borde igual al activo,
  `--sidebar-primary` blanco con texto negro (el cuadrito del logo plegado).
  Trampa: el `SidebarProvider` de shadcn pone `text-sidebar-foreground` en el contenedor
  de TODA la página, así que con la barra negra el contenido hereda texto gris claro;
  el cuerpo de la página tiene que fijar `text-foreground`.

```css
/* MODO CLARO — en :root */
--primary: oklch(0.205 0 0);
--primary-foreground: oklch(1 0 0);
--ring: oklch(0.205 0 0);
--sidebar-accent: oklch(0.269 0 0);
--sidebar-accent-foreground: oklch(1 0 0);

/* MODO OSCURO — en .dark */
--primary: oklch(0.985 0 0);
--primary-foreground: oklch(0.145 0 0);
--ring: oklch(0.708 0 0);
--sidebar-accent: oklch(0.269 0 0);
--sidebar-accent-foreground: oklch(1 0 0);
```
