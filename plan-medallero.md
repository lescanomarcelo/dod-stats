# Medallero Dodero — plan

Medallas de **skill**, al estilo de los logros de Steam: cada rubro tiene una terna de
marcas y el que la alcanza se lleva el ojito, de bronce, de plata o dorado. No hay
semana ni plazo: es lo acumulado de toda la historia y, una vez conseguida, no se
pierde. Con eso se arma un ranking de doderos por medallas y, en cada perfil, lo que
falta para la próxima.

Es mejor que el medallero semanal que habíamos pensado (queda guardado al final):
arranca con todo el historial en vez de con dos semanas, no tiene empates ni mínimos
que resolver, y premia a cualquiera que juegue, no solo al podio.

## Las ternas

Calibradas contra los datos reales del 22/9 al 6/10 (dos semanas). La última columna
es cuántos doderos la tendrían **hoy**, apenas se publique:

| Rubro | Bronce | Plata | Oro | Hoy la tienen |
|---|---|---|---|---|
| Kills | 1.500 | 5.000 | 10.000 | 8 / 0 / 0 |
| Muertes (te mataron) | 1.500 | 5.000 | 10.000 | 5 / 0 / 0 |
| Banderas tomadas | 300 | 1.000 | 5.000 | 6 / 0 / 0 |
| Headshots | 250 | 1.000 | 5.000 | 7 / 0 / 0 |
| Cuerpo a cuerpo | 50 | 300 | 1.000 | 7 / 0 / 0 |
| Granadas | 250 | 1.500 | 5.000 | 6 / 0 / 0 |
| Con mira | 150 | 1.000 | 3.000 | 6 / 0 / 0 |
| Cohete (bazooka, Panzerschreck, PIAT) | 10 | 100 | 500 | 2 / 0 / 0 |
| Teamkills | 100 | 300 | 1.000 | 5 / 0 / 0 |
| Horas jugadas | 15h | 50h | 250h | 5 / 0 / 0 |
| Tiempo acostado (Kenny) | 1h | 10h | 50h | 4 / 0 / 0 |

El reparto es exigente a propósito: **nadie tiene plata ni oro en ningún rubro**, y el
bronce lo tienen entre dos y ocho doderos por rubro, 61 medallas en total para 240
jugadores.

Cuánto tardarían en llegar, al ritmo de estos quince días, el que va primero en cada
rubro y el octavo (que es más o menos el que hoy saca el bronce):

| Rubro | Plata, el 1ro | Plata, el 8vo | Oro, el 1ro | Oro, el 8vo |
|---|---|---|---|---|
| Kills | 3 semanas | 1,6 meses | 1,6 meses | 3,2 meses |
| Muertes | 3 semanas | 1,8 meses | 1,7 meses | 3,7 meses |
| Banderas | 2 semanas | 1,7 meses | 3 meses | 8,7 meses |
| Headshots | 3 semanas | 2 meses | 3,5 meses | 10 meses |
| Cuerpo a cuerpo | 2 semanas | 3,4 meses | 2,2 meses | 11,4 meses |
| Granadas | 2 semanas | 3,3 meses | 2 meses | 11,2 meses |
| Con mira | 3 semanas | 4,2 meses | 2,2 meses | 12,7 meses |
| Teamkills | 3 semanas | 2,1 meses | 2,5 meses | 6,9 meses |
| Horas jugadas | 4 semanas | 1,9 meses | 4,7 meses | 9,6 meses |

Son proyecciones de quince días de datos, así que hay que tomarlas como un orden de
magnitud y no como una promesa.

Dos avisos sobre los números:

- **Están calibrados sobre dos semanas.** Es lo único que hay. Conviene mirarlos de
  nuevo en un mes, cuando se vea el ritmo real de cada rubro.
- **El cohete y el Kenny son los más flojos.** Las muertes con cohete recién se
  registran bien desde el 1/10, y el tiempo acostado desde la versión 0.4 del plugin,
  así que sus marcas son las menos confiables.
- **Todo se va a ir aflojando solo.** Las marcas son fijas y los totales crecen, así
  que dentro de unos meses el bronce lo va a tener mucha más gente y van a empezar a
  caer los oros. Es lo esperable en un sistema de logros, y para eso está pensado el
  ojito de titanio más abajo.

Los rubros "malos" entran igual, que era la gracia: el ojito dorado de teamkills y el
Kenny dorado se ganan con todo honor.

## Cómo se calcula

No hace falta tabla nueva. Una medalla es una cuenta sobre los totales de siempre, así
que sale de las consultas que ya existen:

- La vista `ranking` ya trae kills, muertes, headshots, teamkills, puntos y los
  segundos jugados y acostados de cada uno: **una sola consulta**.
- Faltan cinco más, una por rubro de arma (cuerpo a cuerpo, granadas, con mira,
  cohete) y una para contar banderas.

Son seis consultas para todo el medallero, cacheadas como el resto del sitio. Si más
adelante se pone pesado, recién ahí se materializa en una tabla.

**Lo que no se puede sin tabla** es la fecha en que se consiguió cada medalla, que es
lindo tenerlo ("conseguiste el ojito dorado el 3/10"). Hay dos caminos y los dos
quedan para después: guardar la fecha cuando se cruza la marca, o calcularla al vuelo
buscando el momento del kill número 1.000. Lo segundo no necesita tabla pero es una
consulta pesada, así que iría solo en el detalle.

## Más adelante: el ojito de titanio

Las marcas son fijas y los totales no paran de crecer, así que el oro se va a ir
alcanzando y en algún momento deja de ser un desafío. Para eso queda abierta la puerta
a un cuarto metal, el **ojito de titanio**, con marcas muy por encima del oro, que se
sumaría cuando se vea que la gente engancha y que los oros empiezan a repartirse.

Eso tiene una consecuencia de diseño que conviene respetar desde el día uno: el
catálogo guarda **una lista de escalones** (metal y marca), no tres campos fijos
llamados bronce, plata y oro. Agregar el titanio después tiene que ser una línea en el
catálogo y una imagen más, no rehacer las consultas ni la tabla.

## Las imágenes: tres y no treinta y tres

El ojito es siempre el mismo dibujo, cambia el metal. Así que alcanza con **tres
imágenes para todo el medallero**: el ojito dorado, el plateado y el de bronce. La
tarjeta de cada rubro lleva el ojito del metal que corresponda más el nombre del
rubro; no hace falta un dibujo por rubro, que serían treinta y tres.

Si incluso tres son muchas, hay una salida: un solo ojito claro y que el color del
metal lo ponga el sitio con CSS. Queda bien con dibujos de un solo tono y ahorra dos
imágenes, pero se pierde el brillo de un dorado hecho a mano. Yo probaría primero con
las tres.

## Fases

1. **Catálogo y cálculo.** Las ternas en un solo lugar (`lib/medallas.ts`), las seis
   consultas y la función que devuelve las medallas de un dodero. Con tests sobre los
   bordes: justo en la marca, uno abajo, cero.
2. **Página Medallero.** El ranking de doderos ordenado por oro, después plata,
   después bronce. Debajo, el catálogo de rubros con sus tres marcas y cuánta gente
   llegó a cada una.
3. **En el perfil.** Las medallas del dodero y, para cada rubro, lo que le falta para
   la próxima: "812 / 1.000 kills".
4. **Terminaciones.** Las imágenes de los ojitos (las hace Trevor), el botón de
   compartir por WhatsApp y la vista previa, como el resto del sitio.
5. **Más adelante.** La fecha de cada medalla y un aviso de las nuevas de la semana.

## Falta definir

- **Las tres imágenes del ojito**: dorado, plateado y de bronce, una sola vez para
  todos los rubros.
- **Si los rubros de arma necesitan nombre propio**, como las figuritas, o alcanza con
  "Cuerpo a cuerpo" y "Con mira".

---

## Guardado: el medallero semanal

La idea anterior, por si se quiere sumar después. Cada semana cerrada repartía oro,
plata y bronce al podio de cada rubro, con una tabla `medallas` que se llenaba sola y
el cálculo en una ruta del sitio llamada desde el workflow de ingesta. Se dejó de lado
porque con dos semanas de datos queda flaco y porque obliga a resolver empates y
mínimos. Los dos medalleros pueden convivir: este premia la constancia y aquel, la
semana.
