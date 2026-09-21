# Sitio de stats

Next.js 16 (App Router, Cache Components) + MySQL. Ver el [README principal](../README.md).

```bash
npm install
cp .env.example .env.local   # completar credenciales
npm run dev                  # http://localhost:3000
npm test                     # tests de calculos
npm run build                # build de produccion
```

`DB_PREFIJO=demo_` usa las tablas con partidas simuladas (generarlas con
`node --env-file=.env sembrar-demo.mjs` desde `ingesta/`). En produccion va vacio.
