# Pendientes

Cosas que quedaron abiertas, para no perderlas de vista. Lo de arriba es lo que más
apura.

## Del server

- **`dod_quaint_b1` rompe el server.** Se puso 3 veces y las 3 lo tuvieron que sacar a
  los 10, 72 y 34 segundos (la última, el 16/10 a las 21:25, con "Reliable channel
  overflowed" para muchos). **Sigue habilitado para votarse**, así que si gana una
  votación lo van a poner de nuevo. Conviene sacarlo de
  `addons/amxmodx/configs/maps.ini`: con eso desaparece solo de la votación en la
  corrida de las 04:00. La causa no se pudo determinar: no es exceso de contenido
  (`dod_saints` tiene más entidades y anda bien).

- **Los logs del juego escriben el año 2025** (dicen `10/16/2025` cuando era 2026).
  Los de AMX Mod X sí dicen 2026. No rompe nada nuestro, pero confunde al buscar un
  log por fecha.

## Del sitio

- **Dos commits sin subir**: "Cómo quedó la quincena pasada" y "El voto es
  definitivo".

- **La rama `diario`** (el tema experimental) quedó sin sincronizar desde el rediseño
  de la ficha militar. Se le fue sumando todo lo que vino después.

- **La tabla `chat`** quedó vacía en la base, de la Radio DoD que se descartó. Se
  puede borrar.

- **Buscar el nick escribiendo** en la votación de mapas. Hoy es un desplegable con
  330 doderos y es incómodo en el celular.

- **Histórico de quincenas más largo.** Hoy solo se ve la anterior.

- **Revisar las marcas del medallero** cuando haya pasado un mes con datos, para ver
  si el ritmo real las dejó muy fáciles o muy difíciles. La terna del Kenny es la
  menos confiable.

## Decisiones tomadas que conviene recordar

- Los tamaños de los mapas los manda `ingesta/tamanos-mapas.tsv`, no la medida del
  `.bsp`. Si hay que corregir alguno, se edita ahí.
- El voto de mapas no se puede sacar: una vez apretado, cuenta.
- Lo jugado en gungame no cuenta para ninguna estadística.
