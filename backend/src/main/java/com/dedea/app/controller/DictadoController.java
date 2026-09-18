package com.dedea.app.controller;

import com.dedea.app.config.ArchivosEstaticosConfig;
import com.dedea.app.dto.GenericResponse;
import com.dedea.app.exception.ApiException;
import com.dedea.app.model.DictadoAudio;
import com.dedea.app.model.enums.Dificultad;
import com.dedea.app.repository.DictadoAudioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.codec.Utf8;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.UUID;

// Endpoint de administración para subir los audios reales del ejercicio Dictado
// (modo "archivo"). Mismo patrón de protección que /noticias/force-sync y
// /revision-palabras: header X-Admin-Key comparado en tiempo constante.
@Slf4j
@RestController
@RequestMapping("/api/v1/dictado")
@RequiredArgsConstructor
public class DictadoController {

    private final DictadoAudioRepository dictadoAudioRepository;

    @Value("${app.admin.sync-key}")
    private String syncKey;

    @PostMapping(value = "/audios", consumes = "multipart/form-data")
    public ResponseEntity<GenericResponse<String>> subirAudio(
            @RequestHeader("X-Admin-Key") String adminKey,
            @RequestParam("archivo") MultipartFile archivo,
            @RequestParam("titulo") String titulo,
            @RequestParam("transcripcion") String transcripcion,
            @RequestParam(value = "dificultad", defaultValue = "MEDIO") String dificultad) {

        if (!MessageDigest.isEqual(Utf8.encode(syncKey), Utf8.encode(adminKey))) {
            log.warn("Intento de acceso no autorizado a /dictado/audios");
            throw new ApiException("Clave de administrador incorrecta.");
        }
        if (archivo.isEmpty()) {
            throw new ApiException("El archivo de audio está vacío.");
        }

        try {
            Files.createDirectories(ArchivosEstaticosConfig.CARPETA_AUDIOS);

            String extension = "";
            String nombreOriginal = archivo.getOriginalFilename();
            if (nombreOriginal != null && nombreOriginal.contains(".")) {
                extension = nombreOriginal.substring(nombreOriginal.lastIndexOf('.'));
            }
            String nombreArchivo = UUID.randomUUID() + extension;
            Path destino = ArchivosEstaticosConfig.CARPETA_AUDIOS.resolve(nombreArchivo);
            archivo.transferTo(destino);

            DictadoAudio guardado = dictadoAudioRepository.save(DictadoAudio.builder()
                    .titulo(titulo)
                    .textoTranscripcion(transcripcion)
                    .archivoUrl("/media/audios/" + nombreArchivo)
                    .dificultad(Dificultad.valueOf(dificultad.toUpperCase()))
                    .build());

            log.info("Audio de dictado subido: {} ({})", guardado.getTitulo(), guardado.getArchivoUrl());
            return ResponseEntity.ok(GenericResponse.success("Audio subido correctamente", guardado.getArchivoUrl()));

        } catch (IOException e) {
            log.error("Error guardando el archivo de audio: {}", e.getMessage());
            throw new ApiException("No se pudo guardar el archivo de audio.");
        }
    }
}
