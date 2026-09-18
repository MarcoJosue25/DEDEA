package com.dedea.app.model.enums;

/**
 * En qué punto del filtro manual está una palabra.
 *
 * <p>Los cuatro cajones que pidió el usuario son estos tres estados más la tabla
 * {@code diccionario}, que es la que de verdad usa la web. Se modeló como una columna de
 * estado y no como tres tablas separadas a propósito: mover una palabra es cambiar un valor
 * —operación atómica— en vez de un borrado más un insert que pueden quedar a medias, y una
 * sola consulta busca en todos los cajones a la vez. Funcionalmente son los mismos cuatro
 * grupos: {@code WHERE estado = 'NO_PERMITIDA'} es la lista de rechazadas.
 */
public enum EstadoRevision {
    /** Importada y esperando que el usuario la mire. Es la "tabla general". */
    PENDIENTE,

    /** Aprobada en una tanda de revisión, todavía invisible para la web. */
    PREACTIVA,

    /** Rechazada — a mano o por el filtro automático.
     *  NUNCA se borra: es lo que impide que una importación futura la reviva. */
    NO_PERMITIDA
}
