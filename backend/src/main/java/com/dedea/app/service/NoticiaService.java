package com.dedea.app.service;

import com.dedea.app.dto.NoticiaDTO;
import java.util.List;

public interface NoticiaService {

    // Lo que consume React para el Dashboard
    List<NoticiaDTO> obtenerNoticiasDelDia();

    // NUEVO: Para cuando React necesita el texto completo de una noticia específica
    NoticiaDTO obtenerPorId(Integer id);

    // ACTUALIZADO: Cambiamos Integer usuarioId por String identificadorTemporal
    NoticiaDTO obtenerNoticiaAleatoriaInedita(String identificadorTemporal, String categoria, String dificultad);


    /* Si ya hay una sincronización en curso, devuelve hace cuánto empezó; null si no la hay.

       Existe para que el controlador no responda "iniciada" cuando el candado va a rechazar
       la llamada. Los endpoints son @Async: devuelven al instante, así que sin esto la
       única forma de enterarse de que no arrancó nada era mirar el log. */
    String sincronizacionEnCurso();

    /* Chequeo periódico de bloqueos anti-hotlinking en imágenes ya guardadas: el caso de
       escambray.cu, que respondía bien cuando se guardó la noticia y empezó a bloquear
       días después. El chequeo de ingesta (dentro de generarDesdeCandidatos)
       no alcanza para esto porque el bloqueo apareció DESPUÉS de guardar. */
    void revisarImagenesBloqueadas();

    /* Borra el texto scrapeado de las noticias que superaron la ventana de retención.
       Material de calibración, no del producto. Ver Noticia.articuloScrapeado. */
    void limpiarArticulosViejos();

    /* Trae artículos de GNews, los scrapea y vuelca su perfil al log. NO llama a Gemini y
       NO guarda nada: es la fase de diagnóstico para calibrar PerfilArticulo sin gastar
       cuota. Ver la nota larga en NoticiaServiceImpl. */
    void sondearArticulos(int porCategoria);

    /* PASO 1 del flujo en dos pasos: junta articulos, los scrapea, descarta lo que no es
       noticia y los empareja con el nivel que su contenido puede sostener. Cuesta UNA
       llamada a Gemini. No guarda nada: deja los candidatos listos en memoria. */
    void prepararCandidatos();

    /* PASO 2: pide el resumen de cada candidato preparado y los guarda. Una llamada a
       Gemini por noticia. */
    void generarDesdeCandidatos();

    /* Corre el flujo completo de un tirón: preparar candidatos y, apenas termina,
       generar los resúmenes — en ese orden, dentro del MISMO hilo async, para que el
       segundo paso nunca arranque antes de que el primero deje candidatos listos.
       Es lo que usan el cron diario y /force-sync; /preparar y /generar por separado
       siguen sirviendo para probar o revisar una tanda a mano, paso por paso. */
    void ejecutarFlujoCompleto();
}