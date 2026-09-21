/*
 *  Test 0.3 — Plugin minimo de prueba de MySQL
 *
 *  No es el plugin final: solo comprueba las tres cosas que pueden hundir la Fase 1.
 *
 *    1. Que el modulo MySQL de AMXX este presente y conecte a la base.
 *    2. Que las consultas asincronas (SQL_ThreadQuery) no laguen el server.
 *    3. Que el escapado de strings frene una inyeccion SQL via nick.
 *
 *  Instalacion:
 *    - compilar y poner el .amxx en addons/amxmodx/plugins/
 *    - agregarlo a plugins.ini
 *    - poner las credenciales en amxx.cfg (ver abajo) y reiniciar
 *
 *  Credenciales en addons/amxmodx/configs/amxx.cfg:
 *    dod_stats_host "TU_DB_HOST"
 *    dod_stats_user "TU_DB_USER"
 *    dod_stats_pass "TU_DB_PASS"
 *    dod_stats_db   "TU_DB_NAME"
 *
 *  Todo lo que hace queda registrado en addons/amxmodx/logs/ con el prefijo [STATS-PRUEBA].
 *  Cuando termines de probar, sacalo de plugins.ini: no es para produccion.
 */

#include <amxmodx>
#include <amxmisc>
#include <sqlx>
#include <dodx>

#define PLUGIN_NAME     "DoD Stats - Prueba MySQL"
#define PLUGIN_VERSION  "0.1.0"
#define PLUGIN_AUTHOR   "Marcelo Lescano"

#define PREFIJO         "[STATS-PRUEBA]"

new Handle:g_tupla = Empty_Handle;
new bool:g_conectado = false;
new g_insertadas = 0;
new g_fallidas   = 0;

new g_cvHost, g_cvUser, g_cvPass, g_cvDb;

public plugin_init()
{
    register_plugin(PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_AUTHOR);

    g_cvHost = register_cvar("dod_stats_host", "");
    g_cvUser = register_cvar("dod_stats_user", "");
    g_cvPass = register_cvar("dod_stats_pass", "");
    g_cvDb   = register_cvar("dod_stats_db",   "");

    register_concmd("dod_stats_prueba",   "cmdPrueba",   ADMIN_RCON, "- inserta una fila de prueba con un nick malicioso");
    register_concmd("dod_stats_estado",   "cmdEstado",   ADMIN_RCON, "- muestra cuantas filas se insertaron y cuantas fallaron");
}

public plugin_cfg()
{
    /* amxx.cfg se ejecuta despues de plugin_init, por eso leemos las cvars aca */
    new host[64], usuario[32], clave[64], base[32];

    get_pcvar_string(g_cvHost, host,    charsmax(host));
    get_pcvar_string(g_cvUser, usuario, charsmax(usuario));
    get_pcvar_string(g_cvPass, clave,   charsmax(clave));
    get_pcvar_string(g_cvDb,   base,    charsmax(base));

    if (!host[0] || !usuario[0] || !base[0])
    {
        log_amx("%s FALTAN CREDENCIALES. Definir dod_stats_host/user/pass/db en amxx.cfg", PREFIJO);
        return;
    }

    g_tupla = SQL_MakeDbTuple(host, usuario, clave, base);

    log_amx("%s conectando a %s / base '%s' ...", PREFIJO, host, base);

    SQL_ThreadQuery(g_tupla, "manejadorCrearTabla",
        "CREATE TABLE IF NOT EXISTS prueba_eventos ( \
            id INT AUTO_INCREMENT PRIMARY KEY, \
            momento DATETIME NOT NULL, \
            origen VARCHAR(16) NOT NULL, \
            atacante VARCHAR(64), \
            victima VARCHAR(64), \
            arma VARCHAR(32), \
            hitbox TINYINT, \
            teamkill TINYINT, \
            nota VARCHAR(255) \
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

/* ------------------------------------------------------------------ */
/*  Manejadores de consulta                                            */
/* ------------------------------------------------------------------ */

public manejadorCrearTabla(fallo, Handle:consulta, error[], numeroError, datos[], tamano, Float:demora)
{
    if (fallo == TQUERY_CONNECT_FAILED)
    {
        log_amx("%s TEST 0.3 FALLA - no se pudo conectar: %s (%d)", PREFIJO, error, numeroError);
        log_amx("%s Revisar credenciales y que la base acepte conexiones desde el server.", PREFIJO);
        return;
    }

    if (fallo == TQUERY_QUERY_FAILED)
    {
        log_amx("%s TEST 0.3 FALLA - no se pudo crear la tabla: %s (%d)", PREFIJO, error, numeroError);
        log_amx("%s El usuario probablemente no tiene permiso de CREATE.", PREFIJO);
        return;
    }

    g_conectado = true;
    log_amx("%s CONEXION OK - tabla lista (la consulta espero %.3f seg en la cola)", PREFIJO, demora);
    log_amx("%s Probar ahora: dod_stats_prueba", PREFIJO);
}

public manejadorInsertar(fallo, Handle:consulta, error[], numeroError, datos[], tamano, Float:demora)
{
    if (fallo != TQUERY_SUCCESS)
    {
        g_fallidas++;
        log_amx("%s INSERT fallo: %s (%d)", PREFIJO, error, numeroError);
        return;
    }

    g_insertadas++;

    /* Si la demora en cola sube mucho, la base no da abasto con el ritmo de escritura */
    if (demora > 1.0)
        log_amx("%s AVISO: la consulta espero %.2f seg en la cola. Hace falta escritura por lotes.", PREFIJO, demora);
}

/* ------------------------------------------------------------------ */
/*  Prueba manual: inyeccion SQL via nick                              */
/* ------------------------------------------------------------------ */

public cmdPrueba(id, nivel, cid)
{
    if (!cmd_access(id, nivel, cid, 1))
        return PLUGIN_HANDLED;

    if (!g_conectado)
    {
        console_print(id, "%s Sin conexion a la base. Revisar el log de AMXX.", PREFIJO);
        return PLUGIN_HANDLED;
    }

    /* Un nick que un jugador podria ponerse de verdad para romper la base */
    new const nickMalicioso[] = "Pepe'); DROP TABLE prueba_eventos; --";

    new seguro[160];
    SQL_QuoteStringFmt(Empty_Handle, seguro, charsmax(seguro), "%s", nickMalicioso);

    new consulta[512];
    formatex(consulta, charsmax(consulta),
        "INSERT INTO prueba_eventos (momento, origen, atacante, nota) VALUES (NOW(), 'manual', '%s', 'prueba de escapado')",
        seguro);

    SQL_ThreadQuery(g_tupla, "manejadorInsertar", consulta);

    console_print(id, "%s Insert enviado. Verificar en la base que:", PREFIJO);
    console_print(id, "  1. la tabla prueba_eventos SIGUE EXISTIENDO");
    console_print(id, "  2. hay una fila con el nick guardado como texto literal");
    console_print(id, "  Si la tabla desaparecio, el escapado no funciono. NO seguir con la Fase 1.");

    return PLUGIN_HANDLED;
}

public cmdEstado(id, nivel, cid)
{
    if (!cmd_access(id, nivel, cid, 1))
        return PLUGIN_HANDLED;

    console_print(id, "%s conectado: %s | insertadas: %d | fallidas: %d",
                  PREFIJO, g_conectado ? "si" : "no", g_insertadas, g_fallidas);
    return PLUGIN_HANDLED;
}

/* ------------------------------------------------------------------ */
/*  Camino real: una fila por muerte                                   */
/* ------------------------------------------------------------------ */

public client_death(matador, victima, indiceArma, lugarImpacto, TK)
{
    if (!g_conectado)
        return;

    new nombreMatador[32], nombreVictima[32], arma[32];

    if (matador && matador != victima)
        get_user_name(matador, nombreMatador, charsmax(nombreMatador));
    else
        copy(nombreMatador, charsmax(nombreMatador), "(sin matador)");

    get_user_name(victima, nombreVictima, charsmax(nombreVictima));
    xmod_get_wpnname(indiceArma, arma, charsmax(arma));

    /* Todo string que viene del juego pasa por el escapado, sin excepcion */
    new matadorSeguro[80], victimaSeguro[80], armaSegura[80];
    SQL_QuoteStringFmt(Empty_Handle, matadorSeguro, charsmax(matadorSeguro), "%s", nombreMatador);
    SQL_QuoteStringFmt(Empty_Handle, victimaSeguro, charsmax(victimaSeguro), "%s", nombreVictima);
    SQL_QuoteStringFmt(Empty_Handle, armaSegura,    charsmax(armaSegura),    "%s", arma);

    new consulta[512];
    formatex(consulta, charsmax(consulta),
        "INSERT INTO prueba_eventos (momento, origen, atacante, victima, arma, hitbox, teamkill) \
         VALUES (NOW(), 'muerte', '%s', '%s', '%s', %d, %d)",
        matadorSeguro, victimaSeguro, armaSegura, lugarImpacto, TK);

    SQL_ThreadQuery(g_tupla, "manejadorInsertar", consulta);
}
