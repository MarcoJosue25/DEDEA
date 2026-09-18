package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Resultado del buscador de la pantalla de revisión.
 *
 * <p>Devuelve dos listas y no una porque el buscador tiene dos modos y el segundo necesita
 * decir qué <b>no</b> encontró. Al pegar una lista de 60 nombres, lo que hace falta saber no
 * es solo cuáles aparecieron: también cuáles no están en la tabla, que son las que habría que
 * agregar. Es el flujo previsto para cargar países y nombres más adelante — los que existen
 * se mueven de cajón, los que faltan se dan de alta.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BusquedaPalabrasResponse {

    private List<PalabraRevisionDTO> resultados;

    /** Solo se llena en el modo exacto: en el modo prefijo no tendría sentido. */
    private List<String> noEncontradas;

    /** true = se buscó una lista de palabras completas; false = prefijo de una sola. */
    private boolean exacta;
}
