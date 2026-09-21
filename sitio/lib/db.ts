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
    connectionLimit: 3,
    timezone: 'Z',
    charset: 'utf8mb4'
  })
  return pool
}

/**
 * Ejecuta una consulta de solo lectura. {p} en el SQL se reemplaza por el prefijo
 * de tablas. Los valores van SIEMPRE como parametros (?), nunca interpolados.
 */
export async function consultar<T = Record<string, unknown>> (
  sql: string,
  valores: unknown[] = []
): Promise<T[]> {
  const [filas] = await obtenerPool().query(sql.replaceAll('{p}', PREFIJO), valores)
  return filas as T[]
}
