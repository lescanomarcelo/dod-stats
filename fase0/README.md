# Fase 0 — Tests de viabilidad

Cuatro pruebas antes de escribir una línea del proyecto real. Si alguna falla, el diseño
cambia — mejor saberlo ahora que después de construir medio sitio.

Hacelas en orden: la 0.2 es la que decide si Vercel es viable.

---

## Test 0.1 — ¿Está el módulo MySQL de AMXX?

**No necesita nada de este repo**, es mirar por FTP o por el administrador de archivos del panel.

1. Entrá a `dod/addons/amxmodx/modules/` y buscá **`mysql_amxx_i386.so`**
   (el server es Linux i386: la consola muestra `dodx_amxx_i386.so`).
2. Abrí `dod/addons/amxmodx/configs/modules.ini` y fijate que la línea `mysql`
   **no esté comentada** con `;`.
3. Anotá la versión de AMXX: aparece en la consola al arrancar el server.

| Resultado | Qué hacer |
|---|---|
| El módulo está y está habilitado | seguir al 0.2 |
| Está pero comentado en `modules.ini` | descomentarlo y reiniciar |
| No está | bajar el módulo **de la misma versión de AMXX** que corre el server |

> Un módulo de otra versión no carga. La versión tiene que coincidir exactamente.

---

## Test 0.2 — ¿La base acepta conexiones remotas? ⚠️ GO / NO-GO

Tu PC es, para esa base, tan "externa" como Vercel. Si conecta desde acá, conecta desde allá.

**Paso 1.** Creá una base en el panel: TCAdmin → MySQL Manager → Create Database.

**Paso 2.** Anotá los cuatro datos de la tabla **Configured Databases**: DB Host, DB Name,
DB User, DB Pass.

**Paso 3.** Instalá las dependencias (una sola vez):

```bash
npm install
```

**Paso 4.** Corré la prueba con tus datos:

```bash
node probar-mysql.mjs --host TU_HOST --user TU_USUARIO --pass TU_CLAVE --db TU_BASE
```

El script no solo dice si conecta: mide la latencia, muestra la versión de MySQL, el
`max_connections` disponible, y verifica si el usuario puede crear tablas. Si falla, traduce
el código de error a qué significa y qué hacer.

| Resultado | Qué significa |
|---|---|
| `Test 0.2: GO` | listo, el proyecto va como está planeado |
| `ER_HOST_NOT_PRIVILEGED` | MySQL te reconoce pero no permite tu IP → pedir acceso externo a 4evergaming |
| `ECONNREFUSED` / `ETIMEDOUT` | firewall o MySQL solo en localhost → mismo pedido |
| `permisos: LIMITADOS` | conecta pero no puede crear tablas → crear el esquema desde phpMyAdmin |

> Si el hosting se niega a habilitar acceso externo, no es el final: el **Plan B** del plan
> es usar una base gestionada afuera (PlanetScale, Neon) y que el plugin escriba ahí.

---

## Test 0.3 — ¿El plugin escribe sin lagear el server?

Usa `dod_stats_prueba.sma`, que es un plugin descartable: cuando termines las pruebas,
sacalo de `plugins.ini`.

**Paso 1.** Compilalo en https://www.amxmodx.org/webcompiler.cgi y subí el `.amxx` a
`dod/addons/amxmodx/plugins/`.

**Paso 2.** Agregalo a `plugins.ini`:

```
dod_stats_prueba.amxx
```

**Paso 3.** Poné las credenciales en `dod/addons/amxmodx/configs/amxx.cfg`:

```
dod_stats_host "TU_DB_HOST"
dod_stats_user "TU_DB_USER"
dod_stats_pass "TU_DB_PASS"
dod_stats_db   "TU_DB_NAME"
```

**Paso 4.** Reiniciá y mirá el log en `dod/addons/amxmodx/logs/`. Buscá `[STATS-PRUEBA]`:

```
[STATS-PRUEBA] CONEXION OK - tabla lista (la consulta espero 0.031 seg en la cola)
```

**Paso 5 — la prueba de inyección SQL.** En la consola del server:

```
dod_stats_prueba
```

Inserta una fila con el nick `Pepe'); DROP TABLE prueba_eventos; --`, que es un nombre que
un jugador puede ponerse perfectamente. Después verificá en la base:

- ✅ **La tabla `prueba_eventos` sigue existiendo** y hay una fila con ese texto guardado literal
- ❌ Si la tabla desapareció, el escapado no funcionó → **parar todo**, no seguir a la Fase 1

**Paso 6 — la prueba de lag.** Con gente jugando, en la consola del server:

```
stats
```

Anotá los FPS del server. Compará con los FPS de antes de instalar el plugin. **No deben bajar.**
Cada muerte inserta una fila, así que un mapa movido es la prueba real.

**Paso 7.** Mirá cuántas filas se guardaron:

```
dod_stats_estado
```

Y en la base, que los datos tengan sentido: arma correcta, hitbox razonable, nombres bien.

---

## Test 0.4 — ¿Vercel llega a la base?

Este lo armamos **después** de que el 0.2 dé GO — no tiene sentido antes.

Es una ruta mínima de Next.js que hace `SELECT 1`, desplegada en Vercel, para confirmar
que la salida a internet de Vercel llega hasta Argentina y con cuánta latencia.

---

## Cuando las cuatro estén en verde

Pasamos a la Fase 1: esquema real de la base y el plugin de ingesta definitivo.
Y acordate de sacar `dod_stats_prueba.amxx` de `plugins.ini`.
