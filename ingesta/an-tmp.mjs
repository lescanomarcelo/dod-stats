import SftpClient from 'ssh2-sftp-client'
import { configSftpDesdeEntorno } from './fuentes.mjs'
const c = configSftpDesdeEntorno()
const cli = new SftpClient()
await cli.connect({ host: c.host, port: c.port, username: c.user, password: c.password, readyTimeout: 30000 })
try {
  const carpetaLogs = c.carpeta.replace('/addons/amxmodx/data/stats', '/logs')
  const logs = (await cli.list(carpetaLogs)).filter(f => /^L0927\d*\.log$/.test(f.name)).map(f => f.name).sort()
  console.log(`logs del 27/9: ${logs.length}`)
  let total = 0; const ejemplos = []
  for (const n of logs) {
    const texto = (await cli.get(`${carpetaLogs}/${n}`)).toString('latin1')
    const kills = texto.split('\n').filter(l => / killed .* with "(bazooka|pschreck|piat)"/.test(l))
    total += kills.length
    for (const k of kills.slice(0, 2)) if (ejemplos.length < 4) ejemplos.push(`${n}: ${k.trim().slice(0, 160)}`)
  }
  console.log(`kills con cohete en el log del juego el 27/9: ${total}`)
  for (const e of ejemplos) console.log('  ' + e)

  const datos = await cli.get(`${c.carpeta}/eventos_20260927.tsv`)
  const lineas = datos.toString('utf8').split('\n')
  const m = lineas.filter(l => l.startsWith('M\t'))
  console.log(`eventos_20260927.tsv: ${m.length} muertes; con cohete: ${m.filter(l => /bazooka|pschreck|piat/i.test(l)).length}`)
  const armas = new Map()
  for (const l of m) { const a = l.split('\t')[10]; armas.set(a, (armas.get(a) ?? 0) + 1) }
  console.log('armas registradas:', [...armas.entries()].sort((x, y) => y[1] - x[1]).map(([a, n]) => `${a}:${n}`).join(' '))
} finally { await cli.end() }
