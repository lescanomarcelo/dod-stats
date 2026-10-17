# Mapas

Herramientas para las imágenes de los mapas de calor. No corren en producción: se usan
para generar los recursos del sitio cada vez que cambian los mapas del server.

```bash
npm install
node --env-file=../ingesta/.env bajar-overviews.mjs   # baja los overviews del server por SFTP
node generar.mjs                                      # -> sitio/public/mapas/*.webp y sitio/lib/overviews.json
node validar.mjs "<carpeta dod>" ./cache               # verifica la conversion de coordenadas
node --env-file=../ingesta/.env catalogo.mjs          # carga el catalogo de mapas votables y su tamaño
node --env-file=../ingesta/.env catalogo.mjs --ver    # lo mismo, pero sin escribir en la base
```

Después de `generar.mjs`, commitear `sitio/public/mapas/` y `sitio/lib/overviews.json`.

## El catálogo de mapas votables

`catalogo.mjs` arma la lista de mapas que se pueden votar en el sitio. Sale de
`addons/amxmodx/configs/maps.ini`, que es la que usa el menú de admin del server: los
mapas que un admin puede poner de verdad.

De cada uno saca el tamaño de la caja del mundo del `.bsp`. No baja el archivo
entero: con una lectura por rango alcanzan la cabecera (124 bytes) y los 24 del
modelo 0, así que medir los 83 mapas cuesta unos 12 KB en vez de 200 MB.

Los cortes entre chico, mediano y grande están en `ingesta/tamano_mapas.mjs`. Si un
mapa quedó en el grupo equivocado, se corrige en la tabla poniéndole `a_mano = 1` y
el script no lo vuelve a pisar.

## Cómo se convierten las coordenadas

Cada mapa trae un overview: una imagen de 1024×768 y un `.txt` con `ZOOM`, `ORIGIN` y
`ROTATED`. La conversión del mundo del juego a la imagen está en `sitio/lib/overview.ts`.

`validar.mjs` la verifica con datos reales: lee de cada `.bsp` las posiciones de los
spawns y las banderas, las proyecta sobre el overview y mide cuántas caen sobre el mapa
dibujado. No da la fórmula por buena: compara contra las 8 orientaciones posibles.

Resultado sobre los 22 mapas stock: **902 de 902 puntos** sobre el mapa. Deja además una
imagen por mapa en `validacion/` con los puntos marcados (verde aliados, rojo eje,
amarillo banderas), para revisarla a ojo.

## Archivos

| Archivo | Qué hace |
|---|---|
| `bajar-overviews.mjs` | Lista los mapas del server y baja sus overviews a `cache/` |
| `generar.mjs` | Convierte los overviews a WebP y arma el manifiesto de parámetros |
| `validar.mjs` | Verifica la conversión con los spawns y banderas de los `.bsp` |
| `imagenes.mjs` | Lee BMP y TGA, escribe PNG. Sin dependencias |
| `bsp.mjs` | Lee las entidades de un `.bsp` de GoldSrc |
| `soldado.mjs` | Le quita el fondo a `fuentes/soldado.jpg` para el muñeco de "Dónde pega". Con `--control` deja en `validacion/` el recorte y las zonas pintadas encima |

## El soldado de "Dónde pega"

```bash
node soldado.mjs --control
```

Genera `sitio/public/soldado.webp` (sin fondo) y `sitio/lib/soldado.json` (dónde quedó el recorte).
Las zonas del cuerpo están en `sitio/lib/zonasSoldado.ts`, en píxeles de la imagen original:
si se cambia la imagen, hay que ajustarlas y revisar `validacion/soldado-zonas.png`.
