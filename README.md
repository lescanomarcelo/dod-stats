# DoD Stats

Sitio de estadísticas para el server **DoD 1.3 :::aU::: Tributo** (45.235.98.67:27017).

```
Plugin .amxx  →  archivo TSV en el server  →  ingesta por SFTP  →  MySQL  →  sitio en Vercel
```

## Carpetas

| Carpeta | Qué hay |
|---|---|
| `plugin/` | `dod_stats_registro.sma` — registra muertes, conexiones y desconexiones. Compilado en `plugin/compilado/` con AMXX 1.9.0.5281 |
| `ingesta/` | Baja los archivos del server por SFTP, los parsea y los carga en MySQL. 36 tests |
| `sitio/` | El sitio en Next.js 16: ranking, perfiles, comparación y armas. Se despliega en Vercel |
| `.github/workflows/` | Corre la ingesta cada 15 minutos en GitHub Actions |
| `fase0/` | Pruebas de viabilidad iniciales. `dod_stats_prueba.sma` quedó obsoleto: usaba el módulo MySQL, que el hosting no deja instalar |

## Ingesta

Requiere Node 24.

```bash
cd ingesta
npm install
cp .env.example .env    # y completar las credenciales
npm test                # 36 tests, contra la base real con tablas temporales
npm run esquema         # crea las tablas de produccion (idempotente)
npm run ingerir         # una pasada de ingesta
```

Garantías que cubren los tests:

- **Nunca duplica ni pierde eventos.** Eventos y offset se guardan en la misma transacción.
- **Retoma donde quedó.** Solo baja lo nuevo de cada archivo.
- **Tolera escrituras a medias.** Una línea cortada mientras el plugin escribe se carga cuando se completa.
- **Una sola ingesta a la vez.** Candado de MySQL: dos corridas en paralelo no duplican.
- **Datos hostiles.** Nicks con SQL, tildes, `ñ`, campos largos: se guardan bien o se recortan, nunca traban la ingesta.
- **Verifica al server.** Con `SFTP_HUELLA` se niega a mandar la contraseña si el server cambió.

Reglas de conteo:

- Un teamkill no suma como kill. Un suicidio suma como muerte.
- Las muertes con bots se ignoran enteras.
- Clientes sin steamid válido (`STEAM_ID_LAN`, etc.) se identifican por nick.

## Sitio

Next.js 16 con Cache Components: cada consulta se cachea y se revalida cada minuto,
así la mayoría de las visitas no tocan la base.

```bash
cd sitio
npm install
cp .env.example .env.local
npm run dev
```

Para desarrollar sin datos reales: `node --env-file=.env sembrar-demo.mjs` desde `ingesta/`
genera 7 días de partidas simuladas en tablas `demo_*`, pasándolas por la ingesta real.
Después, `DB_PREFIJO=demo_` en `sitio/.env.local`.

## Credenciales

Nunca en el código. Localmente van en `ingesta/.env` y `sitio/.env.local` (ignorados por git).

- **Vercel** → Settings → Environment Variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`.
- **GitHub** → Settings → Secrets and variables → Actions: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`,
  `SFTP_HOST`, `SFTP_PORT`, `SFTP_USER`, `SFTP_PASS`, `SFTP_HUELLA`.
