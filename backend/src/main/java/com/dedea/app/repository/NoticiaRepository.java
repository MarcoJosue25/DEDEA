package com.dedea.app.repository;

import com.dedea.app.model.Noticia;
import com.dedea.app.model.enums.Dificultad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface NoticiaRepository extends JpaRepository<Noticia, Integer> {

    //Devuelve la lista de noticias en esta fecha
    List<Noticia> findByFechaPublicacionOrderByIdDesc(LocalDate fecha);
    boolean existsByUrl(String url);
    boolean existsByFechaPublicacion(LocalDate fecha);

    /* Cuántas noticias hay ya de una fecha. Se usa para poder REANUDAR una tanda que
       quedó a medias: si la cuota de Gemini se agotó en la quinta, quedan 4 guardadas
       y el día siguiente intento debe traer las que faltan, no abortar por existir una. */
    long countByFechaPublicacion(LocalDate fecha);

    /* Lo mismo pero por categoría, para que al reanudar no se desbalancee el reparto:
       si Tecnología ya tiene su cupo y Deportes ninguno, el reintento debe ir por
       Deportes y no cargar dos noticias más de Tecnología. */
    long countByFechaPublicacionAndCategoria(LocalDate fecha, String categoria);

    /* Cuántas noticias de HOY quedaron en cada nivel de dificultad. Alimenta la cuota
       diaria (3 difíciles / 4 medias / 3 fáciles) que decide qué nivel pedirle a Gemini
       en cada artículo. Se precarga al arrancar la tanda, por la misma razón que
       countByFechaPublicacion: el cron corre 2 veces al día y la corrida de la noche
       tiene que continuar el reparto donde lo dejó la de la mañana, no volver a cero. */
    long countByFechaPublicacionAndDificultad(LocalDate fecha, Dificultad dificultad);

    /* Solo los títulos de una fecha, para la deduplicación por tema: se le pasan a Gemini
       junto con cada artículo nuevo para que compare "¿esto ya se cubrió hoy?". Se
       precarga al arrancar la tanda (no solo se acumula en memoria durante la corrida)
       porque el cron corre 2 veces al día — sin esto, la tanda de la noche no sabría
       qué se cubrió en la de la mañana y repetiría el mismo tema. */
    @Query("SELECT n.titulo FROM Noticia n WHERE n.fechaPublicacion = :fecha")
    List<String> findTitulosByFechaPublicacion(@Param("fecha") LocalDate fecha);

    /* Noticias recientes con imagen, para el chequeo periódico de bloqueos anti-
       hotlinking (WebScraperClient.pareceBloqueoAntiHotlinking). Acotado por fecha:
       revisar todo el historial cada vez crece sin límite y las noticias viejas casi
       no se sirven. */
    List<Noticia> findByImagenUrlIsNotNullAndFechaPublicacionGreaterThanEqual(LocalDate desde);

    /* La fecha más reciente que TIENE noticias.
       Sirve de respaldo para la portada: el cron carga a las 8:00 y 20:00, así que
       entre medianoche y las 8 no existe ninguna noticia con la fecha de hoy y la
       portada quedaba en blanco todas las madrugadas. Con esto se muestran las
       últimas disponibles en vez de una pantalla vacía. */
    @Query("SELECT MAX(n.fechaPublicacion) FROM Noticia n")
    Optional<LocalDate> findFechaMasReciente();

    // ==============================================================================
    // SOLUCIÓN OPTIMIZADA PARA V2: Reemplazo de ORDER BY RAND() por OFFSET
    // ==============================================================================

    // 1. Consulta rápida para contar cuántas noticias inéditas cumplen el filtro
    @Query(value = "SELECT COUNT(n.id) FROM noticias n " +
            "LEFT JOIN sesiones s ON n.id = s.noticia_id AND s.identificador_temporal = :identificadorTemporal " +
            "WHERE n.categoria = :categoria " +
            "AND n.dificultad = :dificultad " +
            "AND s.id IS NULL", nativeQuery = true)
    long countAleatoriaInedita(
            @Param("identificadorTemporal") String identificadorTemporal,
            @Param("categoria") String categoria,
            @Param("dificultad") String dificultad);

    // 2. Consulta indexada que salta directo al registro usando OFFSET
    @Query(value = "SELECT n.* FROM noticias n " +
            "LEFT JOIN sesiones s ON n.id = s.noticia_id AND s.identificador_temporal = :identificadorTemporal " +
            "WHERE n.categoria = :categoria " +
            "AND n.dificultad = :dificultad " +
            "AND s.id IS NULL " +
            "LIMIT 1 OFFSET :offset", nativeQuery = true)
    Optional<Noticia> findAleatoriaIneditaConOffset(
            @Param("identificadorTemporal") String identificadorTemporal,
            @Param("categoria") String categoria,
            @Param("dificultad") String dificultad,
            @Param("offset") long offset);

    /* Borra el texto scrapeado de las noticias viejas, dejando la noticia intacta.
       Es material de calibración con fecha de vencimiento (ver Noticia.articuloScrapeado).
       Se hace con UPDATE masivo y no cargando entidades: son cientos de filas de texto y
       traerlas a memoria para vaciar un campo no tiene sentido. */
    @Modifying
    @Transactional
    @Query("UPDATE Noticia n SET n.articuloScrapeado = NULL "
         + "WHERE n.articuloScrapeado IS NOT NULL AND n.fechaPublicacion < :limite")
    int limpiarArticulosAnterioresA(@Param("limite") LocalDate limite);
}