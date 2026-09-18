package com.dedea.app.model;

import com.dedea.app.model.enums.ProveedorAuth;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "usuarios", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"proveedor", "proveedor_id"}),
        @UniqueConstraint(columnNames = {"identificador_temporal"})
})
/*uniqueConstraints: parámetro que define restricciones a la tabla completa, Mysql no permitirá
ningún INSERT/UPDATE que genere una combinación duplicada.
@UniqueConstraint: En la primera columna, significa que la condición debe ser única como pareja.
@UniqueConstraint: Segunda columna, ningún usuario puede repetir un "identificador_temporal"*/
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private String email;

    private String nombre;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProveedorAuth proveedor;

    // El ID que Google/Facebook le asignan a la cuenta (el "sub" de Google, el "id" de Facebook)
    @Column(name = "proveedor_id", nullable = false)
    private String proveedorId;

    // UUID canónico de este usuario. Las sesiones/stats se filtran por este valor una vez
    // que el usuario está autenticado, ignorando el header X-Identificador-Temporal del cliente.
    // Si en su primer login venía practicando como invitado, este campo adopta ese mismo UUID
    // para que no pierda su historial.
    @Column(name = "identificador_temporal", nullable = false, length = 100)
    private String identificadorTemporal;

    @Column(name = "fecha_creacion", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime fechaCreacion = LocalDateTime.now();

    @PrePersist//de JPA, marca este metodo como "un gancho de ciclo de vida"/Sin esta anotación el método no se ejecuta
    protected void alCrear() {
        if (fechaCreacion == null) fechaCreacion = LocalDateTime.now();
    }
    /*protected: No necesita ser public porque solo Hibernate necesita ejecutarlo.
    void: no devuelve nada porque nadie espera un resultado del metodo
    alCrear(): Nombre del metodo(pudo ser cualquier otro nombre)
    if.. Si al momento de guardar fechaCreacion aun no tiene datos, se le aplica ese metodo, es como un bloque de seguridad*/
}
