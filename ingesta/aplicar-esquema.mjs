/*
 *  Crea las tablas y la vista de ranking en la base de produccion.
 *  Es seguro correrlo varias veces: todo usa IF NOT EXISTS / CREATE OR REPLACE.
 *
 *  Uso:  npm run esquema
 */

import { conectar, configDesdeEntorno } from './base.mjs'

const base = await conectar(configDesdeEntorno())
try {
  await base.aplicarEsquema()
  const tablas = await base.consultar(
    "SELECT TABLE_NAME AS nombre, TABLE_TYPE AS tipo FROM information_schema.TABLES " +
    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT REGEXP '^t[0-9]+_' ORDER BY TABLE_NAME")
  console.log('Esquema aplicado. Objetos en la base:')
  for (const { nombre, tipo } of tablas) console.log(`  ${tipo === 'VIEW' ? 'vista ' : 'tabla '} ${nombre}`)
} finally {
  await base.cerrar()
}
