package com.dedea.app.service.impl;

import com.dedea.app.dto.CursoStatsResponse;
import com.dedea.app.dto.UmbralesLatidoResponse;
import com.dedea.app.mapper.EntityMapper;
import com.dedea.app.model.Ejercicio;
import com.dedea.app.model.enums.NivelCurso;
import com.dedea.app.model.enums.TipoEjercicio;
import com.dedea.app.repository.*;
import com.dedea.app.service.CursoStatsService;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/* El catálogo de ejercicios sembrado con el MISMO código de producción, pero sobre un
   repositorio en memoria: sin MySQL, sin Spring y sin tocar ninguna base.

   Lo comparten los tests del catálogo. El diccionario sale de `seed/palabras_es.txt`, con
   las dos consultas que usan los generadores imitadas con su mismo contrato; qué palabras
   exactas tenga la base de cada uno no cambia nada de lo que se prueba, porque los filtros
   de letras los aplica el generador.

   Además de guardar, registra una HUELLA de cada guardado —título, nivel, orden, tipo y si
   quedó activo— tal como estaba en ese momento: la entidad se muta después, y sin la foto
   no se podría ver que un mismo título pasó por dos nodos distintos. */
class CatalogoEnMemoria {

    record Huella(String titulo, NivelCurso nivel, Integer orden, TipoEjercicio tipo, boolean activo) {}

    final Map<Integer, Ejercicio> porId = new LinkedHashMap<>();
    final Map<String, Ejercicio> porTitulo = new HashMap<>();
    final List<Huella> guardados = new ArrayList<>();
    final EjercicioServiceImpl servicio;

    /* Lo que devuelve el servicio de estadísticas (un doble) cuando el generador le pide los
       umbrales de un nodo con latidos. El cálculo de verdad lo prueba CursoStatsServiceImplTest;
       acá solo interesa que el contenido los lleve. */
    static final UmbralesLatidoResponse UMBRALES_LATIDO =
            new UmbralesLatidoResponse(10, BigDecimal.valueOf(85), BigDecimal.valueOf(90));

    private CatalogoEnMemoria() throws Exception {
        EjercicioRepository ejercicios = mock(EjercicioRepository.class);
        AtomicInteger secuencia = new AtomicInteger(1);
        when(ejercicios.save(any(Ejercicio.class))).thenAnswer(inv -> {
            Ejercicio e = inv.getArgument(0);
            if (e.getId() == null) e.setId(secuencia.getAndIncrement());
            porId.put(e.getId(), e);
            porTitulo.put(e.getTitulo(), e);
            guardados.add(new Huella(e.getTitulo(), e.getNivel(), e.getOrden(), e.getTipo(),
                    Boolean.TRUE.equals(e.getActivo())));
            return e;
        });
        when(ejercicios.findByTitulo(anyString()))
                .thenAnswer(inv -> Optional.ofNullable(porTitulo.get(inv.<String>getArgument(0))));
        when(ejercicios.findById(any()))
                .thenAnswer(inv -> Optional.ofNullable(porId.get(inv.<Integer>getArgument(0))));

        List<String> diccionario = leerPalabrasSemilla();
        DiccionarioRepository palabras = mock(DiccionarioRepository.class);
        when(palabras.findTopNPorFrecuencia(anyInt()))
                .thenAnswer(inv -> diccionario.subList(0, Math.min(inv.<Integer>getArgument(0), diccionario.size())));
        // El mismo contrato que la consulta nativa: largo >= 2, `palabra REGEXP :patron`,
        // en orden de frecuencia y cortado en el límite. La semilla ya viene ordenada.
        when(palabras.findPorPatronDeLetras(anyString(), anyInt())).thenAnswer(inv -> {
            Pattern patron = Pattern.compile(inv.getArgument(0));
            return diccionario.stream()
                    .filter(p -> p.length() >= 2 && patron.matcher(p).find())
                    .limit(inv.<Integer>getArgument(1))
                    .collect(Collectors.toList());
        });

        // Sin historial: la Lluvia de repaso cae a su set genérico, como para un usuario nuevo.
        CursoStatsService cursoStats = mock(CursoStatsService.class);
        when(cursoStats.obtenerStatsPorNivel(any(), any()))
                .thenReturn(CursoStatsResponse.builder().teclasMasFalladas(List.of()).build());
        when(cursoStats.umbralesDeLatidos(any())).thenReturn(UMBRALES_LATIDO);

        servicio = new EjercicioServiceImpl(
                ejercicios, palabras, mock(DictadoAudioRepository.class),
                mock(SesionRepository.class), mock(SesionProgresoRepository.class),
                mock(SesionTeclaRepository.class), mock(SesionNgramRepository.class),
                mock(SesionTeclaEventoRepository.class), new EntityMapper(), new ObjectMapper(), cursoStats);
    }

    /* Solo el Curso por niveles: es lo que siembra el arranque para el sendero. */
    static CatalogoEnMemoria soloCurso() throws Exception {
        CatalogoEnMemoria c = new CatalogoEnMemoria();
        c.servicio.sembrarCatalogoCurso();
        return c;
    }

    /* Ejercicios Base y Curso, en el orden en que los siembra EjercicioSeedRunner: así se
       ve si un título del Curso le pisa uno a Ejercicios Base. */
    static CatalogoEnMemoria completo() throws Exception {
        CatalogoEnMemoria c = new CatalogoEnMemoria();
        c.servicio.sembrarCatalogoBase();
        c.servicio.sembrarCatalogoCurso();
        return c;
    }

    List<Ejercicio> senderoActivo(NivelCurso nivel) {
        return porId.values().stream()
                .filter(e -> e.getNivel() == nivel)
                .filter(e -> Boolean.TRUE.equals(e.getActivo()))
                .filter(e -> e.getOrden() != null && e.getOrden() > 0)
                .sorted(Comparator.comparing(Ejercicio::getOrden))
                .toList();
    }

    private static List<String> leerPalabrasSemilla() throws Exception {
        try (var in = CatalogoEnMemoria.class.getResourceAsStream("/seed/palabras_es.txt");
             var lector = new BufferedReader(new InputStreamReader(
                     Objects.requireNonNull(in, "falta seed/palabras_es.txt"), StandardCharsets.UTF_8))) {
            return lector.lines()
                    .map(l -> l.trim().split("\\s+")[0])
                    .filter(l -> !l.isBlank())
                    .collect(Collectors.toList());
        }
    }
}
