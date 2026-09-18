package com.dedea.app.util;

import com.dedea.app.model.enums.Dificultad;

public final class DifficultyScorer {

    private DifficultyScorer() {
        throw new UnsupportedOperationException("Clase utilitaria");
    }

    /* PESOS POR CLASE DE CARÁCTER (calibrados el 23-ago-2026 contra 32 noticias reales
       etiquetadas a mano por el usuario según cómo se sienten al teclear — no según el
       nivel que se le pidió a Gemini, que es lo que se usaba antes).

       El criterio de fondo es la MECÁNICA del teclado español: cuánto cuesta producir el
       carácter, no cuán "raro" se ve. Todo lo que exige Shift cuesta dos pulsaciones y
       pesa igual; lo que es tecla directa pesa poco.

       Historia completa de la calibración en CLAUDE.md 10.2. */

    /** Todo lo que exige Shift: `" ' ! ¡ ? ¿ ( )` y `: ; % $ @ _ /`. Dos pulsaciones.
     *  La barra es Shift+7 en teclado español, asi que pertenece a esta clase y no a los
     *  avanzados, donde estuvo un rato. El peso es el mismo (2.0), asi que el cambio no
     *  mueve ningun puntaje: es para que la clase diga lo que el caracter realmente es. */
    private static final double PESO_SHIFT = 2.0;
    private static final String CARACTERES_SHIFT = "\"'!¡?¿():;%$@_/";

    /* El guion es tecla DIRECTA: mecánicamente debería costar como una letra. Pesa 2.0
       igual, y conviene saber por qué: en las noticias medidas aparece dentro de
       marcadores deportivos y nombres compuestos (`73-70`, `Chicago Sky-Golden State`),
       o sea que funciona como SEÑAL de contenido difícil más que como dificultad propia.
       Bajarlo a 1.8 tira la noticia 260 fuera del nivel difícil, donde el usuario la
       puso sin dudar. Es un proxy y hay que tratarlo como tal: si algún día aparecen
       guiones en otro contexto, este peso va a fallar. */
    private static final double PESO_GUION = 2.0;

    /* Los símbolos avanzados solo sobreviven al TextCleaner en el nivel DIFICIL, y esta lista
       tiene que coincidir con TextCleaner.PERMITIDOS_SOLO_DIFICIL. Si un carácter pasa la
       limpieza pero no está acá, llega al usuario y NO se mide.

       Eso pasaba con `/`, `<` y `>`: permitidos en DIFICIL desde el 19-ago-2026, pero pesaban
       cero. Lo destapó la noticia 308 del 24-ago —"a las 7P/6C/4PAC por Univision"—, que con
       seis caracteres duros quedaba clasificada MEDIO, por debajo de dos noticias que tenían
       UN solo símbolo. Contando las dos barras sube de 11.88% a 13.38% y aterriza en
       MEDIO_DIFICIL, junto a esas dos.

       La barra es Shift+7 en teclado español, así que 2.0 es coherente con el resto de lo que
       exige Shift. Para `<` y `>` el peso es criterio y no medición: son tecla directa y su
       Shift, pero son raros y quedan igualados por simplicidad.

       ⚠️ Si algún día se agrega un carácter a PERMITIDOS_SOLO_DIFICIL, hay que agregarlo acá
       también. Son dos listas que se sincronizan A MANO. */
    private static final double PESO_AVANZADO = 2.0;
    private static final String CARACTERES_AVANZADOS = "[]+*<>";

    /* Fila numérica: obliga a salir de la fila base y rompe el ritmo. */
    private static final double PESO_DIGITO = 2.0;

    /* Coma y punto son teclas directas, sin Shift: cuestan casi lo mismo que una letra. */
    private static final double PESO_PUNTUACION = 0.8;

    /* Shift + letra, pero altísima frecuencia en nombres propios: si pesara como el resto
       de lo que lleva Shift, cualquier noticia con dos equipos y una ciudad se iría a
       difícil sin ser difícil de teclear. */
    private static final double PESO_MAYUSCULA = 0.2;
    private static final String MAYUSCULAS_ACENTUADAS = "ÁÉÍÓÚÑÜ";

    /* La tilde casi no pesa, y es el hallazgo empírico más fuerte de toda la calibración:
       los textos más cargados de tildes fueron los que el usuario tecleó MÁS rápido
       (69, 76 y 79 wpm, de lo más alto de su historial). En español la tilde está tan
       automatizada que no frena. Con peso 1 el nivel FACIL era inalcanzable. */
    private static final double PESO_TILDE = 0.1;
    private static final String TILDES_MINUSCULAS = "áéíóúñü";

    /* REGLA DE LOS TEXTOS SOLO-NÚMEROS (dos pasadas).

       Cuando un texto no trae más que letras, dígitos, coma y punto, los dígitos salen
       más baratos de lo que dice su peso: se teclean en bloques y se entra en ritmo. Lo
       que encarece de verdad es ALTERNAR dígitos con símbolos, porque cada símbolo obliga
       a soltar el ritmo, pulsar Shift y recolocar la mano.

       El caso que la motivó: una noticia con 14 dígitos y ningún símbolo puntuaba 20% y
       el usuario la leía como media. Sus 14 dígitos aportaban el 90% del puntaje.

       Solo se aplica por encima del disparador para no tocar los textos que ya son
       fáciles o medios: ahí el descuento no arreglaría nada y sí movería la frontera de
       FACIL, que hoy está bien puesta.

       El `;` entra en la lista pese a exigir Shift, y es una decision deliberada: la regla
       mide si algo ROMPE EL RITMO de tecleo, no cuanto cuesta la tecla. Un punto y coma es
       puntuacion de prosa —aparece entre clausulas, no intercalado entre cifras— asi que no
       obliga a soltar el ritmo como si lo hacen `%`, `(` o `$`. Sobre las 41 noticias medidas
       no cambia ni un caso; esta puesto para el escenario que se anticipa, que es una noticia
       MEDIA larga y cargada de cifras que use punto y coma.

       ⚠️ Queda una asimetria conocida: el `;` NO rompe el ritmo para esta regla pero SI cuenta
       como caracter especial para MIN_ESPECIALES_DIFICIL. O sea que tres punto y coma alcanzan
       para que un texto pase la compuerta de dificil. Es un umbral bajo y conviene revisarlo
       si algun dia aparece un texto asi; hoy no existe ninguno en el corpus.

       ⚠️ Tiene un acantilado conocido: agregarle UNA comilla a un texto así apaga la
       regla y le devuelve a todos sus dígitos el peso pleno. Medido sobre el caso real,
       son 12 puntos porcentuales de salto por dos caracteres. Se aceptó a cambio de que
       la regla sea simple de leer; la alternativa era hacer que el peso del dígito bajara
       de forma gradual según la densidad de símbolos, y eso agrega un parámetro más que
       estas 32 noticias no alcanzan a determinar. */
    private static final double PESO_DIGITO_REDUCIDO = 1.5;

    /* El disparador va PEGADO AL TECHO DE MEDIO, no al de dificil. La regla existe para no
       tocar lo que ya es facil o medio, asi que cuando UMBRAL_MEDIO_DIFICIL se movio a 12.0
       este numero tuvo que seguirlo. Quedo desincronizado en 14.0 por un rato y el sintoma
       fue concreto: dos ristras de cifras sin un solo simbolo (ids 253 y 256) puntuaban 13.11
       y 10.95, caian en la banda MEDIO_DIFICIL y la regla nunca llegaba a dispararse.

       ⚠️ Si UMBRAL_MEDIO_DIFICIL cambia, este valor cambia con el. */
    private static final double DISPARADOR_REGLA_DIGITOS = 12.0;

    /* Umbrales. Son los puntos medios entre las noticias que el usuario separó, o sea el
       corte que deja más distancia a cada lado. Los valores exactos que maximizan ese
       margen son 4.78 y 15.08; se redondean porque la tercera cifra sería precisión
       falsa — están ajustados sobre 32 casos, no medidos.

       ⚠️ El margen mínimo es 0.40 puntos: hay noticias a menos de medio punto de su
       frontera. Cuando llegue una tanda nueva y el acierto baje, eso NO va a ser una
       regresión, va a ser el número real apareciendo. Ver CLAUDE.md 10.16. */
    /* ¿POR QUÉ EL PUNTAJE ES DENSIDAD Y NO ESFUERZO TOTAL?

       Se divide por el largo, así que mide "qué tan incómoda es cada pulsación" y no "cuánto
       cuesta el ejercicio entero". Un texto con MÁS datos puede puntuar MENOS solo por ser
       más largo, y eso incomoda al leerlo.

       Se probó el 24-ago-2026 topar el divisor para que, pasado cierto largo, los caracteres
       de más dejaran de diluir. Se revirtió el mismo día: de 35 noticias reales una sola
       superaba ese largo, o sea que el tope no hacía nada excepto promover ESE caso — y al
       releerlo el usuario confirmó que era MEDIO, con lo cual el tope era la única fuente de
       error. Peor: con el rango de longitud que hoy pide el prompt para difícil, el techo del
       rango cruzaba el tope, así que habría dejado de ser una red para desbordes y habría
       pasado a inflar en silencio a toda difícil larga.

       Que un texto largo se sienta más duro es real, pero es esfuerzo TOTAL (duración del
       ejercicio), una dimensión distinta que no se arregla deformando la densidad. Está en el
       ICEBOX. Mientras tanto la longitud se gobierna desde el prompt: el rango de difícil
       pide más palabras Y más datos, así que el texto crece sin perder densidad. */

    /* CARACTERES ESPECIALES: todo lo que no sea letra, tilde, mayuscula, digito, coma o
       punto. O sea el conjunto que exige Shift o que sale de la zona comoda del teclado.
       Se usa para la COMPUERTA de abajo, no para puntuar: los pesos siguen igual. */
    private static final int MIN_ESPECIALES_DIFICIL = 3;

    /* BANDA MEDIO-DIFICIL: 12.0 a 14.0.

       Sale de la distribucion real de 41 noticias, no de una preferencia. En la zona media
       las noticias forman dos racimos —10.76/11.10/11.56/11.82/11.95 y despues
       13.11/13.33/13.99/14.00/14.68— separados por un hueco de 1.16 puntos, el segundo mas
       ancho de todo ese tramo. 12.0 cae dentro del hueco. Se descarto 11.0 porque parte el
       racimo bajo por la mitad, dejando textos a 0.34 de distancia en niveles distintos.

       Reparto resultante sobre las 41: 13 faciles, 10 medias, 4 medio-dificiles, 14 dificiles.

       ⚠️ Ojo con el precedente: en 10.2.1 se habia descartado este nivel porque, definido
       como banda ajustada a las etiquetas del usuario, comprimia el margen a 0.13 puntos.
       Esta banda es distinta: sus bordes se eligen por los huecos de la distribucion y no
       por maximizar acierto, asi que no compite con los otros umbrales por espacio. */
    private static final double UMBRAL_MEDIO_DIFICIL = 12.0;

    private static final double UMBRAL_FACIL = 4.8;
    /* 14.0. El valor calibrado sobre las etiquetas del usuario es 15.1, y con ese numero el
       acierto sobre la tanda del 24-ago es 9/9 contra 8/9. Se elige 14.0 igual, y el motivo
       hay que entenderlo antes de "corregirlo":

       Subir el umbral arregla los dos casos limite de HOY, pero con el prompt nuevo la mayoria
       de los textos supera el 15.1 comodamente, asi que a la larga el umbral alto empieza a
       tirar a MEDIO noticias que si son dificiles, y MEDIO deja de tener balance. El umbral es
       un instrumento romo para este problema: no distingue POR QUE un texto puntuo alto.

       El instrumento fino es la compuerta de caracteres especiales (ver 10.21). Mientras no
       exista, 14.0 es el valor que menos dana el balance de MEDIO, a costa de un caso limite.

       ⚠️ No subirlo a 15.1 "porque acierta mas": ese 9/9 son 9 casos y el costo aparece en la
       distribucion, no en el acierto puntual. Ver la evidencia completa en CLAUDE.md 10.21. */
    private static final double UMBRAL_MEDIO = 14.0;

    /**
     * Evalúa la complejidad mecánica de un texto para mecanografía.
     * Si el texto viene vacío devolvemos FACIL y nos ahorramos evaluarlo.
     */
    public static Dificultad calcularDificultad(String textoLimpio) {
        if (textoLimpio == null || textoLimpio.isEmpty()) {
            return Dificultad.FACIL;
        }

        double complejidad = complejidad(textoLimpio, PESO_DIGITO);

        // Segunda pasada: ver la nota de PESO_DIGITO_REDUCIDO.
        if (complejidad >= DISPARADOR_REGLA_DIGITOS && soloTeclasDirectas(textoLimpio)) {
            complejidad = complejidad(textoLimpio, PESO_DIGITO_REDUCIDO);
        }

        /* COMPUERTA DE FACIL. Un texto sin un solo digito y sin un solo caracter especial
           no puede ser mas que facil de teclear, por muchas comas y mayusculas que traiga.
           Es una red por si Gemini obedece las reglas del nivel pero devuelve un texto muy
           largo: la puntuacion sola podria arrastrarlo a MEDIO sin que nada en el sea dificil.

           Hoy no cambia ningun caso —los 12 textos del corpus que cumplen la condicion
           puntuan 3.27% o menos, contra un umbral de 4.8— y esta puesta a proposito antes de
           que haga falta. Es funcion pura del texto y no del nivel PEDIDO: esta medido que un
           texto sin cifras nunca supero FACIL en las etiquetas del usuario (14 de 15). */
        if (sinDigitosNiEspeciales(textoLimpio)) {
            return Dificultad.FACIL;
        }

        if (complejidad < UMBRAL_FACIL) {
            return Dificultad.FACIL;
        } else if (complejidad < UMBRAL_MEDIO_DIFICIL) {
            return Dificultad.MEDIO;
        } else if (complejidad < UMBRAL_MEDIO) {
            return Dificultad.MEDIO_DIFICIL;
        }

        /* COMPUERTA DE DIFICIL. Puntuar alto no alcanza: hay que puntuar alto POR EL MOTIVO
           correcto. Un texto que llega al umbral casi solo con digitos y sin simbolos es una
           ristra de cifras que se teclea en bloque —se entra en ritmo y deja de costar—, no
           un texto exigente. Baja un escalon en vez de perderse en MEDIO.

           El umbral se puede mantener bajo gracias a esta compuerta: medido sobre las 41, de
           umbral 14.0 a 12.0 el nivel DIFICIL solo pasa de 13 a 14 casos porque todo lo demas
           que sube lo absorbe MEDIO_DIFICIL. La compuerta distingue POR QUE puntuo alto, cosa
           que el umbral solo no puede hacer. */
        return contarEspeciales(textoLimpio) >= MIN_ESPECIALES_DIFICIL
                ? Dificultad.DIFICIL
                : Dificultad.MEDIO_DIFICIL;
    }

    /**
     * El PORCENTAJE crudo, con la regla de dos pasadas ya aplicada.
     *
     * <p>Existe solo para observar. {@link #calcularDificultad} devuelve el nivel, que es lo
     * que el producto usa; esto devuelve el numero que hay detras, para poder registrarlo en
     * el log y ver como se mueve una distribucion sin que nada dependa de el.
     *
     * <p>Lo pidieron los ejercicios de IA, donde el scorer NO decide nada —el objetivo ahi es
     * el ngram, no la dificultad mecanica— pero conviene saber que estan produciendo los tres
     * niveles. Es la disciplina de CLAUDE.md 10.17: medir antes de tocar.
     *
     * <p>OJO: no aplica las dos compuertas (la de FACIL ni la de DIFICIL), asi que este numero
     * NO siempre concuerda con el nivel que devuelve calcularDificultad. Es a proposito: son
     * dos preguntas distintas —cuanto puntua y en que nivel cae— y mezclarlas haria que el
     * numero dejara de ser comparable entre textos.
     */
    public static double porcentaje(String textoLimpio) {
        if (textoLimpio == null || textoLimpio.isEmpty()) {
            return 0;
        }
        double c = complejidad(textoLimpio, PESO_DIGITO);
        if (c >= DISPARADOR_REGLA_DIGITOS && soloTeclasDirectas(textoLimpio)) {
            c = complejidad(textoLimpio, PESO_DIGITO_REDUCIDO);
        }
        return c;
    }

    /** Un caracter que no es letra, tilde, mayuscula, digito, coma ni punto. */
    private static boolean esEspecial(char c) {
        return CARACTERES_SHIFT.indexOf(c) != -1
                || CARACTERES_AVANZADOS.indexOf(c) != -1
                || c == '-';
    }

    private static int contarEspeciales(String texto) {
        int n = 0;
        for (char c : texto.toCharArray()) {
            if (esEspecial(c)) {
                n++;
            }
        }
        return n;
    }

    private static boolean sinDigitosNiEspeciales(String texto) {
        for (char c : texto.toCharArray()) {
            if ((c >= '0' && c <= '9') || esEspecial(c)) {
                return false;
            }
        }
        return true;
    }

    /** Puntos por cada 100 caracteres, con el peso de dígito que se le pase. */
    private static double complejidad(String texto, double pesoDigito) {
        double total = 0;
        for (char c : texto.toCharArray()) {
            if (c == '-') {
                total += PESO_GUION; //2.0
            } else if (CARACTERES_SHIFT.indexOf(c) != -1) { //"\"'!¡?¿():;%$@_"
                total += PESO_SHIFT; //2.0
            } else if (c >= '0' && c <= '9') {
                total += pesoDigito;
            } else if (CARACTERES_AVANZADOS.indexOf(c) != -1) { //"[]+*"
                total += PESO_AVANZADO;//2.0
            } else if (c == '.' || c == ',') {
                total += PESO_PUNTUACION;//0.8
            } else if ((c >= 'A' && c <= 'Z') || MAYUSCULAS_ACENTUADAS.indexOf(c) != -1) {
                total += PESO_MAYUSCULA; //0.2
            } else if (TILDES_MINUSCULAS.indexOf(c) != -1) {
                total += PESO_TILDE; // 0.1
            }
            // El resto (minúsculas sin tilde y el espacio) cuesta cero: son teclas
            // directas de la fila base y su costo real es el de una letra cualquiera.
        }
        return total / texto.length() * 100;
    }

    /* ¿El texto se teclea SOLO con teclas directas, sin Shift en ningún momento?

       Es una lista BLANCA a propósito, no una lista negra de lo prohibido: así cualquier
       carácter que no hayamos previsto —`/`, `<`, `>`, un símbolo nuevo que se habilite
       más adelante— apaga la regla en vez de colarse. Con lista negra habría que acordarse
       de agregarlo, y olvidarse no daría error: daría un puntaje mal calculado en silencio. */
    private static boolean soloTeclasDirectas(String texto) {
        for (char c : texto.toCharArray()) {
            boolean permitido =
                    (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
                    || (c >= '0' && c <= '9')
                    || MAYUSCULAS_ACENTUADAS.indexOf(c) != -1
                    || TILDES_MINUSCULAS.indexOf(c) != -1
                    || c == ' ' || c == '.' || c == ',' || c == ';';
            if (!permitido) {
                return false;
            }
        }
        return true;
    }
}
