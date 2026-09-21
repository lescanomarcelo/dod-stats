/*
 *  DoD Stats - Registro de eventos
 *
 *  Escribe cada muerte, conexion y desconexion a un archivo de texto en el server.
 *  Un proceso externo lo baja por FTP y lo carga en la base de datos del sitio de stats.
 *
 *  No necesita el modulo MySQL: usa solo el nucleo de AMXX y dodx, que ya esta instalado.
 *
 *  Salida:
 *    addons/amxmodx/data/stats/eventos_AAAAMMDD.tsv   (un archivo por dia)
 *
 *  Para no frenar el server, los eventos se juntan en memoria y se escriben de a
 *  tandas: cada 30 segundos y en cada cambio de mapa. La escritura a archivo en AMXX
 *  es bloqueante, asi que una escritura cada 30s en vez de una por muerte.
 *
 *  Formato: una linea por evento, campos separados por TAB. El primer campo es el tipo.
 *
 *    P  ts  mapa                                                   inicio de mapa
 *    C  ts  steamid  nick                                          conexion
 *    D  ts  steamid  nick  segundos_jugados                        desconexion
 *    M  ts  mapa  m_steam  m_nick  m_equipo  v_steam  v_nick  v_equipo
 *           arma  hitbox  teamkill  vx vy vz  mx my mz              muerte
 *
 *    ts = segundos unix.  m_ = matador, v_ = victima.  equipo: 1 aliados, 2 eje.
 *    Si no hay matador (suicidio, caida, mundo) los campos m_ van vacios.
 *    vx/vy/vz = donde murio la victima. mx/my/mz = desde donde disparo el matador.
 */

#include <amxmodx>
#include <amxmisc>
#include <dodx>

#define PLUGIN_NAME     "DoD Stats - Registro"
#define PLUGIN_VERSION  "0.1.0"
#define PLUGIN_AUTHOR   "Marcelo Lescano"

#define PREFIJO         "[STATS]"
#define LARGO_LINEA     384
#define TAREA_VOLCAR    9310
#define SEGUNDOS_VOLCAR 30.0

new Array:g_pendientes;
new g_carpeta[128];
new g_mapa[32];
new g_conectadoDesde[33];

new g_escritas;
new g_fallos;

public plugin_init()
{
    register_plugin(PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_AUTHOR);

    g_pendientes = ArrayCreate(LARGO_LINEA);

    register_concmd("dod_stats_volcar", "cmdVolcar", ADMIN_RCON, "- escribe ya los eventos pendientes al archivo");
    register_concmd("dod_stats_estado", "cmdEstado", ADMIN_RCON, "- muestra eventos pendientes, escritos y fallos");

    set_task(SEGUNDOS_VOLCAR, "tareaVolcar", TAREA_VOLCAR, "", 0, "b");
}

public plugin_cfg()
{
    get_datadir(g_carpeta, charsmax(g_carpeta));
    add(g_carpeta, charsmax(g_carpeta), "/stats");

    if (!dir_exists(g_carpeta))
        mkdir(g_carpeta);

    get_mapname(g_mapa, charsmax(g_mapa));

    new linea[LARGO_LINEA];
    formatex(linea, charsmax(linea), "P^t%d^t%s", get_systime(), g_mapa);
    ArrayPushString(g_pendientes, linea);
}

public plugin_end()
{
    /* Cambio de mapa o apagado: no perder lo que quedo en memoria */
    volcar();
    ArrayDestroy(g_pendientes);
}

/* ------------------------------------------------------------------ */
/*  Escritura a disco                                                  */
/* ------------------------------------------------------------------ */

public tareaVolcar()
{
    volcar();
}

volcar()
{
    new total = ArraySize(g_pendientes);
    if (!total)
        return;

    new fecha[16], ruta[192];
    format_time(fecha, charsmax(fecha), "%Y%m%d");
    formatex(ruta, charsmax(ruta), "%s/eventos_%s.tsv", g_carpeta, fecha);

    new archivo = fopen(ruta, "at");
    if (!archivo)
    {
        g_fallos++;
        log_amx("%s no se pudo abrir %s para escribir (%d eventos siguen en memoria)", PREFIJO, ruta, total);
        return;
    }

    new linea[LARGO_LINEA];
    for (new i = 0; i < total; i++)
    {
        ArrayGetString(g_pendientes, i, linea, charsmax(linea));
        fprintf(archivo, "%s^n", linea);
    }

    fclose(archivo);
    ArrayClear(g_pendientes);
    g_escritas += total;
}

/* ------------------------------------------------------------------ */
/*  Utilidades                                                         */
/* ------------------------------------------------------------------ */

/* El nick lo elige el jugador: sacamos lo que romperia el formato de linea */
limpiar(texto[])
{
    for (new i = 0; texto[i]; i++)
    {
        if (texto[i] == '^t' || texto[i] == '^n' || texto[i] == '^r')
            texto[i] = ' ';
    }
}

datosJugador(id, steam[], largoSteam, nick[], largoNick)
{
    if (is_user_bot(id))
        copy(steam, largoSteam, "BOT");
    else
        get_user_authid(id, steam, largoSteam);

    get_user_name(id, nick, largoNick);
    limpiar(nick);
}

/* ------------------------------------------------------------------ */
/*  Eventos                                                            */
/* ------------------------------------------------------------------ */

public client_putinserver(id)
{
    if (is_user_hltv(id))
        return;

    g_conectadoDesde[id] = get_systime();

    new steam[35], nick[32], linea[LARGO_LINEA];
    datosJugador(id, steam, charsmax(steam), nick, charsmax(nick));

    formatex(linea, charsmax(linea), "C^t%d^t%s^t%s", get_systime(), steam, nick);
    ArrayPushString(g_pendientes, linea);
}

public client_disconnected(id, bool:drop, message[], maxlen)
{
    if (!g_conectadoDesde[id])
        return;

    new segundos = get_systime() - g_conectadoDesde[id];
    g_conectadoDesde[id] = 0;

    new steam[35], nick[32], linea[LARGO_LINEA];
    datosJugador(id, steam, charsmax(steam), nick, charsmax(nick));

    formatex(linea, charsmax(linea), "D^t%d^t%s^t%s^t%d", get_systime(), steam, nick, segundos);
    ArrayPushString(g_pendientes, linea);
}

public client_death(matador, victima, indiceArma, lugarImpacto, TK)
{
    if (!victima || !is_user_connected(victima))
        return;

    new vSteam[35], vNick[32];
    new vOrigen[3];
    datosJugador(victima, vSteam, charsmax(vSteam), vNick, charsmax(vNick));
    get_user_origin(victima, vOrigen);
    new vEquipo = get_user_team(victima);

    /* Sin matador valido: suicidio, caida, muerte por el mapa */
    new mSteam[35], mNick[32];
    new mOrigen[3];
    new mEquipo = 0;

    if (matador && matador != victima && is_user_connected(matador))
    {
        datosJugador(matador, mSteam, charsmax(mSteam), mNick, charsmax(mNick));
        get_user_origin(matador, mOrigen);
        mEquipo = get_user_team(matador);
    }

    new arma[32];
    xmod_get_wpnname(indiceArma, arma, charsmax(arma));
    limpiar(arma);

    new linea[LARGO_LINEA];
    formatex(linea, charsmax(linea),
        "M^t%d^t%s^t%s^t%s^t%d^t%s^t%s^t%d^t%s^t%d^t%d^t%d^t%d^t%d^t%d^t%d^t%d",
        get_systime(), g_mapa,
        mSteam, mNick, mEquipo,
        vSteam, vNick, vEquipo,
        arma, lugarImpacto, TK,
        vOrigen[0], vOrigen[1], vOrigen[2],
        mOrigen[0], mOrigen[1], mOrigen[2]);

    ArrayPushString(g_pendientes, linea);
}

/* ------------------------------------------------------------------ */
/*  Comandos de admin                                                  */
/* ------------------------------------------------------------------ */

public cmdVolcar(id, nivel, cid)
{
    if (!cmd_access(id, nivel, cid, 1))
        return PLUGIN_HANDLED;

    new antes = ArraySize(g_pendientes);
    volcar();
    console_print(id, "%s %d eventos escritos a %s", PREFIJO, antes, g_carpeta);
    return PLUGIN_HANDLED;
}

public cmdEstado(id, nivel, cid)
{
    if (!cmd_access(id, nivel, cid, 1))
        return PLUGIN_HANDLED;

    console_print(id, "%s pendientes: %d | escritos: %d | fallos de escritura: %d",
                  PREFIJO, ArraySize(g_pendientes), g_escritas, g_fallos);
    console_print(id, "%s carpeta: %s", PREFIJO, g_carpeta);
    return PLUGIN_HANDLED;
}
