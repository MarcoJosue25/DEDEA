package com.dedea.app.repository;

import com.dedea.app.model.Ejercicio;
import com.dedea.app.model.enums.NivelCurso;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EjercicioRepository extends JpaRepository<Ejercicio, Integer> {
    // Ejercicios Base: el catálogo plano solo muestra filas SIN nivel — las filas
    // propias del Curso (nivel != null) tienen su propia pantalla (el sendero).
    List<Ejercicio> findByActivoTrueAndNivelIsNullOrderByOrdenAsc();
    boolean existsByTitulo(String titulo);

    // Lo usa el sembrado para poder ACTUALIZAR la configuración de un ejercicio que ya
    // existe, no solo saltárselo (ver crearSiNoExiste en EjercicioServiceImpl).
    Optional<Ejercicio> findByTitulo(String titulo);

    /* Secuencia completa de un nivel del Curso, para pintar el sendero.

       Filtra por `activo` — y no es cosmético. El sembrado nunca borra: cuando un
       ejercicio sale del plan se marca inactivo (ver RETIRADOS_DEL_CURSO), porque hay
       sesiones y progreso apuntando a esa fila por clave foránea. Sin este filtro los
       nodos retirados seguirian apareciendo en el sendero. */
    List<Ejercicio> findByNivelAndActivoTrueOrderByOrdenAsc(NivelCurso nivel);

    /* Los nodos DEL SENDERO. El orden 0 esta reservado para lo que pertenece al nivel pero
       no al camino: hoy solo la Prueba de nivel, que es la alternativa a recorrerlo y por
       eso no puede ocupar una posicion dentro de el. Se dibuja aparte, como tarjeta.

       Filtra tambien el CONTEO de nodos totales: con la prueba dentro, el sendero diria
       "0 de 35" cuando hay 34 por recorrer. */
    List<Ejercicio> findByNivelAndActivoTrueAndOrdenGreaterThanOrderByOrdenAsc(
            NivelCurso nivel, int ordenMinimo);

    /* Siguiente ejercicio de la secuencia (mismo nivel, orden mayor) — la navegación
       "Enter → siguiente ejercicio". Top 1 porque solo hace falta el primero.

       ⚠️ FILTRA POR `activo`, y no filtrarlo fue un bug real. Al reestructurar Básico los
       nodos retirados conservaron su `orden` viejo, así que había DOS filas con orden 9:
       el contrarreloj nuevo y "Fundamentos: as lñ" retirado. Al terminar el nodo 8, esta
       consulta devolvía el retirado — el usuario terminaba las palabras de la línea base y
       aterrizaba en un ejercicio que ya no existe en el sendero.

       El filtro es el arreglo de fondo; además el retiro aparca el `orden` en 900+ para
       que ni siquiera pueda haber empate. */
    List<Ejercicio> findTop1ByNivelAndActivoTrueAndOrdenGreaterThanOrderByOrdenAsc(
            NivelCurso nivel, Integer orden);
}
