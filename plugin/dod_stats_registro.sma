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
 *    H  ts  mapa  steamid  nick  generico cabeza pecho estomago
 *           brazo_izq brazo_der pierna_izq pierna_der  danio  disparos    impactos
 *
 *    S  ts  mapa  steamid  nick  equipo  puntos                    puntos de un jugador
 *    E  ts  mapa  inicio  puntos_aliados  puntos_eje               marcador de equipos
 *
 *    ts = segundos unix.  m_ = matador, v_ = victima.  equipo: 1 aliados, 2 eje.
 *    Si no hay matador (suicidio, caida, mundo) los campos m_ van vacios.
 *    vx/vy/vz = donde murio la victima. mx/my/mz = desde donde disparo el matador.
 *
 *    H trae los impactos y disparos del jugador desde la linea H anterior (no un
 *    total): se suman al cargarlos. Se escribe cada 30s solo para quien disparo o
 *    pego algo, al desconectarse y al terminar el mapa. No cuenta el fuego amigo.
 *
 *    S se escribe cada vez que un jugador suma puntos (tomar banderas y objetivos),
 *    con los puntos ganados en ese momento, no el total.
 *
 *    E es el marcador de la partida: inicio = ts de la linea P de este mapa, que
 *    identifica la partida. Cada E reemplaza a la anterior de la misma partida; la
 *    ultima es el resultado final. Se escribe cada 30s si cambio y al terminar el mapa.
 */

#include <amxmodx>
#include <amxmisc>
#include <dodx>
#include <dodstats>

#define PLUGIN_NAME     "DoD Stats - Registro"
#define PLUGIN_VERSION  "0.3.0"
#define PLUGIN_AUTHOR   "Marcelo Lescano"

#define PARTES_CUERPO   8   /* generico + las 7 zonas: igual a MAX_BODYHITS */
#define CAMPO_DISPAROS  4   /* posicion de "shots" en los stats de dodx */

#define PREFIJO         "[STATS]"
#define LARGO_LINEA     384
#define TAREA_VOLCAR    9310
#define SEGUNDOS_VOLCAR 30.0

new Array:g_pendientes;
new g_carpeta[128];
new g_mapa[32];
new g_conectadoDesde[33];

/* Impactos acumulados desde la ultima linea H de cada jugador */
new g_impactos[33][PARTES_CUERPO];
new g_danio[33];
/* Total de disparos de dodx que ya se informo: la linea H lleva la diferencia */
new g_disparosInformados[33];

/* Marcador de equipos: la partida se identifica por el momento en que empezo el mapa */
new g_inicioMapa;
new g_marcadorBase[3];      /* lo que marcaba dodx al empezar: puede venir del mapa anterior */
new g_marcadorInformado[3];
new bool:g_marcadorValido;  /* ya cambio desde el comienzo: es de esta partida */

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
    g_inicioMapa = get_systime();

    for (new equipo = 1; equipo <= 2; equipo++)
    {
        g_marcadorBase[equipo] = dod_get_team_score(equipo);
        g_marcadorInformado[equipo] = g_marcadorBase[equipo];
    }
    g_marcadorValido = false;

    new linea[LARGO_LINEA];
    formatex(linea, charsmax(linea), "P^t%d^t%s", g_inicioMapa, g_mapa);
    ArrayPushString(g_pendientes, linea);
}

public plugin_end()
{
    /* Cambio de mapa o apagado: no perder lo que quedo en memoria */
    registrarImpactosDeTodos();
    registrarMarcador();
    volcar();
    ArrayDestroy(g_pendientes);
}

/* ------------------------------------------------------------------ */
/*  Escritura a disco                                                  */
/* ------------------------------------------------------------------ */

public tareaVolcar()
{
    registrarImpactosDeTodos();
    registrarMarcador();
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
/*  Impactos y disparos                                                */
/* ------------------------------------------------------------------ */

disparosTotales(id)
{
    new stats[DODX_MAX_STATS], cuerpo[MAX_BODYHITS];
    get_user_wstats(id, 0, stats, cuerpo);      /* arma 0 = todas las armas */
    return stats[CAMPO_DISPAROS];
}

limpiarImpactos(id)
{
    for (new i = 0; i < PARTES_CUERPO; i++)
        g_impactos[id][i] = 0;
    g_danio[id] = 0;
}

registrarImpactos(id)
{
    if (!is_user_connected(id) || is_user_bot(id) || is_user_hltv(id))
        return;

    new total = disparosTotales(id);
    new disparos = total - g_disparosInformados[id];

    /* dodx reinicio sus contadores (por ejemplo, al entrar al mapa despues de que
       tomamos la base): lo que marca ahora son todos disparos nuevos */
    if (disparos < 0)
        disparos = total;
    g_disparosInformados[id] = total;

    new impactos = 0;
    for (new i = 0; i < PARTES_CUERPO; i++)
        impactos += g_impactos[id][i];

    if (!impactos && !disparos)
        return;

    new steam[35], nick[32], linea[LARGO_LINEA];
    datosJugador(id, steam, charsmax(steam), nick, charsmax(nick));

    formatex(linea, charsmax(linea), "H^t%d^t%s^t%s^t%s^t%d^t%d^t%d^t%d^t%d^t%d^t%d^t%d^t%d^t%d",
        get_systime(), g_mapa, steam, nick,
        g_impactos[id][0], g_impactos[id][1], g_impactos[id][2], g_impactos[id][3],
        g_impactos[id][4], g_impactos[id][5], g_impactos[id][6], g_impactos[id][7],
        g_danio[id], disparos);
    ArrayPushString(g_pendientes, linea);

    limpiarImpactos(id);
}

registrarImpactosDeTodos()
{
    for (new id = 1; id <= 32; id++)
        registrarImpactos(id);
}

public client_damage(atacante, victima, danio, indiceArma, lugarImpacto, TA)
{
    /* Sin atacante (caida, mapa), a uno mismo o fuego amigo: no cuenta */
    if (TA || atacante < 1 || atacante > 32 || atacante == victima)
        return;

    if (lugarImpacto < 0 || lugarImpacto >= PARTES_CUERPO)
        lugarImpacto = 0;

    g_impactos[atacante][lugarImpacto]++;
    g_danio[atacante] += danio;
}

/* ------------------------------------------------------------------ */
/*  Puntos                                                             */
/* ------------------------------------------------------------------ */

/*
 *  Marcador de los equipos. dodx guarda el ultimo valor que mando el juego, y al
 *  empezar un mapa puede seguir teniendo el del mapa anterior: hasta que no cambia
 *  por primera vez no se escribe, para no atribuirle a esta partida un resultado ajeno.
 */
registrarMarcador()
{
    new aliados = dod_get_team_score(1);
    new eje = dod_get_team_score(2);

    if (!g_marcadorValido)
    {
        if (aliados == g_marcadorBase[1] && eje == g_marcadorBase[2])
            return;
        g_marcadorValido = true;
    }
    else if (aliados == g_marcadorInformado[1] && eje == g_marcadorInformado[2])
        return;

    g_marcadorInformado[1] = aliados;
    g_marcadorInformado[2] = eje;

    new linea[LARGO_LINEA];
    formatex(linea, charsmax(linea), "E^t%d^t%s^t%d^t%d^t%d", get_systime(), g_mapa, g_inicioMapa, aliados, eje);
    ArrayPushString(g_pendientes, linea);
}

/* dodx avisa cada vez que un jugador suma puntos: puntos = lo que gano ahora, total = su nuevo total */
public client_score(id, puntos, total)
{
    /* Al reiniciarse el marcador llega una diferencia negativa: no es un evento */
    if (puntos <= 0 || !is_user_connected(id) || is_user_bot(id) || is_user_hltv(id))
        return;

    new equipo = get_user_team(id);
    if (equipo != 1 && equipo != 2)
        return;

    new steam[35], nick[32], linea[LARGO_LINEA];
    datosJugador(id, steam, charsmax(steam), nick, charsmax(nick));

    formatex(linea, charsmax(linea), "S^t%d^t%s^t%s^t%s^t%d^t%d", get_systime(), g_mapa, steam, nick, equipo, puntos);
    ArrayPushString(g_pendientes, linea);
}

/* ------------------------------------------------------------------ */
/*  Eventos                                                            */
/* ------------------------------------------------------------------ */

public client_putinserver(id)
{
    if (is_user_hltv(id))
        return;

    g_conectadoDesde[id] = get_systime();
    limpiarImpactos(id);
    g_disparosInformados[id] = disparosTotales(id);

    new steam[35], nick[32], linea[LARGO_LINEA];
    datosJugador(id, steam, charsmax(steam), nick, charsmax(nick));

    formatex(linea, charsmax(linea), "C^t%d^t%s^t%s", get_systime(), steam, nick);
    ArrayPushString(g_pendientes, linea);
}

public client_disconnected(id, bool:drop, message[], maxlen)
{
    if (!g_conectadoDesde[id])
        return;

    /* Lo que disparo y pego desde la ultima tanda, antes de que se vaya */
    registrarImpactos(id);

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
