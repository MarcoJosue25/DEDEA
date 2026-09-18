package com.dedea.app.dto;

import java.math.BigDecimal;

/* Una fila del gráfico de progreso. Es una proyección de Spring Data: la consulta
   nativa devuelve estas columnas y Spring arma el objeto solo, sin entidad de por medio.

   `periodo` viene ya formateado por SQL según el agrupamiento pedido:
   "2026-08-08" por día, "2026-S32" por semana, "2026-08" por mes. */
public interface ProgresoTemporalProyeccion {
    String getPeriodo();
    Integer getWpm();
    // "precisionMedia" y no "precision": PRECISION es palabra reservada de MySQL y como
    // alias de columna rompe la consulta. El nombre del getter debe seguir al alias.
    BigDecimal getPrecisionMedia();
    Integer getSesiones();
}

/*Es el molde que el repository usa como tipo de retorno de su consulta SQL: Spring convierte cada fila en un
 objeto de esta forma, y el service lo consume llamando getPeriodo(), getWpm(), getPrecisionMedia(), getSesiones().
Devuelve una fila del resultado SQL como objeto Java: getPeriodo(), getWpm(),
getPrecisionMedia(), getSesiones() leen las 4 columnas de esa fila. */