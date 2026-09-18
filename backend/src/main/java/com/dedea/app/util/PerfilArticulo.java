package com.dedea.app.util;

import com.dedea.app.model.enums.Dificultad;

import java.util.ArrayList;
import java.util.List;

/**
 * Radiografía de un artículo scrapeado, ANTES de mandárselo a Gemini.
 *
 * <p>No decide nada todavía: solo mide y se vuelca al log. Los umbrales de
 * {@code nivelAdmitidoPorArticulo} se fijaron razonando y no midiendo, así que primero hay
 * que ver qué traen los artículos reales. Cuando haya dos o tres tandas registradas se
 * podrá conectar esto a la decisión con datos en la mano.
 *
 * <p><b>Qué se mide y por qué.</b> Lo que importa del artículo no es su propia dificultad
 * sino <i>qué material puede transferirse al resumen</i>, que son 150 caracteres contra los
 * 4.000 del original. Y no todo transfiere igual:
 *
 * <ul>
 *   <li><b>Dígitos, % $ €, comillas de cita</b> — transfieren: Gemini conserva las cifras
 *       del hecho principal, y el prompt solo permite comillas si el artículo trae una cita
 *       real. Son las señales fuertes.
 *   <li><b>Nombres propios poco comunes</b> — transfieren: el resumen tiene que nombrar al
 *       sujeto. Señal fuerte pero aproximada (ver {@link #esRara}).
 *   <li><b>Paréntesis, dos puntos, punto y coma</b> — casi no transfieren: en el artículo
 *       son incisos y decisiones de redacción que el resumen descarta. Se cuentan igual
 *       porque en cantidad delatan un artículo denso, pero no sirven como requisito.
 * </ul>
 */
public record PerfilArticulo(
        int largoMedido,
        int datosNumericos,
        int digitos,
        int simbolosMoneda,
        int comillas,
        int parentesis,
        int dosPuntos,
        int guiones,
        int avanzados,
        int palabrasRaras,
        List<String> ejemplosRaras,
        double densidadMaxima,
        List<String> zonasDensas
) {

    /* Cuánto del artículo se mide. Las noticias usan pirámide invertida: el hecho principal
       y sus cifras están en el lead, y lo de abajo es contexto, declaraciones sueltas y
       notas relacionadas. Medir los 4.000 caracteres completos diluye la señal con material
       que Gemini no va a usar.

       OJO: esto es cuánto se MIDE, no cuánto se ENVÍA. A Gemini se le siguen mandando los
       4.000 para que redacte con contexto suficiente. */
    public static final int CARACTERES_MEDIDOS = 1200;

    /* Ventana para buscar la zona más cargada del artículo.

       Es la medición que más aporta, y sale de una observación del usuario: un artículo
       puede ser prosa limpia en su mayoría y tener un fragmento como
       "41,99 euros (30% de descuento), 8/10" que en 35 caracteres concentra más material
       difícil que el resto entero. La densidad GLOBAL no lo ve —queda diluida—; la ventana
       deslizante sí.

       120 caracteres es aproximadamente una frase con sus datos. */
    private static final int VENTANA = 120;
    private static final int MAX_ZONAS = 3;

    private static final String MONEDA = "%$€";
    private static final String COMILLAS = "\"'«»";
    private static final String AVANZADOS = "[]+*/<>";

    /* Siglas de uso corriente: se excluyen del conteo de "palabras raras" porque cualquiera
       las escribe de memoria. Sin este filtro, NASA cuenta igual que ANBERNIC y la señal se
       vuelve inútil — medido: infla los textos con siglas conocidas y rompe la
       clasificación de las noticias reales.

       Es una lista corta y a mano, o sea un parche. La solución de verdad es el diccionario
       del icebox: preguntar "¿esta palabra existe en español?" en vez de mantener una lista. */
    private static final List<String> SIGLAS_COMUNES = List.of(
            "ONU", "OEA", "NASA", "FBI", "OMS", "UE", "EEUU", "EE", "UU", "PIB", "IPC",
            "FMI", "MIT", "CIA", "ADN", "SIDA", "VIH", "OTAN", "UNESCO", "UNICEF", "PDF",
            "USA", "UK", "TV", "CD", "DVD", "GPS", "SMS", "IA", "PC", "II", "III", "IV",
            // agencias de noticias: aparecen en teletipos y créditos, no son vocabulario
            "AP", "EFE", "AFP", "EP", "DPA", "ANSA", "PL", "URL", "HTTP", "HTTPS");

    public static PerfilArticulo medir(String articulo) {
        if (articulo == null || articulo.isBlank()) {
            return new PerfilArticulo(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, List.of(), 0, List.of());
        }
        String t = articulo.length() > CARACTERES_MEDIDOS
                ? articulo.substring(0, CARACTERES_MEDIDOS)
                : articulo;

        int digitos = 0, moneda = 0, comillas = 0, parent = 0, dosPuntos = 0, guiones = 0, avanz = 0;
        int datos = 0;
        boolean dentroDeNumero = false;
        for (char c : t.toCharArray()) {
            if (Character.isDigit(c)) {
                digitos++;
                if (!dentroDeNumero) { datos++; dentroDeNumero = true; }
            } else {
                // el punto y la coma no cortan un número: son separadores de millar/decimal
                if (c != '.' && c != ',') dentroDeNumero = false;
                if (MONEDA.indexOf(c) != -1) moneda++;
                else if (COMILLAS.indexOf(c) != -1) comillas++;
                else if (c == '(' || c == ')') parent++;
                else if (c == ':' || c == ';') dosPuntos++;
                else if (c == '-') guiones++;
                else if (AVANZADOS.indexOf(c) != -1) avanz++;
            }
        }

        /* DISTINTAS, no ocurrencias. En el sondeo del 24-ago un artículo repetía la sigla
           LKH tres veces y el conteo daba 3: lo que cuesta es reconocer una palabra nueva,
           no volver a teclearla. Se parte además por "/" porque los créditos vienen pegados
           ("Foto/Karl") y se colaban como si fueran vocabulario. */
        java.util.LinkedHashSet<String> rarasDistintas = new java.util.LinkedHashSet<>();
        for (String bruto : t.split("[\\s/]+")) {
            String w = limpiarBordes(bruto);
            if (esRara(w)) rarasDistintas.add(w);
        }
        List<String> raras = new ArrayList<>(rarasDistintas);
        if (raras.size() > 12) raras = new ArrayList<>(raras.subList(0, 12));
        int totalRaras = rarasDistintas.size();

        Zonas z = zonasMasDensas(t);
        return new PerfilArticulo(t.length(), datos, digitos, moneda, comillas, parent,
                dosPuntos, guiones, avanz, totalRaras, raras, z.maxima, z.textos);
    }

    /* ¿Es una palabra que cuesta teclear por no reconocerla? Siglas y marcas con mayúscula
       interior: ANBERNIC, AliExpress, AMOLED, SpaceX, E7Q. Aproximación conocida: no
       distingue una sigla técnica de una que todo el mundo conoce, salvo por la lista de
       arriba. */
    private static boolean esRara(String palabra) {
        String n = palabra.replaceAll("[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]", "");
        if (n.length() < 2 || SIGLAS_COMUNES.contains(n.toUpperCase())) return false;
        if (n.equals(n.toUpperCase())) return true;                    // sigla: MLB, DESI
        for (int i = 1; i < n.length(); i++) {
            if (Character.isUpperCase(n.charAt(i))) return true;       // interior: AliExpress
        }
        return false;
    }

    private static String limpiarBordes(String w) {
        return w.replaceAll("^[^\\p{L}\\p{N}]+|[^\\p{L}\\p{N}]+$", "");
    }

    private record Zonas(double maxima, List<String> textos) {}

    /* Recorre el texto con una ventana deslizante y se queda con las zonas de mayor
       concentración de material costoso. El puntaje de la ventana usa los mismos pesos que
       DifficultyScorer para que la escala sea comparable con la del resumen. */
    private static Zonas zonasMasDensas(String t) {
        if (t.length() < VENTANA) {
            return new Zonas(puntos(t) / Math.max(1, t.length()) * 100, List.of(t.trim()));
        }
        double max = 0;
        List<int[]> mejores = new ArrayList<>();
        for (int i = 0; i + VENTANA <= t.length(); i += 20) {
            double p = puntos(t.substring(i, i + VENTANA)) / (double) VENTANA * 100;
            if (p > max) max = p;
            mejores.add(new int[]{i, (int) Math.round(p * 100)});
        }
        mejores.sort((a, b) -> Integer.compare(b[1], a[1]));
        List<String> textos = new ArrayList<>();
        List<Integer> usados = new ArrayList<>();
        for (int[] m : mejores) {
            if (textos.size() >= MAX_ZONAS) break;
            boolean solapa = usados.stream().anyMatch(u -> Math.abs(u - m[0]) < VENTANA);
            if (solapa) continue;
            usados.add(m[0]);
            textos.add(t.substring(m[0], Math.min(t.length(), m[0] + VENTANA))
                    .replaceAll("\\s+", " ").trim());
        }
        return new Zonas(max, textos);
    }

    /* Mismos pesos que DifficultyScorer, para que el número de la ventana se pueda comparar
       de frente con el porcentaje que va a sacar el resumen. */
    private static double puntos(String s) {
        double total = 0;
        for (char c : s.toCharArray()) {
            if (c == '-' || "\"'!¡?¿():;%$@_".indexOf(c) != -1) total += 2.0;
            else if (Character.isDigit(c)) total += 2.0;
            else if (AVANZADOS.indexOf(c) != -1) total += 2.0;
            else if (c == '.' || c == ',') total += 0.8;
            else if (Character.isUpperCase(c)) total += 0.2;
            else if ("áéíóúñü".indexOf(c) != -1) total += 0.1;
        }
        return total;
    }

    /* Hasta qué NIVEL puede llegar un resumen de este artículo.

       Vive acá y no en el service para que MIDA LA MISMA VENTANA que el resto del perfil.
       Antes el service lo calculaba aparte sobre los 4.000 caracteres mientras el perfil
       medía los primeros 1.200, y los dos números se contradecían: en el sondeo del
       24-ago hubo artículos marcados DIFICIL con 1 y 2 datos en el lead. No era un error
       de umbral — eran dos ventanas distintas.

       Se mide el lead a propósito: los datos que están en la cola del artículo no llegan
       al resumen, así que contarlos infla el techo y hace que se le pida a Gemini un nivel
       que el material accesible no puede sostener. */
    public Dificultad nivelQueAdmite() {
        boolean traeSimbolos = simbolosMoneda >= Constants.MIN_SIMBOLOS_ARTICULO_DIFICIL;
        if (datosNumericos >= Constants.MIN_DATOS_ARTICULO_DIFICIL || traeSimbolos) return Dificultad.DIFICIL;
        if (datosNumericos >= Constants.MIN_DATOS_ARTICULO_MEDIO) return Dificultad.MEDIO;
        return Dificultad.FACIL;
    }

    /** Línea compacta para el log de cada noticia. */
    public String resumenLog() {
        return String.format(
                "datos=%d dig=%d moneda=%d comillas=%d parent=%d dosPuntos=%d guion=%d avanz=%d raras=%d picoZona=%.1f%%",
                datosNumericos, digitos, simbolosMoneda, comillas, parentesis,
                dosPuntos, guiones, avanzados, palabrasRaras, densidadMaxima);
    }
}
