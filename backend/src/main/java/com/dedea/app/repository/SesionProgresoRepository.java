package com.dedea.app.repository;

import com.dedea.app.model.SesionProgreso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SesionProgresoRepository extends JpaRepository<SesionProgreso, Integer> {

    /* El recorrido segundo a segundo de una sesión. Lo usa el modo sombra para dibujar la
       curva del rival por detrás de la tuya en la pantalla de resultados: sin esto solo se
       podía comparar el número final, y ver dónde te adelantó o dónde lo alcanzaste dice
       mucho más que un WPM suelto. */
    List<SesionProgreso> findBySesionIdOrderBySegundoAsc(Integer sesionId);
}

/*Con JpaRepository ya contamos con muchos métodos, por ahora no necesitamos una
consulta personalizada */