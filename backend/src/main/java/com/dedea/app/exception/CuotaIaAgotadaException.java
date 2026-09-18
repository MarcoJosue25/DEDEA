package com.dedea.app.exception;

/*
 La API de Gemini devolvió 429: se acabó la cuota de la KEY (no del modelo).

 Existe separada de ApiException porque el que llama necesita distinguir
 "este artículo falló" de "ya no se puede generar nada más hoy":

 - Un fallo aislado (scraping malo, JSON raro) justifica pasar al siguiente artículo.
 - La cuota agotada es permanente hasta que se renueve, así que seguir intentando
   solo quema llamadas y hace que la sincronización parezca colgada.

 Al ser hija de ApiException, quien no necesite la distinción la sigue atrapando
 igual que antes.
*/
public class CuotaIaAgotadaException extends ApiException {
    public CuotaIaAgotadaException(String message) {
        super(message);
    }
}
