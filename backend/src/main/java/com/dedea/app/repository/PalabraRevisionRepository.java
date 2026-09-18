package com.dedea.app.repository;

import com.dedea.app.model.PalabraRevision;
import com.dedea.app.model.enums.EstadoRevision;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PalabraRevisionRepository extends JpaRepository<PalabraRevision, Integer> {

    /* La tanda: las siguientes pendientes en orden de frecuencia. Se revisan primero las
       palabras más usadas del idioma porque son las que de verdad van a caer en un ejercicio;
       las de la cola pueden esperar meses sin que nadie lo note. */
    List<PalabraRevision> findByEstadoOrderByRangoFrecuenciaAsc(EstadoRevision estado, Limit limite);

    long countByEstado(EstadoRevision estado);

    List<PalabraRevision> findByEstadoOrderByRangoFrecuenciaAsc(EstadoRevision estado);

    Optional<PalabraRevision> findByPalabra(String palabra);

    /* Para el buscador de UNA palabra. Coincidencia parcial y en cualquier estado: cuando el
       usuario busca una palabra que cree haber clasificado mal, lo que necesita ver es dónde
       quedó. El prefijo además sirve para barrer una familia entera —`negr` trae negro,
       negros y negras—, que es como se corrige el problema de las flexiones sueltas. */
    @Query("SELECT p FROM PalabraRevision p WHERE p.palabra LIKE CONCAT(:texto, '%') "
            + "ORDER BY p.rangoFrecuencia ASC")
    List<PalabraRevision> buscarPorPrefijo(@Param("texto") String texto, Limit limite);

    /* Para el buscador de VARIAS palabras. Acá la coincidencia es EXACTA, y no es un capricho
       de simetría: el resultado de una búsqueda por lista alimenta un botón que rechaza todo
       de un clic, así que un prefijo convertiría ese clic en destrozo. Medido sobre la tabla
       real con la lista de 61 nombres propios: por prefijo arrastraba 55 palabras de más,
       entre ellas `doctor`, `documento`, `alimento`, `billete`, `alianza`, `docena` y
       `jungla` — `doc`, `ali`, `bill` y `jung` son prefijos de todas ellas. */
    List<PalabraRevision> findByPalabraInOrderByRangoFrecuenciaAsc(Collection<String> palabras);

    /* Deshacer una tanda: todo lo que se guardó con ese número vuelve a PENDIENTE. */
    List<PalabraRevision> findByLote(Integer lote);

    @Query("SELECT COALESCE(MAX(p.lote), 0) FROM PalabraRevision p")
    Integer ultimoLote();

    /* Las que ya existen, en cualquier estado. Lo usa la importación para no reprocesar —y
       sobre todo para no revivir una rechazada, que es el punto de toda la tabla. */
    @Query("SELECT p.palabra FROM PalabraRevision p")
    List<String> todasLasPalabras();
}
