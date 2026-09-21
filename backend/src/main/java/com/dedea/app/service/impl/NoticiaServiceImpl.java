package com.dedea.app.service.impl;

import com.dedea.app.client.GeminiApiClient;
import com.dedea.app.client.NewsApiClient;
import com.dedea.app.client.WebScraperClient;
import com.dedea.app.dto.NoticiaDTO;
import com.dedea.app.exception.CuotaIaAgotadaException;
import com.dedea.app.exception.ResourceNotFoundException;
import com.dedea.app.mapper.EntityMapper;
import com.dedea.app.model.Noticia;
import com.dedea.app.model.enums.Dificultad;
import com.dedea.app.repository.NoticiaRepository;
import com.dedea.app.service.NoticiaService;
import com.dedea.app.util.Constants;
import com.dedea.app.util.CandadoSincronizacion;
import com.dedea.app.util.DifficultyScorer;
import com.dedea.app.util.PerfilArticulo;
import com.dedea.app.util.TextCleaner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class NoticiaServiceImpl implements NoticiaService {

    private final NoticiaRepository noticiaRepository;
    private final EntityMapper mapper;
    private final NewsApiClient newsApiClient;
    private final WebScraperClient webScraperClient;
    private final GeminiApiClient geminiApiClient;

    /* Una categoría de GNews junto con la etiqueta que se guarda en la base y se
       muestra en el panel. Se separan porque la API solo entiende inglés y el panel
       filtra por el texto en español. */
    /* Un artículo candidato: ya scrapeado, perfilado y —si el filtro corrió— verificado
       como noticia. Todavía no se le pidió el resumen a Gemini.

       Vive entre el paso 1 (prepararCandidatos) y el paso 2 (generarDesdeCandidatos). El
       nivel viene asignado desde el reparto de la fase 3, no desde el orden de llegada. */
    public record Candidato(
            String url,
            String titulo,
            String fuente,
            String categoria,
            String imagenUrl,
            String texto,
            PerfilArticulo perfil,
            Dificultad nivelAsignado) {

        Candidato conNivel(Dificultad nivel) {
            return new Candidato(url, titulo, fuente, categoria, imagenUrl, texto, perfil, nivel);
        }
    }

    /* Candidatos preparados esperando la generación.

       En memoria a propósito: son el material de UNA corrida y no tiene sentido persistirlos
       —si el proceso se reinicia, se vuelve a preparar, que es gratis—. Se usa una lista
       concurrente porque la preparación corre en el pool @Async y la generación puede
       dispararse desde otro hilo. */
    /* Candidatos que el reparto NO eligio. Antes solo se imprimian en el log y se perdian;
       ahora se guardan para poder sustituir un MEDIO que se desvio, sin volver a scrapear.
       Se vacian en cada preparacion, igual que la lista principal. */
    private final java.util.List<Candidato> candidatosSobrantes =
            new java.util.concurrent.CopyOnWriteArrayList<>();

    private final java.util.List<Candidato> candidatosPreparados =
            new java.util.concurrent.CopyOnWriteArrayList<>();

    /* UN SOLO candado para los tres caminos de sincronización.

       No son tres candados independientes a propósito: `force-sync` (flujo viejo) y el par
       `preparar`/`generar` (flujo nuevo) tocan las MISMAS tablas y la misma cuota de GNews y
       de Gemini. Con un candado por endpoint, disparar force-sync mientras corre una
       preparación seguiría duplicando la tanda, que es justo lo que se quiere evitar. */
    private final CandadoSincronizacion candado = new CandadoSincronizacion("noticias");

    /* Se activa cuando el filtro de spam no pudo leerse en ningún intento: hace que cada
       prompt de generación lleve la instrucción de devolver MARCADOR_NO_ES_NOTICIA. */
    private volatile boolean verificarNoticiaEnGeneracion = false;

    private record CategoriaFuente(String gnews, String etiqueta) {}

    /* Las categorías que se ingieren cada día. El orden es el de prioridad: si el
       tope diario se agota, las de más abajo se quedan sin cupo esa jornada.
       Los nombres de la derecha son EXACTAMENTE los que el frontend usa como filtro,
       así que cambiarlos acá obliga a cambiarlos también en NoticiasView.

       "nation" -> "Política" es una aproximación conocida y aceptada: esa categoría de
       GNews es "noticias nacionales" en general, así que a veces trae cosas que no son
       políticas (el día del eclipse solar trajo la guía de gafas certificadas). GNews no
       tiene una categoría de política pura — se mantiene porque es la fuente más cercana
       y porque son las 5 categorías las que dan las 10 noticias diarias. La clasificación
       fina queda pendiente en el icebox (noticias de política por país). */
    private static final List<CategoriaFuente> CATEGORIAS = List.of(
            new CategoriaFuente("technology",    "Tecnología"),
            new CategoriaFuente("sports",        "Deportes"),
            new CategoriaFuente("science",       "Ciencia"),
            new CategoriaFuente("entertainment", "Cultura"),
            new CategoriaFuente("nation",        "Política")
    );

    @Override
    public String sincronizacionEnCurso() {
        /* Hay una ventana mínima entre esta consulta y el candado real: si dos llamadas
           entran a la vez, las dos pueden ver "libre" y una recibirá igual el mensaje de
           "iniciada" aunque el candado la rechace después. Es cosmético — la protección de
           verdad es el candado, que sigue impidiendo la tanda doble. Cerrar esa ventana
           obligaría a tomar el candado desde el controlador y soltarlo desde el hilo async,
           que acopla las dos capas para arreglar un mensaje. */
        return candado.libre() ? null : candado.tiempoTomado();
    }

    @Override
    public List<NoticiaDTO> obtenerNoticiasDelDia() {
        List<Noticia> noticias = noticiaRepository.findByFechaPublicacionOrderByIdDesc(LocalDate.now());

        /* Respaldo: si hoy todavía no hay nada, se muestran las de la fecha más
           reciente que sí tenga. Antes esto devolvía lista vacía y la portada
           quedaba en blanco todas las madrugadas, porque el cron carga recién a
           las 8:00 y la consulta exigía fecha_publicacion = hoy exacto. */
        if (noticias.isEmpty()) {
            noticias = noticiaRepository.findFechaMasReciente()
                    .map(noticiaRepository::findByFechaPublicacionOrderByIdDesc)
                    .orElse(List.of());

            if (!noticias.isEmpty()) {
                log.info("Sin noticias de hoy ({}). Se devuelven las {} de la última fecha disponible.",
                        LocalDate.now(), noticias.size());
            }
        }

        /* Mezclado al azar: el ORDER BY id DESC deja las categorías en bloques —se
           siembran en orden fijo y sus ids quedan agrupados—, así que sin mezclar la
           portada sale toda Tecnología junta, después toda Deportes. */
        List<NoticiaDTO> dtos = noticias.stream()
                .map(mapper::toNoticiaDTO)
                .collect(Collectors.toList());
        Collections.shuffle(dtos, ThreadLocalRandom.current());

        return dtos;
    }

    @Override
    public NoticiaDTO obtenerPorId(Integer id) {
        Noticia noticia = noticiaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró la noticia con ID: " + id));
        return mapper.toNoticiaDTO(noticia);
    }

    @Override
    public NoticiaDTO obtenerNoticiaAleatoriaInedita(String identificadorTemporal, String categoria, String dificultad) {
        long totalIneditas = noticiaRepository.countAleatoriaInedita(identificadorTemporal, categoria, dificultad);

        if (totalIneditas == 0) {
            throw new ResourceNotFoundException(
                    "No se encontraron noticias inéditas. ¡Has leído todo el contenido actual!"
            );
        }

        long randomOffset = ThreadLocalRandom.current().nextLong(totalIneditas);

        Noticia noticia = noticiaRepository.findAleatoriaIneditaConOffset(
                        identificadorTemporal, categoria, dificultad, randomOffset)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Error inesperado al recuperar la noticia seleccionada."
                ));

        return mapper.toNoticiaDTO(noticia);
    }

    /* ¿La respuesta de Gemini se parece a un texto de verdad?

       Se llama ANTES de limpiar y guardar. Corre sobre lo que devolvió el modelo, así que
       no cuesta ninguna llamada extra: la respuesta ya llegó, solo se decide si sirve.

       Tres comprobaciones, cada una apunta a una forma distinta de basura:
       - un solo carácter acaparando el texto  -> bucle de repetición (el caso "111111...")
       - pocas palabras                        -> respuesta trunca o un token suelto
       - pocas letras                          -> casi todo dígitos o símbolos

       Devuelve el motivo del descarte (o null si está bien) en vez de un booleano, para
       que el log diga QUÉ falló y no solo que falló. */
    /* Delegado a ValidadorTexto: la misma comprobacion la necesitan Noticias y los
       ejercicios de IA, y tenerla dos veces era garantizar que se desincronizaran. El
       envoltorio se conserva para no tocar las cuatro llamadas de este archivo. */
    private String motivoTextoInvalido(String texto) {
        return com.dedea.app.util.ValidadorTexto.motivoInvalido(texto);
    }

    // true si la llamada a Gemini se resolvió con el marcador de "mismo tema ya cubierto"
    // en vez de un resumen real. Se compara por contención y no por igualdad estricta:
    // el modelo casi siempre obedece "responde ÚNICAMENTE con la palabra X", pero exigir
    // coincidencia exacta lo dejaría vulnerable a un espacio o un punto de más. El límite
    // de longitud evita el falso positivo opuesto: un resumen real de 100-150 caracteres
    // que por pura casualidad mencionara la palabra "duplicado" no tiene forma de ser tan
    // corto como el marcador solo.
    private boolean esTemaDuplicado(String respuestaGemini) {
        if (respuestaGemini == null) return false;
        String limpia = respuestaGemini.trim();
        return limpia.length() < 30 && limpia.toUpperCase().contains(Constants.MARCADOR_TEMA_DUPLICADO);
    }

    /* La pausa de 8s entre llamadas a Gemini, ahora compartida entre el camino normal
       (se guardó una noticia) y el de tema duplicado (se llamó a Gemini igual, así que
       cuenta contra el límite de tasa igual). Devuelve false cuando el hilo fue
       interrumpido de verdad (alguien canceló la tarea) — el llamador debe salir del
       método entero en ese caso, no seguir con el siguiente artículo. */
    private boolean pausaDeSeguridad() {
        try {
            log.info("[NEWS-SYNC] IA descansando 8 segundos para evitar límite de cuota (Error 429)...");
            Thread.sleep(8000);
            return true;
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            log.warn("[NEWS-SYNC-WARN] La pausa de seguridad fue interrumpida por el sistema.");
            return false;
        }
    }

    /* ==================== PASO 1: PREPARAR CANDIDATOS ====================
       Fases 1, 2 y 3 del plan. Cuesta UNA sola llamada a Gemini (el filtro de spam);
       todo lo demás es scraping, que es gratis.

       Deja los candidatos listos en memoria y no guarda nada en la base: el resumen se pide
       en un segundo paso, para poder revisar qué se juntó antes de gastar generaciones. */
    @Override
    @Async("newsTaskExecutor")
    public void prepararCandidatos() {
        /* CANDADO. Sin esto, dos llamadas seguidas arrancan dos tandas en paralelo que
           recorren la misma lista de GNews y guardan las mismas noticias por duplicado.
           Observado en vivo. Ver CandadoSincronizacion. */
        if (!candado.tomar()) {
            log.warn("[PREPARAR] Ya hay una sincronización en curso ({}). Se ignora esta llamada.",
                    candado.tiempoTomado());
            return;
        }
        try {
            candidatosPreparados.clear();
            verificarNoticiaEnGeneracion = false;

            LocalDate hoy = LocalDate.now();
            long yaGuardadasHoy = noticiaRepository.countByFechaPublicacion(hoy);
            int objetivo = (int) Math.max(0, Constants.CANDIDATOS_OBJETIVO - yaGuardadasHoy);
            if (objetivo == 0) {
                log.info("[PREPARAR] Las {} noticias de hoy ya estan completas. Nada que preparar.", yaGuardadasHoy);
                return;
            }

            log.info("========== PASO 1: PREPARANDO CANDIDATOS (objetivo {}) ==========", objetivo);

            List<Candidato> aceptados = new ArrayList<>();
            Set<String> urlsVistas = new HashSet<>();

            /* Se sale a buscar en rondas. Una sola no alcanza cuando faltan articulos capaces de
               sostener el nivel DIFICIL, que medimos que son 1 o 2 de cada 10. */
            for (int ronda = 1; ronda <= Constants.MAX_RONDAS_CANDIDATOS; ronda++) {
                if (yaCubreCuotas(aceptados, objetivo)) break;

                log.info("---------- Ronda {} de recoleccion ----------", ronda);
                List<Candidato> nuevos = recolectar(urlsVistas);
                if (nuevos.isEmpty()) {
                    log.warn("[PREPARAR] Ronda {} no trajo ningun articulo nuevo. Se corta la busqueda.", ronda);
                    break;
                }

                List<Candidato> soloNoticias = filtrarNoNoticias(nuevos);
                aceptados.addAll(soloNoticias);
                log.info("[PREPARAR] Ronda {}: {} articulos scrapeados, {} pasaron el filtro. Acumulado: {}.",
                        ronda, nuevos.size(), soloNoticias.size(), aceptados.size());
            }

            List<Candidato> elegidos = repartirNiveles(aceptados, objetivo);
            candidatosPreparados.addAll(elegidos);

            log.info("");
            log.info("========== PASO 1 TERMINADO: {} candidatos listos ==========", elegidos.size());
            for (Candidato c : elegidos) {
                log.info("  [{}] {} | {}", c.nivelAsignado(), c.categoria(), recortar(c.titulo(), 90));
                log.info("        perfil: {}", c.perfil().resumenLog());
                log.info("        url   : {}", c.url());
                /* El comienzo del articulo va al log a proposito: los conteos dicen CUANTO hay,
                   pero para saber si el material sirve hay que LEERLO. Sin esto, la vez que una
                   nota salio con picoZona 53% hubo que re-scrapear la URL a mano para descubrir
                   que todo era la fecha de publicacion. */
                log.info("        texto : {}", recortar(c.texto(), 300));
                if (!c.perfil().zonasDensas().isEmpty()) {
                    log.info("        zona  : {}", recortar(c.perfil().zonasDensas().get(0), 160));
                }
            }
            /* Se compara por URL y no con removeAll: los elegidos son copias hechas con
               conNivel(), o sea records distintos —cambia nivelAsignado— y equals() los daria
               como diferentes. Sin esto, la lista de sobrantes salia con TODO adentro. */
            Set<String> urlsElegidas = elegidos.stream().map(Candidato::url).collect(Collectors.toSet());
            List<Candidato> sobrantes = aceptados.stream()
                    .filter(c -> !urlsElegidas.contains(c.url()))
                    .toList();
            candidatosSobrantes.clear();
            candidatosSobrantes.addAll(sobrantes);
            if (!sobrantes.isEmpty()) {
                log.info("  --- sobrantes (reservados por si hay que sustituir un MEDIO) ---");
                for (Candidato c : sobrantes) {
                    log.info("  [techo {}] {} | {} | {}", c.perfil().nivelQueAdmite(), c.categoria(),
                            c.perfil().resumenLog(), recortar(c.titulo(), 70));
                }
            }
            log.info("Para generar los resumenes: POST /api/v1/noticias/generar");
        } finally {
            candado.soltar();
        }
    }

    /* ---------- FASE 1: recoleccion ---------- */

    /* Trae articulos de GNews, los scrapea y los perfila. Sin llamar a Gemini.

       urlsVistas acumula entre rondas: una ronda nueva no vuelve a scrapear lo que ya miro
       la anterior, asi que cada vuelta avanza sobre articulos distintos de la misma lista. */
    private List<Candidato> recolectar(Set<String> urlsVistas) {
        List<Candidato> encontrados = new ArrayList<>();
        int porCategoria = (Constants.CANDIDATOS_OBJETIVO + Constants.CANDIDATOS_EXTRA)
                / CATEGORIAS.size() + 1;

        for (CategoriaFuente categoria : CATEGORIAS) {
            List<Map<String, Object>> articulos;
            try {
                articulos = newsApiClient.obtenerNoticiasPorCategoria(categoria.gnews());
            } catch (Exception e) {
                log.error("[PREPARAR] GNews fallo para '{}': {}", categoria.etiqueta(), e.getMessage());
                continue;
            }

            int deEsta = 0;
            for (Map<String, Object> art : articulos) {
                if (deEsta >= porCategoria) break;

                String url = (String) art.get("url");
                String titulo = (String) art.get("title");
                if (url == null || !urlsVistas.add(url)) continue;   // ya la vimos en esta corrida
                if (noticiaRepository.existsByUrl(url)) continue;    // ya esta guardada

                if (pareceFormatoRecurrente(titulo, url)) {
                    log.info("[PREPARAR] Formato recurrente, se salta: {}", recortar(titulo, 60));
                    continue;
                }

                String texto;
                try {
                    texto = webScraperClient.extraerTextoDeUrl(url);
                } catch (Exception e) {
                    log.warn("[PREPARAR] Scraping fallo: {}", e.getMessage());
                    continue;
                }
                /* Cadena vacia significa que ni Readability ni el respaldo consiguieron texto
                   suficiente: muro de pago, contenido pintado por JavaScript, o no es un
                   articulo. El scraper ya lo avisa en su propio log. */
                if (texto.isEmpty()) continue;

                String recortado = texto.length() > 4000 ? texto.substring(0, 4000) : texto;
                String fuente = art.get("source") instanceof Map<?, ?> m ? (String) m.get("name") : null;

                encontrados.add(new Candidato(url, titulo, fuente, categoria.etiqueta(),
                        (String) art.get("image"), recortado, PerfilArticulo.medir(recortado), null));
                deEsta++;
            }
        }
        return encontrados;
    }

    /* ---------- FASE 2: filtro de spam (una sola llamada) ---------- */

    /* Le pasa a Gemini el titulo y el comienzo de cada candidato y le pide clasificar cada
       uno como NOTICIA, ANUNCIO u OTRO. Una llamada para toda la lista.

       Si la respuesta no se puede leer en MAX_INTENTOS_FILTRO_SPAM intentos, se aceptan
       TODOS y se activa el respaldo dentro de la generacion. Ver la nota de
       Constants.MAX_INTENTOS_FILTRO_SPAM: tres parseos fallidos seguidos son un problema de
       nuestro prompt y no de los articulos, asi que descartarlos no arreglaria nada y nos
       dejaria sin jornada. */
    private List<Candidato> filtrarNoNoticias(List<Candidato> candidatos) {
        if (candidatos.isEmpty()) return candidatos;

        String prompt = construirPromptFiltro(candidatos);
        for (int intento = 1; intento <= Constants.MAX_INTENTOS_FILTRO_SPAM; intento++) {
            String respuesta;
            try {
                respuesta = geminiApiClient.generarTexto(prompt);
            } catch (CuotaIaAgotadaException e) {
                log.error("[FILTRO] Cuota de Gemini agotada. Se aceptan los {} candidatos sin filtrar.",
                        candidatos.size());
                verificarNoticiaEnGeneracion = true;
                return candidatos;
            } catch (Exception e) {
                log.warn("[FILTRO] Intento {} fallo: {}", intento, e.getMessage());
                continue;
            }

            Map<Integer, String> veredictos = leerVeredictos(respuesta);
            if (veredictos.isEmpty()) {
                log.warn("[FILTRO] Intento {}: no se pudo leer ningun veredicto de la respuesta.", intento);
                continue;
            }

            List<Candidato> noticias = new ArrayList<>();
            for (int i = 0; i < candidatos.size(); i++) {
                String v = veredictos.get(i + 1);
                /* Sin veredicto para ese numero se acepta: preferimos dejar pasar algo dudoso
                   antes que perder una noticia buena por una lista incompleta. */
                if (v == null || v.startsWith("NOTICIA")) {
                    noticias.add(candidatos.get(i));
                } else {
                    log.info("[FILTRO] Descartado como {}: {}", v, recortar(candidatos.get(i).titulo(), 65));
                }
            }
            return noticias;
        }

        log.error("[FILTRO] Los {} intentos fallaron. Se aceptan todos los candidatos y se "
                + "verificara dentro de la generacion.", Constants.MAX_INTENTOS_FILTRO_SPAM);
        verificarNoticiaEnGeneracion = true;
        return candidatos;
    }

    private String construirPromptFiltro(List<Candidato> candidatos) {
        StringBuilder sb = new StringBuilder();
        sb.append("Vas a clasificar textos extraidos de paginas web. Para CADA UNO decide si es ")
          .append("una NOTICIA periodistica real, un ANUNCIO publicitario, u OTRO (pagina de ")
          .append("servicio, juego, horoscopo, listado de productos, contenido promocional).\n\n");
        for (int i = 0; i < candidatos.size(); i++) {
            Candidato c = candidatos.get(i);
            sb.append(i + 1).append(". TITULO: ").append(c.titulo()).append("\n")
              .append("   TEXTO: ")
              .append(recortar(c.texto(), Constants.CARACTERES_MUESTRA_FILTRO))
              .append("\n\n");
        }
        sb.append("Responde SOLO con una linea por cada texto, con este formato exacto:\n")
          .append("1: NOTICIA\n2: ANUNCIO\n3: OTRO\n")
          .append("Una linea por numero, sin explicaciones ni comentarios.");
        return sb.toString();
    }

    /* Lee los veredictos con una expresion regular en vez de comparar texto exacto.

       Aguanta espacios, negritas de markdown, guion en vez de dos puntos, y texto de relleno
       alrededor ("Aqui tienes el resultado: 1: NOTICIA..."). Un contains() literal se rompia
       con cualquiera de esas variantes y nos habria hecho perder noticias buenas. */
    private static final java.util.regex.Pattern VEREDICTO = java.util.regex.Pattern.compile(
            "(?im)^\\W*(\\d{1,2})\\s*[:.\\-]\\s*\\**\\s*(NOTICIA|ANUNCIO|OTRO|SPAM)");

    private Map<Integer, String> leerVeredictos(String respuesta) {
        Map<Integer, String> mapa = new HashMap<>();
        if (respuesta == null) return mapa;
        var m = VEREDICTO.matcher(respuesta);
        while (m.find()) {
            mapa.put(Integer.parseInt(m.group(1)), m.group(2).toUpperCase(Locale.ROOT));
        }
        return mapa;
    }

    /* ---------- FASE 3: reparto ---------- */

    /* Empareja candidatos con niveles segun lo que su articulo puede sostener.

       Es el cambio de fondo respecto del flujo viejo, que asignaba por orden de llegada sin
       saber que venia despues: un articulo cargado de datos podia terminar escribiendo un
       resumen facil mientras el dificil se le pedia a una nota de prosa. Medido: 5 de los 7
       fallos del 22-ago fueron eso.

       DIFICIL primero y por riqueza descendente, porque es el nivel que mas depende de la
       materia prima y el que menos candidatos tiene. FACIL al final, porque cualquier
       articulo puede producir uno. */
    private List<Candidato> repartirNiveles(List<Candidato> candidatos, int objetivo) {
        List<Candidato> disponibles = new ArrayList<>(candidatos);
        /* Se ordena por DATOS NUMERICOS y no por densidadMaxima.

           densidadMaxima es el maximo sobre una ventana de 120 caracteres, asi que cualquier
           fragmento denso la dispara sola: el 24-ago una nota social de una fiesta salio con
           53% porque la ventana cayo justo sobre la fecha de publicacion, y le gano el puesto
           de DIFICIL a una previa de River-Velez que si traia datos del partido.

           El conteo de datos es un total sobre todo el lead, no un pico, asi que un fragmento
           raro no lo mueve. densidadMaxima se sigue registrando en el log porque para mirar
           un articulo a ojo es util, pero ya no decide nada. */
        disponibles.sort(Comparator
                .comparingInt((Candidato c) -> c.perfil().datosNumericos())
                .thenComparingDouble(c -> c.perfil().densidadMaxima())
                .reversed());

        Map<String, Integer> porCategoria = new HashMap<>();
        List<Candidato> elegidos = new ArrayList<>();

        asignar(disponibles, elegidos, porCategoria, Dificultad.DIFICIL,
                Math.min(Constants.CUOTA_NOTICIAS_DIFICIL, objetivo), objetivo);
        asignar(disponibles, elegidos, porCategoria, Dificultad.MEDIO,
                Math.min(Constants.CUOTA_NOTICIAS_MEDIO, objetivo), objetivo);
        asignar(disponibles, elegidos, porCategoria, Dificultad.FACIL,
                Math.min(Constants.CUOTA_NOTICIAS_FACIL, objetivo), objetivo);

        return elegidos;
    }

    /* Toma de `disponibles` los que puedan sostener `nivel` y los pasa a `elegidos`.

       Un candidato con techo DIFICIL sirve tambien para MEDIO o FACIL —siempre se puede
       bajar, nunca subir—, asi que la condicion es que su techo alcance el nivel pedido.

       El tope por categoria se aplica ACA y no solo en la recoleccion: sin eso, los tres
       articulos mas cargados podrian ser los tres de Deportes y la portada quedaria entera
       del mismo tema. */
    private void asignar(List<Candidato> disponibles, List<Candidato> elegidos,
                         Map<String, Integer> porCategoria, Dificultad nivel,
                         int cuota, int objetivo) {
        int puestos = 0;
        var it = disponibles.iterator();
        while (it.hasNext() && puestos < cuota && elegidos.size() < objetivo) {
            Candidato c = it.next();
            if (c.perfil().nivelQueAdmite().compareTo(nivel) < 0) continue;

            int usadas = porCategoria.getOrDefault(c.categoria(), 0);
            if (usadas >= Constants.NOTICIAS_POR_CATEGORIA) continue;

            elegidos.add(c.conNivel(nivel));
            porCategoria.put(c.categoria(), usadas + 1);
            it.remove();
            puestos++;
        }
        if (puestos < cuota) {
            /* Se distingue una cosa de la otra a proposito: "no hay candidatos" es un
               problema de materia prima —hay que salir a buscar mas articulos— y "no quedan
               puestos" es simplemente que el objetivo del dia ya se lleno. Confundirlos hacia
               que el log avisara de una falta de candidatos cuando habia once disponibles. */
            if (elegidos.size() >= objetivo) {
                log.info("[REPARTO] {}: se cubrieron {} de {} porque el objetivo del dia ({}) ya esta completo.",
                        nivel, puestos, cuota, objetivo);
            } else {
                log.warn("[REPARTO] Faltaron CANDIDATOS para {}: se cubrieron {} de {}. "
                        + "Ningun articulo restante sostiene ese nivel.", nivel, puestos, cuota);
            }
        }
    }

    /* Hay candidatos suficientes para cubrir las cuotas? Se mira ANTES de salir a otra
       ronda, para no gastar scraping de mas. */
    private boolean yaCubreCuotas(List<Candidato> aceptados, int objetivo) {
        if (aceptados.size() < objetivo) return false;
        long dificiles = aceptados.stream()
                .filter(c -> c.perfil().nivelQueAdmite() == Dificultad.DIFICIL).count();
        return dificiles >= Math.min(Constants.CUOTA_NOTICIAS_DIFICIL, objetivo);
    }

    private static String recortar(String s, int max) {
        if (s == null) return "";
        String t = s.replaceAll("\\s+", " ").trim();
        return t.length() > max ? t.substring(0, max) + "..." : t;
    }

    /* ==================== PASO 2: GENERAR LOS RESUMENES ====================
       Fase 4 del plan. Una llamada a Gemini por candidato, sobre lo que dejo el paso 1.

       Va separado a proposito: permite revisar en el log que se junto y con que nivel quedo
       emparejado cada articulo ANTES de gastar una generacion por cada uno. */
    @Override
    @Async("newsTaskExecutor")
    public void generarDesdeCandidatos() {
        /* CANDADO. Sin esto, dos llamadas seguidas arrancan dos tandas en paralelo que
           recorren la misma lista de GNews y guardan las mismas noticias por duplicado.
           Observado en vivo. Ver CandadoSincronizacion. */
        if (!candado.tomar()) {
            log.warn("[GENERAR] Ya hay una sincronización en curso ({}). Se ignora esta llamada.",
                    candado.tiempoTomado());
            return;
        }
        try {
            if (candidatosPreparados.isEmpty()) {
                log.warn("[GENERAR] No hay candidatos preparados. Corre primero POST /api/v1/noticias/preparar");
                return;
            }

            LocalDate hoy = LocalDate.now();

            /* Se generan TODOS los niveles. Del 24-ago-2026 y por unas horas hubo aca un filtro
               que solo dejaba pasar los DIFICIL, mientras se ajustaba ese nivel: era el unico que
               fallaba de forma sistematica y el unico que puede devolver MARCADOR_SIN_MATERIAL.
               Se quito al darlo por terminado (ver CLAUDE.md 10.21 y 10.22). */
            /* Cola y no for-each: durante el recorrido se pueden AGREGAR sustitutos (ver
               sustituirMedioDesviado), y modificar una lista mientras se itera revienta. */
            java.util.Deque<Candidato> pendientes = new java.util.ArrayDeque<>(candidatosPreparados);

            log.info("========== PASO 2: GENERANDO {} RESUMENES ==========", pendientes.size());
            if (pendientes.isEmpty()) {
                log.warn("[GENERAR] No hay candidatos preparados. Corre primero POST /api/v1/noticias/preparar");
                return;
            }
            if (verificarNoticiaEnGeneracion) {
                log.warn("[GENERAR] El filtro de spam no se pudo leer en el paso 1: cada prompt "
                        + "llevara la verificacion de respaldo.");
            }

            /* Titulos ya cubiertos hoy, para la deduplicacion por tema. Se precargan desde la
               base porque el cron corre dos veces al dia y la tanda de la noche tiene que saber
               que cubrio la de la manana. */
            List<String> titulosGuardadosHoy = new ArrayList<>(
                    noticiaRepository.findByFechaPublicacionOrderByIdDesc(hoy).stream()
                            .map(Noticia::getTitulo).toList());

            int guardadas = 0, fallosSeguidos = 0;

            /* Cuantos textos pedidos como MEDIO terminaron en MEDIO_DIFICIL. Se permite UNO: a
               partir del segundo se descarta y se pide otro articulo. Ver sustituirMedioDesviado. */
            int mediosDesviados = 0;
            int sustituciones = 0;

            Candidato c;
            while ((c = pendientes.poll()) != null) {
                try {
                    Dificultad nivelObjetivo = c.nivelAsignado();
                    String prompt = construirPromptNoticia(c.titulo(), c.texto(), titulosGuardadosHoy,
                            nivelObjetivo, nivelDeRespaldo());
                    if (verificarNoticiaEnGeneracion) {
                        prompt = prompt + "\n\nANTES DE TODO: si este texto no es una noticia periodistica "
                                + "real (es un anuncio, una pagina de servicio, un juego o contenido "
                                + "promocional), responde UNICAMENTE con la palabra "
                                + Constants.MARCADOR_NO_ES_NOTICIA + " y nada mas.";
                    }
                    /* Verificacion de material, SOLO en dificil. Nuestro perfilado mira el
                       articulo desde afuera y puede confundir metadatos de plantilla con
                       contenido rico —medido: una nota social salio con picoZona 53% y todo
                       era la fecha de publicacion—. Gemini lo lee y sabe si las cifras son del
                       hecho o son la firma. Ver Constants.MARCADOR_SIN_MATERIAL. */
                    if (nivelObjetivo == Dificultad.DIFICIL) {
                        prompt = prompt + "\n\nVERIFICACION DE MATERIAL: este resumen se pidio en el "
                                + "nivel mas exigente porque el articulo parecia traer cifras, datos "
                                + "tecnicos o citas textuales. Si al leerlo resulta que no los tiene, o que "
                                + "lo unico numerico son la fecha y la hora de publicacion, el numero de la "
                                + "nota o datos de la plantilla del sitio, responde UNICAMENTE con la "
                                + "palabra " + Constants.MARCADOR_SIN_MATERIAL + " y nada mas. No fuerces "
                                + "la dificultad ni inventes cifras: preferimos descartar este articulo y "
                                + "buscar otro.\n"
                                /* Se le cierra la puerta del medio a proposito: sin esto el modelo
                                   tiende a contestar cosas como "puedo intentarlo, aunque el
                                   articulo tiene pocas cifras..." y esa respuesta no es ni un
                                   resumen ni el marcador, asi que se guarda como si fuera texto. */
                                + "Solo hay dos respuestas posibles: el resumen terminado, o la palabra "
                                + Constants.MARCADOR_SIN_MATERIAL + " sola. No expliques tu decision, no "
                                + "avises que vas a intentarlo y no agregues ningun comentario.";
                    }

                    String resumenIa = geminiApiClient.generarTexto(prompt);

                    /* Respaldo del filtro de spam: Gemini avisa que no es una noticia. Se descarta
                       igual que un duplicado — la llamada ya se gasto, asi que se respeta la pausa. */
                    if (verificarNoticiaEnGeneracion && esRespuestaCorta(resumenIa, Constants.MARCADOR_NO_ES_NOTICIA)) {
                        log.info("[GENERAR] Gemini avisa que no es una noticia, se descarta: {}",
                                recortar(c.titulo(), 65));
                        resolver(c);
                        if (!pausaDeSeguridad()) return;
                        continue;
                    }

                    /* Gemini leyo el articulo y avisa que no da para dificil. Se descarta y se
                       sigue: la llamada ya se gasto, asi que se respeta la pausa igual. */
                    if (nivelObjetivo == Dificultad.DIFICIL
                            && esRespuestaCorta(resumenIa, Constants.MARCADOR_SIN_MATERIAL)) {
                        log.info("[GENERAR] Sin material para DIFICIL segun Gemini, se descarta: {}",
                                recortar(c.titulo(), 65));
                        resolver(c);
                        if (!pausaDeSeguridad()) return;
                        continue;
                    }

                    if (esTemaDuplicado(resumenIa)) {
                        log.info("[GENERAR] Tema ya cubierto hoy, se descarta: {}", recortar(c.titulo(), 65));
                        resolver(c);
                        if (!pausaDeSeguridad()) return;
                        continue;
                    }

                    String motivoInvalido = motivoTextoInvalido(resumenIa);
                    if (motivoInvalido != null) {
                        log.warn("[GENERAR] Respuesta descartada ({}): {}", motivoInvalido, recortar(c.titulo(), 65));
                        resolver(c);
                        if (!pausaDeSeguridad()) return;
                        continue;
                    }

                    /* Los simbolos avanzados solo sobreviven cuando el texto se pidio como
                       DIFICIL. El gate es sobre el nivel PEDIDO y no sobre el que devuelva el
                       scorer, porque la limpieza ocurre antes de clasificar. */
                    String textoLimpio = TextCleaner.limpiarTexto(resumenIa, nivelObjetivo == Dificultad.DIFICIL);
                    Dificultad dificultadCalculada = DifficultyScorer.calcularDificultad(textoLimpio);

                    /* MEDIO desviado a MEDIO_DIFICIL: se tolera UNO por tanda y el segundo se
                       descarta, pidiendo otro articulo en su lugar.

                       El motivo es el balance de la portada, no la correccion del scorer: un texto
                       que puntua 12-14 ES medio-dificil y esta bien clasificado, pero si tres de
                       las cuatro medias se van para arriba, MEDIO se queda casi vacio. Paso el
                       25-ago-2026: de 3 pedidas MEDIO, 2 aterrizaron en MEDIO_DIFICIL.

                       NO aplica a DIFICIL a proposito (decision del usuario): si una dificil cae en
                       MEDIO_DIFICIL se queda asi, porque ahi el desvio es hacia abajo y no desbalancea
                       nada — simplemente el articulo no daba para mas.

                       El sustituto sale de los sobrantes del reparto, sin scrapear de nuevo, y se
                       elige el de MENOS datos numericos: el problema es exceso de densidad, asi que
                       un articulo mas pobre es el que mas probabilidades tiene de quedarse en MEDIO. */
                    if (nivelObjetivo == Dificultad.MEDIO
                            && dificultadCalculada == Dificultad.MEDIO_DIFICIL) {
                        mediosDesviados++;
                        if (mediosDesviados > 1 && sustituciones < Constants.MAX_SUSTITUCIONES_MEDIO) {
                            Candidato sustituto = tomarSustitutoParaMedio();
                            if (sustituto != null) {
                                sustituciones++;
                                pendientes.add(sustituto);
                                /* Tambien a la lista preparada: si la tanda se corta antes de
                                   llegar a el, un /generar posterior lo retoma igual que a
                                   cualquier otro pendiente. */
                                candidatosPreparados.add(sustituto);
                                log.info("[GENERAR] MEDIO desviado a MEDIO_DIFICIL por segunda vez: se "
                                        + "descarta '{}' y se prueba con '{}'.",
                                        recortar(c.titulo(), 40), recortar(sustituto.titulo(), 40));
                                resolver(c);
                                if (!pausaDeSeguridad()) return;
                                continue;
                            }
                            log.warn("[GENERAR] MEDIO desviado y no quedan sobrantes para sustituir. "
                                    + "Se guarda igual: {}", recortar(c.titulo(), 50));
                        }
                    }

                    String previewParaFront = textoLimpio.length() > Constants.PALABRAS_RESUMEN_NOTICIA * 3
                            ? textoLimpio.substring(0, Constants.PALABRAS_RESUMEN_NOTICIA * 3) + "..."
                            : textoLimpio;

                    String imagenFinal = webScraperClient.pareceBloqueoAntiHotlinking(c.imagenUrl())
                            ? null : c.imagenUrl();

                    Noticia nueva = Noticia.builder()
                            .titulo(c.titulo())
                            .contenidoCompleto(textoLimpio)
                            .contenidoResumido(previewParaFront)
                            .categoria(c.categoria())
                            .fuente(c.fuente())
                            .url(c.url())
                            .imagenUrl(imagenFinal)
                            /* Solo para calibrar el clasificador; se borra a la semana. */
                            .articuloScrapeado(c.texto())
                            .dificultad(dificultadCalculada)
                            .fechaPublicacion(hoy)
                            .build();

                    noticiaRepository.save(nueva);
                    resolver(c);
                    guardadas++;
                    fallosSeguidos = 0;
                    titulosGuardadosHoy.add(c.titulo());

                    log.info("[GENERAR] Guardada [{}] (perfil: {} / pedido: {} / resulto: {}): {}",
                            c.categoria(), c.perfil().resumenLog(), nivelObjetivo,
                            dificultadCalculada, recortar(c.titulo(), 60));

                    if (!pausaDeSeguridad()) return;

                } catch (CuotaIaAgotadaException e) {
                    log.error("[GENERAR] Cuota de Gemini agotada. Se corta con {} noticias guardadas.", guardadas);
                    return;
                } catch (Exception e) {
                    fallosSeguidos++;
                    log.error("[GENERAR] Error con '{}' ({} fallos seguidos): {}",
                            recortar(c.titulo(), 45), fallosSeguidos, e.getMessage());
                    if (fallosSeguidos >= Constants.MAX_FALLOS_IA_SEGUIDOS) {
                        log.error("[GENERAR] {} fallos seguidos: el problema no es del articulo. Se aborta.",
                                fallosSeguidos);
                        return;
                    }
                }
            }

            log.info("========== PASO 2 TERMINADO: {} noticias guardadas ==========", guardadas);
            if (!candidatosPreparados.isEmpty()) {
                log.warn("[GENERAR] Quedan {} candidatos SIN resolver (fallaron por error transitorio). "
                        + "Volve a llamar a /generar y se retoman; no hace falta preparar de nuevo.",
                        candidatosPreparados.size());
            }
        } finally {
            candado.soltar();
        }
    }

    /* Lo que llaman el cron diario y /force-sync: preparar y generar, uno atras del otro.

       @Async se ignora en una llamada desde DENTRO de la misma clase (ver la nota de
       arriba, en prepararCandidatos) — y es justo lo que hace falta aca. Sin esto, dos
       metodos @Async llamados seguidos desde OTRA clase (el scheduler, el controller)
       arrancan cada uno en su propio hilo y generarDesdeCandidatos podria correr antes de
       que prepararCandidatos termine de dejar los candidatos listos. Auto-invocandolos
       desde aca, los dos corren SINCRONICOS dentro del mismo hilo de newsTaskExecutor: el
       segundo no arranca hasta que el primero vuelve. */
    @Override
    @Async("newsTaskExecutor")
    public void ejecutarFlujoCompleto() {
        prepararCandidatos();
        generarDesdeCandidatos();
    }

    /* Saca un candidato de la lista preparada porque ya quedo resuelto: se guardo, o se
       descarto por una razon definitiva (no es noticia, sin material, tema duplicado, texto
       invalido). Un candidato que revienta con una excepcion NO pasa por aca a proposito.

       Antes esto era un unico candidatosPreparados.clear() al final del bucle, y dejaba el
       comportamiento al reves de lo razonable: tres fallos seguidos hacian `return` antes del
       clear y CONSERVABAN los candidatos, mientras que un solo fallo dejaba terminar el bucle
       y los borraba todos. Un 503 pasajero de Gemini costaba la preparacion entera —o sea
       varias llamadas de la cuota diaria— para volver a juntar los mismos articulos.

       Resolviendo uno por uno, cualquier salida del metodo (pausa interrumpida, cuota agotada,
       corte por fallos seguidos) deja en la lista exactamente lo que falta por generar, y
       nunca lo que ya se guardo. La lista vive en memoria, asi que se pierde al reiniciar la
       app: eso es intencional, un candidato de ayer no sirve. */
    /* Saca de los sobrantes el articulo con MENOS datos numericos y lo devuelve marcado como
       MEDIO. Devuelve null si no queda ninguno. Se elige el mas pobre a proposito: el desvio
       que estamos corrigiendo es por exceso de densidad. */
    private Candidato tomarSustitutoParaMedio() {
        Candidato elegido = candidatosSobrantes.stream()
                .min(java.util.Comparator.comparingInt(x -> x.perfil().datosNumericos()))
                .orElse(null);
        if (elegido == null) {
            return null;
        }
        candidatosSobrantes.remove(elegido);
        return elegido.conNivel(Dificultad.MEDIO);
    }

    private void resolver(Candidato c) {
        candidatosPreparados.removeIf(pendiente -> pendiente.url().equals(c.url()));
    }

    /* Una respuesta que es SOLO un marcador y nada mas. Se exige que sea corta para no
       confundirla con un resumen que menciona la palabra al pasar. Mismo criterio que usa
       esTemaDuplicado. */
    private boolean esRespuestaCorta(String respuesta, String marcador) {
        if (respuesta == null) return false;
        String t = respuesta.trim();
        return t.length() < 40 && t.toUpperCase(Locale.ROOT).contains(marcador);
    }

    /* SONDEO: trae artículos de GNews, los scrapea, los perfila y los VUELCA AL LOG.
       No llama a Gemini y no guarda nada.

       Existe para poder calibrar PerfilArticulo sin gastar cuota. La cuota de Gemini son 20
       llamadas por día y es lo único escaso del pipeline; el scraping es un GET normal, sin
       límite. Separando las dos fases se pueden mirar cincuenta artículos por el precio de
       cero resúmenes.

       Es de diagnóstico, no de producto: cuando los umbrales estén calibrados, esto o se
       borra o se convierte en la primera fase del reparto en dos pasos (ver ICEBOX.md,
       "Scrapear varios artículos primero"). */
    @Override
    @Async("newsTaskExecutor")
    public void sondearArticulos(int porCategoria) {
        log.info("========== SONDEO DE ARTÍCULOS ({} por categoría) ==========", porCategoria);
        log.info("No se llama a Gemini y no se guarda nada. Solo scraping y perfilado.");

        int vistos = 0, conTexto = 0;
        for (CategoriaFuente categoria : CATEGORIAS) {
            List<Map<String, Object>> articulos;
            try {
                articulos = newsApiClient.obtenerNoticiasPorCategoria(categoria.gnews());
            } catch (Exception e) {
                log.error("[SONDEO] No se pudo consultar GNews para '{}': {}", categoria.etiqueta(), e.getMessage());
                continue;
            }

            int deEstaCategoria = 0;
            for (Map<String, Object> art : articulos) {
                if (deEstaCategoria >= porCategoria) break;
                vistos++;

                String url = (String) art.get("url");
                String titulo = (String) art.get("title");

                String texto;
                try {
                    texto = webScraperClient.extraerTextoDeUrl(url);
                } catch (Exception e) {
                    log.warn("[SONDEO] {} | scraping falló: {}", categoria.etiqueta(), e.getMessage());
                    continue;
                }
                if (texto.isEmpty()) {
                    log.warn("[SONDEO] {} | sin texto: {}", categoria.etiqueta(), titulo);
                    continue;
                }
                deEstaCategoria++;
                conTexto++;

                String recortado = texto.length() > 4000 ? texto.substring(0, 4000) : texto;
                PerfilArticulo perfil = PerfilArticulo.medir(recortado);
                Dificultad techo = perfil.nivelQueAdmite();
                boolean recurrente = pareceFormatoRecurrente(titulo, url);

                log.info("");
                log.info("---------- [{}] {}", categoria.etiqueta(), titulo);
                log.info("  url    : {}", url);
                log.info("  largo  : {} caracteres scrapeados (se miden los primeros {})",
                        texto.length(), PerfilArticulo.CARACTERES_MEDIDOS);
                log.info("  techo  : {}{}", techo,
                        recurrente ? "   <<< FORMATO RECURRENTE: no es noticia, se descartaría" : "");
                log.info("  perfil : {}", perfil.resumenLog());
                if (!perfil.ejemplosRaras().isEmpty()) {
                    log.info("  raras  : {}", String.join(", ", perfil.ejemplosRaras()));
                }
                int z = 1;
                for (String zona : perfil.zonasDensas()) {
                    log.info("  zona {} : {}", z++, zona);
                }
                /* El comienzo del artículo va entero al log a propósito: los conteos dicen
                   cuánto hay, pero para juzgar si el material sirve hay que LEERLO. */
                log.info("  texto  : {}", recortado.substring(0, Math.min(700, recortado.length()))
                        .replaceAll("\s+", " "));
            }
        }
        log.info("");
        log.info("========== SONDEO TERMINADO: {} artículos vistos, {} con texto ==========", vistos, conTexto);
    }

    /* Borra el texto scrapeado que ya pasó su ventana de retención.

       El artículo se guarda SOLO para poder recalibrar el clasificador sin gastar llamadas
       a Gemini (ver Noticia.articuloScrapeado). No es contenido del producto y no se sirve
       a nadie, así que no tiene por qué acumularse: a la semana ya cumplió su función.

       Cuando la calibración termine, esto y la columna se sacan juntos. */
    @Override
    public void limpiarArticulosViejos() {
        LocalDate limite = LocalDate.now().minusDays(Constants.DIAS_RETENCION_ARTICULO);
        int borrados = noticiaRepository.limpiarArticulosAnterioresA(limite);
        if (borrados > 0) {
            log.info("[LIMPIEZA] Texto scrapeado borrado de {} noticias anteriores al {}.", borrados, limite);
        }
    }

    /* Chequeo periódico de imágenes que empezaron a bloquearse DESPUÉS de guardarse —
       el chequeo de la ingesta (dentro de generarDesdeCandidatos) solo
       atrapa el bloqueo si ya estaba activo el día que se guardó la noticia. El caso real
       que lo motivó: escambray.cu respondía bien al principio y a los pocos días empezó
       a devolver 403 a cualquier pedido con Referer ajeno.
       Se acota a los últimos Constants.DIAS_REVISION_IMAGENES días: repasar todo el
       historial cada vez crece sin límite y las noticias viejas casi no se sirven. */
    @Override
    @Async("newsTaskExecutor")
    public void revisarImagenesBloqueadas() {
        LocalDate desde = LocalDate.now().minusDays(Constants.DIAS_REVISION_IMAGENES);
        List<Noticia> conImagen = noticiaRepository.findByImagenUrlIsNotNullAndFechaPublicacionGreaterThanEqual(desde);

        int revisadas = 0;
        int bloqueadas = 0;

        for (Noticia noticia : conImagen) {
            revisadas++;
            if (!webScraperClient.pareceBloqueoAntiHotlinking(noticia.getImagenUrl())) continue;

            log.warn("[IMG-CHECK] Noticia {} ('{}') perdió su imagen por bloqueo anti-hotlinking. Se limpia imagenUrl.",
                    noticia.getId(), noticia.getTitulo());
            noticia.setImagenUrl(null);
            noticiaRepository.save(noticia);
            bloqueadas++;
        }

        log.info("[IMG-CHECK] Revisión de imágenes terminada: {} revisadas, {} bloqueadas y limpiadas.", revisadas, bloqueadas);
    }

    /* Formatos que se publican todos los días con la misma plantilla y que GNews devuelve
       como si fueran noticias: la solución del Wordle, el horóscopo, los números de la
       lotería, el crucigrama, la programación de TV.

       El caso que lo motivó (sondeo del 24-ago-2026): una página de MeriStation con la
       solución del Wordle del día. El scraper hizo su trabajo perfectamente —bajó lo que
       había— pero la página no es una noticia: sus 22 dígitos son números de acertijo
       ("reto 1690", "palabra número 1.200"). Puntuaba como material rico y habría producido
       una "noticia difícil" que no dice nada.

       Es un hueco conceptual que el clasificador no puede cubrir: mide DIFICULTAD, no si
       el texto es una noticia. Y son justo los formatos que más cifras traen, así que
       tienden a colarse por el nivel difícil, que es el que más nos cuesta llenar.

       Se mira título y URL porque estas páginas los repiten a diario casi textuales. Es una
       lista negra, o sea un parche: va a dejar pasar formatos nuevos. Pero cubre los que
       aparecen todos los días y cuesta dos líneas. */
    private static final List<String> FORMATOS_RECURRENTES = List.of(
            "wordle", "horóscopo", "horoscopo", "crucigrama", "sudoku",
            "lotería", "loteria", "quiniela", "sorteo", "euromillones", "primitiva",
            "resultados de la loter", "números ganadores", "numeros ganadores",
            "pistas y solución", "pistas y solucion", "programación de tv", "qué ver hoy",
            "signos del zodiaco", "carta astral", "quinigol", "melate",
            /* Liveblogs. Un "en directo" no es una noticia cerrada: se actualiza sola
               mientras dura el evento, asi que el resumen envejece mal — a la hora dice algo
               que ya no es cierto. Ademas su texto viene lleno de marcas de tiempo, que es
               justo lo que infla el perfil sin ser contenido. Detectado el 24-ago-2026 con
               "La Vuelta 2026, en directo hoy la Etapa 2". */
            "en directo", "minuto a minuto", "narracion en vivo", "sigue en vivo");

    private boolean pareceFormatoRecurrente(String titulo, String url) {
        String t = ((titulo == null ? "" : titulo) + " " + (url == null ? "" : url)).toLowerCase();
        for (String marcador : FORMATOS_RECURRENTES) {
            if (t.contains(marcador)) return true;
        }
        return false;
    }

    /* A qué nivel puede "caer" un artículo al que se le pidió DIFICIL pero que no tiene
       material para serlo (sin cifras, sin datos técnicos, sin citas).

    /* El respaldo de DIFICIL es SIEMPRE MEDIO, nunca FACIL (decisión del 19-ago-2026).

       Antes era dinámico: si la cuota de medias estaba llena, un artículo que no daba para
       difícil se redactaba como fácil. El problema es que FACIL tiene reglas muy fuertes
       —cifras en palabras, un solo nombre propio, sin signos— pensadas para un artículo
       genuinamente simple. Aplicarlas a un artículo que se había elegido por tener
       material lo desperdicia: obliga a tirar justo los datos por los que se lo eligió.

       MEDIO es el respaldo correcto porque un artículo con material siempre puede bajar
       un escalón sin perder nada; bajar dos escalones sí obliga a mutilarlo. */
    private Dificultad nivelDeRespaldo() {
        return Dificultad.MEDIO;
    }

    /* Descripción compacta del estilo de un nivel, en una sola línea. Se usa dentro de las
       reglas de DIFICIL para describir el respaldo sin repetir el bloque entero. Los
       parámetros son los mismos que en reglasDeNivel — si se cambian allá, cambiarlos acá. */
    private String estiloResumido(Dificultad nivel) {
        return switch (nivel) {
            /* MEDIO_DIFICIL es un resultado del scorer, no un nivel que se pida:
               repartirNiveles no lo produce jamas. Si llega hasta aca
               es que alguien rompio esa invariante, y conviene enterarse en el momento y no
               con una tanda entera de textos pedidos a un nivel inexistente. El fallo lo
               atrapa el try/catch por articulo, asi que no tumba el proceso de golpe. */
            case MEDIO_DIFICIL -> throw new IllegalStateException(
                    "MEDIO_DIFICIL no es un nivel que se pueda pedir a Gemini; solo lo devuelve "
                    + "el DifficultyScorer. Ver CLAUDE.md 10.22.");
            case FACIL -> "vocabulario simple y cotidiano, oraciones cortas, sin comillas ni signos "
                    + "de exclamación o interrogación, sin siglas, entre 20 y 25 palabras";
            /* Sincronizado A MANO con el bloque MEDIO de reglasDeNivel: si allá cambia el
               rango, hay que cambiarlo acá también. */
            case MEDIO -> "vocabulario periodístico normal, coma y punto libres, siglas sin "
                    + "puntos, entre 26 y 32 palabras";
            case DIFICIL -> "vocabulario técnico, puntuación compleja, entre 35 y 45 palabras";
        };
    }

    /* Las reglas de redacción de cada nivel. Son la contracara de DifficultyScorer: ese
       MIDE el texto ya escrito y esto le pide a Gemini que apunte al rango desde el
       principio. Antes el prompt solo decía "NIVEL DE DIFICULTAD: X" sin explicar qué
       significaba, y la dificultad salía al azar. Los pesos vigentes del scorer están en
       DifficultyScorer; no se repiten acá para que no se desincronicen.

       Todas están redactadas como PREFERENCIA DE ESTILO dentro de lo que el artículo
       permite, nunca como orden absoluta: es una noticia real, y forzar el nivel a costa
       de los hechos sería peor que la inconsistencia que estamos corrigiendo.

       El parámetro `respaldo` solo lo usa DIFICIL, para decirle a qué nivel caer si el
       artículo no da para tanto. FACIL y MEDIO no llevan respaldo: siempre se puede
       simplificar un texto, así que nunca se quedan sin poder cumplir su nivel. */
    /* ⚠️ EL BLOQUE DE DIFICIL PASA POR .formatted(), ASI QUE UN "%" LITERAL SE ESCRIBE "%%".

       El 24-ago-2026 se agrego el texto "un porcentaje (%)" y la tanda entera fallo con
       UnknownFormatConversionException: Conversion = ')'. Java leyo el "%)" como un
       especificador de formato. Compila perfecto y revienta en ejecucion, antes de llamar a
       Gemini: las tres generaciones murieron en milisegundos y el corta-circuito de fallos
       seguidos aborto la tanda. Si se agrega texto con % a este nivel, duplicarlo. */
    private String reglasDeNivel(Dificultad nivel, Dificultad respaldo) {
        return switch (nivel) {
            /* MEDIO_DIFICIL es un resultado del scorer, no un nivel que se pida:
               repartirNiveles no lo produce jamas. Si llega hasta aca
               es que alguien rompio esa invariante, y conviene enterarse en el momento y no
               con una tanda entera de textos pedidos a un nivel inexistente. El fallo lo
               atrapa el try/catch por articulo, asi que no tumba el proceso de golpe. */
            case MEDIO_DIFICIL -> throw new IllegalStateException(
                    "MEDIO_DIFICIL no es un nivel que se pueda pedir a Gemini; solo lo devuelve "
                    + "el DifficultyScorer. Ver CLAUDE.md 10.22.");
            case FACIL -> """
                    NIVEL OBJETIVO: FÁCIL (texto de tecleo sencillo).
                    - Vocabulario simple y cotidiano. Si el artículo usa un tecnicismo y existe un
                      sinónimo igual de fiel, prefiere el sinónimo simple.
                    - Oraciones cortas, una idea por oración.
                    - EVITA comillas, signos de exclamación e interrogación, y paréntesis.
                    - No fuerces la ausencia de tildes ni de ñ (son parte de las palabras reales),
                      pero si existen dos formas igual de fieles, prefiere la que lleve menos tildes.
                    - CIFRAS Y FECHAS EN PALABRAS: no escribas ningún dígito. Todo número, fecha,
                      año o cantidad va con letras: "28" se escribe "veintiocho", "2026" se escribe
                      "dos mil veintiséis", "15%" se escribe "quince por ciento". Esto NO altera el
                      dato ni lo inventa —solo cambia cómo se escribe— así que no contradice la
                      regla de fidelidad. Si un dato quedara tan largo en palabras que vuelve la
                      frase ilegible, prefiere omitirlo antes que escribirlo con dígitos.
                    - QUÉ HACE DIFÍCIL UN TEXTO AL TECLEAR (minimiza todo esto): cada letra
                      mayúscula, cada tilde o ñ, y cada coma o punto. No cuentes ni calcules nada:
                      simplemente escribe la versión con menos de esos elementos que siga siendo
                      fiel y natural.
                    - COMPENSA LOS NOMBRES PROPIOS: si la noticia obliga a usar nombres propios
                      (equipos, lugares, personas), que llevan mayúscula sí o sí, ahorra en todo lo
                      demás: une las frases con "y" en vez de cortarlas con punto (así además la
                      palabra siguiente ya no lleva mayúscula), y omite toda coma que no sea
                      imprescindible para entender. Nombra cada nombre propio UNA sola vez y usa su
                      forma corta habitual si existe.
                    - SIGLAS: prefiere las palabras completas. Si la sigla es de uso corriente
                      (ONU, OEA, NASA, FBI), úsala tal cual: explicarla sonaría forzado. Si es
                      especializada o poco conocida (PAS, DESI, AESAF), escríbela con palabras
                      comunes ("personas muy sensibles") en lugar de la sigla. Nunca la omitas
                      si es el tema central de la noticia: una sigla suelta y sin explicar deja
                      la frase incomprensible, pero borrarla deja la noticia sin asunto.
                    - LONGITUD: entre 20 y 25 PALABRAS (unos 115 a 145 caracteres). Cuenta
                      palabras, no letras.""";
            case MEDIO -> """
                    NIVEL OBJETIVO: MEDIO (dificultad de tecleo intermedia).
                    - REQUISITO PRINCIPAL, y es lo que define este nivel: conserva del artículo
                      AL MENOS DOS DATOS NUMÉRICOS —cifras, fechas, edades, cantidades,
                      porcentajes, resultados— y escríbelos con DÍGITOS, nunca con palabras.
                      "48 aviones", "el 30 de septiembre", "2.300 millones", "7,4 por ciento".
                      No es una autorización: es la condición que separa este nivel del fácil.
                      Un resumen sin cifras es un texto fácil por más largo que sea.
                    - Si el artículo de verdad no trae ningún dato numérico, NO INVENTES NINGUNO:
                      la regla de fidelidad manda por encima de esta. En ese caso redacta con el
                      estilo del nivel fácil y ya está.
                    - MAYÚSCULAS LIBRES: usa los nombres propios completos tal como los da el
                      artículo (nombre y apellido, nombre completo del equipo o del lugar). No los
                      acortes ni los menciones una sola vez, como sí haría el nivel fácil.
                    - Coma y punto con total libertad. Si además quieres articular la oración con
                      otro signo, usa PUNTO Y COMA ( ; ) y UNO SOLO en todo el texto. NO uses dos
                      puntos ( : ), ni paréntesis, ni guiones, ni ningún otro signo: en este nivel
                      la puntuación tiene que ser coma, punto y como mucho un punto y coma.
                    - Signos de interrogación y exclamación libres. (Cómo abrirlos lo dice la
                      regla 4 de gramática; no hace falta repetirlo acá.)
                    - Usa comillas SOLO si el artículo original trae una cita textual real; nunca
                      las agregues por adorno.
                    - Tildes y ñ libres, tal como aparezcan en las palabras reales.
                    - SÍMBOLOS MATEMÁTICOS EN PALABRAS: no uses < > + * / [ ] # { } &. Si el
                      artículo los trae, escríbelos con palabras: "5 < 10" se escribe "5 menor
                      que 10", "4 * 2" se escribe "4 por 2", "50/50" se escribe "50 y 50" o
                      "mitad y mitad". Los números en sí SÍ van con dígitos; lo que se convierte
                      a palabras es solo el símbolo. Nunca dejes el símbolo suelto: si lo
                      escribieras, el sistema lo borraría y los números quedarían pegados
                      formando una cifra falsa.
                    - SIGLAS: úsalas tal como las escribe el artículo, SIN puntos (ONU, no
                      O.N.U. — la norma actual del español no lleva puntos en las siglas). Si
                      la sigla es especializada o poco conocida (PAS, DESI, AESAF), aclara en
                      pocas palabras a qué se refiere la primera vez que aparezca; si es de uso
                      corriente (ONU, OEA, NASA), no hace falta explicar nada.
                    - LONGITUD: entre 26 y 32 PALABRAS (unos 150 a 185 caracteres). Cuenta
                      palabras, no letras.""";
            case DIFICIL -> """
                    NIVEL OBJETIVO: DIFÍCIL (texto de tecleo exigente).
                    - Conserva el vocabulario técnico o específico del artículo, sin simplificarlo.
                    - Se permite mayor complejidad en las oraciones (subordinadas, aposiciones) si el
                      original la tiene.
                    - REQUISITO PRINCIPAL, y es lo que define este nivel: conserva del artículo
                      AL MENOS CUATRO DATOS NUMÉRICOS —cifras, fechas, porcentajes, edades,
                      marcadores, cantidades— escritos con DÍGITOS. No es una autorización: es la
                      condición que separa este nivel del medio. Un resumen con dos cifras es un
                      texto medio por más técnico que suene el vocabulario.
                    - Y AL MENOS TRES CARÁCTERES DE LOS QUE EXIGEN SHIFT, repartidos por el texto:
                      un porcentaje (%%), una cifra con moneda ($), un paréntesis, un punto y coma,
                      dos puntos, o unas comillas si el artículo trae una cita textual real. TRES es
                      el mínimo, no una sugerencia: con dos, el texto NO alcanza este nivel.
                      Los dígitos solos se teclean en bloque y se entra en ritmo; lo que de verdad cuesta es ALTERNAR números con
                      símbolos, porque cada símbolo obliga a soltar el ritmo y recolocar la mano.
                      Es la diferencia entre una lista de números y un texto exigente.
                    - Preserva la puntuación compleja tal como aparece en el original.
                    - Todo esto SOLO con lo que el artículo ya trae: la regla de fidelidad manda
                      por encima. Si no hay material, ver el RESPALDO de abajo.
                    - SIGLAS: consérvalas tal como las usa el artículo, SIN puntos (MLB, DESI,
                      ONU — la norma actual del español no lleva puntos en las siglas). En este
                      nivel no hace falta explicarlas: son parte del tecleo exigente.
                    - LONGITUD: entre 35 y 45 PALABRAS (unos 200 a 260 caracteres). Cuenta
                      palabras, no letras. Es el nivel más largo de los tres a propósito, para
                      que aunque una noticia media salga larga siga habiendo distancia entre
                      los dos niveles. Apunta a la parte alta del rango, no al mínimo.
                    - QUÉ HACER CON ESE ESPACIO: el rango es amplio para que quepan MÁS DATOS
                      del artículo, no para escribir la misma idea con más palabras.
                      Aprovechalo para sumar cifras, fechas, porcentajes y nombres técnicos que
                      el original traiga y que en un texto corto no entrarían. Un texto largo
                      relleno de conectores es más fácil de teclear que uno corto lleno de
                      datos: lo que cuenta es cuántos datos entran, no cuántas palabras.
                    - EJEMPLOS. Estos son resúmenes reales, evaluados por una persona.

                      ASÍ SÍ:
                      1) «Hallan GJ 523b, una "mega-Tierra" rocosa 23,5 veces más masiva que la
                         Tierra; con 2,55 veces su radio, desafía las teorías, pues, con >20
                         masas terrestres, no es gigante gaseoso.»
                         Por qué funciona: once dígitos MEZCLADOS con comillas, punto y coma y
                         un signo de mayor. Los decimales (23,5 · 2,55) valen doble.

                      2) «Juguetes sexuales interrumpieron partidos de la WNBA por segunda noche
                         consecutiva; el viernes el 73-70 Chicago Sky-Golden State Valkyries y
                         el jueves el 124-88 Atlanta-Los Angeles Sparks, con una detención.»
                         Por qué funciona: los marcadores pegados a nombres propios compuestos
                         obligan a alternar dígitos, guiones y mayúsculas todo el tiempo.

                      3) «El nuevo formato "semiburbuja" de la 65 Serie Nacional de Béisbol
                         (4 de octubre-22 de diciembre) presenta dos zonas, cuatro grupos, 44
                         encuentros por conjunto y sistema page en playoffs.»
                         Por qué funciona: solo siete dígitos, pero con comillas y paréntesis.
                         Alcanza el nivel por la MEZCLA, no por la cantidad.

                      ASÍ NO:
                      4) «El mercado de drones agrícolas pasó de 90 unidades en 2023 a 3.000
                         proyectadas para 2024, transformando la agricultura y ganadería
                         argentina con precisión.»
                         Por qué falla: tiene CATORCE dígitos, más que los tres ejemplos
                         buenos, y aun así no sirve. Son puros números sueltos, sin un solo
                         símbolo: se teclean en bloque, se entra en ritmo y el texto se siente
                         medio. LA CANTIDAD DE CIFRAS NO ALCANZA; hace falta la mezcla.

                      5) «España observará el 28 de agosto un eclipse lunar parcial de magnitud
                         0,93, tiñendo la Luna de rojizo. Será visible sin protección,
                         destacando el Oeste peninsular y Canarias.»
                         Por qué falla: dos datos numéricos y ningún símbolo. Es un texto de
                         nivel medio: correcto, pero no exigente de teclear.
                    - RESPALDO (importante): si este artículo NO tiene ese tipo de contenido (no
                      trae cifras, ni datos técnicos, ni citas), NO fuerces la dificultad ni la
                      inventes. En ese caso ignora las reglas de este nivel y redacta con este
                      estilo: %s. Un resumen fiel y más simple es siempre preferible a uno
                      forzado."""
                    .formatted(estiloResumido(respaldo));
        };
    }

    private String construirPromptNoticia(String titulo, String textoCompleto, List<String> titulosYaCubiertosHoy,
            Dificultad nivelObjetivo, Dificultad nivelRespaldo) {
        /* Instrucción de deduplicación por tema: solo se agrega cuando ya hay algo con
           qué comparar. La primera noticia del día (cruzando TODAS las categorías) no
           lleva este bloque — nada que comparar todavía —, así que a Gemini le llega el
           prompt de siempre, sin la rama de "responde DUPLICADO".

           Va ANTES de las instrucciones de redacción a propósito: la decisión de
           "¿es el mismo tema?" tiene que resolverse primero, porque si el modelo ya
           arrancó a redactar el resumen es más difícil que dé marcha atrás. */
        String bloqueDuplicado = titulosYaCubiertosHoy.isEmpty() ? "" :
                "ANTES DE REDACTAR: estos títulos ya se usaron hoy en DEDEA: "
                        + String.join("; ", titulosYaCubiertosHoy) + ". "
                        + "Si esta noticia trata sobre el MISMO evento o suceso que cualquiera de esos títulos "
                        + "(aunque el ángulo o la fuente sean distintos — por ejemplo, dos artículos distintos "
                        + "sobre el mismo eclipse, el mismo partido o la misma noticia de último momento), "
                        + "responde ÚNICAMENTE con la palabra " + Constants.MARCADOR_TEMA_DUPLICADO
                        /* Antes decía "sigue con las reglas de abajo": una referencia POSICIONAL
                           que se rompe en silencio si algún día cambia el orden del prompt. Ahora
                           nombra lo que referencia en vez de dónde está. */
                        + " y nada más, sin explicación. Si es un tema distinto, ignora esta instrucción "
                        + "y sigue con las instrucciones de redacción con total normalidad.\n\n";

        /* Los saltos de linea son REALES. Hasta el 25-ago-2026 aca habia "\\n",
           o sea la secuencia de DOS caracteres barra-ene, asi que el prompt de noticias le
           llegaba a Gemini como un unico parrafo con la sarta "\\n" incrustada entre
           seccion y seccion. Era el unico constructor de prompt del archivo que lo hacia:
           el filtro de spam, la verificacion de material y los text blocks de reglasDeNivel
           siempre usaron saltos de verdad.

           Funcionaba —el modelo tolera la basura— pero le pedia interpretar un separador en
           vez de verlo, y la parte del prompt que mas necesita estructura es justo esta: el
           bloque de deduplicacion, el articulo y las reglas del nivel iban todos pegados.

           OJO AL LEER LA TANDA SIGUIENTE: esto CAMBIA lo que ve el modelo, asi que es un
           cambio de prompt como cualquier otro. Toda la calibracion vigente (umbrales del
           scorer, banda MEDIO_DIFICIL, rangos de longitud) se midio con el prompt roto. Si
           la distribucion se corre, el sospechoso numero uno es esto y no el scorer. */
        return bloqueDuplicado +
                "Actúa como un editor periodístico profesional y experto en gramática española. Toma esta noticia real:\n" +
                "Título: '" + titulo + "'\nContenido: '" + textoCompleto + "'\n\n" +
                "Redacta un texto continuo de un solo párrafo resumiendo lo más importante.\n\n" +
                reglasDeNivel(nivelObjetivo, nivelRespaldo) + "\n\n" +
                "REGLAS CRÍTICAS DE GRAMÁTICA: " +
                "1. La redacción debe ser natural, coherente y gramaticalmente impecable. " +
                "2. Revisa estrictamente la concordancia de género y número. " +
                /* Antes pedía además "signos de puntuación variados", y eso contradecía al
                   nivel FACIL, que pide justo lo contrario. Era redundante de todos modos:
                   cada nivel ya especifica qué puntuación quiere. */
                "3. Usa excelente ortografía. " +
                /* Los signos de apertura se piden explícitamente porque este texto sirve para
                   practicar mecanografía en español: ¿ y ¡ son teclas propias del teclado
                   español y las que menos se llegan a practicar.

                   El "Si usas" del principio no es un adorno: sin él, esta regla le exigía a
                   FACIL abrir con ¿ y ¡ cuando ese nivel los tiene prohibidos. Ahora solo
                   aplica a los niveles que sí los permiten. */
                "4. Si usas preguntas o exclamaciones, ABRE siempre con ¿ o ¡ como exige el español; " +
                "nunca uses solo el signo de cierre. " +
                /* Antes decía "No uses rayas largas ni comillas tipográficas: solo guion
                   normal y comillas rectas", redactado como si AUTORIZARA comillas — y FACIL
                   las prohíbe. Es una regla de FORMA (qué carácter usar), no de permiso: el
                   condicional lo deja claro. */
                "5. Si el nivel te permite comillas o guiones y decides usarlos, escríbelos en su " +
                "forma simple de teclado: comillas rectas y guion normal. Nunca uses rayas largas " +
                "ni comillas tipográficas curvas. " +
                /* Los ordinales tienen que escribirse con letras pegadas al digito porque el
                   indicador ordinal (º / ª) NO sobrevive: no esta en la lista blanca de
                   TextCleaner y se borra sin dejar nada, asi que "el 7º fichaje" le llega al
                   usuario como "el 7 fichaje". Verificado ejecutando la clase: `7.º` queda en
                   `7.` y `7º` queda en `7`. Ya paso dos tandas seguidas (ids 286 y 289) y
                   parecia que Gemini omitia el ordinal cuando en realidad lo escribia bien.

                   Ademas, en teclado LATINOAMERICANO la tecla º/ª directamente no existe (esa
                   posicion da | ° ¬), asi que agregarla a la lista blanca romperia la regla de
                   que todo el contenido tiene que ser tecleable. `7mo` y `3er` son teclas
                   directas, sobreviven intactos y conservan el digito — que para el nivel
                   DIFICIL importa, porque escribirlo con palabras ("septimo") lo eliminaria. */
                "6. ORDINALES: escríbelos como 1er, 2do, 3er, 4to, 7mo, 10mo — número seguido de " +
                "letras, sin espacio. NUNCA uses el símbolo de ordinal (º o ª) ni el punto antes " +
                "de las letras: no se pueden teclear y se pierden. Ejemplo correcto: \"será el 7mo " +
                "fichaje\" y \"la 6ta fecha\". Ejemplo incorrecto: \"el 7º fichaje\", \"la 6ª fecha\", " +
                "\"el 7. fichaje\". " +
                /* Vale para los TRES niveles, no solo para DIFICIL: el nivel puede pedir
                   preservar cifras y símbolos, pero jamás inventarlos. Es una noticia real —
                   un dato fabricado para "cumplir" el nivel sería peor que cualquier
                   inconsistencia de dificultad. */
                "7. REGLA DE FIDELIDAD (inviolable): no inventes ni agregues cifras, fechas, " +
                "porcentajes, símbolos, nombres ni datos que no estén en el artículo original. " +
                "Solo puedes conservar o reformular lo que el texto original ya dice. " +
                "Devuelve SOLO el texto plano, sin títulos, sin comillas, sin introducciones y sin saltos de línea.";
    }
}

