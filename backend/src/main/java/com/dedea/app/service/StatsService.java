package com.dedea.app.service;

import com.dedea.app.dto.ProgresoNgramResponse;
import com.dedea.app.dto.StatsResponse;
import com.dedea.app.dto.DebilidadesResponse;
import com.dedea.app.dto.ProgresoTemporalResponse;
import com.dedea.app.dto.RecordsResponse;
import com.dedea.app.dto.RivalSesionResponse;

import java.util.List;

/**
 * ==============================================================================
 * CONTRATO DE NEGOCIO DE ESTADÍSTICAS (INTERFAZ) - DEDEA V2
 * ==============================================================================
 * Define las reglas de juego que la capa controller puede solicitar.
 * En la V2, rompemos el método único antiguo para separar las consultas
 * rápidas de las analíticas pesadas que consumirá Gemini.
 */
public interface StatsService {

    /**
     * 📊 obtenerResumenGlobal: Obtiene WPM, precisión y tiempo total del perfil.
     * Operación ultra ligera.
     */
    StatsResponse obtenerResumenGlobal(String identificadorTemporal);

    /**
     * 🧠 obtenerDiagnosticoDebilidades: Procesa el TOP 5 de errores en teclas y n-grams.
     * Operación pesada para la IA.
     */
    DebilidadesResponse obtenerDiagnosticoDebilidades(String identificadorTemporal, String enfoque);

    ProgresoNgramResponse obtenerProgresoNgrams(String identificadorTemporal);

    /**
     * 📈 obtenerProgresoTemporal: La curva de aprendizaje agrupada por día, semana o mes.
     * Solo cuenta Noticias y textos de IA.
     */
    ProgresoTemporalResponse obtenerProgresoTemporal(String identificadorTemporal, String agrupacion);

    /**
     * 🏆 obtenerRecords: Mejores marcas y racha de días practicando.
     */
    RecordsResponse obtenerRecords(String identificadorTemporal);

    /**
     * ⌨️ obtenerMapaDeTeclas: las teclas para pintar el mapa de calor, que NO son las
     * mismas que alimentan a Gemini.
     *
     * obtenerDiagnosticoDebilidades() devuelve el top 5 con un mínimo de 2 intentos, que
     * es lo que la IA necesita. Para pintar un teclado eso no sirve: hace falta el
     * panorama completo y un mínimo de pulsaciones alto, para que una tecla pulsada dos
     * veces con las dos mal no encabece el ranking por encima de las que de verdad cuestan.
     * Excluye los modos drill, donde las secuencias tipo "jf df kj" disparan las letras
     * de la fila guía.
     */
    List<DebilidadesResponse.ItemDebilidad> obtenerMapaDeTeclas(String identificadorTemporal);

    /**
     * 👻 obtenerRival: convierte una sesión pasada en rival para volver a correrla.
     *
     * Solo Noticias y textos de IA. En esos dos modos el texto no se guarda en la sesión,
     * así que se reconstruye desde la noticia o el texto de IA que se practicó.
     * Devuelve null si la sesión no es del usuario, no es de un modo válido o el contenido
     * original ya no existe.
     */
    RivalSesionResponse obtenerRival(Integer sesionId, String identificadorTemporal);
}