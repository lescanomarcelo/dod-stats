/*
 *  La lista de admines del server: users.ini de AMX Mod X.
 *
 *  El archivo tiene una linea por admin:
 *
 *    ; <nick o steamid>   <contrasena>   <flags de acceso>   <flags de la cuenta>
 *    "STEAM_0:1:12345"    ""             "abcdefghij"        "ce"
 *
 *  OJO: el segundo campo es la contrasena del admin. Se lee y se tira en el acto:
 *  no se guarda en la base, no se muestra, no se registra en ningun log. De la
 *  lista solo nos importa QUIENES son admins y con que nivel de acceso.
 */

/* Un campo: entre comillas, o una palabra suelta */
const CAMPO = /"([^"]*)"|(\S+)/g

function campos (linea) {
  const lista = []
  let coincidencia
  CAMPO.lastIndex = 0
  while ((coincidencia = CAMPO.exec(linea)) !== null) {
    lista.push(coincidencia[1] ?? coincidencia[2])
  }
  return lista
}

const STEAMID = /^STEAM_[0-5]:[01]:\d+$/
const IP = /^\d{1,3}(\.\d{1,3}){3}$/

export function tipoDeClave (clave) {
  if (STEAMID.test(clave)) return 'steamid'
  if (IP.test(clave)) return 'ip'
  return 'nick'
}

/**
 * Parsea users.ini. Devuelve [{ clave, tipo, acceso }] sin contrasenas.
 * Las lineas de comentario (;) y las que no tienen al menos clave y contrasena
 * se ignoran.
 */
export function parsearUsuarios (texto) {
  const admines = []
  const vistos = new Set()

  for (const cruda of String(texto).split(/\r?\n/)) {
    const linea = cruda.trim()
    if (!linea || linea.startsWith(';') || linea.startsWith('//')) continue

    const partes = campos(linea)
    if (partes.length < 2) continue

    const clave = partes[0]
    /* partes[1] es la contrasena: no se toca */
    const acceso = partes[2] ?? ''

    if (!clave || vistos.has(clave)) continue
    vistos.add(clave)

    admines.push({ clave, tipo: tipoDeClave(clave), acceso })
  }

  return admines
}
