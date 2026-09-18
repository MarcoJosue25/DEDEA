package com.dedea.app.repository;

import com.dedea.app.model.DictadoAudio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface DictadoAudioRepository extends JpaRepository<DictadoAudio, Integer> {

    @Query(value = "SELECT * FROM dictado_audios ORDER BY RAND() LIMIT 1", nativeQuery = true)
    // Tabla chica y de uso poco frecuente (el admin sube pocos audios a mano): ORDER BY RAND()
    // es aceptable acá, a diferencia del diccionario de 8000 palabras donde sí importaba el offset.
    List<DictadoAudio> encontrarUnoAleatorio();
}
