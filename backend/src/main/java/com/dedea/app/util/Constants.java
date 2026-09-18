package com.dedea.app.util;

//Significa que esta clase no puede heredar ni tener hijos
public final class Constants {
//Esta clase no almacena métodos, solo variables, es un archivo pasivo
// Es un diccionario de reglas

    // Constructor privado para evitar que alguien intente hacer "new Constants()"
    // Es un desperdicio de "RAM"
    // Nadie puede instanciar la clase solo leer sus valores estáticos
    private Constants() {
        throw new UnsupportedOperationException("Esta es una clase utilitaria y no puede ser instanciada");
      /*Throw (Lanzar) -> Detonar el error y detener la ejecución
        new -> Crear o fabricar la caja de error
        UnsupportedOperationException -> (Tipo de error) Alarma construida dentro de Java
       */
    }

    /*Al usar Static le decimos al usuario que las variables no le pertenecen
    al usuario (objeto) si no al sistema (la clase). Se carga una sola vez cuando arranca el servidor
    Final significa inmutable, no se puede cambiar los valores mientras la app corre
    --- NOTICIAS E IA ---*/
    /* ===== MODO PRUEBAS ACTIVO — REVERTIR ANTES DE PUBLICAR =====
       Tanda de CALIBRACIÓN (22-ago-2026): 15 noticias, 5 de cada nivel, para juntar
       muestras y comparar contra las 19 del 21-ago. El tamaño no es para esquivar la
       cuota: es diseño experimental — se quiere el mismo número de casos por nivel para
       que la comparación no quede sesgada hacia el nivel más frecuente.

       objetivoDelDia = min(NOTICIAS_POR_CATEGORIA x 5 categorías, MAX_NOTICIAS_POR_DIA)
       = min(3 x 5, 15) = 15. Las tres cuotas en 5 reparten esas 15 entre los niveles.

       Para producción: MAX_NOTICIAS_POR_DIA = 30 y NOTICIAS_POR_CATEGORIA = 2, que con
       las 5 categorías de NoticiaServiceImpl.CATEGORIAS dan las 10 noticias de la
       portada. NO hay que tocar nada de NoticiaServiceImpl al revertir — ver el aviso
       de CLAUDE.md 10.15. */
    public static final int MAX_NOTICIAS_POR_DIA = 10;     // PRODUCCIÓN: 30
    public static final int NOTICIAS_POR_CATEGORIA = 2;    // PRODUCCIÓN: 2

    /* ===== FLUJO EN DOS PASOS (24-ago-2026) =====

       Antes la tanda era un solo bucle: agarrar un artículo, scrapearlo, pedirle el resumen
       a Gemini, guardar, siguiente. Eso tenía dos problemas medidos:

       - Se gastaba una llamada a Gemini en artículos que no eran noticias (una página de
         soluciones de Wordle, un anuncio) o que no tenían material para el nivel pedido.
       - El nivel se asignaba por orden de llegada, sin saber qué artículos venían después,
         así que un artículo rico podía terminar escribiendo un resumen fácil mientras el
         difícil se le pedía a una nota de prosa. Medido: 5 de 7 fallos de la jornada del
         22-ago fueron eso.

       Ahora son dos pasos separados. Primero se juntan y filtran los candidatos (scraping,
       que es gratis, más UNA llamada a Gemini para descartar lo que no es noticia), y
       recién después se generan los resúmenes, uno por candidato ya emparejado con su
       nivel. */

    /* Cuántos candidatos limpios hay que juntar antes de generar. */
    public static final int CANDIDATOS_OBJETIVO = 10;

    /* Cuántos de más se juntan por ronda. Existe porque entre el filtro de spam y el
       reparto siempre se cae alguno, y volver a salir a buscar cuesta otra ronda entera. */
    public static final int CANDIDATOS_EXTRA = 5;

    /* Tope de rondas de recolección. Sin esto, si GNews no trae artículos que sostengan el
       nivel DIFICIL —y medimos que son raros: 1 o 2 de cada 10— el bucle sale a buscar para
       siempre. Con el tope, la corrida cierra con lo que consiguió. */
    public static final int MAX_RONDAS_CANDIDATOS = 3;

    /* Cuántos caracteres de cada artículo se le mandan al filtro de spam. Alcanza para que
       Gemini distinga una noticia de un anuncio o de una página de servicio; mandarle más
       solo agranda el prompt sin mejorar la decisión. */
    public static final int CARACTERES_MUESTRA_FILTRO = 400;

    /* Intentos de la llamada del filtro de spam antes de rendirse.

       Si los tres fallan NO se descartan los candidatos: se aceptan todos y se activa el
       respaldo (ver MARCADOR_NO_ES_NOTICIA). El filtro es una mejora, no un requisito, y
       tres parseos fallidos seguidos indican un problema de nuestro prompt —no de los
       artículos—, así que pedir otros no arreglaría nada y dejaría la jornada sin noticias. */
    public static final int MAX_INTENTOS_FILTRO_SPAM = 3;

    /* Palabra que le pedimos a Gemini que devuelva SOLA cuando el artículo que le tocó
       resumir no es una noticia.

       Es el respaldo del filtro de spam: solo se agrega al prompt cuando el filtro no pudo
       leerse. Así la verificación no se pierde, y no cuesta ninguna llamada extra porque
       viaja dentro de la generación que igual se iba a hacer. Mismo patrón que
       MARCADOR_TEMA_DUPLICADO. */
    public static final String MARCADOR_NO_ES_NOTICIA = "NO_ES_NOTICIA";

    /* Palabra que le pedimos a Gemini que devuelva SOLA cuando le toca un articulo con
       nivel DIFICIL y al leerlo resulta que no tiene material para tanto.

       Por que SOLO en dificil: es el unico nivel que puede quedarse sin material. Facil se
       cumple siempre y medio casi siempre; dificil necesita cifras y simbolos que el
       articulo tiene que traer. Y es el nivel donde nuestro perfilado mas se equivoca,
       porque puede confundir metadatos de plantilla con contenido rico.

       Cuesta llamadas extra —hay que pedir otro articulo— pero solo en ese nivel, y a
       cambio evita guardar una noticia difficil que en realidad es facil. */
    public static final String MARCADOR_SIN_MATERIAL = "SIN_MATERIAL";

    /* Fallos seguidos de Gemini antes de abortar la tanda entera. Si la IA falla
       varias veces al hilo, el problema es de la key o del servicio y no del artículo:
       seguir intentando solo quema llamadas y hace que la sincronización parezca colgada. */
    public static final int MAX_FALLOS_IA_SEGUIDOS = 3;

    /* Cuantas veces tiene que aparecer en el ejercicio de IA un objetivo que NO es una
       letra (%, $, :, /, parentesis...).

       Existe porque a un modelo de lenguaje no se le puede pedir "escribe palabras que
       contengan %": ninguna palabra lo contiene. El simbolo no vive dentro del vocabulario,
       asi que hay que pedirle que lo USE, y eso se hace en un bloque aparte del prompt
       (IaServiceImpl.bloqueSimbolos). Hasta el 25-ago-2026 se le pedia como si fuera una
       letra mas, y el modelo devolvia textos sin un solo simbolo.

       Es una cantidad EXACTA y no un minimo, y la diferencia importa: un simbolo repetido de
       mas convierte el parrafo en una lista de simbolos, mientras que una letra de mas no
       molesta a nadie.

       5 lo fijo el usuario. Es un termino medio deliberado: con 1 o 2 no se llega a
       automatizar el gesto, y con 10 el texto deja de parecer prosa.

       No hay red que lo garantice: si Gemini no obedece, el ejercicio sale con menos. Se
       comprueba a ojo en el panel de objetivos de PracticaView, que es lo unico que mide
       esto hoy. */
    /* ===== DESARROLLO — REVERTIR ANTES DE PUBLICAR =====

       Con esto en true, cada peticion de ejercicio con IA genera TRES textos —uno facil, uno
       medio y uno dificil— con los mismos ngrams y simbolos, y los vuelca al log. El usuario
       recibe en pantalla unicamente el del nivel que pidio: los otros dos no salen del log,
       no se guardan y no cambian nada de lo que ve.

       Para que sirve: comparar los tres niveles sobre los MISMOS objetivos, en una sola
       peticion. Probandolos de a uno, cada nivel sale con ngrams distintos y no se puede
       atribuir la diferencia al nivel — es el problema de atribucion de CLAUDE.md 10.19.

       ⚠️ Triplica las llamadas a Gemini: 3 por ejercicio contra 1, mas los reintentos por
       texto invalido. Con Vertex AI activo (app.gemini.vertex.enabled=true, que es como corre
       hoy) eso no aprieta: el tope de 20 peticiones diarias es del nivel gratuito de la
       Developer API, no de Vertex. El aviso vuelve a valer si se apaga Vertex — ahi son ~6
       ejercicios diarios y un 429 en medio de una tanda sale de aca.

       PRODUCCIÓN: false. Y no hay nada mas que revertir — el camino normal sigue vivo y es el
       que corre con la bandera apagada. */
    public static final boolean GENERAR_LOS_TRES_NIVELES_IA = true;   // PRODUCCIÓN: false

    public static final int OBJETIVOS_SIMBOLO_POR_TEXTO = 5;

    public static final int PALABRAS_RESUMEN_NOTICIA = 50;
    public static final int MAX_TEXTOS_IA_CACHE = 20;

    /* Palabra clave que le pedimos a Gemini que devuelva SOLA (nada más) cuando el
       artículo trata el mismo evento que uno ya guardado hoy en OTRA categoría — el caso
       del eclipse solar apareciendo como noticia principal en Tecnología, Ciencia y
       Cultura el mismo día. Vive acá porque el prompt (NoticiaServiceImpl) y el chequeo
       de la respuesta la necesitan igual. */
    public static final String MARCADOR_TEMA_DUPLICADO = "DUPLICADO";

    /* Reparto de dificultad de la tanda diaria. Es el nivel que se PIDE, no el que sale:
       la dificultad final siempre la decide DifficultyScorer sobre el texto real. Antes
       esto no existía —el prompt no pedía ningún nivel— y el 12-ago-2026 salieron 9
       DIFICIL y 1 MEDIO en la jornada entera, sin una sola FACIL.

       ===== MODO PRUEBAS ACTIVO — REVERTIR ANTES DE PUBLICAR =====
       Con 1/1/1 cada corrida de prueba trae una muestra de los tres niveles con solo 3
       llamadas a Gemini. En producción van 3/4/3, que suman las 10 de la portada. */
    public static final int CUOTA_NOTICIAS_DIFICIL = 3;    // PRODUCCIÓN: 3
    public static final int CUOTA_NOTICIAS_MEDIO = 4;      // PRODUCCIÓN: 4
    public static final int CUOTA_NOTICIAS_FACIL = 3;      // PRODUCCIÓN: 3

    /* Artículos EXTRA que se permite procesar por encima de MAX_NOTICIAS_POR_DIA cuando
       la cuota de DIFICIL todavía no se cumplió al llegar al tope.

       Sin esto, si todos los artículos de la tanda vuelven clasificados MEDIO, la
       corrida termina sin una sola noticia difícil — y la difícil es justo la que hace
       falta para probar que el prompt de ese nivel funciona.

       EN 0 DURANTE LA TANDA DE CALIBRACIÓN (22-ago-2026). Con valor 2, topeEfectivo()
       deja procesar 2 artículos por encima del tope mientras no se hayan LOGRADO 5
       difíciles, y esos dos extra se piden como DIFICIL (fase EXTRA de
       elegirNivelObjetivo). Eso daría 7 pedidos de DIFICIL contra 5 de los otros
       niveles y arruinaría el reparto parejo que la calibración necesita.

       Con 0, topeEfectivo() devuelve siempre MAX_NOTICIAS_POR_DIA y se piden exactamente
       5 de cada nivel. Al volver a producción hay que devolverlo a 2. */
    public static final int INTENTOS_EXTRA_DIFICIL = 0;    // PRODUCCIÓN: 2

    /* CUÁNTOS DATOS NUMÉRICOS tiene que traer el ARTÍCULO para que valga la pena pedirle
       a Gemini un resumen de cada nivel. Un "dato numérico" es un grupo de dígitos
       seguidos: "2026" cuenta uno, "3.000" cuenta uno, "73-70" cuenta dos.

       El porqué (medido el 23-ago-2026 sobre 132 textos, ver CLAUDE.md 10.2.2): un resumen
       SIN dígitos nunca alcanza el nivel MEDIO — 0 de 18 lo lograron, y el propio usuario
       etiquetó como FACIL 14 de las 15 noticias reales sin cifras. Con 3 o más dígitos en
       el resumen, 17 de 18 cruzan el umbral. O sea que pedirle MEDIO a un artículo sin
       números es gastar una llamada a Gemini para obtener un texto fácil.

       ⚠️ ESTOS DOS NÚMEROS NO ESTÁN CALIBRADOS. Salen de razonar, no de medir: el texto
       scrapeado nunca se guardó, así que no hay con qué ajustarlos todavía. Por eso el log
       de cada noticia registra ahora cuántos datos numéricos tenía su artículo — con dos o
       tres tandas se podrán fijar de verdad. Si al revisar el log se ve que artículos con
       6 datos producen medias sin problema, bajar MIN_DATOS_ARTICULO_DIFICIL.

       Se cuentan sobre el texto RECORTADO que ve Gemini, no sobre la página entera. */
    public static final int MIN_DATOS_ARTICULO_MEDIO = 3;
    /* Bajado de 8 a 5 el 24-ago-2026, con evidencia directa.

       El 8 salia de razonar "hace falta el doble de lo que se va a usar", y ese razonamiento
       ignoraba que LOS DECIMALES DUPLICAN LOS DIGITOS SIN DUPLICAR LOS DATOS: "23,5" es un
       dato y tres digitos. El resumen de la noticia 264 —una DIFICIL de 22.30%— usa cuatro
       datos: 23,5 · 2,55 · 20 · 523b, que dan once digitos.

       El caso que lo destapo: un articulo sobre el MISMO descubrimiento (la "mega-Tierra")
       llego con 3 datos en el lead y se clasifico MEDIO, cuando el mismo hecho ya habia
       producido una dificil. Con el umbral en 8 estabamos descartando candidatos buenos en
       silencio y sin forma de recuperarlos.

       Permisivo arriba, verificado abajo: si con 5 entra alguno que no rinde, Gemini lo lee
       y devuelve MARCADOR_SIN_MATERIAL. Es mejor que un umbral alto, que descarta a ciegas. */
    public static final int MIN_DATOS_ARTICULO_DIFICIL = 5;

    /* Cuántas veces se puede PEDIR un mismo nivel antes de pasar al siguiente, por encima
       de su cuota.

       Existe porque los contadores que deciden el nivel cuentan lo que el scorer CONFIRMÓ,
       no lo que se pidió: así, si se pide DIFICIL y sale MEDIO, el cupo de difíciles sigue
       abierto y se vuelve a intentar. Eso es lo que se quiere.

       Pero sin tope reaparece el bug del 18-ago-2026: si el nivel nunca se logra, su
       condición "faltan" queda verdadera para siempre y la tanda pide ese nivel en bucle
       sin llegar nunca a los otros. Con el tope, un nivel que no sale cede el turno. */
    public static final int MAX_INTENTOS_EXTRA_POR_NIVEL = 2;

    /* Cuántos %, $ o € tiene que traer el artículo para considerarlo material de DIFICIL
       por sí solos, sin mirar la densidad de dígitos.

       Antes bastaba UNO (`contains`) y eso rompía la clasificación: casi cualquier página
       trae un símbolo suelto en publicidad, menú o pie, así que el atajo mandaba todo a
       DIFICIL y anulaba la medición de densidad. Con 3 se pide una señal real —una nota
       de precios o de porcentajes los repite— y el ruido de navegación deja de contar. */
    public static final int MIN_SIMBOLOS_ARTICULO_DIFICIL = 3;

    /* Validación de cordura sobre lo que devuelve Gemini, antes de limpiarlo y guardarlo.
       El caso que la motivó: el modelo entró en un bucle de repetición y devolvió el
       dígito "1" repetido 1.309 veces, que se guardó y llegó a la pantalla del usuario —
       nadie preguntaba "¿esto se parece a un texto?". Es un modo de fallo conocido de los
       LLM (degeneración por repetición), así que va a repetirse. Ver CLAUDE.md 10.12.

       El tope está en 50% y no en algo más estricto a propósito: en un texto corto en
       español la "e" o el espacio pueden ocupar una porción alta sin que haya nada raro. */
    public static final double MAX_PORCENTAJE_UN_CARACTER = 50.0;

    // Un resumen real siempre trae varias palabras; un bucle degenerado, ninguna o una.
    public static final int MIN_PALABRAS_TEXTO_IA = 8;

    // Proporción mínima de letras: descarta respuestas que sean casi todo dígitos o signos.
    public static final double MIN_PORCENTAJE_LETRAS = 50.0;

    /* Ventana del chequeo periódico de imágenes rotas por bloqueo anti-hotlinking (ver
       WebScraperClient.pareceBloqueoAntiHotlinking). Acotado a lo reciente: revisar TODO
       el historial cada día no aporta —las noticias viejas casi no se sirven— y crece sin
       límite con cada día que pasa. */
    public static final int DIAS_REVISION_IMAGENES = 30;

    /* Cuántos días se conserva el texto scrapeado de cada noticia (ver
       Noticia.articuloScrapeado). Es material de calibración, no del producto: una semana
       alcanza para revisar una tanda rara sin que la tabla crezca sin control.
       Con 30 noticias diarias de ~4 KB, una semana son menos de 1 MB. */
    public static final int DIAS_RETENCION_ARTICULO = 7;
    // Intentos mínimos para teclas individuales (menor que ngrams porque se presionan más)
    public static final int TECLA_MIN_INTENTOS = 2;

    /* El MAPA DE CALOR no filtra por intentos en la consulta: devuelve toda tecla con al
       menos una pulsación, porque la vista necesita el conteo real para distinguir "nunca
       la tocaste" de "la tocaste tres veces, pocas para medir".
       Cuántas pulsaciones hacen falta para COLOREAR una tecla lo decide el front
       (MIN_PULSACIONES_MAPA en GlobalStatsView), que es donde se toma esa decisión visual. */

    /* El horario del cron NO vive acá: está en `app.scheduler.cron` de application.yml, que es
       lo que lee `@Scheduled`. Había una constante CRON_NOTICIAS con el mismo valor y **nadie la
       usaba**: cambiarla no movía el horario, y cambiar el yml la dejaba mintiendo. Dos fuentes
       de verdad para el mismo dato, que es justo lo que prohíbe la sección 9 del CLAUDE.md. */

    // --- ANÁLISIS DE N-GRAMS ---
    // Cuántas veces debe intentar el usuario un n-gram en su historia para empezar a medirlo
    public static final int NGRAM_MIN_INTENTOS = 3;

    // 30% de error o más = N-gram débil que requiere práctica
    public static final double NGRAM_UMBRAL_ERROR = 0.30;

    // Agregamos la ventana expandida para usuarios inconstantes
    public static final int DIAS_ANALISIS_HISTORICO_BASE = 7;
    public static final int DIAS_ANALISIS_HISTORICO_EXPANDIDO = 15;
    /* Por encima de este WPM la marca deja de ser creíble y se registra para revisar.

       Los récords mundiales sostenidos rondan las 200-220 palabras por minuto, así que 250
       ya está por encima de cualquier marca humana normal en un texto largo. NO se rechaza
       la sesión: se anota en el log. Bloquear a un usuario que de verdad escribe rápido
       sería peor que revisar un puñado de casos a mano.

       El plan de producto para cuando existan rankings (V3): la marca queda fuera de las
       tablas públicas hasta que el usuario mande un video, y ahí se aprueba y se celebra —
       el control antifraude convertido en reconocimiento. Idea del usuario, 29-ago-2026. */
    public static final int WPM_SOSPECHOSO = 250;

    // --- MECANOGRAFÍA ---
    // El estándar internacional para calcular WPM asume que 1 palabra = 5 pulsaciones correctas
    public static final double CARACTERES_POR_PALABRA_WPM = 5.0;
    /* Cuantas veces se permite descartar un texto pedido como MEDIO que aterrizo en
       MEDIO_DIFICIL y pedir otro articulo en su lugar. El tope existe para que una tanda con
       articulos muy densos no gire pidiendo sustitutos: cada uno cuesta una llamada. */
    public static final int MAX_SUSTITUCIONES_MEDIO = 2;

}