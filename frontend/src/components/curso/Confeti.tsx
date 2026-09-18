import { useEffect, useRef } from 'react';

interface Props {
  // Cuántas piezas lanzar. Un nodo completado tira pocas; aprobar un nivel, muchas.
  piezas?: number;
  colores?: string[];
}

/* Confeti en canvas, sin librería.

   Se hizo a mano y no con un paquete por dos razones concretas: el bundle de entrada ya
   se había bajado de 758 kB a 292 kB partiendo por vista (ver CLAUDE.md 13.1) y no tiene
   sentido devolverle 15 kB a la pantalla más liviana del Curso; y las librerías de
   confeti montan su propio canvas en el body, que en esta app se pelearía con el grano
   fijo de body::after y el z-index de #root.

   Un canvas y no divs animadas: 120 elementos del DOM con transform propia obligan al
   navegador a recalcular estilo en cada cuadro. En canvas son 120 rectángulos pintados
   en un solo paso.

   Se apaga solo: cuando la última pieza sale de la pantalla se cancela el bucle. No hay
   temporizador que adivine cuánto dura. */
const Confeti = ({ piezas = 90, colores }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    /* Respetar la preferencia del sistema no es opcional acá: para alguien con
       sensibilidad al movimiento, papelitos cayendo por toda la pantalla es exactamente
       el efecto que esa preferencia existe para evitar. El resto de la recompensa
       (estrellas, marcas, mensaje) se sigue viendo igual. */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const paleta = colores ?? ['#00F1FD', '#96F8FF', '#FFC53D', '#BF81FF', '#FFFFFF'];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ancho = canvas.offsetWidth;
    const alto = canvas.offsetHeight;
    canvas.width = ancho * dpr;
    canvas.height = alto * dpr;
    ctx.scale(dpr, dpr);

    const particulas = Array.from({ length: piezas }).map(() => ({
      x: Math.random() * ancho,
      // Arrancan ARRIBA del borde, repartidas en una franja: si salieran todas de y=0
      // exacto entrarían como una cortina recta en vez de como una lluvia.
      y: -Math.random() * alto * 0.6 - 10,
      ancho: 5 + Math.random() * 5,
      alto: 8 + Math.random() * 6,
      velocidadY: 55 + Math.random() * 95,      // px por segundo
      derivaX: (Math.random() - 0.5) * 50,
      giro: Math.random() * Math.PI * 2,
      velocidadGiro: (Math.random() - 0.5) * 6,
      color: paleta[Math.floor(Math.random() * paleta.length)],
    }));

    let raf = 0;
    let ultimo = performance.now();

    const dibujar = (ahora: number) => {
      // Por tiempo real y no por cuadro: en una pantalla de 144Hz el confeti caería al
      // doble de velocidad que en una de 60Hz. Misma regla que el bucle de Lluvia de letras.
      const dt = Math.min((ahora - ultimo) / 1000, 0.05);
      ultimo = ahora;
      ctx.clearRect(0, 0, ancho, alto);

      let vivas = 0;
      for (const p of particulas) {
        p.y += p.velocidadY * dt;
        p.x += p.derivaX * dt;
        p.giro += p.velocidadGiro * dt;
        if (p.y < alto + 20) vivas++;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.giro);
        ctx.fillStyle = p.color;
        // El |cos| aplasta el papelito al girar: es lo que lo hace parecer una lámina
        // dando vueltas y no un cuadrado bajando.
        ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto * Math.abs(Math.cos(p.giro)));
        ctx.restore();
      }

      if (vivas === 0) return; // se acabó: no se pide otro cuadro
      raf = requestAnimationFrame(dibujar);
    };

    raf = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(raf);
  }, [piezas, colores]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      /* pointer-events-none es obligatorio: el canvas cubre el panel entero y sin esto
         se comería los clics de los botones que hay debajo. */
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
};

export default Confeti;
