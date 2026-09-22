-- Esquema de la base de stats.
--
-- {p} es el prefijo de las tablas: vacio en produccion, "t12345_" en los tests.
-- Asi los tests corren contra la misma base real sin tocar las tablas de produccion.
--
-- Las estadisticas (kills, muertes, headshots...) NO se guardan como contadores:
-- se calculan desde los eventos en la vista {p}ranking. Un contador puede
-- desincronizarse; una cuenta sobre los eventos siempre da bien.

CREATE TABLE IF NOT EXISTS {p}jugadores (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- steamid valido, o "NICK:<nick>" para clientes sin steamid (STEAM_ID_LAN, etc.)
  identidad    VARCHAR(80)  NOT NULL,
  steamid      VARCHAR(40)  NULL,
  nick         VARCHAR(64)  NOT NULL,
  primera_vez  DATETIME     NOT NULL,
  ultima_vez   DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_identidad (identidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS {p}muertes (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  momento         DATETIME         NOT NULL,
  mapa            VARCHAR(40)      NOT NULL,
  -- NULL = suicidio, caida o muerte por el mapa
  matador_id      INT UNSIGNED     NULL,
  victima_id      INT UNSIGNED     NOT NULL,
  matador_equipo  TINYINT UNSIGNED NULL,
  victima_equipo  TINYINT UNSIGNED NOT NULL,
  arma            VARCHAR(32)      NOT NULL,
  hitbox          TINYINT UNSIGNED NOT NULL,
  headshot        TINYINT(1)       NOT NULL,
  teamkill        TINYINT(1)       NOT NULL,
  -- Coordenadas en unidades del mundo de HL1. Para los heatmaps de la fase 3.
  victima_x       INT              NOT NULL,
  victima_y       INT              NOT NULL,
  victima_z       INT              NOT NULL,
  matador_x       INT              NULL,
  matador_y       INT              NULL,
  matador_z       INT              NULL,
  PRIMARY KEY (id),
  KEY ix_matador (matador_id),
  KEY ix_victima (victima_id),
  KEY ix_mapa (mapa),
  KEY ix_momento (momento),
  CONSTRAINT fk_{p}muertes_matador FOREIGN KEY (matador_id) REFERENCES {p}jugadores (id),
  CONSTRAINT fk_{p}muertes_victima FOREIGN KEY (victima_id) REFERENCES {p}jugadores (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS {p}sesiones (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  jugador_id   INT UNSIGNED    NOT NULL,
  desconexion  DATETIME        NOT NULL,
  segundos     INT UNSIGNED    NOT NULL,
  PRIMARY KEY (id),
  KEY ix_jugador (jugador_id),
  CONSTRAINT fk_{p}sesiones_jugador FOREIGN KEY (jugador_id) REFERENCES {p}jugadores (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS {p}mapas_jugados (
  id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mapa    VARCHAR(40)     NOT NULL,
  inicio  DATETIME        NOT NULL,
  PRIMARY KEY (id),
  KEY ix_mapa (mapa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Donde pega cada jugador: todos los impactos (no solo el tiro que mata), por zona
-- del cuerpo, mas el danio y los disparos para la precision. Una fila por jugador y
-- mapa que se va sumando: las lineas H del plugin traen diferencias, no totales.
-- Sin fuego amigo. El mapa se guarda en minuscula para no duplicar filas.
CREATE TABLE IF NOT EXISTS {p}impactos (
  jugador_id   INT UNSIGNED    NOT NULL,
  mapa         VARCHAR(40)     NOT NULL,
  generico     INT UNSIGNED    NOT NULL DEFAULT 0,
  cabeza       INT UNSIGNED    NOT NULL DEFAULT 0,
  pecho        INT UNSIGNED    NOT NULL DEFAULT 0,
  estomago     INT UNSIGNED    NOT NULL DEFAULT 0,
  brazo_izq    INT UNSIGNED    NOT NULL DEFAULT 0,
  brazo_der    INT UNSIGNED    NOT NULL DEFAULT 0,
  pierna_izq   INT UNSIGNED    NOT NULL DEFAULT 0,
  pierna_der   INT UNSIGNED    NOT NULL DEFAULT 0,
  danio        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  disparos     BIGINT UNSIGNED NOT NULL DEFAULT 0,
  actualizado  DATETIME        NOT NULL,
  PRIMARY KEY (jugador_id, mapa),
  CONSTRAINT fk_{p}impactos_jugador FOREIGN KEY (jugador_id) REFERENCES {p}jugadores (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tiempo acostado (prone) de cada jugador, para la estadistica "Camper". Una fila
-- por jugador y mapa que se va sumando: las lineas A traen diferencias. Desde la 0.4.
CREATE TABLE IF NOT EXISTS {p}acostado (
  jugador_id   INT UNSIGNED    NOT NULL,
  mapa         VARCHAR(40)     NOT NULL,
  segundos     BIGINT UNSIGNED NOT NULL DEFAULT 0,
  actualizado  DATETIME        NOT NULL,
  PRIMARY KEY (jugador_id, mapa),
  CONSTRAINT fk_{p}acostado_jugador FOREIGN KEY (jugador_id) REFERENCES {p}jugadores (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Puntos de cada jugador (tomar banderas y objetivos): una fila por vez que sumo,
-- con el bando con el que jugaba en ese momento. Desde la version 0.3 del plugin.
CREATE TABLE IF NOT EXISTS {p}puntos (
  id          BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  momento     DATETIME          NOT NULL,
  mapa        VARCHAR(40)       NOT NULL,
  jugador_id  INT UNSIGNED      NOT NULL,
  equipo      TINYINT UNSIGNED  NOT NULL,
  puntos      SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY ix_jugador (jugador_id),
  KEY ix_momento (momento),
  CONSTRAINT fk_{p}puntos_jugador FOREIGN KEY (jugador_id) REFERENCES {p}jugadores (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Resultado de cada partida (un mapa jugado): el marcador de equipos. La identifica
-- el momento en que empezo el mapa; cada linea E del plugin la pisa con el marcador
-- mas nuevo, asi que al terminar queda el resultado final.
CREATE TABLE IF NOT EXISTS {p}partidas (
  mapa     VARCHAR(40)       NOT NULL,
  inicio   DATETIME          NOT NULL,
  fin      DATETIME          NOT NULL,
  aliados  SMALLINT UNSIGNED NOT NULL,
  eje      SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (inicio, mapa),
  KEY ix_mapa (mapa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hasta que byte de cada archivo ya se cargo. Se actualiza en la MISMA transaccion
-- que los eventos: o entran los eventos y avanza el offset, o no pasa ninguna de las dos.
CREATE TABLE IF NOT EXISTS {p}ingesta_estado (
  archivo              VARCHAR(64)     NOT NULL,
  bytes_procesados     BIGINT UNSIGNED NOT NULL,
  eventos_totales      INT UNSIGNED    NOT NULL DEFAULT 0,
  descartadas_totales  INT UNSIGNED    NOT NULL DEFAULT 0,
  actualizado          DATETIME        NOT NULL,
  PRIMARY KEY (archivo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ranking calculado desde los eventos.
-- Un teamkill NO suma como kill. Un suicidio SI suma como muerte.
CREATE OR REPLACE VIEW {p}ranking AS
SELECT
  j.id,
  j.identidad,
  j.steamid,
  j.nick,
  j.primera_vez,
  j.ultima_vez,
  COALESCE(k.kills, 0)      AS kills,
  COALESCE(k.headshots, 0)  AS headshots,
  COALESCE(k.teamkills, 0)  AS teamkills,
  COALESCE(d.muertes, 0)    AS muertes,
  COALESCE(d.suicidios, 0)  AS suicidios,
  COALESCE(s.segundos, 0)   AS segundos_jugados,
  COALESCE(pt.puntos, 0)    AS puntos,
  COALESCE(ac.segundos, 0)  AS segundos_acostado
FROM {p}jugadores j
LEFT JOIN (
  SELECT matador_id,
         SUM(teamkill = 0)                  AS kills,
         SUM(teamkill = 0 AND headshot = 1) AS headshots,
         SUM(teamkill = 1)                  AS teamkills
  FROM {p}muertes
  WHERE matador_id IS NOT NULL
  GROUP BY matador_id
) k ON k.matador_id = j.id
LEFT JOIN (
  SELECT victima_id,
         COUNT(*)                AS muertes,
         SUM(matador_id IS NULL) AS suicidios
  FROM {p}muertes
  GROUP BY victima_id
) d ON d.victima_id = j.id
LEFT JOIN (
  SELECT jugador_id, SUM(segundos) AS segundos
  FROM {p}sesiones
  GROUP BY jugador_id
) s ON s.jugador_id = j.id
LEFT JOIN (
  SELECT jugador_id, SUM(puntos) AS puntos
  FROM {p}puntos
  GROUP BY jugador_id
) pt ON pt.jugador_id = j.id
LEFT JOIN (
  SELECT jugador_id, SUM(segundos) AS segundos
  FROM {p}acostado
  GROUP BY jugador_id
) ac ON ac.jugador_id = j.id;
