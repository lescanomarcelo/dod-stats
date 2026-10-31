# Pendientes

Cosas que quedaron abiertas, para no perderlas de vista. Lo de arriba es lo que más
apura.

## Del server

- **`dod_quaint_b1` rompe el server. RESUELTO.** Se puso 3 veces y las 3 lo tuvieron
  que sacar a los 10, 72 y 34 segundos (la última, el 16/10 a las 21:25, con
  "Reliable channel overflowed" para muchos). Quedó comentado en
  `addons/amxmodx/configs/maps.ini` y la corrida de las 04:00 lo desactivó solo: ya
  no se puede votar. La causa nunca se determinó: no es exceso de contenido
  (`dod_saints` tiene más entidades y anda bien), así que si alguna vez se lo quiere
  volver a habilitar, es a ciegas.

- **Los logs del juego escriben el año 2025** (dicen `10/16/2025` cuando era 2026).
  Los de AMX Mod X sí dicen 2026. No rompe nada nuestro, pero confunde al buscar un
  log por fecha.

## Del sitio

- **Commits sin subir.** Entre ellos el que cierra las trampas de crawler, que es
  el que más apura: hasta que no se despliegue, el consumo de CPU en Vercel sigue
  igual.

- **El build local falla**, y ya fallaba antes de todo esto: el sitio apunta a las
  tablas `demo_` y esas quedaron sin la columna `gg` que sumó lo del gungame.
  `npx tsc --noEmit` y el lint pasan limpios, y el deploy de Vercel usa las tablas
  de verdad, así que no frena nada; pero no se puede probar un build completo en la
  máquina hasta volver a sembrar la demo.

- **Confirmar el consumo de Vercel en el Usage del equipo ML.** El 31/10, un día
  después del robots.txt, el tráfico automático sobre `/comparar` ya no estaba: la
  antigüedad del caché sube pareja y es igual a la de la portada, cuando antes del
  arreglo daba 12 segundos contra 152. Falta el número de Active CPU, que necesita
  Observability Plus (plan Pro) y solo se ve entrando al Usage. El Firewall quedó sin
  ninguna regla: por ahora no hizo falta.

- **La rama `diario`** (el tema experimental) quedó sin sincronizar desde el rediseño
  de la ficha militar. Se le fue sumando todo lo que vino después.

- **La tabla `chat`** quedó vacía en la base, de la Radio DoD que se descartó. Se
  puede borrar.

- **Buscar el nick escribiendo** en la votación de mapas. Hoy es un desplegable con
  330 doderos y es incómodo en el celular.

- **Histórico de quincenas más largo.** Hoy solo se ve la anterior.

- **Revisar el medallero otra vez cuando empiecen a caer los oros.** La revisión del
  31/10 (40 días de datos) dejó las marcas como estaban salvo el oro del Kenny, que
  bajó de 50h a 25h. El primer oro que va a caer es el del Matador: al ritmo del
  líder, a los pocos días de esa fecha. Cuando pase, conviene mirar si la página los
  muestra bien, que hasta ahora nunca se vio un oro de verdad.

## Decisiones tomadas que conviene recordar

- Los tamaños de los mapas los manda `ingesta/tamanos-mapas.tsv`, no la medida del
  `.bsp`. Si hay que corregir alguno, se edita ahí.
- El voto de mapas no se puede sacar: una vez apretado, cuenta.
- Lo jugado en gungame no cuenta para ninguna estadística.
