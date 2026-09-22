/*
 *  Parser del archivo de eventos que escribe dod_stats_registro.amxx
 *
 *  Formato: una linea por evento, campos separados por TAB, primer campo = tipo.
 *  Tiene que coincidir exactamente con los formatex() del plugin.
 */

/* Cantidad de campos por tipo de evento, incluyendo el propio tipo */
const CAMPOS = { P: 3, C: 4, D: 5, M: 18, H: 15, S: 7, E: 6, A: 6, J: 6 }

/* Orden de las zonas en la linea H: el hitplace del motor, de 0 a 7 */
export const ZONAS = ['generico', 'cabeza', 'pecho', 'estomago', 'brazo_izq', 'brazo_der', 'pierna_izq', 'pierna_der']

/* Valores de hitplace del motor HL1 */
export const HITBOX = {
  0: 'generico',
  1: 'cabeza',
  2: 'pecho',
  3: 'estomago',
  4: 'brazo_izq',
  5: 'brazo_der',
  6: 'pierna_izq',
  7: 'pierna_der'
}

function entero (valor) {
  const numero = Number(valor)
  return Number.isInteger(numero) ? numero : null
}

/**
 * Convierte una linea del archivo en un evento.
 * Devuelve null si la linea esta mal formada: cantidad de campos incorrecta,
 * tipo desconocido o numeros invalidos. Nunca tira excepcion.
 */
export function parsearLinea (linea) {
  const campos = linea.split('\t')
  const tipo = campos[0]

  if (!(tipo in CAMPOS) || campos.length !== CAMPOS[tipo]) return null

  const ts = entero(campos[1])
  if (ts === null) return null

  if (tipo === 'P') {
    return { tipo: 'inicio_mapa', ts, mapa: campos[2] }
  }

  if (tipo === 'C') {
    return { tipo: 'conexion', ts, steamid: campos[2], nick: campos[3] }
  }

  if (tipo === 'D') {
    const segundos = entero(campos[4])
    if (segundos === null) return null
    return { tipo: 'desconexion', ts, steamid: campos[2], nick: campos[3], segundos }
  }

  if (tipo === 'H') {
    const valores = campos.slice(5).map(entero)
    if (valores.some((v) => v === null || v < 0)) return null
    const impactos = Object.fromEntries(ZONAS.map((zona, i) => [zona, valores[i]]))
    return {
      tipo: 'impactos',
      ts,
      mapa: campos[2],
      steamid: campos[3],
      nick: campos[4],
      impactos,
      danio: valores[8],
      disparos: valores[9]
    }
  }

  if (tipo === 'S') {
    const equipo = entero(campos[5])
    const puntos = entero(campos[6])
    if (equipo !== 1 && equipo !== 2) return null
    if (puntos === null || puntos <= 0) return null
    return { tipo: 'puntos', ts, mapa: campos[2], steamid: campos[3], nick: campos[4], equipo, puntos }
  }

  if (tipo === 'E') {
    const [inicio, aliados, eje] = campos.slice(3).map(entero)
    if (inicio === null || aliados === null || eje === null) return null
    return { tipo: 'marcador', ts, mapa: campos[2], inicio, aliados, eje }
  }

  /* A: acostado (Camper). J: tiempo en un bando. Las dos traen segundos sueltos */
  if (tipo === 'A' || tipo === 'J') {
    const segundos = entero(campos[5])
    if (segundos === null || segundos <= 0) return null
    return {
      tipo: tipo === 'A' ? 'acostado' : 'jugado',
      ts, mapa: campos[2], steamid: campos[3], nick: campos[4], segundos
    }
  }

  /* M: muerte */
  const numericos = [5, 8, 10, 11, 12, 13, 14, 15, 16, 17].map((i) => entero(campos[i]))
  if (numericos.some((n) => n === null)) return null

  const [mEquipo, vEquipo, hitbox, tk, vx, vy, vz, mx, my, mz] = numericos
  const tieneMatador = campos[3] !== ''

  return {
    tipo: 'muerte',
    ts,
    mapa: campos[2],
    matador: tieneMatador
      ? { steamid: campos[3], nick: campos[4], equipo: mEquipo, x: mx, y: my, z: mz }
      : null,
    victima: { steamid: campos[6], nick: campos[7], equipo: vEquipo, x: vx, y: vy, z: vz },
    arma: campos[9],
    hitbox,
    headshot: hitbox === 1,
    teamkill: tk === 1
  }
}

/**
 * Parsea un fragmento del archivo, procesando SOLO lineas completas.
 *
 * El plugin puede estar escribiendo justo cuando bajamos el archivo por FTP, asi que
 * la ultima linea puede venir cortada. Esa linea no se consume: bytesConsumidos marca
 * hasta donde se leyo, y la proxima pasada retoma desde ahi con la linea ya completa.
 *
 * Trabaja sobre bytes, no sobre caracteres: un nick con "ñ" ocupa mas bytes que
 * caracteres, y el offset tiene que coincidir con la posicion real en el archivo para
 * retomar la descarga FTP desde el punto exacto. Cortar en 0x0A es seguro en UTF-8:
 * ese byte nunca aparece dentro de un caracter multibyte.
 */
export function parsearFragmento (datos) {
  const buffer = Buffer.isBuffer(datos) ? datos : Buffer.from(datos, 'utf8')
  const ultimoSalto = buffer.lastIndexOf(0x0a)

  if (ultimoSalto === -1) {
    return { eventos: [], descartadas: 0, bytesConsumidos: 0 }
  }

  const texto = buffer.subarray(0, ultimoSalto).toString('utf8')
  const eventos = []
  let descartadas = 0

  for (const linea of texto.split('\n')) {
    if (linea.trim() === '') continue
    const evento = parsearLinea(linea.replace(/\r$/, ''))
    if (evento) eventos.push(evento)
    else descartadas++
  }

  return { eventos, descartadas, bytesConsumidos: ultimoSalto + 1 }
}
