interface Props {
  /* Cuántas están ganadas. Admite MEDIAS: 2.5 pinta la tercera estrella hasta la mitad.
     La escala la decide el servidor (calcularMediasEstrellas) y acá solo se dibuja. */
  cantidad: number;
  total?: number;
  // Lado del icono en px. Las del sendero son chiquitas; las de la pantalla final, grandes.
  tamano?: number;
  /* Con animación, cada estrella entra escalonada. Se apaga en el sendero: treinta nodos
     animándose a la vez al cargar la pantalla es ruido, no celebración. */
  animar?: boolean;
}

/* Las estrellas del Curso. Una sola pieza para las dos pantallas donde aparecen —la
   recompensa al terminar y cada nodo del sendero— porque si fueran dos componentes se
   desincronizarían el día que cambie la escala.

   El hueco de una estrella no conseguida se dibuja SIEMPRE, aunque sean tres huecos: sin
   los huecos no hay forma de saber que faltan dos, y un usuario con una estrella creería
   que ya tiene el máximo. Es la misma razón por la que TypingClub y typing.com muestran
   la estrella vacía en gris en vez de no mostrarla.

   La media estrella se dibuja con DOS iconos superpuestos —el hueco entero abajo, el
   macizo encima recortado al 50% de ancho— y no con un icono "star_half" propio: así el
   recorte sale del mismo número que manda el servidor, y si algún día la escala tuviera
   cuartos no habría que buscar otro glifo. */
const Estrellas = ({ cantidad, total = 3, tamano = 20, animar = false }: Props) => (
  <span className="inline-flex items-center gap-0.5" role="img"
    aria-label={`${cantidad} de ${total} estrellas`}>
    {Array.from({ length: total }).map((_, i) => {
      // 1 = entera, 0.5 = media, 0 = hueco. El clamp evita que la última se pase de 1.
      const llenado = Math.max(0, Math.min(1, cantidad - i));
      return (
        <span
          key={i}
          aria-hidden="true"
          className={`relative inline-block leading-none ${
            llenado > 0 && animar ? 'estrella-aparece' : ''
          }`}
          style={{
            width: tamano,
            height: tamano,
            // Escalonado: la tercera cae 240ms después de la primera, que es lo que hace
            // que se lea como "una, dos, ¡tres!" y no como un bloque que aparece.
            animationDelay: llenado > 0 && animar ? `${i * 120}ms` : undefined,
          }}>
          {/* El hueco, siempre debajo. */}
          <span
            className="material-symbols-outlined absolute inset-0 leading-none"
            style={{
              fontSize: tamano,
              color: 'var(--color-oro-apagado)',
              fontVariationSettings: `'FILL' 0, 'wght' 500, 'opsz' ${tamano}`,
            }}>
            star
          </span>

          {/* La parte ganada, recortada por ancho. El relleno es lo que distingue
              "ganada" de "hueco" de un vistazo, más que el color: una estrella de
              contorno se lee como marco vacío aun en dorado. */}
          {llenado > 0 && (
            <span className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${llenado * 100}%` }}>
              <span
                className="material-symbols-outlined block leading-none"
                style={{
                  fontSize: tamano,
                  color: 'var(--color-oro)',
                  fontVariationSettings: `'FILL' 1, 'wght' 500, 'opsz' ${tamano}`,
                }}>
                star
              </span>
            </span>
          )}
        </span>
      );
    })}
  </span>
);

export default Estrellas;
