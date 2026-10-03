/*
 *  Quien es quien: ata cada cuenta del users.ini al steamid real del que la usa.
 *
 *  Hace falta porque las altas por nick se emparejan con el jugador comparando el
 *  nombre, y varios admines juegan con otro nick: "El Uruguaio" entra como "El Uru"
 *  y "Cap. Garbanzo" como "Cap. Garbanz". Por nick no hay forma confiable de atarlos
 *  (probando por coincidencia parcial, "DEVANT" matchea con "Eva").
 *
 *  Pero el server ya lo anota solo: cada vez que alguien se loguea como admin, AMX
 *  Mod X escribe en su log una linea asi:
 *
 *    L 09/29/2026 - 19:12:20: [admin.amxx] Login: "NeO|SR|ELJUNA OLMOND<201><STEAM_0:0:60783066><>"
 *    became an admin (account "ELJUNA OLMOND") (access "abcdefhijmnou") (address "186.22.17.216")
 *
 *  Ahi esta todo: la cuenta del users.ini y el steamid de quien la usa, sin importar
 *  con que nick entro. De la linea se toma solo eso: ni la IP ni el acceso se guardan.
 */

const LOGIN = /"[^"]*<\d+><(STEAM_[0-5]:[01]:\d+)><[^>]*>"\s+became an admin\s+\(account "([^"]*)"\)/

/** Saca los pares cuenta -> steamid de un log de AMX Mod X. Sin repetir. */
export function parsearLogins (texto) {
  const vistos = new Map()

  for (const linea of String(texto).split(/\r?\n/)) {
    const encontrado = LOGIN.exec(linea)
    if (!encontrado) continue

    const steamid = encontrado[1]
    const cuenta = encontrado[2]
    if (!cuenta) continue

    vistos.set(`${cuenta}\u0000${steamid}`, { cuenta, steamid })
  }

  return [...vistos.values()]
}

/*
 *  Los logs de AMX Mod X son uno por dia, con el nombre LAAAAMMDD.log. El server
 *  esta en Argentina y nosotros corremos en UTC, asi que se miran los ultimos dias
 *  para no perder el de ayer por la diferencia de horario.
 */
export function nombresDeLog (hasta = new Date(), dias = 3) {
  const nombres = []

  for (let i = 0; i < dias; i++) {
    const dia = new Date(hasta.getTime() - i * 24 * 60 * 60 * 1000)
    const aaaammdd = dia.toISOString().slice(0, 10).replaceAll('-', '')
    nombres.push(`L${aaaammdd}.log`)
  }

  return nombres
}
