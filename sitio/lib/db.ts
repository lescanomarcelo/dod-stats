import 'server-only'
import mysql from 'mysql2/promise'

/*
 *  Pool de conexiones a la base de stats.
 *
 *  En Vercel cada instancia de funcion reutiliza el pool mientras vive, asi que
 *  se crea una sola vez por instancia. Pocas conexiones por instancia: con muchas
 *  instancias en paralelo se podria agotar max_connections (500 en este hosting).
 *  La cache de las consultas (use cache) hace que casi nunca haga falta ir a la base.
 */

/* Prefijo de tablas: vacio en produccion, "demo_" para desarrollar con datos simulados.
   Se interpola en el SQL, por eso se valida estrictamente. */
const PREFIJO = process.env.DB_PREFIJO ?? ''
if (!/^[a-z0-9_]*$/.test(PREFIJO)) {
  throw new Error(`DB_PREFIJO invalido: "${PREFIJO}"`)
}

let pool: mysql.Pool | undefined

function obtenerPool (): mysql.Pool {
  pool ??= mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: 4,
    /* Si la base no acepta la conexion, cortar y fallar rapido en vez de dejar la
       pagina colgada: una visita con un error es mejor que 30 segundos en blanco */
    connectTimeout: 6000,
    /* La base esta lejos (Argentina) y la funcion puede quedar viva un rato: con
       keepalive la conexion no se muere en silencio entre visita y visita */
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
    waitForConnections: true,
    timezone: 'Z',
    charset: 'utf8mb4'
  })
  return pool
}

/**
 * Ejecuta una consulta de solo lectura. {p} en el SQL se reemplaza por el prefijo
 * de tablas. Los valores van SIEMPRE como parametros (?), nunca interpolados.
 */
/* Tope para una consulta: ninguna del sitio tarda mas de 100 ms contra la base real */
const ESPERA_MAXIMA = 10000

export async function consultar<T = Record<string, unknown>> (
  sql: string,
  valores: unknown[] = []
): Promise<T[]> {
  const consulta = obtenerPool().query(sql.replaceAll('{p}', PREFIJO), valores)
  const corte = new Promise<never>((_, rechazar) =>
    setTimeout(() => rechazar(new Error('la base tardo demasiado en responder')), ESPERA_MAXIMA).unref?.())
  const [filas] = await Promise.race([consulta, corte])
  return filas as T[]
}
