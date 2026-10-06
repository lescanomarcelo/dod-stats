# Medallero Dodero — plan

Cada semana que cierra reparte **ojitos**: dorado al primero de cada rubro, plateado
al segundo y de bronce al tercero. Con eso se arma un ranking de doderos por medallas
("Trevor es el dodero dorado del mes") y un detalle de quién ganó qué y cuándo.

## Decidido

| Qué | Cómo |
|---|---|
| Rubros | 9: las seis figuritas "buenas" + kills + puntos + K/D |
| Podio | Tres por rubro: oro, plata y bronce. 27 ojitos por semana |
| Mínimos | No hay mínimo extra: el que puntea se lleva el oro igual |
| Semana | De lunes a domingo, hora de Argentina. Ya está resuelto en `lib/periodos.ts` |
| Cuándo se otorga | Cuando la semana cierra. La semana en curso no reparte |

Los nueve rubros:

| Rubro | Qué mide | De dónde sale |
|---|---|---|
| `fiel` | Más horas jugadas | figurita El dodero fiel |
| `banderas` | Más banderas tomadas | figurita El dodero ejemplar |
| `melee` | Más kills con pala o cuchillo | figurita La vieja más pelada |
| `granadas` | Más kills con granadas | figurita El Aero-Player |
| `headshots` | Mayor % de headshots | figurita El chiterazo |
| `sniper` | Más frags con mira | figurita ¡Como estoy con esnaiper! |
| `kills` | Más kills | ranking general |
| `puntos` | Más puntos | ranking general |
| `kd` | Mejor K/D | ranking general |

Quedan afuera teamkills, El más Kenny y El cocinero: el medallero premia solo cosas
de las que uno se enorgullece.

> **Ojo con los porcentajes.** `headshots` y `kd` ya piden un mínimo de kills para
> entrar (`MIN_KILLS_PORCENTAJES`), porque si no el que mató una sola vez a la cabeza
> sale primero con 100%. Eso no es un mínimo nuevo: es parte de cómo está definido el
> rubro y se respeta tal cual.

## Cómo se calcula

Las medallas de una semana cerrada no cambian nunca, así que se guardan una sola vez
en vez de recalcularlas en cada visita:

```sql
CREATE TABLE medallas (
  semana      DATE         NOT NULL,  -- el lunes de esa semana
  rubro       VARCHAR(20)  NOT NULL,
  puesto      TINYINT      NOT NULL,  -- 1 oro, 2 plata, 3 bronce
  jugador_id  INT UNSIGNED NOT NULL,
  valor       BIGINT       NOT NULL,  -- el número con el que lo gano
  PRIMARY KEY (semana, rubro, puesto)
)
```

**Quién las escribe.** Las consultas de cada rubro ya están en el sitio
(`CONSULTA_DESTACADO` y el ranking). Copiarlas a la ingesta sería tener el mismo SQL
en dos lugares, así que el cálculo va en una ruta del sitio, `POST /api/medallas`,
protegida por un secreto. El workflow de ingesta la llama después de cargar los
eventos: recalcula las dos últimas semanas cerradas (por si llegaron datos tarde) y
completa las que falten. Es idempotente.

## Fases

1. **Tabla y cálculo.** `medallas` en el esquema, los tres rubros nuevos (kills,
   puntos, K/D) como consultas, `POST /api/medallas` y la llamada desde el workflow.
   Al final: las dos semanas cerradas que ya hay, con sus 54 ojitos, en la base.
2. **Página Medallero.** El ranking de doderos ordenado por oro, después plata,
   después bronce, con el filtro de período de siempre (mes, global) para que exista
   el "dodero dorado del mes". Debajo, el detalle por rubro.
3. **Detalle por rubro.** Quién ganó cada rubro semana por semana.
4. **En el perfil.** Las medallas de cada dodero en su página, con el rubro y la
   semana de cada una.
5. **Terminaciones.** Las imágenes de los ojitos, el botón de compartir por WhatsApp
   y la vista previa, como el resto del sitio.

## Falta definir

- **Las tres imágenes del ojito** (dorado, plateado, de bronce), que las hace Trevor.
- **Desempates.** Si dos salen iguales en un rubro, por ahora gana el de id más bajo.
  Habría que decidir si se reparte el mismo puesto a los dos o si desempata algo
  (más tiempo jugado, por ejemplo).
- **Si el medallero arranca desde el 21/9**, que es la primera semana con datos, o si
  se espera a tener más historia.
