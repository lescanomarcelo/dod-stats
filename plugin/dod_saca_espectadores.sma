/*
 *  DoD - Saca espectadores
 *
 *  Cuando el server se llena, el que se queda mirando ocupa un lugar que podria
 *  estar usando alguien que quiere jugar. Este plugin saca al espectador que lleva
 *  un rato sin elegir bando, pero solo cuando hace falta: si hay lugar de sobra, no
 *  molesta a nadie.
 *
 *  Las dos condiciones se configuran:
 *
 *    espect_minimo     12    de cuantos jugadores en adelante se aplica la regla
 *    espect_minutos     3    cuanto puede estar mirando antes de que lo saquen
 *    espect_admines     1    1 = a los admines no se los saca, 0 = a todos igual
 *    espect_mensaje          lo que ve el que se va
 *
 *  Se pueden poner en addons/amxmodx/configs/amxx.cfg para que queden fijos, o a
 *  mano en la consola para probar.
 *
 *  Como cuenta los jugadores: todos los humanos conectados, mirando o jugando. Es
 *  la cuenta que importa, porque son los que ocupan lugar.
 *
 *  Como sabe quien esta mirando: el que no esta en Aliados ni en Eje. Eso incluye al
 *  que todavia no eligio clase, que es justo lo que se quiere. Los tres minutos le
 *  dan tiempo de sobra para elegir.
 *
 *  No usa eventos de cambio de equipo: cada 15 segundos mira en que anda cada uno.
 *  Con una regla de minutos, esa precision sobra, y asi no depende de que los
 *  eventos del juego lleguen siempre.
 */

#include <amxmodx>
#include <amxmisc>

#define PLUGIN_NAME     "DoD - Saca espectadores"
#define PLUGIN_VERSION  "1.0.0"
#define PLUGIN_AUTHOR   "Marcelo Lescano"

#define PREFIJO         "[ESPECT]"

/* Los equipos que cuentan como jugar. Cualquier otra cosa es estar mirando. */
#define ALIADOS         1
#define EJE             2

#define TAREA_REVISAR   9320
#define SEGUNDOS_REVISION 15.0
#define LARGO_MENSAJE   128

new g_cvarMinimo, g_cvarMinutos, g_cvarAdmines, g_cvarMensaje

/* Desde cuando esta mirando cada uno (get_gametime). 0 = esta jugando. */
new Float:g_mirandoDesde[33]

public plugin_init()
{
    register_plugin(PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_AUTHOR)

    g_cvarMinimo  = register_cvar("espect_minimo", "12")
    g_cvarMinutos = register_cvar("espect_minutos", "3")
    g_cvarAdmines = register_cvar("espect_admines", "1")
    g_cvarMensaje = register_cvar("espect_mensaje", "Volve cuando esten listos los bifes!")

    register_concmd("espect_estado", "cmdEstado", ADMIN_RCON, "- muestra quien esta mirando y hace cuanto")

    set_task(SEGUNDOS_REVISION, "tareaRevisar", TAREA_REVISAR, "", 0, "b")
}

public plugin_cfg()
{
    /* Cambio de mapa: todos arrancan de cero, que es lo correcto. Al entrar al mapa
       nuevo todos estan eligiendo clase, y recien ahi empieza a correr el reloj. */
    for (new id = 1; id <= 32; id++)
        g_mirandoDesde[id] = 0.0
}

public client_putinserver(id)
{
    g_mirandoDesde[id] = 0.0
}

/* No hace falta enganchar la desconexion: la revision de cada 15 segundos le
   borra el reloj a cualquiera que ya no este conectado. Asi tampoco depende de
   que el forward se llame client_disconnect o client_disconnected, que cambio
   de nombre entre versiones de AMXX. */


/* ------------------------------------------------------------------ */

/** Si ese jugador cuenta para la cantidad de gente en el server */
bool:esHumano(id)
{
    return is_user_connected(id) && !is_user_bot(id) && !is_user_hltv(id)
}

/** Si esta mirando en vez de jugando */
bool:estaMirando(id)
{
    new equipo = get_user_team(id)
    return equipo != ALIADOS && equipo != EJE
}

/** Cuantos humanos hay conectados, mirando o jugando */
cuantosHay()
{
    new cuantos = 0
    for (new id = 1; id <= 32; id++)
        if (esHumano(id))
            cuantos++
    return cuantos
}

/* ------------------------------------------------------------------ */

public tareaRevisar()
{
    new Float:ahora = get_gametime()
    new Float:limite = floatmax(0.0, get_pcvar_float(g_cvarMinutos)) * 60.0
    new minimo = get_pcvar_num(g_cvarMinimo)
    new respetarAdmines = get_pcvar_num(g_cvarAdmines)

    /* Primero el reloj de cada uno: se lleva siempre, haya o no gente. Si no, al
       llenarse el server los que ya estaban mirando arrancarian recien de cero. */
    new hay = 0
    for (new id = 1; id <= 32; id++)
    {
        if (!esHumano(id))
        {
            g_mirandoDesde[id] = 0.0
            continue
        }
        hay++

        if (!estaMirando(id))
            g_mirandoDesde[id] = 0.0
        else if (g_mirandoDesde[id] == 0.0)
            g_mirandoDesde[id] = ahora
    }

    /* Si hay lugar de sobra, no se molesta a nadie */
    if (hay <= minimo || limite <= 0.0)
        return

    new mensaje[LARGO_MENSAJE]
    get_pcvar_string(g_cvarMensaje, mensaje, charsmax(mensaje))

    for (new id = 1; id <= 32; id++)
    {
        if (!esHumano(id) || g_mirandoDesde[id] == 0.0)
            continue
        if (ahora - g_mirandoDesde[id] < limite)
            continue
        if (respetarAdmines && is_user_admin(id))
            continue

        sacar(id, mensaje)
        hay--

        /* Si sacando a este el server ya no esta lleno, los demas se salvan */
        if (hay <= minimo)
            break
    }
}

sacar(id, const mensaje[])
{
    new nick[32], userid = get_user_userid(id)
    get_user_name(id, nick, charsmax(nick))

    /* Que lo lea en el chat tambien: el cartel del kick a veces pasa de largo */
    client_print(id, print_chat, "%s", mensaje)

    log_amx("%s %s estuvo mirando y el server estaba lleno: afuera", PREFIJO, nick)
    server_cmd("kick #%d ^"%s^"", userid, mensaje)

    g_mirandoDesde[id] = 0.0
}

/* ------------------------------------------------------------------ */

public cmdEstado(id, nivel, cid)
{
    if (!cmd_access(id, nivel, cid, 1))
        return PLUGIN_HANDLED

    new Float:ahora = get_gametime()
    new minimo = get_pcvar_num(g_cvarMinimo)
    new Float:minutos = get_pcvar_float(g_cvarMinutos)
    new hay = cuantosHay()

    console_print(id, "%s %d jugadores. Se saca al que mire mas de %.1f min cuando haya mas de %d.",
        PREFIJO, hay, minutos, minimo)
    console_print(id, "%s %s", PREFIJO, hay > minimo ? "La regla esta activa." : "Hay lugar: no se saca a nadie.")

    new nick[32], cuantos = 0
    for (new jugador = 1; jugador <= 32; jugador++)
    {
        if (!esHumano(jugador) || !estaMirando(jugador))
            continue

        get_user_name(jugador, nick, charsmax(nick))
        new Float:llevaMirando = g_mirandoDesde[jugador] > 0.0 ? ahora - g_mirandoDesde[jugador] : 0.0
        console_print(id, "  %s: mirando hace %.0f s%s",
            nick, llevaMirando, (get_pcvar_num(g_cvarAdmines) && is_user_admin(jugador)) ? " (admin, no se saca)" : "")
        cuantos++
    }
    if (!cuantos)
        console_print(id, "%s No hay nadie mirando.", PREFIJO)

    return PLUGIN_HANDLED
}
