package com.dedea.app.mapper;

import com.dedea.app.dto.NoticiaDTO;
import com.dedea.app.dto.TextoIaResponse;
import com.dedea.app.dto.SesionResponse;
import com.dedea.app.dto.SesionProgresoDTO;
import com.dedea.app.dto.TeclaStatsRequest;
import com.dedea.app.dto.NgramStatsRequest;
import com.dedea.app.dto.TeclaEventoRequest;
import com.dedea.app.model.Noticia;
import com.dedea.app.model.TextoIa;
import com.dedea.app.model.Sesion;
import com.dedea.app.model.SesionProgreso;
import com.dedea.app.model.SesionTecla;
import com.dedea.app.model.SesionNgram;
import com.dedea.app.model.SesionTeclaEvento;
import com.dedea.app.model.enums.TipoNgram;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/*
==============================================================================
ARQUITECTURA DE TRADUCCIÓN (CAPA MAPPER) - PROYECTO DEDEA V2
==============================================================================
Esta clase actúa como el "traductor oficial" en la aduana de nuestro backend.
Su único trabajo es transformar objetos de base de datos (@Entity) a objetos
de transporte de datos (DTOs/Requests) que React pueda entender, y viceversa.

@Component: Le dice a Spring Boot que cree una única instancia (Singleton) de
esta clase al arrancar el servidor y la guarde en su contenedor de Beans. Así,
cualquier Service que necesite traducir datos podrá inyectarla directamente.
 */
@Component
public class EntityMapper {
    /*
     toNoticiaDTO: (Salida a React)
     Convierte una entidad Noticia cruda de la base de datos en un DTO limpio.
     ¿Por qué lo hacemos? Jamás debemos exponer la entidad @Entity directa al Front.
     Si mañana agregamos un campo secreto o de auditoría en la tabla, el DTO actúa
     como un escudo que impide que React se entere si no es necesario.
     */
    public NoticiaDTO toNoticiaDTO(Noticia noticia) {
        if (noticia == null) {
            return null;
        }
        //No lo guardamos en una variable temporal porque se despacha automáticamente
        return NoticiaDTO.builder()
                .id(noticia.getId())
                .titulo(noticia.getTitulo())
                .contenidoCompleto(noticia.getContenidoCompleto())
                .contenidoResumido(noticia.getContenidoResumido())
                .categoria(noticia.getCategoria())
                .fuente(noticia.getFuente())
                .dificultad(noticia.getDificultad() != null ? noticia.getDificultad().name() : null)
                .fechaPublicacion(noticia.getFechaPublicacion())
                .imagenUrl(noticia.getImagenUrl())
                .build();
    }

    /*
     toTextoIaResponse: MODELO IA (@Entity) -> RESPUESTA DTO (Json para React)
     Traduce los textos de refuerzo generados por Gemini al formato de pantalla del juego.
     */
    public TextoIaResponse toTextoIaResponse(TextoIa textoIa) {
        if (textoIa == null) {
            return null;
        }

        return TextoIaResponse.builder()
                .id(textoIa.getId())
                .contenidoLimpio(textoIa.getContenido())
                .dificultad(textoIa.getDificultad() != null ? textoIa.getDificultad().name() : null)
                .teclasBase(textoIa.getTeclasBase())
                .build();
    }

    /*
    toSesionResponse: ENTIDAD GUARDADA -> RESPUESTA EJECUTIVA
     */
    public SesionResponse toSesionResponse(Sesion sesion) {
        if (sesion == null) {
            return null;
        }
        return SesionResponse.builder()
                .id(sesion.getId())
                .mensaje("Sesión guardada con éxito")
                .build();
    }

    // ==============================================================================
    // NUEVOS MÉTODOS DE LA V2 PARA DETENER LA COMPLEJIDAD EN EL SERVICE
    // ==============================================================================

    /**
     * 📈 toSesionProgreso: DTO DE REACT + ENTIDAD MADRE -> ENTIDAD JPA PROGRESO
     */
    public SesionProgreso toSesionProgreso(SesionProgresoDTO dto, Sesion sesion) {
        if (dto == null) {
            return null;
        }
        return SesionProgreso.builder()
                .sesion(sesion)
                .segundo(dto.getSegundo())
                .wpmMomento(dto.getWpmMomento())
                .precisionMomento(dto.getPrecisionMomento())
                .build();
    }

    /**
     * ⌨️ toSesionTecla: REQUEST BIOMÉTRICA + ENTIDAD MADRE -> ENTIDAD JPA TECLA
     */
    public SesionTecla toSesionTecla(TeclaStatsRequest request, Sesion sesion) {
        if (request == null) {
            return null;
        }
        return SesionTecla.builder()
                .sesion(sesion)
                .tecla(request.getTecla())
                .vecesPresionada(request.getVecesPresionada())
                .vecesCorrecta(request.getVecesCorrecta())
                .vecesError(request.getVecesError())
                .tiempoTotalMs(request.getTiempoTotalMs())
                .build();
    }

    /**
     * 🔤 toSesionNgram: REQUEST N-GRAMA + ENTIDAD MADRE -> ENTIDAD JPA N-GRAMA
     */
    public SesionNgram toSesionNgram(NgramStatsRequest request, Sesion sesion) {
        if (request == null) {
            return null;
        }
        return SesionNgram.builder()
                .sesion(sesion)
                .secuencia(request.getSecuencia())
                .tipo(TipoNgram.valueOf(request.getTipo().toUpperCase()))
                .totalIntentos(request.getTotalIntentos())
                .errores(request.getErrores())
                .tiempoTotalMs(request.getTiempoTotalMs())
                .build();
    }

    /**
     * toSesionTeclaEvento: REQUEST DE MODO SOMBRA + ENTIDAD MADRE -> ENTIDAD JPA EVENTO
     */
    public SesionTeclaEvento toSesionTeclaEvento(TeclaEventoRequest request, Sesion sesion) {
        if (request == null) {
            return null;
        }
        return SesionTeclaEvento.builder()
                .sesion(sesion)
                .tecla(request.getTecla())
                .ordenSecuencia(request.getOrdenSecuencia())
                .tiempoDesdeInicioMs(request.getTiempoDesdeInicioMs())
                .indiceResultante(request.getIndiceResultante())
                .correcta(request.getCorrecta())
                .build();
    }
}


/*Revisa bien esto y comprueba si es o no un bug
Bug latente — null sin filtrar antes de saveAll. EntityMapper.toSesionProgreso() (y sus hermanos
toSesionTecla/toSesionNgram/toSesionTeclaEvento) devuelven null si el DTO de entrada es null, pero
en SesionServiceImpl.guardarSesionCompletada() ese null no se filtra: queda dentro de la lista que
arma .stream().map(mapper::toX).collect(Collectors.toList()). Si algún elemento de request.getProgreso()
(o teclas/ngrams/eventos) llegara null — hoy no ocurre desde el frontend normal, pero sí es posible con un
JSON manual/malicioso — saveAll() fallaría con NullPointerException al intentar persistir ese elemento, en vez
 de fallar antes con un error claro. Severidad baja (no explotable desde la UI actual), pero conviene blindarlo.
 Fix: agregar .filter(Objects::nonNull) en el stream, antes del .collect(), en los cuatro bloques de
 SesionServiceImpl — o mejor, hacerlo una sola vez centralizado si se refactoriza el patrón repetido.
 */