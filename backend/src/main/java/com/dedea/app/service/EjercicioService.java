package com.dedea.app.service;

import com.dedea.app.dto.EjercicioContenidoResponse;
import com.dedea.app.dto.EjercicioDTO;
import com.dedea.app.dto.HistorialEjercicioResponse;
import com.dedea.app.dto.IntentoResumen;
import com.dedea.app.dto.SesionCursoRequest;
import com.dedea.app.dto.SesionResponse;

import java.util.List;

public interface EjercicioService {

    // Catálogo completo para la lista "Curso"
    List<EjercicioDTO> listarActivos();

    // Genera el contenido de esta vuelta (aleatorio, distinto en cada llamada)
    /* grupo: solo lo usa "Fundamentos de teclado", con el formato "fila:indice"
       (por ejemplo "central:0" = f/j). Null en el resto de los tipos.
       identificadorTemporal: solo lo usa REPASO_FALLADAS, para leer tu propio
       historial de teclas falladas. Null en el resto — nullable a propósito, esta
       llamada no siempre trae el header (por ejemplo, el catálogo público). */
    EjercicioContenidoResponse generarContenido(Integer ejercicioId, String grupo, String identificadorTemporal);

    /* El QUINTO latido de un ejercicio de letras: el último intento que se ofrece cuando
       los cuatro anteriores no alcanzaron el umbral. Se juzga solo por precisión, sin
       exigencia de velocidad.

       Va en su propia llamada porque la mayoría de las veces no se usa: incluirlo en la
       respuesta inicial sería generar y transmitir contenido que se descarta casi siempre. */
    com.dedea.app.dto.LatidoResponse generarUltimoIntento(Integer ejercicioId, String grupo);

    // Modo sombra: en vez de generar al azar, reutiliza el texto exacto de una sesión
    // pasada (fantasmaSesionId) y adjunta sus eventos para animar el cursor fantasma.
    EjercicioContenidoResponse generarContenidoConFantasma(Integer ejercicioId, Integer fantasmaSesionId, String identificadorTemporal);

    /* Fantasma SIMULADO: genera contenido normal, pero le inventa un recorrido a un WPM
       elegido por el usuario (30, 40, 50... hasta donde quiera pedirlo) en vez de
       reproducir una sesión real. Pensado para "Ejercicios Base", donde todavía no hay
       historial propio contra el que correr. */
    EjercicioContenidoResponse generarContenidoConFantasmaSimulado(Integer ejercicioId, Integer wpmObjetivo, String grupo);

    // Mejores/peores 3 intentos de ESTE ejercicio para el usuario actual.
    HistorialEjercicioResponse obtenerHistorial(Integer ejercicioId, String identificadorTemporal);

    /* Modo sombra sin selector: elige solo contra quién correr en este ejercicio.
       Devuelve null cuando todavía no hay ninguna sesión pasada que sirva de rival,
       que es el caso normal la primera vez que se abre un ejercicio. */
    IntentoResumen buscarRivalSombra(Integer ejercicioId, String identificadorTemporal);

    /* Navegación secuencial dentro de un nivel del Curso: el siguiente ejercicio del
       mismo nivel, por orden. null si el actual no tiene nivel, o si era el último
       (típicamente el Test Final) — es una respuesta normal, no un error. */
    EjercicioDTO obtenerSiguienteEnCurso(Integer ejercicioId);

    // Idempotente: crea las filas del catálogo si no existen todavía. Se llama al arrancar.
    void sembrarCatalogoBase();

    /* Idempotente, igual que sembrarCatalogoBase: siembra (o actualiza) las filas
       propias del Curso por niveles — con nivel/bloque/orden asignado, a diferencia de
       "Ejercicios Base". Se llama por separado porque son catálogos con propósitos
       distintos, aunque compartan la misma tabla. */
    void sembrarCatalogoCurso();

    // Guarda una sesión de Curso, incluyendo el log tecla-por-tecla de modo sombra.
    SesionResponse guardarSesion(String identificadorTemporal, Integer ejercicioId, SesionCursoRequest request);
}
