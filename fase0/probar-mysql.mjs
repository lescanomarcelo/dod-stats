#!/usr/bin/env node
/*
 *  Test 0.2 — GO / NO-GO del proyecto
 *
 *  Verifica si la base MySQL del hosting acepta conexiones desde afuera.
 *  Tu PC es, para esa base, tan "externa" como Vercel: si conecta desde aca,
 *  va a conectar desde Vercel.
 *
 *  Uso:
 *      npm install
 *      node probar-mysql.mjs --host HOST --user USUARIO --pass CLAVE --db BASE
 *
 *  O con variables de entorno:
 *      DB_HOST=... DB_USER=... DB_PASS=... DB_NAME=... node probar-mysql.mjs
 */

import { createConnection } from 'mysql2/promise'

/* ------------------------------------------------------------------ */
/*  Argumentos                                                         */
/* ------------------------------------------------------------------ */

function leerArgumentos () {
  const args = process.argv.slice(2)
  const valores = {}

  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) continue
    const clave = args[i].slice(2)
    const valor = args[i + 1]
    if (valor !== undefined && !valor.startsWith('--')) {
      valores[clave] = valor
      i++
    }
  }

  return {
    host: valores.host ?? process.env.DB_HOST,
    user: valores.user ?? process.env.DB_USER,
    password: valores.pass ?? process.env.DB_PASS,
    database: valores.db ?? process.env.DB_NAME,
    port: Number(valores.port ?? process.env.DB_PORT ?? 3306)
  }
}

/* ------------------------------------------------------------------ */
/*  Diagnostico de errores                                             */
/* ------------------------------------------------------------------ */

const DIAGNOSTICOS = {
  ECONNREFUSED:
    'El host rechazo la conexion. MySQL no escucha en ese puerto desde afuera,\n' +
    '   o un firewall la bloquea. Es el caso tipico de "solo localhost".',

  ETIMEDOUT:
    'La conexion se colgo sin respuesta. Casi siempre es un firewall descartando\n' +
    '   los paquetes en silencio. Hay que pedir acceso externo al hosting.',

  ENOTFOUND:
    'No se pudo resolver el nombre del host. Revisa que el DB Host este bien\n' +
    '   escrito, tal cual aparece en el panel.',

  ER_ACCESS_DENIED_ERROR:
    'Usuario o clave incorrectos. Ojo: MySQL distingue desde donde te conectas,\n' +
    '   asi que el mismo usuario puede andar en el server y ser rechazado desde afuera.',

  ER_HOST_NOT_PRIVILEGED:
    'MySQL te reconoce pero NO le permite conectarse a tu IP. Este es exactamente\n' +
    '   el permiso que hay que pedirle a 4evergaming que habiliten.',

  ER_DBACCESS_DENIED_ERROR:
    'El usuario existe pero no tiene permisos sobre esa base.',

  ER_BAD_DB_ERROR:
    'La base no existe. Revisa el nombre (suele llevar el prefijo de tu cuenta).'
}

/* ------------------------------------------------------------------ */
/*  Prueba                                                             */
/* ------------------------------------------------------------------ */

async function probar (config) {
  const faltantes = ['host', 'user', 'password', 'database']
    .filter((campo) => !config[campo])

  if (faltantes.length) {
    console.error('Faltan datos:', faltantes.join(', '))
    console.error('\nUso:')
    console.error('  node probar-mysql.mjs --host HOST --user USUARIO --pass CLAVE --db BASE\n')
    process.exit(2)
  }

  console.log('Probando conexion a MySQL')
  console.log(`  host:    ${config.host}:${config.port}`)
  console.log(`  usuario: ${config.user}`)
  console.log(`  base:    ${config.database}`)
  console.log('')

  if (config.host === 'localhost' || config.host === '127.0.0.1') {
    console.log('AVISO: el DB Host es "localhost". Eso significa que la base solo es')
    console.log('       accesible desde el propio server de juego. Vercel no va a llegar.')
    console.log('       Igual sigo, por si el panel muestra un alias.\n')
  }

  let conexion
  const inicio = Date.now()

  try {
    conexion = await createConnection({ ...config, connectTimeout: 10000 })
  } catch (error) {
    const demora = Date.now() - inicio
    console.log(`RESULTADO: FALLA  (${demora} ms)\n`)
    console.log(`  codigo: ${error.code ?? 'desconocido'}`)
    console.log(`  mensaje: ${error.message}`)

    const diagnostico = DIAGNOSTICOS[error.code]
    if (diagnostico) console.log(`\n  -> ${diagnostico}`)

    console.log('\nEl test 0.2 da NO-GO. Ver "Plan B" en el plan antes de seguir.')
    process.exit(1)
  }

  const demoraConexion = Date.now() - inicio

  try {
    const inicioConsulta = Date.now()
    await conexion.query('SELECT 1')
    const demoraConsulta = Date.now() - inicioConsulta

    const [version] = await conexion.query('SELECT VERSION() AS v')
    const [maxCon] = await conexion.query("SHOW VARIABLES LIKE 'max_connections'")

    console.log('RESULTADO: OK\n')
    console.log(`  conectar:      ${demoraConexion} ms`)
    console.log(`  consulta:      ${demoraConsulta} ms`)
    console.log(`  MySQL:         ${version[0].v}`)
    console.log(`  max_connections: ${maxCon[0]?.Value ?? 'no visible'}`)

    /* Permiso de escritura: el plugin necesita CREATE e INSERT */
    try {
      await conexion.query('CREATE TABLE IF NOT EXISTS _prueba_acceso (id INT)')
      await conexion.query('DROP TABLE _prueba_acceso')
      console.log('  permisos:      CREATE y DROP OK')
    } catch (error) {
      console.log(`  permisos:      LIMITADOS (${error.code})`)
      console.log('                 El usuario no puede crear tablas. Hay que pedir permisos')
      console.log('                 o crear el esquema desde phpMyAdmin del panel.')
    }

    console.log('\nTest 0.2: GO. Vercel va a poder leer esta base.')

    if (demoraConsulta > 300) {
      console.log('\nNota: la latencia es alta. No es un problema, pero confirma que')
      console.log('      el cacheo de 60s del sitio no es opcional.')
    }
  } finally {
    await conexion.end()
  }
}

probar(leerArgumentos()).catch((error) => {
  console.error('Error inesperado:', error)
  process.exit(1)
})
