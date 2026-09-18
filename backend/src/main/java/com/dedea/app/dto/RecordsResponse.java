package com.dedea.app.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/* Marcas personales y constancia. Las MARCAS, igual que los promedios, solo cuentan
   Noticias y textos de IA: incluir Curso metía sesiones de 1 segundo con 1740 WPM como
   "récord".

   La racha mide días con al menos una sesión DE CUALQUIER MODO, no rendimiento — por eso
   no comparte ese filtro (ver SesionRepository.obtenerDiasConActividad). `rachaActual`
   sigue viva si hoy todavía no practicaste pero ayer sí — se corta recién cuando pasa un
   día entero en blanco. */
public record RecordsResponse(
        Integer mejorWpm,
        LocalDate fechaMejorWpm,
        /* La sesión que marcó el récord, para poder ofrecer correr contra ella desde la
           tarjeta. Null si todavía no hay ninguna sesión medible. */
        Integer mejorWpmSesionId,
        /* Solo si el récord salió del CURSO (hoy, nivel Avanzado): el ejercicio y su nivel.
           El rival de una noticia se reconstruye desde /practica, pero el de un ejercicio
           del Curso vive en su propia ruta (/curso/{nivel}/{id}?fantasma=...), y sin esto el
           botón mandaba a practicar una noticia cualquiera sin rival. Null en Noticias e IA. */
        Integer mejorWpmEjercicioId,
        String mejorWpmNivel,
        BigDecimal mejorPrecision,
        Integer sesionMasLarga,
        Integer rachaActual,
        Integer rachaMaxima,
        Integer diasActivos
) {}
