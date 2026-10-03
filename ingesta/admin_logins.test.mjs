import test from 'node:test'
import assert from 'node:assert/strict'
import { parsearLogins, nombresDeLog } from './admin_logins.mjs'

const LOG = `
L 09/29/2026 - 19:12:20: [admin.amxx] Login: "NeO|SR|ELJUNA OLMOND<201><STEAM_0:0:60783066><>" became an admin (account "ELJUNA OLMOND") (access "abcdefhijmnou") (address "186.22.17.216")
L 09/29/2026 - 19:14:40: [admin.amxx] Login: "Chaco<202><STEAM_0:0:2508480><>" became an admin (account "Chaco") (access "abcdefhijmnou") (address "181.46.138.165")
L 09/29/2026 - 19:25:19: [mapchooser.amxx] Vote: Voting for the nextmap started
L 09/29/2026 - 19:30:05: [admincmd.amxx] Kick: "Chaco<202><STEAM_0:0:2508480><>" kick "INFLATION<206><STEAM_0:0:476060><>" (reason "")
`

test('toma la cuenta y el steamid de cada login, sin importar el nick', () => {
  assert.deepEqual(parsearLogins(LOG), [
    { cuenta: 'ELJUNA OLMOND', steamid: 'STEAM_0:0:60783066' },
    { cuenta: 'Chaco', steamid: 'STEAM_0:0:2508480' }
  ])
})

test('el mismo login repetido va una sola vez', () => {
  assert.equal(parsearLogins(LOG + LOG).length, 2)
})

test('un admin que entra con dos nicks distintos es un solo par', () => {
  const otroNick = LOG.replace('NeO|SR|ELJUNA OLMOND<201>', 'ELJUNA OLMOND<318>')
  assert.equal(parsearLogins(LOG + otroNick).length, 2)
})

test('las lineas que no son logins no aportan nada', () => {
  assert.deepEqual(parsearLogins('L 09/29/2026 - 19:25:19: [mapchooser.amxx] Vote: started'), [])
  assert.deepEqual(parsearLogins(''), [])
})

test('no se queda con la IP ni con el acceso', () => {
  const [primero] = parsearLogins(LOG)
  assert.deepEqual(Object.keys(primero), ['cuenta', 'steamid'])
})

test('los nombres de log son los ultimos dias, de hoy para atras', () => {
  assert.deepEqual(nombresDeLog(new Date('2026-10-03T12:00:00Z'), 3), [
    'L20261003.log', 'L20261002.log', 'L20261001.log'
  ])
})
