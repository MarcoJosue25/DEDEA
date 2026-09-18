package com.dedea.app.dto;

public record UsuarioResponse(
        boolean autenticado,
        Integer id,
        String email,
        String nombre,
        String avatarUrl
) {
    public static UsuarioResponse invitado() {
        return new UsuarioResponse(false, null, null, null, null);
    }
}
