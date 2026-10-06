# Movimiento y retención

## Una sola curva

Toda la pieza entra y sale con la misma curva. La variedad se consigue con el
**escalonado** y el tamaño, no cambiando de easing: cinco curvas distintas se
leen como cinco plantillas pegadas.

```ts
export const EASE = Easing.bezier(0.16, 1, 0.3, 1); // ease-out fuerte
```

Los `spring` con rebote leen como plantilla de stock. Para un montaje que quiere
parecer caro, el elemento entra rápido y **frena en seco**.

La entrada que funciona combina tres cosas a la vez, ~11 frames: opacidad 0→1,
desplazamiento vertical de ~26px hacia arriba, y desenfoque de 10px→0. El
desenfoque es lo que da la sensación de coste; sin él la entrada se ve plana.

La salida es más corta (~8 frames) y sólo opacidad más un desplazamiento leve. Un
elemento que se va no merece tanta atención como uno que llega.

## Escalonar hermanos

Los elementos de una lista entran con retardo creciente, 7 a 14 frames entre uno
y otro. Con menos se leen como un bloque; con más, el espectador termina de leer
el primero y espera.

```tsx
{items.map((item, i) => <Row key={item} delay={8 + i * 14} ... />)}
```

## La cámara nunca está quieta

Es la diferencia más grande entre un talking head plano y uno que retiene, y la
más barata de conseguir.

- **Deriva continua**: escala de 1.02 a 1.06 a lo largo de toda la pieza.
  Imperceptible conscientemente, pero el plano deja de estar muerto.
- **Punch-in seco** en los giros del guion: salto a 1.12-1.14 en 5 frames, y
  desde ahí sigue empujando muy poco. Resérvalo para dos o tres momentos — la
  prueba, el bono, el cierre. Usado en cada frase pierde todo el efecto.

## Recursos que rematan

**Destello de dos fotogramas.** Un blanco al 50% sobre un corte duro. Tapa el
salto y marca el giro. Cuatro o cinco en un video de dos minutos, no más.

**Grano de película.** Un patrón de ruido estático que se desplaza cada
fotograma, en `mixBlendMode: overlay` al 9%. Generar ruido nuevo por fotograma
dispara el tiempo de render sin que se note la diferencia.

**Viñeta.** Un gradiente radial que hunde las esquinas ~46%. Centra la mirada y
une el B-roll con el plano base.

**Contador.** Un número que sube hasta su valor en ~22 frames. Que el ojo vea
moverse la cifra la fija mucho mejor que verla quieta.

**Tachado que se dibuja.** Una barra que crece de 0 a 100% mientras el texto baja
a 42% de opacidad. Para negaciones: "sin mensualidad", "cero cámaras". El gesto
de tachar comunica el rechazo mejor que cualquier palabra.

**Letterbox.** Barras superior e inferior que entran con el inserto. Separan el
B-roll del plano y de paso tapan el borde del clip generado.

**Etalonaje de dos capas.** Un filtro sobre el plano base
(`contrast(1.07) saturate(0.9)`) y un gradiente algo más frío sobre el B-roll.
Que el inserto se lea como inserto y no como otra escena.

## Coste de render

`OffthreadVideo` con `premountFor` en las secuencias de B-roll evita el tirón al
entrar. Carga sólo los pesos tipográficos que uses: `loadFont` sin argumentos son
más de cien peticiones por render.
