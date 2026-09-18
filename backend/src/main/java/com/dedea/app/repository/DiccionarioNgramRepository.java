package com.dedea.app.repository;

import com.dedea.app.model.DiccionarioNgram;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

/*
@Repository: Inyección de dependencias
Esta anotación le dice a Spring que le cree una instancia de este archivo
 *//*
Si MySQL falla lanza un error SQLException, @Repository lo atrapa y lo traduce a un
DataAccesException, que es mas facil de manejar para la capa de Excepciones Globales
 */
@Repository
//Extends hace que esta interfaz herede funcionalidades de otra interfaz
public interface DiccionarioNgramRepository extends JpaRepository<DiccionarioNgram, Integer> {
    //JpaRepository le dice a spring que esta clase maneja la entidad
    // <DiccionarioNgram, Su llave primaria es un Integer// >
    //Esta extensión brinda métodos como el CRUD

    // ==============================================================================
    // SOLUCIÓN OPTIMIZADA PARA V2: Reemplazo de ORDER BY RAND() por Ventana OFFSET
    // ==============================================================================

    // 1. Cuenta el universo total de palabras únicas que contienen el n-grama objetivo
    //@Query se usa para hacer una consulta personalizada en código Sql
    //nativeQuery True: Le dice a Spring que no lo traduzca solo se lo envíe a Mysql
    // LIKE en vez de = : la tabla solo guarda bigramas/trigramas (2-3 letras), nunca letras
    // sueltas. Si un usuario quiere practicar una sola letra (ej. "k"), la igualdad exacta
    // no encontraría nada porque nunca existe un ngram de 1 letra. Con LIKE, "k" matchea
    // cualquier bigrama/trigrama que la contenga (ka, ki, kilo...), y una búsqueda de 2-3
    // letras sigue funcionando igual que antes (además de sumar trigramas relacionados).
    /* IGUALDAD, no LIKE. El cambio no altera ni un resultado y es lo que hace que la
       consulta pueda usar un indice.

       Por que da lo mismo: toda palabra que CONTIENE "as" tiene "as" entre sus bigramas
       —"casa" genera ca, as, sa— asi que buscar el bigrama exacto encuentra las mismas
       palabras que buscar cualquier ngram que contenga "as". El comodin solo agregaba
       coincidencias redundantes ("cas", "asa") que apuntaban a las MISMAS palabras, y a
       cambio obligaba a evaluar la condicion fila por fila sobre la tabla entera.

       El caso de una sola letra funciona desde que se guardan unigramas (ver NgramGenerator). */
    @Query(value = "SELECT COUNT(DISTINCT d.palabra) FROM diccionario_ngrams dn " +
            "JOIN diccionario d ON dn.diccionario_id = d.id " +
            "WHERE dn.ngram = :ngram AND d.dificultad = :dificultad", nativeQuery = true)
    long countPalabrasPorNgram(
            @Param("ngram") String ngram,
            @Param("dificultad") String dificultad);

    // 2. Extrae un bloque continuo de palabras de forma indexada
    /* El ORDER BY no es cosmetico: sin el, MySQL no garantiza NINGUN orden, y un LIMIT con
       OFFSET sobre un orden indefinido puede devolver filas repetidas entre dos llamadas o
       saltarse otras. Funcionaba de casualidad, por el orden fisico de lectura.

       Se ordena por `d.palabra` y no por `d.id` porque con DISTINCT, MySQL exige que lo que
       se ordena este en la lista de seleccion. La aleatoriedad la sigue dando el OFFSET al
       azar mas el shuffle posterior; lo unico que aporta el orden es que la ventana este
       bien definida. */
    @Query(value = "SELECT DISTINCT d.palabra FROM diccionario_ngrams dn " +
            "JOIN diccionario d ON dn.diccionario_id = d.id " +
            "WHERE dn.ngram = :ngram AND d.dificultad = :dificultad " +
            "ORDER BY d.palabra LIMIT :limite OFFSET :offset", nativeQuery = true)
    List<String> findPalabrasPorNgramConOffset(
            @Param("ngram") String ngram,
            @Param("dificultad") String dificultad,
            @Param("limite") int limite,
            @Param("offset") long offset);

    /* Los hijos NO se borran solos.

       La relacion es un @ManyToOne unidireccional y la clave foranea de MySQL esta en NO
       ACTION, asi que borrar una palabra del diccionario sin limpiar antes sus ngramas
       revienta con una violacion de integridad referencial. Hay que borrarlos a mano, y por
       eso estos dos metodos existen. */
    @Modifying
    @Query(value = "DELETE FROM diccionario_ngrams WHERE diccionario_id = :idPalabra",
            nativeQuery = true)
    void borrarPorPalabra(@Param("idPalabra") Integer idPalabra);

    @Modifying
    @Query(value = "DELETE FROM diccionario_ngrams", nativeQuery = true)
    void borrarTodos();
}

//EL @Param (Etiqueta de envío) Es el puente entre los parámetros del método y del query
// permite insertar valores a las variables nombradas dentro de la consulta
// Las variables como los String ngram, se llaman igual por buena costumbre.

