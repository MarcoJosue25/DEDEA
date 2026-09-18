package com.dedea.app.dto;

/* Una tecla y lo que tarda en promedio. Distinto de las teclas más FALLADAS: se puede
   acertar siempre una tecla y aun así ser la que más frena la escritura.

   El tiempo no está guardado como tal — se deriva restando instantes consecutivos de
   sesion_teclas_eventos (ver la consulta en SesionRepository). */
public interface TeclaLentaProyeccion {
    String getTecla();
    Integer getMsPromedio();
    Integer getPulsaciones();
}
