package com.dedea.app.model;

import com.dedea.app.model.enums.EstadoRevision;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Una palabra candidata a entrar al diccionario, con el estado de su revisión manual.
 *
 * <p>Acá viven las decenas de miles de palabras importadas mientras el usuario decide una
 * por una cuáles entran. El diccionario que usa la web sigue siendo {@code diccionario}; esta
 * tabla es la antesala.
 */
@Entity
@Table(name = "palabras_revision", indexes = {
        /* La pantalla pide siempre "las siguientes 100 pendientes en orden de frecuencia",
           así que ese es el índice que importa. Sin él, cada tanda escanea la tabla entera. */
        @Index(name = "idx_estado_rango", columnList = "estado, rango_frecuencia"),
        @Index(name = "idx_lote", columnList = "lote")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PalabraRevision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    /* unique: es lo que hace que el filtro de "ya rechazada" funcione sin consultas extra.
       Si una importación futura trae una palabra que ya está acá —en cualquier estado— el
       insert falla y se ignora, sin importar si estaba pendiente, aprobada o rechazada. */
    @Column(nullable = false, unique = true, length = 100,
            columnDefinition = "VARCHAR(100) COLLATE utf8mb4_0900_as_ci")
    private String palabra;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoRevision estado;

    /* Posición en la lista de frecuencia de origen: 1 es la palabra más usada del idioma.

       Se conserva porque es la única información que el archivo trae además de la palabra, y
       es la que ordena la revisión: se revisan primero las más comunes, que son las que de
       verdad van a aparecer en los ejercicios. Hasta hoy este dato se tiraba en la
       importación y las 7.736 filas del diccionario tienen frecuencia 0. */
    @Column(name = "rango_frecuencia", nullable = false)
    private Integer rangoFrecuencia;

    /* Por qué el filtro automático la rechazó, o null si la rechazó el usuario a mano.
       Existe para poder auditar el filtro: si algún día aparecen palabras buenas en
       NO_PERMITIDA, este campo dice qué regla se las comió. */
    @Column(length = 60)
    private String motivoRechazo;

    /* Pista para la pantalla, no una decisión: "posible extranjerismo", "lleva k o w".
       El filtro no bloquea estos casos porque `kilómetro` y `web` son español correcto —
       solo los pinta distinto para que el ojo del usuario vaya más rápido. */
    @Column(length = 40)
    private String sospecha;

    /* Identifica la tanda en que se guardó, para poder deshacerla entera.

       Es la red del flujo: la revisión se hace a puro Enter y sin mirar el mouse, así que una
       navegación equivocada puede mandar 100 palabras a NO_PERMITIDA de un saque. Con el lote
       marcado, deshacer es devolver todas las de ese número a PENDIENTE. */
    private Integer lote;
}
