package com.dedea.app.util;

import java.util.List;
import java.util.Set;

// Contenido escrito a mano para los ejercicios que no tienen una fuente de datos propia
// todavía (no hay corpus de oraciones ni de palabras confusas en la DB). Mismo espíritu
// que seed/palabras_es.txt: un set curado, chico y con licencia 100% propia.
public final class ContenidoCurado {

    private ContenidoCurado() {
        throw new UnsupportedOperationException("Clase utilitaria");
    }

    // Minúsculas, sin puntuación, 5-8 palabras cada una (ortografía correcta con tildes;
    // lo "simple" es la longitud y el vocabulario, no escribir mal a propósito).
    public static final List<String> ORACIONES_SIMPLES = List.of(
            "El perro corre por el parque.",
            "Mi hermana estudia todas las noches.",
            "El cielo está despejado y azul.",
            "Compramos pan fresco en la esquina.",
            "El tren llega siempre a tiempo.",
            "Ella cocina arroz con pollo hoy.",
            "Los niños juegan en el patio.",
            "Necesito comprar leche y huevos.",
            "El sol sale muy temprano aquí.",
            "Vamos a caminar por la playa.",
            "Mi gato duerme sobre el sofá.",
            "El profesor explica la lección otra vez.",
            "Quiero aprender a tocar guitarra.",
            "La lluvia moja las calles grises.",
            "El café está listo para servir.",
            "Ellos viajan a la montaña mañana.",
            "Mi abuela cuenta historias muy lindas.",
            "El río baja con mucha fuerza.",
            "Compramos frutas frescas en el mercado.",
            "El autobús pasa cada diez minutos.",
            "Los pájaros cantan al amanecer.",
            "Mi papá arregla el auto solo.",
            "La biblioteca cierra a las ocho.",
            "El niño pinta un dibujo bonito.",
            "Vamos a ver una película esta noche.",
            "El pan se hornea muy temprano.",
            "Mi vecino riega las plantas a diario.",
            "El equipo ganó el partido ayer.",
            "La nieve cubre toda la montaña.",
            "Quiero dormir una siesta larga.",
            "El mar se ve muy tranquilo.",
            "Mis amigos llegan el próximo lunes.",
            "El jardín tiene flores de colores.",
            "La cena estará lista pronto.",
            "El perro ladra toda la noche.",
            "Mi hermano estudia medicina en la ciudad.",
            "El viento sopla fuerte esta tarde.",
            "La tienda abre a las nueve.",
            "Ellos bailan toda la noche.",
            "El bebé duerme tranquilo en su cuna."
    );

    // Con mayúsculas y puntuación real.
    public static final List<String> ORACIONES_MAYUSCULAS = List.of(
            "El cielo está despejado hoy.",
            "María llegó temprano a la reunión.",
            "El Perú tiene playas hermosas.",
            "Juan compró un libro nuevo ayer.",
            "La Luna se ve enorme esta noche.",
            "Carlos trabaja en el centro de la ciudad.",
            "El Amazonas es el río más largo.",
            "Ana estudia Ingeniería en la universidad.",
            "El Museo Nacional abre los domingos.",
            "Pedro corre cinco kilómetros cada mañana.",
            "La Navidad se celebra en diciembre.",
            "Rosa preparó una cena deliciosa anoche.",
            "El Presidente dio un discurso importante.",
            "Lima es la capital del Perú.",
            "Los Andes cruzan todo el continente.",
            "Diego terminó su tarea antes de dormir.",
            "El Día del Trabajo es feriado.",
            "Sofía pintó un cuadro muy colorido.",
            "El Pacífico baña toda la costa.",
            "Martín aprobó su examen final.",
            "La Tierra gira alrededor del Sol.",
            "El Zoológico recibió animales nuevos.",
            "Valentina canta en el coro escolar.",
            "El Banco Central subió las tasas.",
            "Gabriel ganó el primer premio.",
            "La Feria del Libro empieza mañana.",
            "El Ministerio anunció nuevas medidas.",
            "Camila viajó a Cusco en tren.",
            "El Congreso aprobó la nueva ley.",
            "Fernando reparó la bicicleta él solo.",
            "La Cruz Roja ayudó a los heridos.",
            "El Estadio Nacional estuvo lleno ayer.",
            "Lucía adoptó un gato callejero.",
            "El Aeropuerto Jorge Chávez está muy cerca.",
            "Ricardo enseña matemáticas en el colegio.",
            "La Plaza Mayor se llenó de gente.",
            "El Hospital Central atiende las veinticuatro horas.",
            "Patricia organizó la fiesta de fin de año.",
            "El Ejecutivo firmó el nuevo decreto.",
            "Andrea ganó una beca para estudiar afuera."
    );

    /* ============================================================
       RUIDO DEL DICCIONARIO
       El corpus importado trae entradas marcadas como español que no lo son:
       nombres propios ingleses, interjecciones y abreviaturas. Se cuelan sobre
       todo en el modo de una mano, donde el conjunto de palabras posibles es
       chico y esas entradas quedan muy visibles.

       Los nombres en ESPAÑOL sí se conservan (sara, eva, julio…), igual que los
       préstamos que la RAE ya admite (web, pop, extra). Lo que sale es lo que no
       es español: john, jimmy, texas, street, y las abreviaturas sueltas.
       ============================================================ */
    public static final Set<String> PALABRAS_NO_ESPANOLAS = Set.of(
            // Nombres propios en inglés
            "john", "johnny", "jon", "jim", "jimmy", "kim", "phil", "philip", "phillip",
            "molly", "holly", "lily", "jill", "nikki", "yoon", "polly", "lou", "jin",
            "steve", "dave", "grace", "carter", "ted", "fred", "greg", "rebecca",
            "brad", "edward", "bart", "wade", "drew", "eve", "reed", "rex", "wes",
            "deb", "tess", "dee", "reese", "stewart", "dexter", "jack", "tommy", "sammy",
            // Topónimos que no son de habla hispana
            "ohio", "vegas", "texas", "west", "hill",
            // Palabras y muletillas en inglés
            "ok", "uh", "um", "you", "in", "on", "my", "ooh", "huh", "up", "monk",
            "joy", "street", "hmm", "mmm", "mm", "ohh",
            "star", "test", "get", "are", "set", "case", "we", "be",
            // Fragmentos y abreviaturas que no son palabras para teclear
            "ho", "jo", "ji", "io", "uu", "ll", "ii", "mo", "li",
            "pm", "km", "min", "tv", "sr", "st", "re", "ed",
            "ee", "er", "ra", "tae", "sra", "srta", "dr", "cd", "est"
    );

    /* ============================================================
       LAS 100 PALABRAS MÁS COMUNES DEL ESPAÑOL — lista fija, no derivada del diccionario.

       Hasta el 11-sep-2026 "Top palabras comunes" (y con él, Modo ciego y Palabras
       mutantes, que comparten el mismo generador) sacaba sus 100 palabras de
       `diccionario.frecuencia_uso` — o sea, las 100 más comunes DE ENTRE LAS QUE EL
       USUARIO YA APROBÓ en /revision-palabras, no las 100 más comunes del español. Con
       el diccionario a medio llenar eso podía devolver cualquier cosa, y aunque hoy ya
       tiene 6.904 palabras, el ejercicio prometía una cosa ("las palabras más comunes
       del español") y entregaba otra (un ranking que depende de qué se haya revisado a
       mano). Ver CLAUDE.md, bug 18 y 12.7 punto 2.

       Esta lista es la solución de fondo: fija, curada, no depende de ninguna tabla.
       Sale de cómo se reparte de verdad la frecuencia en español —dominada por
       artículos, preposiciones, conjunciones y pronombres, con algunos verbos muy
       comunes al final— y evita a propósito las formas exclusivas de España
       ("vosotros", "vosotras", "os", "vuestro"), que no se usan en el español
       latinoamericano al que apunta la app; en su lugar entran verbos frecuentes
       (hacer, decir, poder...) que ocupan ese mismo rango de frecuencia.

       El generador (`generarDesdeTop100`) no arma oraciones con esto: baraja la lista y
       sirve `PALABRAS_POR_TANDA` (30) de ellas sueltas, unidas por espacio — es
       exactamente lo mismo que ya hacía antes, solo que la fuente ahora es fija. */
    public static final List<String> TOP_100_PALABRAS_ESPANOL = List.of(
            "de", "la", "que", "el", "en", "y", "a", "los", "se", "del",
            "las", "un", "por", "con", "no", "una", "su", "para", "es", "al",
            "lo", "como", "más", "pero", "sus", "le", "ya", "o", "este", "sí",
            "porque", "esta", "entre", "cuando", "muy", "sin", "sobre", "también", "me", "hasta",
            "hay", "donde", "quien", "desde", "todo", "nos", "durante", "todos", "uno", "les",
            "ni", "contra", "otros", "ese", "eso", "ellos", "esto", "antes", "algunos", "qué",
            "unos", "yo", "otro", "otra", "él", "tanto", "esa", "estos", "mucho", "nada",
            "muchos", "poco", "ella", "algo", "nosotros", "mi", "tú", "te", "tu", "ellas",
            "usted", "hacer", "decir", "poder", "ir", "ver", "dar", "saber", "querer", "llegar",
            "pasar", "deber", "poner", "quedar", "creer", "hablar", "dejar", "seguir", "encontrar", "llamar"
    );

    /* ============================================================
       MUERTE SÚBITA — tres bancos por longitud.
       En cada uno, las últimas 5 son deliberadamente más difíciles: no más
       largas, sino con vocabulario menos común, tildes seguidas, ñ, o signos
       de apertura (¿ ¡) que obligan a teclas poco usadas.
       ============================================================ */

    // 3 a 6 palabras.
    public static final List<String> ORACIONES_CORTAS = List.of(
            "El gato duerme en el sofá.",
            "Llegamos tarde otra vez.",
            "Ana prepara el desayuno.",
            "El tren sale a las ocho.",
            "Hace mucho frío afuera.",
            "Mi vecino toca la guitarra.",
            "La puerta quedó abierta.",
            "Compré flores en el mercado.",
            "El niño perdió su pelota.",
            "Nadie contestó el teléfono.",
            "El café ya está listo.",
            "Ella escribe cartas largas.",
            "Vamos al cine esta noche.",
            "El río creció con la lluvia.",
            "Olvidé las llaves en casa.",
            "Su perro corre muy rápido.",
            "La luna salió temprano.",
            "Pintamos la pared de verde.",
            "El examen fue bastante corto.",
            "Mi abuela cocina muy bien.",
            "El reloj marca las tres.",
            "Guardé el dinero en un sobre.",
            "Los pájaros cantan al amanecer.",
            "Ese libro cuesta poco.",
            "La fiesta terminó tarde.",
            // --- las 5 difíciles ---
            "¿Quién apagó la luz?",
            "¡Qué día tan extraño!",
            "El niño añoraba su juguete.",
            "Exhibió un ímpetu inusual.",
            "¿Cuál güiro suena mejor?"
    );

    // 8 a 12 palabras.
    public static final List<String> ORACIONES_MEDIAS = List.of(
            "El vecino del quinto piso riega sus plantas cada mañana temprano.",
            "Mi hermano compró una bicicleta usada en el mercado del centro.",
            "La profesora explicó el tema dos veces para toda la clase.",
            "Guardamos las fotos viejas en una caja de madera oscura.",
            "El camión de la basura pasa los martes y los viernes.",
            "Ella terminó la novela que empezó durante las vacaciones pasadas.",
            "Los turistas caminaron por el casco antiguo toda la tarde.",
            "El panadero abre su local mucho antes de que amanezca.",
            "Encontramos un gato perdido cerca de la estación del tren.",
            "Mi padre arregla relojes antiguos en el taller del garaje.",
            "La tormenta derribó dos árboles en la avenida principal.",
            "Cada domingo mi familia se reúne para almorzar en casa.",
            "El equipo local ganó el partido en el último minuto.",
            "Ordenamos los libros por autor y después por año.",
            "El museo abre sus puertas a las diez de la mañana.",
            "Ese restaurante sirve el mejor pescado de toda la costa.",
            "Los niños construyeron un castillo enorme con arena mojada.",
            "La carta llegó tres semanas después de haber sido enviada.",
            "Mi vecina cultiva tomates y albahaca en su pequeño balcón.",
            "El profesor repartió los exámenes corregidos al final de la clase.",
            "Caminamos hasta la cima y vimos el valle completo.",
            "El músico afinó su instrumento antes de empezar el concierto.",
            "Compramos entradas para la función de las nueve de la noche.",
            "La empresa cambió su horario de atención el mes pasado.",
            "Recogimos manzanas del árbol que plantó mi abuelo.",
            // --- las 5 difíciles ---
            "¿Cuándo averiguaste que el güisqui estaba adulterado?",
            "¡Qué exquisita ambigüedad la de aquel enunciado!",
            "El arqueólogo añadió que aquella vasija era excepcionalmente frágil.",
            "Aquel jeroglífico exhibía símbolos anteriores al éxodo.",
            "¿Por qué zigzagueaba el vehículo bajo la lluvia?"
    );

    // 15 a 20 palabras.
    public static final List<String> ORACIONES_LARGAS = List.of(
            "El tren de la mañana se retrasó casi una hora por una falla en las vías del norte.",
            "Mi hermana decidió estudiar arquitectura después de visitar aquella ciudad llena de edificios antiguos y plazas amplias.",
            "Los vecinos organizaron una colecta para arreglar el techo de la escuela antes de que empiece el invierno.",
            "Aquel verano pasamos tres semanas en la costa y volvimos con las maletas llenas de conchas marinas.",
            "El panadero del barrio prepara cada madrugada más de doscientos panes que vende antes del mediodía.",
            "Cuando llegamos al mirador la niebla cubría todo el valle y apenas se veían las luces del pueblo.",
            "La biblioteca municipal amplió su horario para que los estudiantes puedan quedarse hasta bien entrada la noche.",
            "Mi padre guarda en el garaje una colección de herramientas que heredó de su propio padre.",
            "El festival de música se celebró en el parque central y reunió a miles de personas durante el fin de semana.",
            "Después de tantos años el viejo cine del centro volvió a abrir sus puertas completamente renovado.",
            "Los científicos explicaron que el fenómeno se repite cada doce años y dura apenas unas pocas horas.",
            "Caminamos por el sendero durante casi cuatro horas hasta encontrar la cascada que aparecía en el mapa.",
            "La reunión se alargó tanto que tuvimos que pedir comida para poder terminar de revisar el proyecto.",
            "Ese pintor retrató durante décadas los mismos paisajes cambiando solamente la luz y la estación del año.",
            "El equipo trabajó sin descanso toda la semana para entregar el informe antes del plazo acordado.",
            "Mi abuela conserva cartas escritas hace más de sesenta años dentro de una caja forrada de tela azul.",
            "La lluvia comenzó justo cuando terminábamos de montar la carpa y no paró en toda la noche.",
            "Los alumnos presentaron sus proyectos frente a un jurado que valoró tanto la idea como la ejecución.",
            "Aquella librería del centro sobrevivió a tres crisis distintas gracias a los clientes que la visitan cada semana.",
            "El río que atraviesa la ciudad se desbordó dos veces el año pasado y obligó a cerrar el puente.",
            "Encontramos en el desván un baúl con juguetes de madera que pertenecieron a varias generaciones de la familia.",
            "La cooperativa de agricultores decidió vender directamente sus productos para no depender de los intermediarios.",
            "Cada tarde el anciano se sienta en el mismo banco y observa a los niños jugar en la plaza.",
            "El documental mostró cómo trabajan los pescadores del sur durante los meses más duros del año.",
            "Compramos una casa antigua que necesita reformas pero conserva las vigas originales del techo.",
            // --- las 5 difíciles ---
            "¿Cuántas veces averiguaste que aquel jeroglífico exhibía símbolos anteriores al éxodo de la región?",
            "¡Qué exquisito espectáculo el de aquellos güisquis añejos exhibidos tras el vitral del vestíbulo!",
            "El arqueólogo señaló que la ambigüedad del enunciado impedía cualquier exégesis rigurosa del hallazgo.",
            "Aquel zigzagueante vehículo atravesó el desfiladero mientras la señora contemplaba el paisaje con perplejidad.",
            "¿Por qué el psicólogo insistía en que la excepción confirmaba la regla que él mismo había refutado?"
    );

    // Grupos de palabras que suenan igual o parecido y se confunden al escribir.
    public static final List<List<String>> GRUPOS_PALABRAS_CONFUSAS = List.of(
            List.of("tubo", "tuvo"),
            List.of("haya", "halla", "allá"),
            List.of("hay", "ahí", "ay"),
            List.of("vaya", "valla", "baya"),
            List.of("votar", "botar"),
            List.of("cocer", "coser"),
            List.of("echo", "hecho"),
            List.of("ves", "vez"),
            List.of("hierba", "hierva"),
            List.of("rebelar", "revelar"),
            List.of("grabar", "gravar"),
            List.of("cesión", "sesión"),
            List.of("actitud", "aptitud"),
            List.of("absolver", "absorber"),
            List.of("deshecho", "desecho"),
            List.of("errar", "herrar"),
            List.of("hola", "ola"),
            List.of("honda", "onda"),
            List.of("ora", "hora"),
            List.of("rallar", "rayar"),
            List.of("calló", "cayó"),
            List.of("malla", "maya"),
            List.of("pollo", "poyo"),
            List.of("bello", "vello"),
            List.of("baso", "vaso"),
            List.of("bienes", "vienes"),
            List.of("basto", "vasto")
    );

    /* ============================================================
       ORACIONES "UNA MANO FORZADA" — a mano, no generadas.
       El generador algorítmico (EjercicioServiceImpl.generarUnaManoForzada) solo sirve
       para PALABRAS sueltas: puntuar oraciones completas por dominancia de mano y que
       además salgan gramaticales es un problema mucho más difícil.

       Corregido el 11-sep-2026: la primera versión de este banco apuntaba "al 90%+" en
       el comentario pero en los hechos daba 100% real —medido letra por letra, las doce
       frases viejas no tenían NI UNA sola letra de la mano contraria— porque evitar el
       10% que sobra por completo es más fácil que acertarlo. El precio era el largo: sin
       un solo artículo ni conector normal ("el", "la", "un"), las frases quedaban en 4-6
       palabras y forzadas ("la hada" no cabía, tenía que ser "esa hada"). Esta versión
       apunta a situarse ENTRE 80% y 95% —medido con el mismo criterio que
       generarUnaManoForzada usa para las palabras (izquierda = "qwertasdfgzxcvb", derecha
       = "yuiophjklñnm")— y a cambio son el doble de largas (8-12 palabras): el 10-20% que
       queda libre es justo el espacio para un artículo, un conector o un nombre propio,
       que es lo que las hace sonar a español real y no a acertijo.
       ============================================================ */

    // Entre 80% y 95% de letras de "qwertasdfgzxcvb" (medido), el resto conectores normales.
    public static final List<String> ORACIONES_UNA_MANO_IZQUIERDA = List.of(
            "Esa garza gris cazaba cerca de la charca.",
            "Trae fresas frescas y trazas extra para la fiesta.",
            "Gasta esa grasa vieja y crea una receta distinta.",
            "Esa ave se acerca de veras a la cerca alta.",
            "Trazas esa carta con letras extra grandes y claras.",
            "Esa cabra ataca de veras a la parra reseca.",
            "Esa gata gris se aferra a la rama seca.",
            "Esa yegua gris pasta cerca de la vasta pradera.",
            "Vaga esa rata gris cerca de la cerca vieja.",
            "Trazas la ruta exacta para cruzar esa vasta selva."
    );

    // Entre 80% y 95% de letras de "yuiophjklñnm" (medido), el resto conectores normales.
    public static final List<String> ORACIONES_UNA_MANO_DERECHA = List.of(
            "Hoy mi hijo hiló un hilo fino y lo llevó al molino.",
            "Mi hijo unió un hilo con el moño y lo colgó allí.",
            "Un mono huyó y lo oí subir por el molino.",
            "Julio pulió mi moño y lo dejó liso hoy mismo.",
            "Un mono mulló mi moño y lo dejó mullido.",
            "Un niño unió mi moño y huyó con mi limón.",
            "Julio molió mi limón y lo puso en el molino.",
            "Mi pulmón dolió un poco y lo sintió Julio hoy.",
            "Julio subió al molino y olió mi limón maduro.",
            "Julio y un niño unió mi moño con un hilo fino."
    );

    /* ============================================================
       PALABRAS DE LA LÍNEA INFERIOR (Básico) — a mano, no generadas.
       La fila inferior (z x c v b n m , ; .) no tiene ninguna vocal: "palabra hecha solo
       con esa fila" es matemáticamente imposible, así que este ejercicio es de
       ORACIONES, no de palabras (a diferencia de central/superior, que sí generan
       palabras completas vía diccionario). Regla del usuario: mínimo 90% de las
       CONSONANTES de la oración (sin contar vocales ni espacios) pertenecen al set
       de esa fila — la coma, el punto y coma y el punto cuentan porque viven ahí
       físicamente. Mismo espíritu que ORACIONES_UNA_MANO_*: apuntar a 90%+ real y
       sonar natural es difícil a la vez, así que esto es un banco chico pensado para
       ampliarse, no para generarse solo.
       Los 4 temas de la guía de contenido (datos curiosos / Perú y Latam / mecanografía
       / literatura) NO entran acá: con solo z x c v b n m como consonantes permitidas,
       ni un nombre propio latinoamericano ni vocabulario de teclado sobreviven al 90%
       sin sonar forzado. Se prioriza que suene español natural, con temática libre
       (animales y vida diaria, que es donde más rinde el set de letras disponible). */
    public static final List<String> ORACIONES_LINEA_INFERIOR = List.of(
            "Un mono vive en una cueva.",
            "Come una manzana, una banana y avena.",
            "Un vecino combina cacao con avena.",
            "Nueve monos comen, se mueven y vuelven a comer.",
            "Un mono se mueve en una cueva.",
            "Una vacuna nueva convence, y a nadie le conviene ocultarlo.",
            "Amanece con una nube nueva.",
            "Cinco vacas comen avena, cebada y cacao.",
            "Un mono convence a su vecino.",
            "Una vaca come avena con cebada.",
            "Una vaca convive con un mono.",
            "Un mono nuevo convive con nueve vacas.",
            "Una vecina cocina con avena, cacao y canela.",
            "Un vecino conoce mi cine.");

    /* ============================================================
       BANCOS TEMÁTICOS DEL CURSO (Intermedio y Avanzado) — ver docs/guia_contenido_curso.md
       para los parámetros de dificultad y el reparto de temas. Todos alimentan
       ORACIONES_TEMATICAS o RESISTENCIA vía configuracion.banco (ver
       generarOracionesTematicas / generarResistencia en EjercicioServiceImpl).
       ============================================================ */

    // Intermedio: mayúsculas + coma/punto — foco en la coma (listas y aclaraciones).
    public static final List<String> ORACIONES_INTERMEDIO_SIGNOS = List.of(
            "El corazón humano late, en promedio, cien mil veces al día.",
            "Cusco, Arequipa y Trujillo son ciudades muy visitadas en el Perú.",
            "El pulpo tiene tres corazones, y uno de ellos deja de latir al nadar.",
            "Los Andes cruzan Perú, Bolivia, Chile y Argentina, entre otros países.",
            "Escribir rápido, con precisión y sin mirar el teclado, toma meses de práctica.",
            "El río Amazonas nace en Perú y desemboca, muchos kilómetros después, en Brasil.",
            "Cervantes escribió que la libertad, decía Don Quijote, es uno de los dones más preciados.",
            "Las abejas se comunican bailando, y ese baile indica dirección, distancia y alimento.",
            "En México, Colombia y Perú se hablan, además del español, decenas de lenguas originarias.",
            "Bécquer escribió que, mientras exista poesía, existirá quien la sienta y quien la escriba.",
            "La Luna se aleja de la Tierra, poco a poco, unos centímetros cada año.",
            "El maíz, la papa y el cacao son, todos, originarios de América.",
            "Martí escribió que un pueblo culto, decía él, será siempre libre."
    );

    /* NUEVO el 11-sep-2026, para "Contrarreloj (Intermedio)" y "Contrarreloj rápido
       (Intermedio)". Los dos nodos no tenían `banco` en su config —ni `fila` ni `patron`
       tampoco—, así que el switch de CONTRARRELOJ caía a `ORACIONES_SIMPLES`, el banco
       genérico anterior a la guía de contenido ("El perro corre por el parque."). Los dos
       comparten este banco a propósito: la diferencia entre ambos nodos es solo el reloj
       (30s contra 15s), nunca el contenido — mismo criterio que ya usa Básico para sus
       propios pares de Contrarreloj.
       Mayúscula inicial, coma y punto libres (ya se enseñan en o3 y o9); sin ¿?¡!, que es
       terreno exclusivo de "Oraciones con interrogación y exclamación". Los 4 temas de la
       guía, mezclados. */
    public static final List<String> ORACIONES_INTERMEDIO_GENERAL = List.of(
            "El corazón de un colibrí late tan rápido que apenas se puede contar, incluso en cámara lenta.",
            "El lago Titicaca, compartido entre Perú y Bolivia, es uno de los lagos navegables más altos del mundo.",
            "Escribir sin mirar el teclado parece imposible al principio, pero con práctica diaria se vuelve automático.",
            "Cervantes describió a un hidalgo que, de tanto leer, terminó por confundir la realidad con sus libros.",
            "Las abejas recuerdan rostros humanos, algo que sorprendió incluso a los científicos que las estudiaron.",
            "La selva amazónica se extiende por nueve países, y Perú alberga una parte considerable de ella.",
            "Cada dedo tiene asignadas ciertas teclas, y respetar ese reparto es la base de escribir rápido.",
            "Don Quijote y Sancho Panza recorrieron caminos polvorientos, discutiendo sobre justicia, honor y locura.",
            "Un día en Venus dura más que un año completo, algo difícil de imaginar desde la Tierra.",
            "Machu Picchu recibe visitantes de todo el mundo, atraídos por su historia y su ubicación entre montañas.",
            "La velocidad llega sola cuando la precisión ya es sólida, nunca al revés.",
            "Bécquer escribió que las golondrinas volverían, aunque distintas, a colgar sus nidos en el mismo balcón."
    );

    /* NUEVO el 13-sep-2026, para "Contrarreloj (Intermedio)". Antes servía 6 oraciones de
       ORACIONES_INTERMEDIO_GENERAL concatenadas con espacio: seis ideas de temas distintos,
       sin relación entre sí, y el usuario lo notó — "son varios textos", no un texto. Acá
       cada ítem YA ES el ejercicio entero (cantidad:1 en el sembrado, mismo trato que
       basico_relajo/basico_qwerty): un solo párrafo cohesivo de 33 a 37 palabras, sobre
       un único tema de principio a fin. "Contrarreloj rápido (Intermedio)" se queda con
       ORACIONES_INTERMEDIO_GENERAL tal cual — es el que sí busca la sensación de "aguantar
       o caer" contra varias ideas sueltas y menos tiempo. */
    public static final List<String> ORACIONES_INTERMEDIO_CONTRARRELOJ = List.of(
            "El colibrí puede batir sus alas más de cincuenta veces por segundo, algo que ningún otro ave logra hacer. Gracias a ese movimiento, es capaz de quedarse suspendido en el aire, e incluso puede volar hacia atrás.",
            "Machu Picchu se construyó en lo alto de la cordillera andina, sin usar ruedas ni animales de carga como los caballos. Los incas transportaban piedras enormes usando rampas, cuerdas y mucha mano de obra.",
            "El lago Titicaca, compartido entre Perú y Bolivia, es considerado el lago navegable más alto del mundo. Sus aguas frías esconden una gran variedad de especies únicas que no existen en ningún otro lugar.",
            "El pulpo tiene tres corazones y sangre de color azul, algo muy distinto al resto de los animales marinos. Cuando nada, uno de esos corazones deja de latir, por eso prefiere caminar por el fondo.",
            "Cervantes escribió que un hidalgo, de tanto leer libros de caballería, terminó por confundir la realidad con lo que había leído. Así comienza una de las historias más recordadas de toda la literatura en español.",
            "Las abejas se comunican entre ellas por medio de un baile especial, que indica con precisión la dirección y la distancia hasta una fuente de alimento. Los científicos llevan décadas estudiando este comportamiento sin dejar de sorprenderse.",
            "El río Amazonas nace en los Andes peruanos y recorre miles de kilómetros antes de desembocar en el océano Atlántico. A lo largo de su curso, atraviesa selvas donde vive una enorme cantidad de especies distintas.",
            "Bécquer escribió que las golondrinas volverían cada año a colgar sus nidos en el mismo balcón, pero que algunas cosas, una vez que se van, ya no regresan de la misma manera. Sus versos siguen leyéndose hoy."
    );

    /* NUEVO el 11-sep-2026, para "Práctica de signos" — que hasta hoy generaba pseudo-tokens
       al azar mezclando `; .` con `a s d f j k l` (`a;j`, `.kl`), sin ninguna oración real.
       El punto no necesita este tratamiento —ya se enseña dentro de cualquier frase, en
       Básico y en cada banco de Intermedio— pero el punto y coma sí: es la primera vez que
       el Curso lo toca, y es además una tecla que MUCHA gente adulta nunca aprendió a usar
       bien en su propio idioma, no solo a teclear. Por eso el nodo pasó de símbolos sueltos
       a gramática real: cada oración usa un `;` de verdad, uniendo dos ideas relacionadas sin
       conector (o, en una, separando ítems de una lista que ya tiene comas adentro — el otro
       uso clásico). Pedido explícito del usuario: no importa si además hay comas en la misma
       oración. Ver `puntoYComaObligatorio` en CursoPracticaView — cada `;` bloquea el avance
       hasta acertarlo, y si falla antes de lograrlo, SÍ cuenta como error (al revés que la
       primera mayúscula, que es gratis): el gesto ya se explica en el panel, así que fallar
       después de verlo si se cobra. */
    public static final List<String> ORACIONES_INTERMEDIO_PUNTOYCOMA = List.of(
            "El pulpo tiene tres corazones; dos bombean sangre hacia las branquias y uno hacia el resto del cuerpo.",
            "Cusco fue la capital del imperio inca; hoy sigue siendo uno de los destinos más visitados de Sudamérica.",
            "No hace falta escribir rápido desde el primer día; la velocidad llega sola cuando la precisión ya está firme.",
            "Cervantes no buscaba burlarse de los libros de caballerías; quería mostrar qué pasa cuando la ficción reemplaza a la realidad.",
            "Las tortugas marinas regresan a la misma playa donde nacieron; recorren miles de kilómetros para lograrlo.",
            "El Amazonas nace en los Andes peruanos; atraviesa después Brasil hasta llegar al océano Atlántico.",
            "El dedo meñique es el más débil de la mano; por eso sus teclas piden un movimiento más cuidadoso.",
            "Bécquer escribía sobre el amor y la pérdida; sus rimas siguen leyéndose más de un siglo después.",
            "Un rayo puede calentar el aire a su alrededor más que la superficie del Sol; por eso se escucha el trueno.",
            "Visitamos Lima, la capital; Arequipa, la ciudad blanca; y Puno, a orillas del Titicaca.",
            "Mirar el teclado corta el ritmo; mantener la vista en la pantalla lo sostiene.",
            "El hidalgo perdió la razón leyendo novelas de caballería; su sobrina y el cura decidieron quemar su biblioteca.",
            /* Agregadas el 15-sep-2026, a pedido del usuario: que también entre alguna coma
               junto al punto y coma, sin que eso afloje el uso gramatical del `;`. Las dos
               siguen el mismo patrón que ya tenía "Visitamos Lima, la capital; Arequipa...":
               una coma dentro de una de las cláusulas, el `;` separando las dos completas. */
            "El profesor explicó el tema con calma, sin apurar a nadie; al final, todos entendieron mejor.",
            "Llovía con fuerza, el viento no paraba; aun así, decidimos salir a caminar."
    );

    // Intermedio: tildes y ñ sin límite, a propósito.
    public static final List<String> ORACIONES_INTERMEDIO_TILDES = List.of(
            "Mi hermano compró un camión último modelo para su compañía.",
            "El águila voló rápido hacia la montaña más alta del cañón.",
            "José y María caminarán mañana hasta el jardín botánico.",
            "El bebé durmió tranquilo después de tomar su biberón tibio.",
            "La araña tejió su telaraña cerca del limón y la piña.",
            "Según cuentan, el cóndor andino puede volar sin batir las alas por horas.",
            "El pingüino emperador soporta temperaturas árticas increíblemente bajas.",
            "Mañana iré a comprar café, azúcar y también un poco de miel.",
            "La niña pequeña señaló el árbol más alto del jardín.",
            "El músico afinó su guitarra antes del concierto en el auditorio.",
            "Según la leyenda, el volcán despertó después de más de un siglo dormido.",
            "El camarógrafo grabó un video sobre la migración de las águilas.",
            "La compañía anunció que el próximo año abrirá una sucursal más.",
            // Sumadas el 13-sep-2026, apuntando a más tildes por oración sin forzar
            // ninguna — verificadas letra por letra después de un error real (tilde de
            // más en "varías" cuando correspondía "varias" sin tilde).
            "El cóndor voló días enteros sobre la cordillera sin bajar jamás hasta el río.",
            "María recordó que también había un río cerca de la última estación del tren.",
            "El músico tocó una melodía tan mágica que nadie olvidó jamás aquella función.",
            "Según cuentan, allí vivía un águila que volaba más alto que cualquier cóndor.",
            "El río Amazonas nació muy lejos de aquí, pero su caudal también llegó hasta acá.",
            "El violín sonó tan bien que hasta los músicos más exigentes quedaron sorprendidos."
    );

    // Intermedio: ¿? ¡! — oraciones cortas.
    public static final List<String> ORACIONES_INTERMEDIO_EXCLAMACION = List.of(
            "¿Sabías que el corazón de una ballena azul pesa como un auto pequeño?",
            "¡Qué increíble es ver un cóndor volando sobre los Andes!",
            "¿Cuántas estrellas puede ver a simple vista una persona en una noche despejada?",
            "¡Cuidado con el escalón, está un poco resbaloso!",
            "¿Por qué el cielo se ve azul durante el día?",
            "¡Qué rico huele el café recién hecho por la mañana!",
            "¿Sabías que Perú tiene más de tres mil variedades de papa?",
            "¡Vamos a llegar tarde si no salimos ahora mismo!",
            "¿Alguna vez viste un colibrí volando hacia atrás?",
            "¡Qué hermoso se ve el atardecer desde aquí!",
            "¿Cuántos idiomas se hablan en toda Latinoamérica?",
            "¡Practica todos los días y notarás la diferencia enseguida!",
            "¿Sabías que escribir sin mirar el teclado se llama mecanografía al tacto?"
    );

    // Intermedio: oraciones armadas con palabras largas/complejas a propósito.
    public static final List<String> ORACIONES_INTERMEDIO_PALABRAS_LARGAS = List.of(
            "La internacionalización de las empresas peruanas creció mucho en la última década.",
            "El desenvolvimiento del bebé sorprendió a todos los especialistas presentes.",
            "La responsabilidad y la perseverancia son características admirables en cualquier persona.",
            "El extraordinario paisaje andino atrae a miles de turistas cada año.",
            "La biodiversidad amazónica es considerada una de las más impresionantes del planeta.",
            "Su comportamiento extraordinariamente generoso sorprendió a todos los vecinos.",
            "La electroencefalografía permite observar la actividad eléctrica del cerebro humano.",
            "El desarrollo socioeconómico de la región avanzó considerablemente este año.",
            "La impresionante arquitectura incaica sigue asombrando a arqueólogos e historiadores.",
            "Aquella extraordinaria hazaña deportiva quedará en la memoria de todos.",
            "La transformación digital cambió radicalmente la forma de comunicarnos.",
            "El descubrimiento arqueológico revolucionó por completo la historia conocida."
    );

    // Avanzado: números, fechas, importes — símbolos y puntuación compuesta.
    public static final List<String> ORACIONES_AVANZADO_NUMEROS = List.of(
            "La reunión quedó fijada para el 15 de marzo de 2026, a las 10:30 a.m.",
            "El pedido #4521 tiene un total de S/ 458.90, incluido el IGV (18%).",
            "Machu Picchu fue declarado Patrimonio de la Humanidad en 1983 por la UNESCO.",
            "El vuelo 302 sale a las 06:45 y llega, aproximadamente, a las 09:15.",
            "La factura N.º 00231 vence el 30/04/2026; el monto es de $1,250.00.",
            "El Imperio incaico llegó a controlar más de 4,000 km de territorio andino.",
            "El evento reunió a 3,200 asistentes, un 15% más que el año anterior (2025).",
            "El contrato #A-119 se firmó el 02/01/2026, con vigencia de 24 meses.",
            "La inflación cerró en 3.4%, según el reporte del BCR correspondiente a enero.",
            "El maratón de Lima 2026 tendrá salida a las 06:00 en punto.",
            "El presupuesto asignado fue de S/ 12,500,000 para el periodo 2025-2026.",
            "La cordillera de los Andes supera, en algunos tramos, los 6,000 metros de altura."
    );

    // Avanzado: registro formal/burocrático, deliberadamente denso ("tedioso").
    public static final List<String> ORACIONES_AVANZADO_TEDIOSAS = List.of(
            "Por medio de la presente, se comunica que el plazo de entrega ha sido reprogramado.",
            "El suscrito deja constancia de haber recibido conforme la totalidad de los documentos solicitados.",
            "Se solicita, respetuosamente, la revisión exhaustiva del expediente antes de la fecha límite establecida.",
            "El presente informe tiene por finalidad exponer, de manera detallada, los resultados obtenidos durante el periodo evaluado.",
            "En cumplimiento de lo dispuesto en el reglamento interno, se procede a notificar la resolución correspondiente.",
            "La presente comunicación tiene carácter meramente informativo y no constituye compromiso contractual alguno.",
            "Se deja expresa constancia de que las condiciones descritas están sujetas a modificación sin previo aviso.",
            "El área correspondiente deberá remitir, a la brevedad posible, la documentación pendiente de sustentación.",
            "De conformidad con lo establecido, se procederá a la evaluación en un plazo no mayor a treinta días hábiles.",
            "Se agradece de antemano la atención prestada a la presente solicitud y su pronta respuesta."
    );

    // Avanzado: préstamos del inglés en tono relajado (uso cotidiano, no técnico puro).
    /* Datos sobre el propio teclado, para el nodo que abre el cierre de Básico.

       Sale de mirar cómo TypingClub evita que su fila inferior —37 lecciones, la sección
       más larga de su curso— se vuelva un desierto de consonantes: intercala tarjetas de
       lectura, entre ellas una llamada "History of QWERTY".

       Acá se hace al revés y sale mejor: ellos te MUESTRAN el dato, DEDEA te lo hace
       ESCRIBIR. Misma variedad, ninguna mecánica nueva, y encaja con "datos curiosos", que
       ya es uno de los cuatro temas de docs/guia_contenido_curso.md.

       ⚠️ REESCRITO el 11-sep-2026, dos veces el mismo día. Los dos textos originales
       —de cuándo el nodo cerraba el nivel, DESPUÉS de "Fila de números"— usaban `1873`
       (el año del patentado) y no tenían nada que ver entre sí: uno explicaba el origen,
       el otro hablaba de la fila de reposo en general. El usuario reordenó el cierre para
       que este nodo vaya PRIMERO —antes de que se enseñen los dígitos—, así que el `1873`
       se sacó, y pidió además que los DOS textos hablen del mismo tema que el título: por
       qué se llama qwerty. El segundo pasó a explicar que el mismo truco de nombrar el
       teclado por sus primeras letras da nombres distintos en otros idiomas (azerty en
       francés, qwertz en alemán), en vez de la fila de reposo, que no tiene que ver con
       el nombre.

       Cada texto es TODO el ejercicio (`cantidad:1`, no `porTandas`): antes servía los DOS
       seguidos como si fueran una sola tanda larga —619 caracteres, el nodo más largo del
       nivel por 2,5×— y al terminar el primero aparecía el segundo sin que nadie lo
       pidiera. "Texto largo" para el usuario significa uno que llene la vista sin
       pasarse: unas 65 a 70 palabras cada uno, no la suma de los dos.

       Verificadas letra por letra: usan las tres filas completas, tildes, mayúscula
       inicial y solo coma y punto — todo lo que ya se enseñó al terminar la fila inferior.
       CERO dígitos a propósito: el nodo va antes de "Fila de números" en el orden nuevo. */
    /* EL TEXTO DE RELAJO del bloque 3, y la razón de que suene distinto a todo lo demás.

       Va ANTES de que se enseñen la b y la n (orden 26), y eso deja fuera "no", "en", "un",
       "una", "con", "sin", "tiene", todo verbo en plural (-an, -en), todo adverbio en -mente
       y toda palabra en -ción. Cada texto está verificado carácter a carácter contra ese
       conjunto.

       ⚠️ Los textos esquivan además la z y la x, y desde el 9-sep-2026 eso es conservador de
       más: el nodo se movió al orden 25, o sea DESPUÉS de "Fundamentos: z x". Se dejan como
       están porque son las dos letras más raras del idioma (3% entre las dos) y reescribir
       cinco textos para meterlas no compra nada.

       Y por eso son LARGOS —190 a 210 caracteres— y no frases de 4 a 7 palabras como pide la
       guía para Básico: probado, con frases cortas sobrevive una de cada tres, porque una
       sola palabra prohibida mata la frase entera. Con doscientos caracteres hay espacio
       para rodearla. Es la excepción de longitud mejor fundada del nivel.

       El punto tampoco existe todavía —es tecla del anular derecho, orden 24—, así que van
       separados por comas. La mayúscula inicial es deliberada: el nodo trae el tutorial de
       Shift, que enseña a pulsar la mayúscula con el shift de la mano contraria.

       ⚠️ Este comentario decía "es la primera y única mayúscula de todo Básico" — ya
       mentía desde el 10-sep-2026 (ocho nodos la traían) y con lo del 11-sep-2026 (6.19:
       LINEA_BASE y TECLAS_NUEVAS suman mayúscula) miente todavía más: hoy los DIEZ bancos
       de frases del nivel la traen. Corregido al toparse con él, por la regla de la
       sección 9 — no queda ningún banco de Básico sin mayúscula inicial que citar acá.

       Lo que NO puede aparecer, aunque se busque: pantalla, escribir, aprender, mano, cien,
       también, número. Si alguien agrega un texto acá, tiene que verificarlo igual. */
    /* LOS DOS EXAMENES DE BASICO. Uno solo por banco a proposito: la decision ya tomada es
       que sean UN texto y no una tanda de frases sueltas, porque un examen tiene que ser el
       mismo para todos y comparable consigo mismo entre intentos.

       Ninguno lleva tilde, y no es descuido: estan REDACTADOS para esquivar las palabras
       que la necesitan, en vez de escribirlas mal.

       ⚠️ La mitad de esto ya era falsa antes de hoy: los dos textos YA arrancan con
       mayúscula ("Antes de que...", "Escribir al tacto...") pese a que el comentario decía
       "Tampoco llevan mayúsculas: Shift es de Intermedio" — nunca se actualizó. Lo único
       que sigue siendo cierto es que esquivan la tilde, aunque la razón ya no aplica:
       Básico SÍ enseña la tecla de acento desde el 10-sep-2026 ("Oraciones con tilde",
       o17). No se tocó el contenido de los exámenes en esta pasada porque cambiar las
       palabras de un test es una decisión de contenido aparte, no una corrección de
       comentario — queda anotado para decidir si conviene sumarles tilde también.

       Los dos usan las tres filas, la coma y el punto, e incluyen la z y la x (empezar,
       experta, destreza, exige), que son las teclas que el nivel ensena mas tarde y peor. */
    public static final List<String> TEXTO_TEST_FINAL_BASICO = List.of(
            "Antes de que existiera el teclado, cada copia de un documento se copiaba a "
                    + "mano, letra por letra, y un solo error obligaba a empezar la hoja de nuevo. "
                    + "Hoy una persona experta escribe en una hora lo que antes costaba una jornada "
                    + "entera de pluma y tinta.");

    /* Mas largo que el final, y esa es la diferencia importante: este lo hace gente que ya
       teclea rapido y lo terminaria en treinta segundos, donde el WPM se infla un 18% (ver
       CLAUDE.md 10.2). Ademas MUESTREA en vez de examinar: no puede apoyarse en nada que el
       curso ensenara, porque quien lo hace puede no haber abierto un solo nodo. */
    public static final List<String> TEXTO_TEST_NIVEL_BASICO = List.of(
            "Escribir al tacto es una destreza que exige calma y se construye despacio. El "
                    + "secreto no es mover los dedos con prisa sino no mirar el teclado, dejar que la "
                    + "mano recuerde el camino y volver siempre a la fila de reposo. Quien lo logra "
                    + "deja de pensar en las teclas y empieza a pensar en lo que quiere decir, que es "
                    + "para lo que sirve. La velocidad llega luego, sola, como consecuencia.");

    /* EL EXAMEN DE INTERMEDIO (18-sep-2026). Cuatro textos y se sirve UNO al azar en cada
       intento —también al recargar—, pedido del usuario: el examen se repite hasta aprobarlo,
       y con un solo texto se termina tecleando de memoria. Dos maravillas y dos de
       tecnología, ~85 palabras cada uno (unos 3 minutos a los 32 WPM del nivel).

       Cada uno junta lo que el nivel enseña: mayúsculas y siglas, tildes, coma, punto y
       coma, ¿? y ¡!, y números (años, decimales, un porcentaje). Los datos son reales y se
       revisaron uno por uno: la persona los lee mientras teclea.

       Ortografía según la RAE, y por eso se ven raros a primera vista: los números de cinco
       cifras o más van con espacio ("13 000", "17 000"), los de cuatro sin nada ("5000",
       "2430"), no se mezclan cifras con la palabra "mil" ("17 mil" es incorrecto; "13 000
       millones" sí, porque "millón" es un sustantivo) y el signo de porcentaje va separado
       de la cifra ("5 %"). */
    public static final List<String> TEXTO_TEST_FINAL_INTERMEDIO = List.of(
            "¿Sabías que Machu Picchu se construyó hacia 1450, por orden del inca Pachacútec? "
                    + "Está a 2430 metros sobre el nivel del mar, y muchos de sus muros encajan tan "
                    + "bien que no necesitaron mortero. Los conquistadores españoles nunca la "
                    + "encontraron; en 1911, Hiram Bingham la dio a conocer al mundo, guiado por "
                    + "campesinos de la zona. En 1983 la UNESCO la declaró Patrimonio de la Humanidad "
                    + "y, en 2007, fue elegida una de las siete nuevas maravillas del mundo. ¡Nada mal "
                    + "para más de 500 años de historia!",
            "El telescopio James Webb despegó el 25 de diciembre de 2021. Su espejo principal "
                    + "mide 6,5 metros y está formado por 18 piezas hexagonales cubiertas de oro; como "
                    + "no cabía en el cohete, viajó plegado y se abrió en el espacio. Hoy trabaja a 1,5 "
                    + "millones de kilómetros de la Tierra, protegido del Sol por un escudo del tamaño "
                    + "de una cancha de tenis. ¿Para qué tanto esfuerzo? Para ver galaxias cuya luz "
                    + "salió hace más de 13 000 millones de años. ¡Es como mirar el pasado!",
            "El canal de Panamá se inauguró el 15 de agosto de 1914 y une dos océanos en unos 80 "
                    + "kilómetros. Como el terreno es más alto que el mar, los barcos suben por "
                    + "esclusas hasta el lago Gatún, a 26 metros de altura, y luego bajan del otro "
                    + "lado; el cruce dura entre 8 y 10 horas. Por él pasa cerca del 5 % del comercio "
                    + "marítimo del mundo. ¿Y antes? Ir por mar de Nueva York a San Francisco "
                    + "obligaba a rodear toda Sudamérica. ¡Más de 100 años y sigue sorprendiendo!",
            "En 1946 se presentó ENIAC, una de las primeras computadoras electrónicas. Pesaba "
                    + "unas 27 toneladas, ocupaba una sala entera y usaba más de 17 000 tubos de "
                    + "vacío; podía hacer 5000 sumas por segundo, una velocidad asombrosa para su "
                    + "época. Hoy, un teléfono que cabe en el bolsillo hace miles de millones de "
                    + "operaciones en ese mismo segundo. ¿Lo más curioso? Buena parte de su "
                    + "programación la hicieron seis mujeres, cuyo trabajo tardó décadas en ser "
                    + "reconocido. ¡La historia de la informática también lleva sus nombres!");

    /* LA TILDE, que hasta ahora Basico exigia sin ensenar nunca.

       La guia de contenido pide tildes en el 10% de las oraciones del nivel, y varios bancos
       ya las traian; pero no habia ningun nodo que presentara la tecla. El acento es una
       TECLA MUERTA: pulsada sola no escribe nada, y quien no lo sabe la pulsa dos veces y le
       salen dos acentos seguidos. Ese gesto hay que ensenarlo, no suponerlo.

       Va en la fila superior, justo despues de "Fundamentos: t y", porque la tecla del
       acento vive ahi (a la derecha de la Ñ) y porque a partir de aqui el resto del nivel
       puede usar tildes sin mentir.

       ⚠️ RESTRICCION DURA: en el orden 17 solo existen la fila central y la superior. Nada
       de b c m n v x z, y tampoco el punto (anular derecho, orden 24). Cada frase esta
       verificada caracter a caracter contra ese conjunto — de las 1.298 palabras acentuadas
       del diccionario, 278 son tecleables aqui, que es material de sobra.

       SON LARGAS —de 7 a 11 palabras, contra las 4-7 que pide la guia para Basico— y es
       a proposito. Sin punto ni coma, encadenar seis frases cortas da un parrafo corrido
       donde no se ve donde acaba una y empieza la otra: se lee como un muro. Con tres
       frases largas servidas DE A UNA (ver porTandas) cada una es una unidad completa y
       el corte lo marca el ejercicio, no la puntuacion que todavia no existe. */
    /* DOS TEXTOS, no doce datos sueltos.

       Antes eran doce frases inconexas de las que se servian seis al azar: 446
       caracteres, el nodo mas largo del nivel con diferencia (casi cinco minutos a 18
       WPM, el doble que cualquier otro), y sin orden de lectura porque cada frase era
       un dato independiente. Ahora cada texto cuenta una cosa entera, con principio y
       final, y el nodo se sirve en tandas.

       Se explican los terminos la primera vez que aparecen: antes 'varillas' salia en
       dos frases sin decir nunca que eran. Y desaparecio 'virgulilla', que casi nadie
       conoce y estaba en el dato mas flojo de los doce.

       ⚠️ VA DESPUES DE 'Fila de numeros' por el 1873: cuatro digitos que hasta ese nodo
       no se han ensenado. Es ademas el primer sitio del nivel donde las cifras se usan
       dentro de una frase y no como drill. */
        /* REESCRITO el 11-sep-2026: encadenar 4 de estas con un simple espacio (sin
           `porTandas`, ver generarOraciones) daba un texto corrido sin ningún punto entre
           frases — "no sería mejor una sola oración más larga", dijo el usuario, y tenía
           razón. Ahora cada ítem YA ES el ejercicio entero (`cantidad:1`, mismo trato que
           basico_relajo y basico_qwerty), de 19 a 22 palabras.

           Siguen usando SOLO letras de fila central + superior (a s d f g h j k l ñ q w e
           r t y u i o p — el nodo va antes de la fila inferior) y mayúscula inicial, como
           ya traía el banco. Las tildes sí entran: el nodo llega después de "Oraciones con
           tilde" (orden 17). Sin esas siete consonantes (b c m n v x z) el vocabulario
           natural es muy limitado —nada de "en", "con", "también"— así que salen todas
           del mismo registro de vida diaria y oficios que ya tenía el banco viejo; no hay
           margen para variar más de tema sin salirse de las dos filas.

           SIN PUNTO FINAL, y no es un descuido: el punto se enseña recién en "z x" (orden
           24). Lo detectó AuditoriaFugasBasicoTest el 18-sep-2026 — la reescritura del
           11-sep había dejado un punto al final de las diez. */
        public static final List<String> ORACIONES_BASICO_DOS_FILAS = List.of(
            "El pastor guardó su tejido hasta que llegó el otoño y luego lo dejó listo para el taller de la sastre",
            "El profesor salió tarde de la sala de estudio y se quedó a apagar el farol hasta que llegó la fiesta",
            "Su tía guardó la olla y la sopa hasta que llegó la hora justa de la fiesta que esperará todo el taller",
            "El perro sigue a su dueño hasta la puerta y luego se queda quieto al lado del farol de la sala",
            "Aquel día la aldea guardó su agua hasta que llegó la hora justa de regar el taller y la sala",
            "El sastre arregló la puerta del taller y guardó su tela hasta que llegó la hora de la fiesta de la aldea",
            "El hijo guardó su reloj y salió justo a la hora hasta que llegó a la sala de estudio de la aldea",
            "Su hija guardó la toalla y la olla hasta que llegó su tía a la puerta de la sala",
            "El pastor salió a pasear su perro hasta la puerta de la aldea y luego guardó la olla y la sopa lista",
            "La sastre guardó su tela y su hilo hasta que llegó la hora justa para el traje de la fiesta");

        /* NUEVO el 11-sep-2026, para "Contrarreloj: las tres filas" (orden 35). Antes ese
           nodo usaba `"patron":"^[a-zñ]+$"` — cualquier palabra del diccionario — y salía
           una lista de palabras sueltas en vez de un texto: "son puras palabras, debe ser
           un texto largo", dijo el usuario. Con las tres filas ya no hay restricción de
           letras (entran b c m n v x z, la fila inferior), así que acá sí hay margen para
           los cuatro temas de la guía de contenido. Tres textos largos, uno por tema —
           dato curioso, Perú/mundo, literatura de dominio público— siguiendo el mismo
           molde que ORACIONES_BASICO_RELAJO: cada ítem es el ejercicio entero
           (`cantidad:1`), con punto entre sus propias oraciones internas. */
        public static final List<String> ORACIONES_BASICO_TRES_FILAS = List.of(
            "El corazón de un colibrí late más de mil veces por minuto mientras vuela buscando néctar entre las flores. Aun así logra descansar cada noche bajando su ritmo casi a la mitad.",
            "En los Andes peruanos los agricultores todavía usan terrazas construidas hace siglos para sembrar maíz y papa en las laderas más empinadas de la montaña. El sistema conserva el agua y evita que la tierra se pierda con la lluvia.",
            "Había una vez un zorro astuto que prometía cuidar el gallinero durante la noche a cambio de un lugar cálido para dormir. Los animales del corral aceptaron sin saber que el zorro solo buscaba la cena perfecta.");

    /* LA FILA CENTRAL, EN COMBINACIONES CORTAS. Alimenta el Contrarreloj del bloque 1
       (orden 9), que sirve sobre todo PALABRAS sueltas del diccionario y mete tres de
       estas entre medias.

       El nodo pasó por las dos formas antes de llegar a esta. Primero era una lista pelada
       de palabras, igual que el nodo 8 que tiene encima: dos nodos seguidos pidiendo lo
       mismo y el segundo con un reloj. Después fueron seis frases enteras encadenadas, y
       eso trajo dos problemas que el usuario vio en pantalla: se servían pegadas y sin
       puntuación (`...dadas a la hada La alhaja falsa halaga Haga la lasaña...`, imposible
       de leer) y cada frase traía su mayúscula, o sea cinco Shift de más en un nodo donde
       la mayúscula se enseña una sola vez. Hoy: palabras sueltas, tres combinaciones para
       que aparezca algo que suene a lengua, y UNA mayúscula, la de la primera palabra del
       texto, que la pone el generador.

       ⚠️ LA ÚNICA VOCAL DISPONIBLE ES LA `a`. En `a s d f g h j k l ñ` no hay ninguna otra,
       así que no existe ni un verbo en plural (todos acaban en -n), ni artículo masculino,
       ni casi ninguna preposición. Por eso todas son del mismo molde: artículo + sustantivo
       femenino + adjetivo.

       ⚠️ NADA DE `la hada`. Las frases viejas lo usaban —lo correcto es `el hada`, y `el`
       lleva una `e` que a esta altura no existe— y se aceptaba como el precio de escribir
       frases. En combinaciones cortas ese precio ya no hace falta pagarlo: se escribe `las
       hadas`, que es correcto, o se elige otro sustantivo. Si alguien añade una combinación
       nueva, esta es la trampa que tiene que esquivar.

       Van en MINÚSCULA a propósito, al revés que los bancos de frases del nivel: la única
       mayúscula del ejercicio es la primera palabra del texto entero, y esa la pone
       `capitalizarPrimera`. Sin puntuación: la coma es del orden 21 y el punto del 24.

       Verificado carácter a carácter contra `asdfghjklñ` más el espacio. */
    public static final List<String> COMBINACIONES_BASICO_LINEA_BASE = List.of(
            "la salsa salada",
            "las gafas falsas",
            "la lasaña salada",
            "las alhajas falsas",
            "la falda salada",
            "la daga falsa",
            "las algas saladas",
            "la sala salada",
            "las salsas saladas",
            "las dagas falsas",
            "las hadas",
            "la alfalfa");

    /* LAS TECLAS NUEVAS DEL BLOQUE 2, EN FRASES. Alimenta el nodo 12, que hasta el
       10-sep-2026 servia una lista de palabras con el mismo patron.

       Se descarto una vez por imposible y no lo era. Con `r u e i` sobre la fila central
       sigue sin haber `o`, `n`, `t`, `y` ni `q` —no existen "no", "con", "una", "que" ni
       "y"—, pero el diccionario da 285 palabras y las frecuentes son nucleo del idioma:
       `de la el es se su las del al ser ella fue era ese desde`. Con eso se escriben frases
       que suenan a lengua, que es lo que el usuario pidio: *"muchos ejercicios con palabras
       podrian ser oraciones con todas esas teclas"*.

       TRES RESTRICCIONES QUE EXPLICAN LAS FRASES:
         · SIN VERBOS EN PLURAL: todos acaban en -n. Por eso cada sujeto va en singular.
         · SIN TILDES: la tecla del acento es del orden 17. Por eso no aparece "dia" ni
           "rio" —sin tilde serian faltas— y si "salar", "sierra" y "aldea".
         · SIN PUNTUACION, como el resto del bloque: la coma es del orden 21 y el punto del 23.

       MAYÚSCULA INICIAL OBLIGATORIA desde el 11-sep-2026 —hasta entonces decía "sin
       mayúsculas, Shift de Intermedio"—, revertido a pedido del usuario: el mecanismo que
       bloquea el ejercicio en la primera mayúscula (`AvisoTeclaEspecial`) ya existía y es
       automático, así que el único cambio necesario fue el contenido. Acá cada frase es
       una tanda, así que la mayúscula de cada una abre su propia tanda; en el nodo 9, que
       sirve todo de corrido, la pone el generador una sola vez.

       Ahora si cabe `el hada`, que en la fila central sola era imposible —`el` lleva una
       `e`— y obligaba al incorrecto `la hada`. Ver COMBINACIONES_BASICO_LINEA_BASE.

       Verificado caracter a caracter contra `asdfghjklñruei` mas el espacio (mayúscula
       inicial incluida: usa la misma tecla que su minúscula, solo con Shift). */
    public static final List<String> ORACIONES_BASICO_TECLAS_NUEVAS = List.of(
            "La araña hila su red de seda",
            "La ardilla sale de su guarida",
            "Al jaguar le agrada el agua",
            "La grulla usa sus alas largas",
            "El agua salada da sed",
            "La leña arde si le da aire",
            "La risa alegra la sala",
            "La sierra da agua a las aldeas",
            "La jirafa guarda a su hija",
            "La helada daña las fresas",
            "La rueda de la feria gira",
            "La feria llega a la aldea",
            "La idea surge de la duda",
            "La aguja afilada rasga la seda",
            "El hada le regala alas a la ardilla",
            "Ella agrega sal a la salsa");

    public static final List<String> ORACIONES_BASICO_TILDES = List.of(
            "El té ya está frío y la tetera sigue por ahí",
            "Papá salió tarde pero llegó justo para la feria",
            "La hoja se soltó y quedó allí hasta que la guardé",
            "Él quería la otra galleta y se la pidió a su tía",
            "Ella leía todo el día y luego salía a pasear",
            "Sé que llegarás tarde pero te esperaré aquí",
            "El río llegó hasta la orilla y allí se quedó",
            "Aquel día salí de prisa y perdí la hoja",
            "Ojalá el resto del día te salga así de fluido",
            "Le pedí otro papel y él lo dejó por ahí",
            "La puerta se quedó así todo el día y sigue igual",
            "Todo lo que quedó allí se soltó después",
            "Aquí se está a gusto y allá haría frío",
            "Su tío llegó de otro país y trajo té para todos");

    public static final List<String> ORACIONES_BASICO_RELAJO = List.of(
            "El pulgar solo se ocupa del espacio, esa es toda su tarea, mueve la tecla más "
                    + "larga del teclado y la usa más que cualquier otro dedo, si la toca "
                    + "siempre el mismo pulgar el ritmo queda parejo.",
            "Mirar el teclado te quita velocidad, cada mirada corta el ritmo y la memoria del "
                    + "dedo se apaga, la mejor cura es la calma, teclea despacio y deja la "
                    + "vista quieta, la prisa llega sola más tarde.",
            "El relieve de la efe y de la jota le dice a tu dedo que ya llegó a casa, esa "
                    + "marca pequeña te deja soltar la vista del teclado, todo el método se "
                    + "apoya allí, si el dedo halla su sitio solo la mirada queda suelta.",
            "Correr y fallar sale más lerdo que ir despacio y acertar, cada error te quita dos "
                    + "tiempos, el de la tecla mala y el de corregirla, apura solo aquello que "
                    + "ya te sale limpio y deja que el resto madure a su ritmo.",
            "La e es la letra que más se repite al teclear, y le toca al dedo del medio, el "
                    + "mismo que ya cuida la de y la ce, así que ese dedo carga más tarea que "
                    + "casi todo el resto, dale calma y cuidado.");

    public static final List<String> ORACIONES_BASICO_QWERTY = List.of(
            "El teclado que usamos hoy se llama qwerty por las seis primeras letras de su "
                    + "fila de arriba. Nació en la época de las máquinas de escribir mecánicas, "
                    + "cuando cada letra pendía de una varilla de metal. Dos varillas vecinas se "
                    + "trababan si subían casi juntas, así que las letras que más se combinan en "
                    + "el idioma quedaron separadas a propósito. Las varillas desaparecieron, pero "
                    + "ese orden se quedó para siempre.",
            "En español le decimos qwerty al teclado, igual que en inglés, por nombrarlo con "
                    + "sus primeras letras de arriba. En Francia esa misma idea da otro nombre, "
                    + "azerty, porque su fila de arriba empieza distinto. En los países de habla "
                    + "alemana se llama qwertz, con la zeta donde nosotros ponemos la y, porque "
                    + "esa letra se usa mucho más en alemán que en español. Cada país acomodó el "
                    + "nombre a su propio idioma.");

    /* NUEVO el 11-sep-2026. El puente entre "Fila de números" (que solo enseña las TECLAS
       de los dígitos, sin ninguna palabra alrededor) y el Test Final (que no vuelve a
       mencionar un número): sin este nodo, un dígito se practicaba una única vez, aislado
       de cualquier frase real.

       Dos temas —salud/bienestar y motivación— que no son de los cuatro de
       docs/guia_contenido_curso.md, pedidos así por el usuario: encajan con "datos
       curiosos" en que dan algo que pensar además de teclear, y son temas donde un número
       real (minutos, repeticiones, vasos de agua) no se siente forzado, al revés que
       inventarle una cifra a un dato de otro tema solo para que el nodo tenga números.

       "Texto medio": más largo que un dato suelto pero más corto que ORACIONES_BASICO_QWERTY
       (65-70 palabras) — unas 60 palabras cada uno, con 2 a 4 números de por medio ("unos
       cuantos", no una lista). `cantidad:1`: cada intento sirve UNO solo. Verificados letra
       por letra contra las tres filas, tildes, mayúscula inicial, coma y punto — todo lo
       que ya se enseñó a esta altura del nivel, dígitos incluidos (va DESPUÉS de "Fila de
       números"). */
    public static final List<String> ORACIONES_BASICO_NUMEROS = List.of(
            "Beber al menos 8 vasos de agua al día ayuda a mantener el cuerpo activo y "
                    + "despierto. Caminar 30 minutos, aunque sea a paso lento, ya marca una "
                    + "diferencia real en el ánimo. Dormir entre 7 y 9 horas por noche es tan "
                    + "importante como comer bien. Pequeños hábitos diarios, sostenidos por "
                    + "semanas, valen más que un solo esfuerzo grande.",
            "Un pequeño avance cada día, aunque sean solo 10 minutos, termina sumando más de "
                    + "lo que parece. En un mes son unas 300 oportunidades de mejorar un poco. "
                    + "Nadie empieza siendo experto, se necesitan cientos de intentos y más de un "
                    + "tropiezo antes de que algo empiece a salir con soltura. Lo que cuenta es "
                    + "seguir, no la velocidad del primer paso.");

    public static final List<String> ORACIONES_AVANZADO_INGLES = List.of(
            "Tuvimos un meeting rápido antes de mandar el email al cliente.",
            "El deadline del proyecto se movió, así que hay más tiempo para el testing.",
            "Le hice un update al software y ahora corre mucho más rápido.",
            "Vamos a hacer un brainstorming antes de armar el plan final.",
            "El feedback del cliente llegó tarde, pero fue bastante positivo.",
            "Tenemos que hacer un backup antes de subir los cambios al servidor.",
            "El nuevo laptop viene con mejor batería y una pantalla full HD.",
            "El equipo hizo overtime toda la semana para cerrar el sprint a tiempo.",
            "Compré unos sneakers nuevos para salir a correr los fines de semana.",
            "El streaming se cortó justo en la mejor parte de la película."
    );

    /* ============================================================
       BANCOS DE TEXTOS (párrafos completos, un ítem = un ejercicio entero, se elige
       uno al azar — no se encadenan como ORACIONES_LARGAS). Ver generarResistencia.
       ============================================================ */

    // Intermedio: 1-2 minutos de tecleo aprox.
    public static final List<String> TEXTOS_INTERMEDIO = List.of(
            "El pulpo es uno de los animales más inteligentes del mar. Puede resolver laberintos, abrir frascos y hasta recordar rostros humanos. Tiene tres corazones y sangre de color azul, gracias a un pigmento distinto al de otros animales. Cuando se siente en peligro, cambia de color y textura en cuestión de segundos, algo que ningún otro animal logra con esa velocidad.",
            "Machu Picchu se construyó en el siglo XV, en lo alto de la cordillera andina, sin usar ruedas ni animales de carga como los caballos. Los incas transportaban piedras enormes usando rampas, cuerdas y mucha mano de obra organizada. Hoy en día, millones de turistas visitan este lugar cada año, y sigue siendo uno de los destinos más buscados del mundo.",
            "En un lugar de la Mancha, de cuyo nombre no quiero acordarme, vivía un hidalgo que pasaba las noches leyendo libros de caballería. Tanto leyó, que terminó por perder el juicio y decidió convertirse él mismo en caballero andante. Así comienza una de las historias más recordadas de la literatura en español.",
            "Las abejas se comunican entre ellas a través de un baile especial, conocido como la danza de la abeja. Con sus movimientos, indican a otras abejas la dirección y la distancia exacta hasta una fuente de alimento. Este comportamiento fue estudiado durante décadas y todavía sorprende a los científicos por su precisión.",
            "El lago Titicaca, ubicado entre Perú y Bolivia, es considerado el lago navegable más alto del mundo. Sus aguas frías albergan una gran variedad de especies únicas, y a su alrededor viven comunidades que conservan tradiciones muy antiguas, entre ellas las famosas islas flotantes hechas completamente de totora.",
            "Aprender a escribir sin mirar el teclado toma tiempo, pero cambia por completo la forma de trabajar frente a una computadora. Al principio, los dedos buscan cada tecla con torpeza, pero con práctica constante, el cuerpo memoriza la posición de cada letra. Después de unas semanas, escribir rápido y con precisión se vuelve casi automático.",
            "Bécquer escribió que las golondrinas oscuras volverían cada año a colgar sus nidos en el mismo balcón, pero que algunas cosas, una vez que se van, ya no regresan de la misma manera. Sus versos, breves y melancólicos, siguen leyéndose hoy como si hubieran sido escritos apenas ayer.",
            "El corazón humano late, en promedio, cerca de cien mil veces al día, sin que la persona tenga que pensarlo ni una sola vez. A lo largo de toda una vida, ese músculo puede llegar a latir más de tres mil millones de veces, bombeando sangre hacia cada rincón del cuerpo sin detenerse jamás.",
            // Sumado el 13-sep-2026: los 8 anteriores rondaban 60-90 palabras y el usuario
            // pidió al menos uno de verdad largo (100-120). ~110 palabras, un solo tema.
            "El quipu era un sistema de cuerdas anudadas que los incas usaban para registrar información, mucho antes de que existiera la escritura en los Andes. Cada nudo, su posición y el color de la cuerda representaban números, fechas o incluso relatos completos, y solo un grupo especializado de personas, los quipucamayocs, sabía interpretarlos correctamente. Durante siglos se pensó que el quipu solo servía para llevar cuentas administrativas, como el tributo de cada región del imperio. Investigaciones recientes sugieren que algunos quipus más complejos podrían haber almacenado narraciones históricas, casi como una forma de escritura codificada. Hoy sobreviven apenas unos pocos cientos, y buena parte de sus secretos sigue sin descifrarse."
    );

    // Intermedio: textos cortos con ¿? ¡!
    public static final List<String> TEXTOS_INTERMEDIO_EXCLAMACION = List.of(
            "¿Sabías que el corazón de una ballena azul es tan grande como un auto pequeño? ¡Late tan fuerte que puede escucharse desde varios kilómetros de distancia bajo el agua! La naturaleza, sin duda, sigue sorprendiendo a quienes la estudian de cerca.",
            "¡Qué maravilla es Machu Picchu! ¿Te imaginas construir una ciudad entera en la cima de una montaña, sin usar ruedas ni maquinaria moderna? Los incas lo lograron, y su obra sigue en pie después de más de quinientos años.",
            "¿Cuántas veces escribiste sin mirar el teclado esta semana? ¡Seguramente más de las que crees! Practicar un poco cada día, aunque sea unos minutos, hace una diferencia enorme con el paso de las semanas.",
            "¡Increíble! ¿Sabías que un colibrí puede batir sus alas más de cincuenta veces por segundo? Gracias a eso, puede quedarse suspendido en el aire e incluso volar hacia atrás, algo que ningún otro ave logra hacer.",
            "¿Alguna vez probaste las más de tres mil variedades de papa que existen en el Perú? ¡Es difícil creerlo, pero es completamente cierto! Cada región andina conserva sus propias variedades, cultivadas desde hace siglos.",
            "¡Qué curioso! ¿Sabías que los pulpos tienen tres corazones y sangre azul? Cuando nadan, uno de esos corazones deja de latir por completo, por eso prefieren caminar por el fondo marino antes que nadar largas distancias."
    );

    // Avanzado: simulación de correos, lenguaje formal.
    public static final List<String> TEXTOS_AVANZADO_CORREOS = List.of(
            "Estimado señor Ramírez: por medio de la presente, le confirmo que la reunión programada para el jueves ha sido reprogramada para el lunes, a las 10:00 a.m. Quedo atento a cualquier consulta adicional. Saludos cordiales, Carla Medina.",
            "Buenos días: adjunto el informe solicitado correspondiente al mes de enero. Cualquier observación, por favor hágamela llegar antes del viernes, ya que el documento debe enviarse a gerencia el lunes siguiente. Quedo a su disposición. Atentamente, Jorge Salinas.",
            "Estimados clientes: les informamos que, por mantenimiento programado, el sistema no estará disponible el sábado entre las 2:00 y las 6:00 a.m. Lamentamos las molestias que esto pueda ocasionar y agradecemos su comprensión. Atentamente, el equipo de soporte técnico.",
            "Estimada señora López: en respuesta a su consulta, le confirmo que el pedido N.º 4521 fue despachado esta mañana y llegará en un plazo máximo de cuatro días hábiles. Ante cualquier inconveniente, no dude en contactarnos. Saludos cordiales, área de logística.",
            "Buenas tardes: les recuerdo que el plazo para presentar la documentación pendiente vence este viernes a las 5:00 p.m. Solicitamos remitirla a la brevedad posible para evitar demoras en el proceso. Muchas gracias por su atención. Cordialmente, Recursos Humanos.",
            "Estimado equipo: se les convoca a la reunión mensual de coordinación, que se realizará el próximo miércoles a las 9:00 a.m. en la sala principal. Se ruega confirmar asistencia antes del martes. Saludos, Dirección General.",
            "Estimado proveedor: adjunto la orden de compra correspondiente al mes en curso, por un monto total de S/ 8,450.00. Solicitamos confirmar la recepción y el plazo estimado de entrega. Quedamos atentos. Atentamente, área de Compras."
    );

    // Avanzado: dificultad media — vocabulario técnico, oraciones largas encadenadas.
    public static final List<String> TEXTOS_AVANZADO_MEDIOS = List.of(
            "La inteligencia artificial ha transformado, en poco más de una década, la manera en que las empresas procesan información y toman decisiones. Algoritmos capaces de reconocer patrones complejos permiten anticipar tendencias, automatizar tareas repetitivas y optimizar procesos que antes requerían semanas de trabajo manual. Sin embargo, este avance también plantea preguntas importantes sobre el futuro del empleo y la necesidad de una regulación adecuada.",
            "El fenómeno de El Niño altera, de forma significativa, los patrones climáticos de gran parte de Sudamérica. Sus efectos incluyen lluvias intensas en zonas normalmente secas, sequías prolongadas en otras regiones y alteraciones importantes en los ecosistemas marinos frente a las costas peruanas. Comprender este fenómeno resulta clave para anticipar desastres naturales y proteger a las comunidades más vulnerables.",
            "La arquitectura incaica se caracterizó por un dominio excepcional de la ingeniería sísmica, mucho antes de que existiera ese concepto como tal. Las piedras, talladas con precisión milimétrica, encajaban entre sí sin necesidad de argamasa, lo que permitía que las estructuras se movieran ligeramente durante un sismo sin llegar a colapsar. Esta técnica explica, en parte, por qué muchas construcciones incaicas siguen en pie siglos después.",
            "El aumento del nivel del mar, consecuencia directa del cambio climático, amenaza a millones de personas que habitan zonas costeras alrededor del mundo. Ciudades enteras enfrentan el riesgo de inundaciones cada vez más frecuentes, lo que obliga a gobiernos e instituciones a replantear la infraestructura urbana y las políticas de prevención a mediano y largo plazo.",
            "La fermentación es un proceso biológico utilizado por el ser humano desde hace miles de años, mucho antes de comprender su explicación científica. Gracias a microorganismos como levaduras y bacterias, es posible transformar alimentos simples en productos completamente distintos, desde el pan y el vino hasta el yogur y numerosas bebidas tradicionales de distintas culturas."
    );

    // Avanzado: textos largos (2-3 min), pensados para medir fatiga.
    public static final List<String> TEXTOS_AVANZADO_LARGOS = List.of(
            "El proceso de domesticación de la papa comenzó hace más de siete mil años en la región andina, mucho antes de la formación del Imperio incaico. Los pueblos que habitaban estas zonas identificaron, a través de generaciones de observación y selección, cientos de variedades capaces de sobrevivir en condiciones extremas de altura, frío y suelos poco fértiles. Esta labor de domesticación no solo permitió el desarrollo de una agricultura sofisticada, sino que también sentó las bases de una alimentación estable para sociedades enteras. Hoy, el Perú conserva más de tres mil variedades registradas, un patrimonio genético que atrae la atención de científicos de todo el mundo interesados en la seguridad alimentaria futura, especialmente frente a los desafíos que impone el cambio climático sobre los cultivos tradicionales.",
            "Durante siglos, la navegación en alta mar dependió casi por completo de la observación de las estrellas, el comportamiento del viento y el conocimiento acumulado de generación en generación. Mucho antes de la existencia de instrumentos modernos, distintas culturas alrededor del mundo desarrollaron técnicas propias para orientarse en medio del océano, muchas veces con una precisión sorprendente. Los polinesios, por ejemplo, lograron colonizar islas separadas por miles de kilómetros utilizando únicamente el movimiento de las olas, el vuelo de las aves y la posición de determinadas estrellas en el cielo nocturno. Este conocimiento, transmitido de forma oral durante generaciones, representa una de las mayores hazañas de navegación registradas en la historia de la humanidad, y solo en las últimas décadas comenzó a ser estudiado con el rigor científico que merece.",
            "El sistema de caminos construido durante el Imperio incaico, conocido como el Qhapaq Ñan, llegó a superar los treinta mil kilómetros de extensión, atravesando montañas, desiertos y selvas a lo largo de gran parte de Sudamérica. Esta red permitía la comunicación rápida entre distintas regiones del imperio, principalmente a través de mensajeros llamados chasquis, capaces de recorrer largas distancias en tiempos extraordinariamente cortos gracias a un sistema de relevos bien organizado. La ingeniería empleada en su construcción, adaptada a cada tipo de terreno, sigue siendo motivo de estudio y admiración entre arqueólogos e ingenieros contemporáneos, quienes destacan la planificación y el conocimiento del territorio que exigió una obra de semejante magnitud.",
            "La memoria humana no funciona como una grabadora que almacena eventos de manera exacta y permanente. Cada vez que recordamos algo, el cerebro reconstruye parcialmente esa información, incorporando pequeños detalles nuevos, influenciados por el estado emocional del momento o por conversaciones posteriores relacionadas con el mismo recuerdo. Este fenómeno explica por qué distintas personas pueden recordar un mismo evento de formas ligeramente diferentes, sin que necesariamente exista mala intención de por medio. Comprender esta característica de la memoria ha tenido implicancias importantes en campos tan distintos como la psicología clínica, la educación y hasta los procesos judiciales, donde el testimonio de un testigo presencial puede variar considerablemente con el paso del tiempo.",
            "La Amazonía, considerada el pulmón verde del planeta, alberga una biodiversidad tan extensa que buena parte de sus especies todavía no ha sido clasificada por la ciencia. Se estima que en cada hectárea de selva pueden convivir cientos de especies distintas de árboles, muchas de ellas con propiedades medicinales que las comunidades locales conocen y utilizan desde hace generaciones. Sin embargo, la deforestación acelerada de las últimas décadas pone en riesgo este equilibrio, no solo para las especies que allí habitan, sino también para la regulación del clima a nivel global, ya que la selva amazónica cumple un papel fundamental en la absorción de dióxido de carbono de la atmósfera."
    );

    /* ============================================================
       PATRONES DE UNA MANO (Intermedio) — sin lista propia.
       "Patrones de una mano" no tiene banco acá: usa PALABRAS_DE_FILA con
       "patron" directo sobre el diccionario (mismo mecanismo que "Palabras con
       doble consonante"), buscando combinaciones que caen enteras en una sola
       mano EN CUALQUIER POSICIÓN de la palabra (no solo al final, a diferencia
       de -ción/-mente): "ser" en sereno/conservar/serpiente, "mono" en
       mono/monólogo. El patrón va escrito en el sembrado, no acá.
       ============================================================ */

    /* ⚠️ REESCRITO el 13-sep-2026: eran 15 datos sueltos de ergonomía sin relación entre
       sí, y `generarOraciones` juntaba 6 al azar — el usuario lo notó como "una mezcla de
       varios textos". Ahora son 2 PÁRRAFOS COHESIVOS (40-50 palabras cada uno, un solo
       hilo temático de punta a punta) con `cantidad:1` en el sembrado, para que salga
       uno entero por vez y los dos Respiro del nivel puedan alternar entre ellos. Tono de
       DATO, nunca de consejo (ver guía de contenido). */
    public static final List<String> ORACIONES_ERGONOMIA = List.of(
            "Mantener las muñecas rectas mientras se escribe reduce la tensión en los tendones del antebrazo. Por eso muchos especialistas recomiendan una pausa breve cada veinte minutos frente a la pantalla, además de un monitor a la altura de los ojos, para que el cuello no se incline hacia adelante.",
            "Pasar horas sentado frente al teclado sin moverse afecta la circulación de las piernas, algo que revertir con solo ponerse de pie un minuto por hora. Los ojos también se cansan: parpadear seguido y mirar algo lejano de vez en cuando evita la fatiga visual de la pantalla."
    );

    // Intermedio: fechas, horas y porcentajes SIN el formato de moneda/decimales
    // de Avanzado — puente antes de "Oraciones con números y fechas" del nivel
    // siguiente. Datos reales de Perú/Latam, no agenda genérica.
    public static final List<String> ORACIONES_INTERMEDIO_NUMEROS = List.of(
            "El sol se pone en Lima alrededor de las 18:00 durante gran parte del año.",
            "Machu Picchu recibe cerca del 60% de sus visitantes entre junio y agosto.",
            "El 15 de agosto se celebra el aniversario de Arequipa cada año.",
            "Casi el 30% del territorio peruano corresponde a la selva amazónica.",
            "El maratón de Lima suele iniciar a las 07:00 de la mañana.",
            "Un cóndor puede volar más de 5 horas sin batir las alas.",
            "El 20% de las especies de papa del mundo se originaron en los Andes.",
            "La feria empieza el 10 de octubre y dura quince días.",
            "El museo abre de martes a domingo, de 9 a 17 horas.",
            "Cerca del 40% del lago Titicaca pertenece al lado boliviano.",
            "El eclipse será visible desde las 13:00 hasta cerca de las 15:00.",
            "El 25 de diciembre las calles del centro quedan casi vacías.",
            "El 1 de mayo es feriado en la mayoría de los países de América Latina.",
            "Una llama puede cargar hasta un 25% de su propio peso corporal."
    );

    /* Intermedio: frases cortas con ¿...?, no oraciones completas — practica la
       apertura ¿ en varias palabras seguidas, distinto de "Oraciones con
       interrogación y exclamación" (frases largas). Cada ítem ya es un grupo de
       4 preguntas cortas, tal como se ve en pantalla. */
    public static final List<String> ORACIONES_INTERMEDIO_SIGNOS_PREGUNTA = List.of(
            "¿quién? ¿qué? ¿dónde? ¿cuándo?",
            "¿cómo? ¿por qué? ¿para qué? ¿cuánto?",
            "¿cuántos? ¿cuál? ¿de verdad? ¿en serio?",
            "¿por qué no? ¿te parece? ¿estás seguro? ¿qué tal?",
            "¿qué pasó? ¿a qué hora? ¿de quién? ¿con quién?",
            "¿desde cuándo? ¿hasta dónde? ¿y si...? ¿por dónde?"
    );

    /* Intermedio, nuevo el 15-sep-2026: el espejo de ORACIONES_INTERMEDIO_SIGNOS_PREGUNTA,
       ahora con ¡exclamación! — va ANTES de "Oraciones con interrogación y exclamación"
       (que ya combina los dos signos en frases largas), para no pedir un signo dentro de
       una oración completa antes de haberlo practicado suelto. Mismo formato: cada ítem
       ya es un grupo de 4 exclamaciones cortas. */
    public static final List<String> ORACIONES_INTERMEDIO_SIGNOS_EXCLAMACION = List.of(
            "¡cuidado! ¡vamos! ¡increíble! ¡basta!",
            "¡ojalá! ¡claro! ¡nunca! ¡ayuda!",
            "¡qué lindo! ¡qué pena! ¡qué susto! ¡qué bien!",
            "¡no puede ser! ¡eso es! ¡qué sorpresa! ¡por fin!",
            "¡mucho cuidado! ¡qué alegría! ¡qué horror! ¡al fin!",
            "¡silencio! ¡atención! ¡socorro! ¡adelante!"
    );

    /* Intermedio: pares de palabras unidos por "/" — el formato real de
       formularios y avisos (sí/no, M/F). El signo no tenía práctica propia:
       solo aparecía mezclado con otros 16 en "Maratón de símbolos" de Avanzado. */
    public static final List<String> ORACIONES_INTERMEDIO_SIGNO_DIAGONAL = List.of(
            "ellas/ellos sí/no arriba/abajo",
            "adelante/atrás fuerte/suave izquierda/derecha",
            "encendido/apagado activo/inactivo verdadero/falso",
            "mayor/menor entrada/salida día/noche",
            "frío/calor rápido/lento más/menos",
            "dentro/fuera antes/después único/varios",
            "público/privado presente/ausente aprobado/desaprobado"
    );

    // Intermedio: el mismo signo "/", ahora DENTRO de una oración real — el
    // segundo paso, después de "Palabras con el signo /".
    public static final List<String> ORACIONES_INTERMEDIO_DIAGONAL_EN_FRASE = List.of(
            "Marca sí/no en la casilla correspondiente antes de entregar el formulario.",
            "El horario de atención es de lunes/viernes, de nueve de la mañana a seis de la tarde.",
            "Indique su género (M/F) en la parte superior del documento.",
            "El curso está disponible en formato presencial/virtual, según la sede.",
            "Se aceptan pagos en efectivo/tarjeta en todas las sucursales.",
            "El resultado del examen figura como aprobado/desaprobado según el puntaje final.",
            "Responda cada pregunta usando verdadero/falso.",
            "El estado del pedido aparece como pendiente/entregado en el sistema.",
            "La encuesta pregunta si está de acuerdo/en desacuerdo con cada afirmación.",
            "Seleccione la opción activo/inactivo para completar su perfil."
    );

    /* ============================================================
       DOCUMENTOS DE OFICINA — dos niveles, dos formatos cada uno, servidos como
       2 TANDAS por generarResistencia con "bancoTandas" (una tanda de cada
       bolsa, para que la combinación salga distinta cada vez). Intermedio se
       queda con los dos formatos más simples (carta y aviso); Avanzado con los
       dos más estructurados (memo y formulario, con etiquetas "Para:"/"Asunto:").
       ============================================================ */

    // Intermedio: apertura de carta formal, simple — sin membrete completo.
    public static final List<String> TEXTOS_INTERMEDIO_DOC_CARTA = List.of(
            "Lima, 15 de marzo de 2026. Estimado señor Torres: por medio de la presente, me dirijo a usted para solicitar información sobre el trámite de renovación de contrato.",
            "Arequipa, 2 de abril de 2026. Estimada señora Flores: le escribo para confirmar mi asistencia a la reunión programada para la próxima semana.",
            "Cusco, 20 de mayo de 2026. Estimado señor Quispe: por medio de la presente, quiero agradecerle por la atención brindada durante mi última visita a sus oficinas.",
            "Trujillo, 8 de junio de 2026. Estimada señora Ramos: le escribo para solicitar una copia del certificado que acredita la finalización del curso."
    );

    // Intermedio: aviso/anuncio breve — registro de oficina sin firma ni membrete.
    public static final List<String> TEXTOS_INTERMEDIO_DOC_AVISO = List.of(
            "Se comunica a todo el personal que el jueves 20 de marzo la oficina cerrará a las tres de la tarde por mantenimiento.",
            "Se informa a los vecinos que el suministro de agua estará suspendido el sábado desde las ocho de la mañana.",
            "Aviso: la biblioteca permanecerá cerrada el próximo lunes por motivos de limpieza general.",
            "Se avisa a los clientes que la sucursal del centro atenderá en horario reducido durante esta semana."
    );

    /* "Cómo escribir una fecha" (Intermedio, nuevo el 14-sep-2026): dos tandas de fechas
       SUELTAS —sin ninguna oración alrededor, a propósito, para practicar solo el
       formato "día de mes de año"— seguidas de dos oraciones cortas que ya la meten
       dentro de una frase real. Las dos parejas viven separadas (lista1/lista2,
       oracion1/oracion2) para que "generarResistencia" con "bancoTandas" pueda sacar
       una tanda de cada bolsa sin repetir. Todas las fechas son válidas en el
       calendario; las de las oraciones son hechos reales y verificables. */
    public static final List<String> TEXTOS_INTERMEDIO_FECHA_LISTA_1 = List.of(
            "3 de enero de 1998. 17 de junio de 2005. 29 de noviembre de 1982.",
            "9 de marzo de 2011. 22 de agosto de 1976. 14 de octubre de 2000.",
            "5 de febrero de 1990. 30 de mayo de 2018. 11 de julio de 1965.",
            "8 de abril de 2003. 19 de septiembre de 1994. 2 de diciembre de 2022."
    );

    public static final List<String> TEXTOS_INTERMEDIO_FECHA_LISTA_2 = List.of(
            "27 de enero de 1987. 6 de junio de 2014. 15 de octubre de 1999.",
            "1 de marzo de 2008. 23 de julio de 1971. 10 de diciembre de 1993.",
            "18 de febrero de 2016. 4 de septiembre de 1985. 21 de mayo de 2001.",
            "12 de abril de 1978. 26 de noviembre de 2019. 7 de agosto de 1960."
    );

    public static final List<String> TEXTOS_INTERMEDIO_FECHA_ORACION_1 = List.of(
            "El hombre llegó a la Luna el 20 de julio de 1969.",
            "Machu Picchu fue dada a conocer al mundo el 24 de julio de 1911.",
            "Lima fue fundada el 18 de enero de 1535.",
            "Los hermanos Wright volaron por primera vez el 17 de diciembre de 1903."
    );

    public static final List<String> TEXTOS_INTERMEDIO_FECHA_ORACION_2 = List.of(
            "El Perú proclamó su independencia el 28 de julio de 1821.",
            "La Torre Eiffel se inauguró el 31 de marzo de 1889.",
            "La primera conexión de ARPANET se probó el 29 de octubre de 1969.",
            "García Márquez publicó Cien años de soledad el 30 de mayo de 1967."
    );

    // Avanzado: memo interno con etiquetas ("Para:", "De:", "Asunto:", "Fecha:").
    public static final List<String> TEXTOS_AVANZADO_DOC_MEMO = List.of(
            "Para: Gerencia de Operaciones. De: Área de Logística. Asunto: actualización del cronograma de entregas. Fecha: 10/03/2026. Se adjunta el detalle de los cambios propuestos para el segundo trimestre.",
            "Para: Recursos Humanos. De: Jefatura de Sistemas. Asunto: solicitud de nuevos accesos. Fecha: 22/04/2026. Se requiere habilitar las credenciales del personal ingresante antes del lunes.",
            "Para: Dirección General. De: Área Comercial. Asunto: resultados del primer trimestre. Fecha: 05/05/2026. Se adjunta el informe con las cifras de ventas por región.",
            "Para: Todo el personal. De: Administración. Asunto: cambio de horario de atención. Fecha: 18/06/2026. A partir del próximo mes, la atención al público iniciará a las ocho y media."
    );

    // Avanzado: formulario con campos en blanco — el guion bajo ya está en la
    // lista blanca de TextCleaner (10.4/12.8), así que es tecleable sin cambios.
    public static final List<String> TEXTOS_AVANZADO_DOC_FORMULARIO = List.of(
            "Nombre completo: _____. DNI: _____. Fecha de nacimiento: __/__/____. Dirección: _____. Teléfono de contacto: _____.",
            "Razón social: _____. RUC: _____. Dirección fiscal: _____. Representante legal: _____. Correo electrónico: _____.",
            "Nombre del solicitante: _____. Motivo de la solicitud: _____. Fecha de presentación: __/__/____. Firma: _____.",
            "Nombre del paciente: _____. Edad: _____. Fecha de la cita: __/__/____. Hora: _____. Especialidad médica: _____."
    );
}
