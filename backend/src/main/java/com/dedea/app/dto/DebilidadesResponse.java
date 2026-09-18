package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DebilidadesResponse {
    private List<ItemDebilidad> peoresBigramas;
    private List<ItemDebilidad> peoresTrigramas;
    private List<ItemDebilidad> peoresTeclas;

//Clase anidada estática dentro de otra clase
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ItemDebilidad {
        private String secuencia;
        private int porcentajeError;
        private long totalIntentos;
    }
}

/*Estas propiedades actúan como un empaque de datos
Solo almacenan la información que se requiere al momento y se borra
luego de transportar los datos, se almacenan en la memoria ram del servidor
*/
