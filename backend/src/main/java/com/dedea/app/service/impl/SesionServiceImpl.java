package com.dedea.app.service.impl;

import com.dedea.app.dto.SesionRequest;
import com.dedea.app.dto.SesionResponse;
import com.dedea.app.exception.ApiException;
import com.dedea.app.util.WpmCalculator;
import com.dedea.app.util.Constants;
import com.dedea.app.dto.TeclaStatsRequest;
import com.dedea.app.mapper.EntityMapper;
import com.dedea.app.model.Sesion;
import com.dedea.app.model.SesionNgram;
import com.dedea.app.model.SesionProgreso;
import com.dedea.app.model.SesionTecla;
import com.dedea.app.model.SesionTeclaEvento;
import com.dedea.app.model.enums.Dificultad;
import com.dedea.app.repository.NoticiaRepository;
import com.dedea.app.repository.TextoIaRepository;
import com.dedea.app.repository.SesionNgramRepository;
import com.dedea.app.repository.SesionProgresoRepository;
import com.dedea.app.repository.SesionRepository;
import com.dedea.app.repository.SesionTeclaRepository;
import com.dedea.app.repository.SesionTeclaEventoRepository;
import com.dedea.app.service.SesionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.dedea.app.model.enums.ModoUsado; // <-- ¡Agrega esta línea!
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j // Con esta anotacion las llaves que ponemos guardan lo que les pasamos después de la coma
@Service
@RequiredArgsConstructor
public class SesionServiceImpl implements SesionService {

    //Declaración de dependecias para ser inyectadas y reutilizadas
    private final SesionRepository sesionRepository;
    private final SesionNgramRepository sesionNgramRepository;
    private final SesionTeclaRepository sesionTeclaRepository;
    private final SesionProgresoRepository sesionProgresoRepository;
    private final SesionTeclaEventoRepository sesionTeclaEventoRepository;
    private final NoticiaRepository noticiaRepository;
    private final TextoIaRepository textoIaRepository;
    private final EntityMapper mapper;

    @Override
    @Transactional
    public SesionResponse guardarSesionCompletada(String identificadorTemporal, SesionRequest request) {

        log.info("Iniciando persistencia atómica para UUID: {}...", identificadorTemporal.substring(0, 8));

        /* EL SERVIDOR RECALCULA. Hasta el 29-ago-2026 se guardaba `request.getWpm()` tal
           cual: desde la consola del navegador se podía mandar un WPM de 900 y quedaba en el
           historial y en los récords. `WpmCalculator` ya existía completo desde siempre —
           simplemente no se llamaba desde ningún lado.

           Se recalcula a partir de las pulsaciones que el cliente ya envía por tecla, que es
           un dato mucho más difícil de falsificar de forma coherente: habría que fabricar
           también el desglose por tecla y que cuadre con la duración. */
        Verificacion v = verificar(request);

        Sesion sesion = Sesion.builder()
                .identificadorTemporal(identificadorTemporal)
                .wpm(v.wpm())
                .precision(v.precision())
                .segundos(request.getSegundos())
                .modoUsado(parseModoUsado(request.getModoUsado()))
                .dificultad(parseDificultad(request.getDificultad()))
                .fechaGuardado(LocalDateTime.now())
                .noticia(request.getNoticiaId() != null ? noticiaRepository.getReferenceById(request.getNoticiaId()) : null)
                .textoIa(request.getTextoIaId() != null ? textoIaRepository.getReferenceById(request.getTextoIaId()) : null)
                .build();

        Sesion sesionGuardada = sesionRepository.save(sesion);

        if (request.getProgreso() != null && !request.getProgreso().isEmpty()) {
            List<SesionProgreso> progreso = request.getProgreso().stream()
                    .map(dto -> mapper.toSesionProgreso(dto, sesionGuardada))
                    .collect(Collectors.toList());
            sesionProgresoRepository.saveAll(progreso);
        }
        /*mapper: Agarra el dto y construye la entidad JPA completa lista para guardar, incluyendo la conexión con el padre
        mapper.toSesionProgreso(dto, sesionGuardada): Enlaza el objeto padre completo con la clase hija
        Entidad JPA (Clase con @Entity "Model") Entidad completa: el DTO más el vínculo con el padre
        Lo que hace mapper es transformar cada dto en una entidad SesionProgreso con el id del padre fijo en todos
        Inserta todos los dtos convertidos en entidades JPA
        */

        if (request.getNgrams() != null && !request.getNgrams().isEmpty()) {
            List<SesionNgram> ngrams = request.getNgrams().stream()
                    .map(dto -> mapper.toSesionNgram(dto, sesionGuardada))
                    .collect(Collectors.toList());
            sesionNgramRepository.saveAll(ngrams);
        }

        if (request.getTeclas() != null && !request.getTeclas().isEmpty()) {
            List<SesionTecla> teclas = request.getTeclas().stream()
                    .map(dto -> mapper.toSesionTecla(dto, sesionGuardada))
                    .collect(Collectors.toList());
            sesionTeclaRepository.saveAll(teclas);
        }

        /* Los eventos tecla a tecla son el insumo del análisis de ritmo (qué teclas te
           frenan aunque no las falles). Llegan en lote y pueden ser cientos por sesión, por
           eso van con saveAll y no uno por uno. */
        if (request.getEventos() != null && !request.getEventos().isEmpty()) {
            List<SesionTeclaEvento> eventos = request.getEventos().stream()
                    .map(dto -> mapper.toSesionTeclaEvento(dto, sesionGuardada))
                    .collect(Collectors.toList());
            sesionTeclaEventoRepository.saveAll(eventos);
        }

        log.info("Éxito: Sesión {} y sus métricas guardadas correctamente.", sesionGuardada.getId());
        return mapper.toSesionResponse(sesionGuardada);
    }

    private record Verificacion(Integer wpm, java.math.BigDecimal precision) {}

    /* Decide qué WPM y qué precisión se guardan.

       ⚠️ LA REGLA NO ES "EL SERVIDOR SIEMPRE MANDA", Y EL MOTIVO ESTÁ MEDIDO.

       Comparando lo guardado contra lo recalculado sobre las 295 sesiones que tenían
       desglose por tecla: **272 coinciden exacto**. Las 16 que difieren de verdad son casi
       todas de modo CURSO con 1 o 2 segundos de duración — drills de Muerte Súbita, donde el
       ejercicio se reinicia y las pulsaciones acumuladas no corresponden al intento final. Ahí
       el cliente y el servidor miden cosas distintas y ninguno de los dos está "mal".

       En NOTICIAS e IA, que son los únicos modos que alimentan promedios y récords (decisión
       7.1), la coincidencia fue del 100%. Por eso el recálculo MANDA en esos dos modos —donde
       no cambia nada para un usuario honesto y cierra el agujero— y en el resto se conserva
       el número del cliente, que es el que corresponde al intento que la persona vio.

       Si algún día los drills del Curso entran en un ranking, hay que resolver antes qué
       significa el WPM de un ejercicio que se reinicia. */
    private Verificacion verificar(SesionRequest request) {
        int correctas = 0;
        int presionadas = 0;
        if (request.getTeclas() != null) {
            for (TeclaStatsRequest t : request.getTeclas()) {
                correctas += t.getVecesCorrecta() == null ? 0 : t.getVecesCorrecta();
                presionadas += t.getVecesPresionada() == null ? 0 : t.getVecesPresionada();
            }
        }

        ModoUsado modo = parseModoUsado(request.getModoUsado());
        boolean recalculable = modo == ModoUsado.NOTICIAS || modo == ModoUsado.IA;

        /* Sin pulsaciones no hay de dónde recalcular, y hasta el 18-sep-2026 eso dejaba pasar
           el número del cliente tal cual: bastaba con NO mandar `teclas` para registrar un
           900. En la app nunca ocurre —Noticias e IA guardan al terminar el texto, así que
           siempre traen pulsaciones—, de modo que una sesión así solo puede venir armada a
           mano. Se rechaza en vez de guardarla en 0, que ensuciaría los promedios. */
        if (recalculable && presionadas == 0) {
            throw new ApiException("Una sesión de práctica sin pulsaciones no se puede guardar.");
        }

        boolean mandaElServidor = recalculable
                && request.getSegundos() != null && request.getSegundos() > 0;

        Integer wpm = request.getWpm();
        java.math.BigDecimal precision = request.getPrecision();

        if (mandaElServidor) {
            int wpmServidor = WpmCalculator.calcularWpm(correctas, request.getSegundos());
            java.math.BigDecimal precServidor = WpmCalculator.calcularPrecision(correctas, presionadas);

            /* Solo se registra cuando de verdad difieren. Si el log avisara en cada sesión,
               el aviso dejaría de leerse justo el día que importe. */
            if (wpm == null || Math.abs(wpm - wpmServidor) > 2) {
                log.warn("WPM del cliente ({}) no coincide con el recalculado ({}) en modo {}. "
                        + "Se guarda el del servidor.", wpm, wpmServidor, modo);
            }
            wpm = wpmServidor;
            precision = precServidor;
        }

        if (wpm != null && wpm > Constants.WPM_SOSPECHOSO) {
            /* No se rechaza ni se corrige: se deja constancia. Bloquear a alguien que de
               verdad escribe rápido sería peor que revisar un puñado de casos a mano. Ver
               Constants.WPM_SOSPECHOSO para el plan cuando existan rankings. */
            log.warn("RÉCORD A VERIFICAR: {} WPM en modo {} ({} correctas en {} s). "
                    + "Por encima de cualquier marca humana normal.",
                    wpm, modo, correctas, request.getSegundos());
        }

        return new Verificacion(wpm, precision);
    }

    private ModoUsado parseModoUsado(String modo) {
        try {
            return ModoUsado.valueOf(modo.toUpperCase());
        } catch (Exception e) {
            log.error("Error validando ModoUsado: {}", modo);
            throw new ApiException("Modo de sesión inválido. Valores permitidos: NOTICIAS, IA, LIBRE.");
        }
    }

    private Dificultad parseDificultad(String dif) {
        try {
            return Dificultad.valueOf(dif.toUpperCase());
        } catch (Exception e) {
            log.error("Error validando Dificultad: {}", dif);
            throw new ApiException("Nivel de dificultad inválido. Valores permitidos: FACIL, MEDIO, DIFICIL.");
        }
    }
}