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
| Kills | 100 | 1.000 | 10.000 | 48 / 14 / 0 |
| Muertes (te mataron) | 100 | 1.000 | 10.000 | 52 / 15 / 0 |
| Banderas tomadas | 25 | 250 | 2.000 | 45 / 8 / 0 |
| Headshots | 50 | 500 | 2.500 | 32 / 2 / 0 |
| Cuerpo a cuerpo | 10 | 100 | 500 | 26 / 2 / 0 |
| Granadas | 25 | 250 | 2.000 | 37 / 6 / 0 |
| Con mira | 25 | 250 | 1.500 | 24 / 4 / 0 |
| Cohete (bazooka, Panzerschreck, PIAT) | 3 | 20 | 100 | ~10 / 1 / 0 |
| Teamkills | 10 | 100 | 500 | 44 / 5 / 0 |
| Horas jugadas | 5h | 50h | 250h | 28 / 0 / 0 |
| Tiempo acostado (Kenny) | 30m | 2h | 10h | a revisar |

La idea del reparto: el **bronce** lo saca cualquiera que venga seguido unas semanas,
la **plata** pide meses de constancia y el **oro** es de veterano. Hoy no hay ningún
oro, y eso está bien: al ritmo actual, los 10.000 kills son unos seis meses del que
más juega.

Dos avisos sobre los números:

- **Están calibrados sobre dos semanas.** Es lo único que hay. Conviene mirarlos de
  nuevo en un mes, cuando se vea el ritmo real de cada rubro.
- **El cohete y el Kenny son los más flojos.** Las muertes con cohete recién se
  registran bien desde el 1/10, y el tiempo acostado desde la versión 0.4 del plugin,
  así que sus marcas son las menos confiables.

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

- **Las tres imágenes del ojito**: dorado, plateado y de bronce.
- **La terna del Kenny**, que es la más dudosa: hoy solo cuatro doderos pasan la hora
  acostados.
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
