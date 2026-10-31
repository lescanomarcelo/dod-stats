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
 *    espect_admines     0    0 = a todos igual, 1 = a los admines no se los saca
 *    espect_mensaje          lo que ve el que se va
 *
 *  Se tocan en addons/amxmodx/configs/espectadores.cfg, que el plugin escribe solo
 *  la primera vez con estos valores y sus explicaciones. Cambiar un numero ahi y
 *  cambiar de mapa alcanza: no hay que recompilar nada. En la consola tambien se
 *  pueden cambiar en caliente, pero eso dura hasta que se reinicie el server.
 *
 *  Como cuenta los jugadores: todos los humanos conectados, mirando o jugando. Es
 *  la cuenta que importa, porque son los que ocupan lugar.
 *
 *  Como sabe quien esta mirando: el que no esta en Aliados ni en Eje. Eso incluye al
 *  que todavia no eligio clase, que es justo lo que se quiere. Los tres minutos le
 *  dan tiempo de sobra para elegir.
 *
 *  Cada vez que saca a alguien escribe una linea K en el mismo archivo de eventos
 *  que usa dod_stats_registro, para que la ingesta la levante sin cambiar nada de
 *  como se leen los archivos:
 *
 *    K  <momento>  <steamid>  <nick>  <segundos que llevaba mirando>
 *
 *  Se escribe en el momento, sin acumular en memoria como hace el de stats: son
 *  unos pocos eventos por dia y asi no se pierde ninguno si el server se cae.
 *
 *  No usa eventos de cambio de equipo: cada 15 segundos mira en que anda cada uno.
 *  Con una regla de minutos, esa precision sobra, y asi no depende de que los
 *  eventos del juego lleguen siempre.
 */

#include <amxmodx>
#include <amxmisc>
#include <file>

#define PLUGIN_NAME     "DoD - Saca espectadores"
#define PLUGIN_VERSION  "1.2.0"
#define PLUGIN_AUTHOR   "Marcelo Lescano"

#define PREFIJO         "[ESPECT]"

/* Los equipos que cuentan como jugar. Cualquier otra cosa es estar mirando. */
#define ALIADOS         1
#define EJE             2

#define TAREA_REVISAR   9320
#define SEGUNDOS_REVISION 15.0
#define LARGO_MENSAJE   128
#define ARCHIVO_CFG     "espectadores.cfg"

new g_cvarMinimo, g_cvarMinutos, g_cvarAdmines, g_cvarMensaje

/* Donde escribe dod_stats_registro sus eventos: escribimos en el mismo archivo */
new g_carpeta[128]

/* Desde cuando esta mirando cada uno (get_gametime). 0 = esta jugando. */
new Float:g_mirandoDesde[33]

public plugin_init()
{
    register_plugin(PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_AUTHOR)

    g_cvarMinimo  = register_cvar("espect_minimo", "12")
    g_cvarMinutos = register_cvar("espect_minutos", "3")
    g_cvarAdmines = register_cvar("espect_admines", "0")
    g_cvarMensaje = register_cvar("espect_mensaje", "Volve cuando esten listos los bifes!")

    register_concmd("espect_estado", "cmdEstado", ADMIN_RCON, "- muestra quien esta mirando y hace cuanto")

    get_datadir(g_carpeta, charsmax(g_carpeta))
    add(g_carpeta, charsmax(g_carpeta), "/stats")
    if (!dir_exists(g_carpeta))
        mkdir(g_carpeta)

    set_task(SEGUNDOS_REVISION, "tareaRevisar", TAREA_REVISAR, "", 0, "b")
}

public plugin_cfg()
{
    /* Cambio de mapa: todos arrancan de cero, que es lo correcto. Al entrar al mapa
       nuevo todos estan eligiendo clase, y recien ahi empieza a correr el reloj. */
    for (new id = 1; id <= 32; id++)
        g_mirandoDesde[id] = 0.0

    cargarConfig()
}

/*
 *  La configuracion vive en un archivo aparte y no en amxx.cfg: asi se ve de un
 *  vistazo que se puede tocar y por que, sin perderse entre las cvars de todo lo
 *  demas. Si el archivo no esta, se escribe con los valores de arriba y con sus
 *  explicaciones, asi el server queda configurable con solo subir el plugin.
 *
 *  Se lee en cada cambio de mapa, que es cuando corre plugin_cfg: editar el
 *  archivo y cambiar de mapa alcanza para que tome los valores nuevos.
 */
cargarConfig()
{
    new carpeta[64], ruta[128]
    get_configsdir(carpeta, charsmax(carpeta))
    formatex(ruta, charsmax(ruta), "%s/%s", carpeta, ARCHIVO_CFG)

    if (!file_exists(ruta))
    {
        write_file(ruta, "// DoD - Saca espectadores")
        write_file(ruta, "// Cambiar un valor aca y cambiar de mapa: no hace falta recompilar.")
        write_file(ruta, "")
        write_file(ruta, "// De cuantos jugadores en adelante se aplica la regla.")
        write_file(ruta, "espect_minimo 12")
        write_file(ruta, "")
        write_file(ruta, "// Cuantos minutos puede estar mirando antes de que lo saquen.")
        write_file(ruta, "// Acepta decimales: 0.5 es medio minuto. En 0 no se saca a nadie.")
        write_file(ruta, "espect_minutos 3")
        write_file(ruta, "")
        write_file(ruta, "// 0 = a los admines se los saca igual, 1 = a los admines no se los saca.")
        write_file(ruta, "espect_admines 0")
        write_file(ruta, "")
        write_file(ruta, "// Lo que ve el que se va. Sin tildes: la fuente del juego las rompe.")
        write_file(ruta, "espect_mensaje ^"Volve cuando esten listos los bifes!^"")

        log_amx("%s Primera vez: escribi la configuracion en %s", PREFIJO, ruta)
    }

    server_cmd("exec %s", ruta)
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

        sacar(id, mensaje, ahora - g_mirandoDesde[id])
        hay--

        /* Si sacando a este el server ya no esta lleno, los demas se salvan */
        if (hay <= minimo)
            break
    }
}

sacar(id, const mensaje[], Float:llevaMirando)
{
    new nick[32], userid = get_user_userid(id)
    get_user_name(id, nick, charsmax(nick))

    anotarKick(id, nick, floatround(llevaMirando))

    /* Que lo lea en el chat tambien: el cartel del kick a veces pasa de largo */
    client_print(id, print_chat, "%s", mensaje)

    log_amx("%s %s estuvo mirando y el server estaba lleno: afuera", PREFIJO, nick)
    server_cmd("kick #%d ^"%s^"", userid, mensaje)

    g_mirandoDesde[id] = 0.0
}

/*
 *  Deja constancia del kick en el archivo de eventos del dia, el mismo que escribe
 *  dod_stats_registro. La ingesta ya sabe leer ese archivo: solo tuvo que aprender
 *  un tipo de linea mas.
 *
 *  Se abre y se cierra en el momento. El otro plugin acumula y vuelca cada 30
 *  segundos porque escribe miles de lineas por partida; aca son unas pocas por dia,
 *  asi que no vale la pena el riesgo de perderlas si el server se cae.
 *
 *  Los TAB y los saltos de linea del nick se cambian por espacios: el formato
 *  separa por TAB y un nick con uno adentro correria las columnas.
 */
anotarKick(id, const nick[], segundos)
{
    new limpio[32]
    copy(limpio, charsmax(limpio), nick)
    for (new i = 0; limpio[i]; i++)
        if (limpio[i] == '^t' || limpio[i] == '^n' || limpio[i] == '^r')
            limpio[i] = ' '

    new steam[35]
    if (is_user_bot(id))
        copy(steam, charsmax(steam), "BOT")
    else
        get_user_authid(id, steam, charsmax(steam))

    new fecha[16], ruta[192]
    format_time(fecha, charsmax(fecha), "%Y%m%d")
    formatex(ruta, charsmax(ruta), "%s/eventos_%s.tsv", g_carpeta, fecha)

    new archivo = fopen(ruta, "at")
    if (!archivo)
    {
        log_amx("%s no se pudo abrir %s para anotar el kick de %s", PREFIJO, ruta, limpio)
        return
    }

    fprintf(archivo, "K^t%d^t%s^t%s^t%d^n", get_systime(), steam, limpio, segundos)
    fclose(archivo)
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
