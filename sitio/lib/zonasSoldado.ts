/*
 *  Zonas del cuerpo sobre la imagen del soldado (public/soldado.webp).
 *
 *  Coordenadas en pixeles de la imagen ORIGINAL (mapas/fuentes/soldado.jpg, 1152x923).
 *  La figura mira hacia el que la ve: su brazo derecho queda a la izquierda.
 *
 *  Si se cambia la imagen, hay que ajustar estos poligonos y revisar el control:
 *    node mapas/soldado.mjs --control   ->   mapas/validacion/soldado-zonas.png
 */

export type NombreZona = 'cabeza' | 'pecho' | 'estomago' | 'brazo_izq' | 'brazo_der' | 'pierna_izq' | 'pierna_der'

export const ZONAS_SOLDADO: Record<NombreZona, [number, number][]> = {
  cabeza: [[528, 150], [537, 112], [565, 92], [600, 86], [635, 95], [655, 120], [660, 150], [648, 168], [672, 190],
    [697, 215], [698, 235], [675, 238], [640, 232], [615, 252], [575, 258], [550, 240], [540, 205], [533, 175]],
  pecho: [[500, 242], [555, 250], [612, 250], [655, 242], [672, 300], [690, 332], [680, 400], [495, 400], [488, 333], [495, 290]],
  estomago: [[495, 400], [680, 400], [690, 470], [688, 532], [484, 532], [480, 470]],
  /* Los bordes externos pueden salirse de la figura: en el sitio el color se recorta
     con la silueta. Lo que importa es el limite entre zonas y no invadir las armas. */
  brazo_der: [[500, 236], [446, 257], [386, 292], [330, 333], [294, 358], [262, 383], [248, 418], [252, 460], [294, 460],
    [320, 424], [352, 403], [406, 381], [460, 360], [490, 347], [495, 290]],
  brazo_izq: [[655, 236], [710, 255], [768, 292], [820, 334], [852, 354], [878, 365], [894, 400], [886, 450], [846, 452],
    [822, 414], [772, 383], [722, 357], [690, 342], [672, 300]],
  pierna_der: [[484, 532], [585, 532], [585, 575], [572, 640], [560, 700], [548, 760], [540, 800], [538, 870], [518, 906],
    [446, 906], [444, 875], [458, 820], [456, 760], [450, 700], [460, 640], [470, 580]],
  pierna_izq: [[585, 532], [688, 532], [696, 600], [698, 700], [700, 760], [698, 800], [706, 850], [734, 880], [730, 904],
    [626, 904], [621, 860], [640, 800], [628, 760], [612, 700], [600, 640], [585, 580]]
}

/* Donde apunta la linea de cada etiqueta, dentro de la zona */
export const ANCLAS_SOLDADO: Record<NombreZona, [number, number]> = {
  cabeza: [590, 130],
  pecho: [640, 320],
  estomago: [640, 490],
  brazo_der: [360, 360],
  brazo_izq: [800, 350],
  pierna_der: [510, 700],
  pierna_izq: [650, 700]
}
