# Origen de palabras_es.txt

8,000 palabras en español, curadas a partir de la lista de frecuencia
[hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords)
(`content/2018/es/es_50k.txt`), derivada de un corpus de subtítulos.

- Código del repositorio original: licencia MIT.
- Contenido (las listas de frecuencia): licencia CC-BY-SA 4.0.

Curación aplicada sobre las 50,000 palabras originales:
- Solo palabras de 2 a 15 letras, únicamente `a-z`, `ñ`, `á/é/í/ó/ú/ü` (sin números,
  símbolos ni palabras repetidas).
- Se descartó una lista corta de groserías/insultos comunes.
- Se tomaron las primeras 8,000 que pasaron el filtro, en su orden original de
  frecuencia (más comunes primero).

---

# es_50k.txt (agregado el 1-sep-2026)

La lista **cruda** de 50.000, tal como la publica la fuente, sin curar. Se guarda sin tocar
para que el origen quede reproducible: la curación la hace ahora el código
(`FiltroPalabra` + la pantalla de revisión), no un proceso externo que no se puede repetir.

⚠️ Trae **dos columnas** separadas por espacio (`de 14459520`: palabra y número de
apariciones), mientras que `palabras_es.txt` trae una sola. El importador se queda con el
primer campo, así que sirve para los dos formatos.

⚠️ **No está libre de groserías**, al revés que `palabras_es.txt`: la curación de aquel
archivo las quitó y esta no. Y como vienen de un corpus de subtítulos son de altísima
frecuencia, así que caen en las primeras tandas de revisión.
