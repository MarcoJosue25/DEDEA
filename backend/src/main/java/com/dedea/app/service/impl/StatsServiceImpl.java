package com.dedea.app.service.impl;

import com.dedea.app.dto.*;
import com.dedea.app.model.Sesion;
import com.dedea.app.model.enums.ModoUsado;
import com.dedea.app.repository.SesionNgramRepository;
import com.dedea.app.repository.SesionProgresoRepository;
import com.dedea.app.repository.SesionRepository;
import com.dedea.app.repository.SesionTeclaRepository;
import com.dedea.app.service.StatsService;
import com.dedea.app.util.Constants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import com.dedea.app.dto.ProgresoNgramResponse;
import java.util.ArrayList;
import java.util.Map;

/**
 * ==============================================================================
 * MOTOR DE ANALÍTICA BIOMÉTRICA Y ESTADÍSTICAS - DEDEA V2
 * ==============================================================================
 * Este servicio procesa el rendimiento histórico del usuario mecanógrafo.
 * Refactoreado en la V2 para dividir las respuestas ejecutivas de las solicitudes
 * cognitivas de debilidades orientadas a la IA adaptativa de Gemini.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StatsServiceImpl implements StatsService {

    //Declaración de dependencias a ser inyectadas
    private final SesionRepository sesionRepository;
    private final SesionNgramRepository sesionNgramRepository;
    private final SesionTeclaRepository sesionTeclaRepository;
    // Solo lo usa el modo sombra, para traer el recorrido del rival.
    private final SesionProgresoRepository sesionProgresoRepository;

    /* Los modos con un rival GLOBAL que volver a correr: su texto se reconstruye desde la
       noticia o el texto de IA. El Curso tiene su propio modo sombra, por ejercicio.
       (Qué sesiones cuentan para PROMEDIOS y MARCAS ya no se decide por modo: ver
       CondicionesSesion.) */
    private static final List<ModoUsado> MODOS_CON_RIVAL_GLOBAL = List.of(ModoUsado.NOTICIAS, ModoUsado.IA);

    /* Formatos de DATE_FORMAT de MySQL por agrupación. %x/%v es el año-semana ISO
       (semana que empieza el lunes); usar %Y con %v mezcla mal el cambio de año. */
    private static final Map<String, String> FORMATOS_PERIODO = Map.of(
            "dia", "%Y-%m-%d",
            "semana", "%x-S%v",
            "mes", "%Y-%m");

    /**
     * obtenerResumenGlobal: OPERACIÓN LIGERA DE DASHBOARD
     * Recupera promedios mundiales y volumen de juego del perfil SIN procesar n-gramas.
     * Ideal para pintar componentes rápidos en el Navbar o Home de React.
     */
    @Override
    public StatsResponse obtenerResumenGlobal(String identificadorTemporal) {
        log.info("[STATS] Calculando resumen global ejecutivo para el usuario: {}", abreviar(identificadorTemporal));

        // 1. Cargamos todas las sesiones completadas por este usuario
        List<Sesion> sesiones = sesionRepository.findByIdentificadorTemporal(identificadorTemporal);

        /* 2. Para los PROMEDIOS: Noticias, IA y el Curso por niveles, sin sus juegos ni lo
           que duró menos de 10 s. Hasta el 10-sep-2026 eran solo Noticias e IA y el Curso
           quedaba fuera entero; el usuario decidió meterlo, y el filtro que lo hace posible
           —con lo medido antes de activarlo— está en CondicionesSesion. */
        List<Sesion> medibles = sesionRepository.findMedibles(identificadorTemporal);

        // Cálculo seguro de velocidad WPM Promedio (Evita divisiones por cero con orElse)
        int wpmPromedio = (int) Math.round(
                medibles.stream().mapToInt(Sesion::getWpm).average().orElse(0.0)
                /*average(): Calcula el promedio de todos los valores. Devuelve u optionalDouble
                .orElse(): Si el optional está vacío, se usa 0.0.
                (Int) Casteo. Convierte de log a int*/
        );

        // 3. Promedio exacto monetario/financiero de precisión usando el Double-Escudo de BigDecimal
        BigDecimal precisionPromedio = medibles.isEmpty() ? BigDecimal.ZERO :
                medibles.stream()
                        .map(Sesion::getPrecision)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        //reduce(): combina los elementos y los va sumando desde el cero hasta el último.
                        .divide(BigDecimal.valueOf(medibles.size()), 2, RoundingMode.HALF_UP);
                        //Divide la suma entre la cantidad de sesiones, 2(Decimales a conservar), Redondeo hacia arriba

        /* 4. El VOLUMEN en cambio cuenta todo. Que los drills no sirvan para promediar
           velocidad no significa que no hayas practicado: el tiempo invertido y las teclas
           falladas suman igual, vengan de donde vengan. */
        int tiempoTotalSegundos = sesiones.stream().mapToInt(Sesion::getSegundos).sum();
        long caracteresEscritos = sesionTeclaRepository.sumarPulsacionesTotales(identificadorTemporal);
        long caracteresFallados = sesionTeclaRepository.sumarErroresTotales(identificadorTemporal);

        return StatsResponse.builder()
                .wpmPromedio(wpmPromedio)
                .precisionPromedio(precisionPromedio)
                .sesionesMedidas(medibles.size())
                .sesionesCompletadas(sesiones.size())
                .tiempoTotalSegundos(tiempoTotalSegundos)
                .caracteresEscritos(caracteresEscritos)
                .caracteresFallados(caracteresFallados)
                .build();
    }

    /**
     * obtenerDiagnosticoDebilidades: ALGORITMO ADAPTATIVO AVANZADO
     * Extrae, filtra y ordena las combinaciones y caracteres donde el usuario falla.
     * Este DTO es el insumo sagrado que lee Gemini para armar las Typing Arenas.
     */
    @Override
    public DebilidadesResponse obtenerDiagnosticoDebilidades(String identificadorTemporal, String enfoque) {
        log.info("[STATS] Ejecutando analítica de debilidades. Enfoque: {}", enfoque);

        LocalDateTime fechaBase = LocalDateTime.now().minusDays(Constants.DIAS_ANALISIS_HISTORICO_BASE);

        List<NgramStatProyeccion> ngramsCrudos = sesionNgramRepository.findNgramStatsAgrupados(
                identificadorTemporal, fechaBase, Constants.NGRAM_MIN_INTENTOS);

        List<TeclaStatProyeccion> teclasCrudas = sesionTeclaRepository.findTeclaStatsAgrupados(
                identificadorTemporal, fechaBase, Constants.TECLA_MIN_INTENTOS);

        if (ngramsCrudos.size() < 5) {
            log.info("[STATS] Datos escasos para {}. Expandiendo a {} días.",
                    abreviar(identificadorTemporal), Constants.DIAS_ANALISIS_HISTORICO_EXPANDIDO);
            LocalDateTime fechaExpandida = LocalDateTime.now().minusDays(Constants.DIAS_ANALISIS_HISTORICO_EXPANDIDO);
            ngramsCrudos = sesionNgramRepository.findNgramStatsAgrupados(
                    identificadorTemporal, fechaExpandida, Constants.NGRAM_MIN_INTENTOS);
            teclasCrudas = sesionTeclaRepository.findTeclaStatsAgrupados(
                    identificadorTemporal, fechaExpandida, Constants.TECLA_MIN_INTENTOS);
        }

        boolean ascendente = "LEVES".equalsIgnoreCase(enfoque);

        return DebilidadesResponse.builder()
                .peoresBigramas(procesarNgramsYOrdenar(ngramsCrudos, "BIGRAMA", ascendente))
                .peoresTrigramas(procesarNgramsYOrdenar(ngramsCrudos, "TRIGRAMA", ascendente))
                .peoresTeclas(procesarTeclasYOrdenar(teclasCrudas, ascendente))
                .build();
    }

    private List<DebilidadesResponse.ItemDebilidad> procesarNgramsYOrdenar(
            List<NgramStatProyeccion> crudos, String tipoFiltro, boolean ascendente) {
        return crudos.stream()
                .filter(dto -> tipoFiltro.equalsIgnoreCase(dto.tipo()))
                //.filter(): Compara el tipo de filtro que recibe cada dto con el tipo de dato del Enum NgramStatsProyeccion
                .map(dto -> {
                    double pct = dto.totalIntentos().doubleValue() > 0
                            ? (dto.errores().doubleValue() / dto.totalIntentos().doubleValue()) * 100
                            : 0.0;
                    return new DebilidadesResponse.ItemDebilidad(
                            dto.secuencia(),
                            (int) Math.round(pct),
                            dto.totalIntentos().longValue()
                    );
                })
                .filter(item -> item.getPorcentajeError() >= (int)(Constants.NGRAM_UMBRAL_ERROR * 100))
                .sorted(ascendente ?
                        Comparator.comparingInt(DebilidadesResponse.ItemDebilidad::getPorcentajeError) :
                        Comparator.comparingInt(DebilidadesResponse.ItemDebilidad::getPorcentajeError).reversed())
                .limit(5)
                .collect(Collectors.toList());
    }

    @Override
    public RivalSesionResponse obtenerRival(Integer sesionId, String identificadorTemporal) {
        Sesion sesion = sesionRepository.findByIdAndIdentificadorTemporal(sesionId, identificadorTemporal)
                .orElse(null);
        if (sesion == null) return null;

        /* Solo Noticias e IA. Curso ya tiene su propio modo sombra por ejercicio, y el Área
           de Entrenamiento genera contenido distinto en cada vuelta: no hay nada estable
           contra lo que volver a correr. */
        if (!MODOS_CON_RIVAL_GLOBAL.contains(sesion.getModoUsado())) return null;

        /* El texto se reconstruye. En estos modos la sesión no guarda copia (a diferencia
           de Curso, que sí lo hace justo para el fantasma), así que se lee del contenido
           original. Si la noticia se borró en una sincronización posterior, no hay rival. */
        String texto = null;
        if (sesion.getNoticia() != null) {
            texto = sesion.getNoticia().getContenidoCompleto();
        } else if (sesion.getTextoIa() != null) {
            texto = sesion.getTextoIa().getContenido();
        }
        if (texto == null || texto.isBlank()) return null;

        // El recorrido del rival para poder dibujarlo detrás del tuyo al terminar.
        List<SesionProgresoDTO> progreso = sesionProgresoRepository
                .findBySesionIdOrderBySegundoAsc(sesion.getId())
                .stream()
                .map(p -> new SesionProgresoDTO(p.getSegundo(), p.getWpmMomento(), p.getPrecisionMomento()))
                .collect(Collectors.toList());

        return new RivalSesionResponse(
                sesion.getId(),
                sesion.getWpm(),
                sesion.getSegundos(),
                texto,
                sesion.getModoUsado().name(),
                sesion.getFechaGuardado().toLocalDate(),
                sesion.getNoticia() != null ? sesion.getNoticia().getId() : null,
                sesion.getTextoIa() != null ? sesion.getTextoIa().getId() : null,
                progreso);
    }

    @Override
    public List<DebilidadesResponse.ItemDebilidad> obtenerMapaDeTeclas(String identificadorTemporal) {
        /* Sin límite de 5 y sin umbral de error: el mapa necesita TODAS las teclas con
           datos, incluidas las que casi no fallas — son las que se pintan en frío y dan
           el contraste.

           Se devuelven también las que tienen POCAS pulsaciones (mínimo 1) aunque no
           alcancen para colorearlas: el front necesita el conteo real para poder decir
           "3 intentos, pocos para medir" en vez de un "sin datos" a secas que no
           distingue una tecla que nunca tocaste de una que tocaste tres veces. Quién
           tiene suficiente para pintarse lo decide la vista. */
        return sesionTeclaRepository
                .findTeclaStatsParaMapa(identificadorTemporal, 1)
                .stream()
                .map(dto -> {
                    double pct = dto.totalIntentos().doubleValue() > 0
                            ? (dto.errores().doubleValue() / dto.totalIntentos().doubleValue()) * 100
                            : 0.0;
                    return new DebilidadesResponse.ItemDebilidad(
                            dto.tecla(), (int) Math.round(pct), dto.totalIntentos().longValue());
                })
                .sorted(Comparator.comparingInt(DebilidadesResponse.ItemDebilidad::getPorcentajeError).reversed())
                .collect(Collectors.toList());
    }

    private List<DebilidadesResponse.ItemDebilidad> procesarTeclasYOrdenar(
            List<TeclaStatProyeccion> crudos, boolean ascendente) {
        return crudos.stream()
                .map(dto -> {
                    double pct = dto.totalIntentos().doubleValue() > 0
                            ? (dto.errores().doubleValue() / dto.totalIntentos().doubleValue()) * 100
                            : 0.0;
                    return new DebilidadesResponse.ItemDebilidad(
                            dto.tecla(),
                            (int) Math.round(pct),
                            dto.totalIntentos().longValue()
                    );
                })
                .filter(item -> item.getPorcentajeError() >= (int)(Constants.NGRAM_UMBRAL_ERROR * 100))
                .sorted(ascendente ?
                        Comparator.comparingInt(DebilidadesResponse.ItemDebilidad::getPorcentajeError) :
                        Comparator.comparingInt(DebilidadesResponse.ItemDebilidad::getPorcentajeError).reversed())
                .limit(5)
                .collect(Collectors.toList());
    }
    @Override
    public ProgresoNgramResponse obtenerProgresoNgrams(String identificadorTemporal) {
        log.info("[STATS] Calculando progreso de ngrams para: {}", abreviar(identificadorTemporal));

        // Ventana reciente: últimas 3 sesiones
        List<NgramStatProyeccion> recientes = sesionNgramRepository.findNgramStatsUltimasSesiones(
                identificadorTemporal, 3, 1);

        // Ventana anterior: las 3 sesiones previas
        List<NgramStatProyeccion> anteriores = sesionNgramRepository.findNgramStatsVentanaAnterior(
                identificadorTemporal, 3, 3, 1);

        // Convertimos anteriores a mapa para búsqueda rápida
        Map<String, NgramStatProyeccion> mapaAnteriores = anteriores.stream()
                .collect(Collectors.toMap(NgramStatProyeccion::secuencia, n -> n));

        List<ProgresoNgramResponse.NgramConProgreso> mejorandoEnTop5 = new ArrayList<>();
        List<ProgresoNgramResponse.NgramConProgreso> graduados = new ArrayList<>();

        for (NgramStatProyeccion reciente : recientes) {
            // Calculamos porcentaje actual
            double pctActual = reciente.totalIntentos().doubleValue() > 0
                    ? (reciente.errores().doubleValue() / reciente.totalIntentos().doubleValue()) * 100
                    : 0.0;
            int pctActualInt = (int) Math.round(pctActual);

            // Buscamos si existía en ventana anterior
            NgramStatProyeccion anterior = mapaAnteriores.get(reciente.secuencia());
            if (anterior == null) continue; // Ngram nuevo, sin historial previo

            double pctAnterior = anterior.totalIntentos().doubleValue() > 0
                    ? (anterior.errores().doubleValue() / anterior.totalIntentos().doubleValue()) * 100
                    : 0.0;
            int pctAnteriorInt = (int) Math.round(pctAnterior);

            // Solo nos interesan los que mejoraron
            if (pctActualInt >= pctAnteriorInt) continue;
            if (pctAnteriorInt < (int)(Constants.NGRAM_UMBRAL_ERROR * 100)) continue; // Nuevo filtro

            int puntosMejorados = pctAnteriorInt - pctActualInt;

            ProgresoNgramResponse.NgramConProgreso progreso = ProgresoNgramResponse.NgramConProgreso.builder()
                    .secuencia(reciente.secuencia())
                    .tipo(reciente.tipo())
                    .porcentajeErrorActual(pctActualInt)
                    .porcentajeErrorAnterior(pctAnteriorInt)
                    .puntosMejorados(puntosMejorados)
                    .totalIntentos(reciente.totalIntentos().longValue())
                    .build();

            // Graduado si bajó del umbral del 30%
            if (pctActualInt < (int)(Constants.NGRAM_UMBRAL_ERROR * 100)) {
                graduados.add(progreso);
            } else {
                mejorandoEnTop5.add(progreso);
            }
        }

        /* Ordenamos por puntos mejorados descendente y recortamos a 5. Sin el .limit(5),
           que faltaba en las dos listas pese a que el propio nombre "mejorandoEnTop5" lo
           promete, una sesión que arregla muchos ngramas de golpe inunda "graduados" con
           más tarjetas de las que caben en pantalla (se vieron 15 en producción) — deja de
           leerse como "tus últimos logros" para ser un volcado completo sin filtrar.
           La ventana de "últimas 3 sesiones" (ver findNgramStatsUltimasSesiones) ya se
           encarga de la frescura/rotación: al practicar de nuevo, la ventana se corre y los
           ngramas que quedan fuera de las 3 sesiones más recientes dejan de aparecer solos.
           Este límite solo acota cuántos caben cuando esa ventana trae más de 5 a la vez. */
        List<ProgresoNgramResponse.NgramConProgreso> mejorandoTop5 = mejorandoEnTop5.stream()
                .sorted(Comparator.comparingInt(ProgresoNgramResponse.NgramConProgreso::getPuntosMejorados).reversed())
                .limit(5)
                .collect(Collectors.toList());
        List<ProgresoNgramResponse.NgramConProgreso> graduadosTop5 = graduados.stream()
                .sorted(Comparator.comparingInt(ProgresoNgramResponse.NgramConProgreso::getPuntosMejorados).reversed())
                .limit(5)
                .collect(Collectors.toList());

        return ProgresoNgramResponse.builder()
                .mejorandoEnTop5(mejorandoTop5)
                .graduados(graduadosTop5)
                .build();
    }



    /**
     * obtenerProgresoTemporal: LA CURVA DE APRENDIZAJE
     * Agrupa las sesiones por día, semana o mes y devuelve el WPM y la precisión promedio
     * de cada bloque. El agrupamiento lo hace MySQL con DATE_FORMAT, así que la consulta
     * devuelve ya una fila por punto del gráfico en vez de traer 128 sesiones para
     * agruparlas acá.
     */
    @Override
    public ProgresoTemporalResponse obtenerProgresoTemporal(String identificadorTemporal, String agrupacion) {
        /* La agrupación llega del frontend y termina dentro de un DATE_FORMAT, así que
           jamás la interpolamos directo: la usamos como llave de un mapa cerrado. Si llega
           cualquier otra cosa, se cae a "dia" en vez de viajar a la base de datos. */
        String clave = agrupacion == null ? "dia" : agrupacion.toLowerCase();

        /* "hoy" es la única agrupación que NO agrupa: devuelve una sesión por punto con su
           hora, para poder ver cómo fue cada práctica del día en vez de un promedio que
           las aplana todas en un solo valor. Por eso va por su propia consulta y sale
           antes del mapa de formatos. */
        if ("hoy".equals(clave)) {
            List<ProgresoTemporalResponse.PuntoProgreso> deHoy =
                    sesionRepository.obtenerProgresoDeHoy(identificadorTemporal).stream()
                            .map(p -> new ProgresoTemporalResponse.PuntoProgreso(
                                    p.getPeriodo(), p.getWpm(), p.getPrecisionMedia(), p.getSesiones()))
                            .collect(Collectors.toList());
            log.info("[STATS] Progreso de hoy ({} sesiones) para: {}",
                    deHoy.size(), abreviar(identificadorTemporal));
            return new ProgresoTemporalResponse(clave, deHoy);
        }

        String formato = FORMATOS_PERIODO.get(clave);
        if (formato == null) {
            log.warn("[STATS] Agrupación desconocida '{}', se usa 'dia'", agrupacion);
            clave = "dia";
            formato = FORMATOS_PERIODO.get("dia");
        }

        log.info("[STATS] Progreso temporal ({}) para: {}", clave, abreviar(identificadorTemporal));

        List<ProgresoTemporalResponse.PuntoProgreso> puntos =
                sesionRepository.obtenerProgresoTemporal(identificadorTemporal, formato).stream()
                        .map(p -> new ProgresoTemporalResponse.PuntoProgreso(
                                p.getPeriodo(), p.getWpm(), p.getPrecisionMedia(), p.getSesiones()))
                        .collect(Collectors.toList());

        return new ProgresoTemporalResponse(clave, puntos);
    }

    /**
     * obtenerRecords: MARCAS PERSONALES Y CONSTANCIA
     * Las marcas salen de Noticias, IA y el Curso AVANZADO —ni Básico ni Intermedio: sus
     * sílabas y listas cortas no pueden ser tu "mejor WPM"— (ver CondicionesSesion). La
     * racha, en cambio, cuenta cualquier día con práctica.
     */
    @Override
    // Lee el ejercicio del récord, que es LAZY: sin transacción no se garantiza poder cargarlo.
    @Transactional(readOnly = true)
    public RecordsResponse obtenerRecords(String identificadorTemporal) {
        log.info("[STATS] Calculando récords y racha para: {}", abreviar(identificadorTemporal));

        List<Sesion> medibles = sesionRepository.findParaMarcas(identificadorTemporal);

        // Sin sesiones medibles todavía no hay récords que mostrar, pero la racha se
        // calcula igual: es sobre días con actividad de cualquier modo, no sobre rendimiento.
        Sesion mejorSesion = medibles.stream()
                .max(Comparator.comparingInt(Sesion::getWpm))
                .orElse(null);

        BigDecimal mejorPrecision = medibles.stream()
                .map(Sesion::getPrecision)
                .max(Comparator.naturalOrder())
                .orElse(BigDecimal.ZERO);

        int sesionMasLarga = medibles.stream()
                .mapToInt(Sesion::getSegundos)
                .max()
                .orElse(0);

        List<LocalDate> dias = sesionRepository.obtenerDiasConActividad(identificadorTemporal);

        // Del Curso: el ejercicio y su nivel, para que la tarjeta sepa a qué ruta volver.
        boolean delCurso = mejorSesion != null && mejorSesion.getModoUsado() == ModoUsado.CURSO
                && mejorSesion.getEjercicio() != null && mejorSesion.getEjercicio().getNivel() != null;

        return new RecordsResponse(
                mejorSesion == null ? 0 : mejorSesion.getWpm(),
                mejorSesion == null ? null : mejorSesion.getFechaGuardado().toLocalDate(),
                mejorSesion == null ? null : mejorSesion.getId(),
                delCurso ? mejorSesion.getEjercicio().getId() : null,
                delCurso ? mejorSesion.getEjercicio().getNivel().name() : null,
                mejorPrecision,
                sesionMasLarga,
                calcularRachaActual(dias),
                calcularRachaMaxima(dias),
                dias.size());
    }

    /* Los días llegan ordenados de más reciente a más antiguo y sin repetir.

       La racha actual arranca en hoy o en ayer: si todavía no practicaste hoy la racha no
       está rota, recién se corta cuando pasa un día entero completo sin actividad. Cortarla
       a medianoche castigaría a alguien que practica todas las noches. */
    private int calcularRachaActual(List<LocalDate> diasDesc) {
        if (diasDesc.isEmpty()) return 0;

        LocalDate hoy = LocalDate.now();
        LocalDate masReciente = diasDesc.get(0);
        if (masReciente.isBefore(hoy.minusDays(1))) return 0;

        int racha = 1;
        LocalDate esperado = masReciente.minusDays(1);
        for (int i = 1; i < diasDesc.size(); i++) {
            if (!diasDesc.get(i).equals(esperado)) break;
            racha++;
            esperado = esperado.minusDays(1);
        }
        return racha;
    }

    private int calcularRachaMaxima(List<LocalDate> diasDesc) {
        if (diasDesc.isEmpty()) return 0;

        int maxima = 1;
        int actual = 1;
        for (int i = 1; i < diasDesc.size(); i++) {
            // Lista descendente: los días consecutivos van restando de a uno.
            if (diasDesc.get(i).equals(diasDesc.get(i - 1).minusDays(1))) {
                actual++;
                maxima = Math.max(maxima, actual);
            } else {
                actual = 1;
            }
        }
        return maxima;
    }

    /**
     * obtenerTeclasLentas: EL OTRO MODO DEL MAPA DE CALOR
     * Fallar poco no significa escribir rápido. Una tecla lejana puede tener 0% de error y
     * aun así ser la que te frena, porque cada vez que aparece hay que buscarla. Este
     * cálculo deriva el tiempo entre pulsaciones consecutivas de sesion_teclas_eventos.
     */
    @Override
    public TeclasLentasResponse obtenerTeclasLentas(String identificadorTemporal) {
        log.info("[STATS] Calculando teclas más lentas para: {}", abreviar(identificadorTemporal));

        List<TeclasLentasResponse.TeclaLenta> teclas =
                sesionRepository.obtenerTeclasMasLentas(
                                identificadorTemporal,
                                Constants.MIN_PULSACIONES_TECLA_LENTA,
                                Constants.LIMITE_TECLAS_LENTAS)
                        .stream()
                        .map(t -> new TeclasLentasResponse.TeclaLenta(
                                t.getTecla(), t.getMsPromedio(), t.getPulsaciones()))
                        .collect(Collectors.toList());

        /* La pantalla necesita distinguir "escribes parejo" de "todavía no hay datos": los
           eventos tecla a tecla solo existen desde que se añadió ese registro, así que un
           usuario antiguo puede tener cientos de sesiones y cero eventos. */
        return new TeclasLentasResponse(!teclas.isEmpty(), teclas);
    }

    // Los logs no deberían guardar el identificador completo (es el UUID permanente de la
    // cuenta para usuarios logueados). Con los primeros 8 caracteres alcanza para rastrear
    // un caso en desarrollo sin exponer el identificador completo en los logs del servidor.
    private String abreviar(String identificador) {
        if (identificador == null || identificador.length() < 8) return "***";
        return identificador.substring(0, 8) + "...";
    }
}