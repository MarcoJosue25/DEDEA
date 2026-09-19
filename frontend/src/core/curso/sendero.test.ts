import { describe, expect, it } from 'vitest';
import type { ProgresoEjercicioResponse } from '../../types';
import { enConstruccion, llegoAlTestFinal, nivelSiguiente } from './sendero';

let siguienteId = 1;
const nodo = (cambios: Partial<ProgresoEjercicioResponse> = {}): ProgresoEjercicioResponse => ({
  ejercicioId: siguienteId++,
  titulo: 'Ejercicio',
  descripcion: null,
  bloque: 1,
  orden: siguienteId,
  completado: false,
  ...cambios,
});
const hecho = () => nodo({ completado: true });
const testFinal = (completado = false) => nodo({ rolEnNivel: 'TEST_FINAL', completado });

/* Los casos que CLAUDE.md 6.13 (punto 9) dejó verificados a mano el 10-sep-2026: el aviso
   de estrellas pendientes sale SOLO al llegar al examen, no a veinte nodos del final. */
describe('llegoAlTestFinal', () => {
  it('es falso a mitad del sendero, aunque haya ejercicios de una estrella', () => {
    const sendero = [hecho(), nodo({ completado: true, porMejorar: true }), nodo(), nodo(), testFinal()];
    expect(llegoAlTestFinal(sendero)).toBe(false);
  });

  it('es verdadero con todo hecho menos el examen', () => {
    expect(llegoAlTestFinal([hecho(), hecho(), hecho(), testFinal()])).toBe(true);
  });

  it('sigue siendo verdadero con el examen ya dado (el candado se sigue mostrando)', () => {
    expect(llegoAlTestFinal([hecho(), hecho(), testFinal(true)])).toBe(true);
  });

  it('es falso si falta un solo ejercicio', () => {
    expect(llegoAlTestFinal([hecho(), nodo(), hecho(), testFinal()])).toBe(false);
  });

  it('es falso en un nivel sin Test Final (Intermedio y Avanzado, hoy)', () => {
    expect(llegoAlTestFinal([hecho(), hecho(), hecho()])).toBe(false);
  });

  it('es falso en un nivel vacío', () => {
    expect(llegoAlTestFinal([])).toBe(false);
  });
});

/* Lo usa la tarjeta de la Prueba de nivel para decir qué nivel se abre al aprobarla. */
describe('nivelSiguiente', () => {
  it('Básico abre Intermedio e Intermedio abre Avanzado', () => {
    expect(nivelSiguiente('BASICO')).toBe('INTERMEDIO');
    expect(nivelSiguiente('INTERMEDIO')).toBe('AVANZADO');
  });

  it('después de Avanzado no hay otro', () => {
    expect(nivelSiguiente('AVANZADO')).toBeNull();
  });
});

/* Avanzado queda cerrado mientras se termina, aunque Intermedio ya pueda aprobarse
   (decisión del usuario, 18-sep-2026). Sacarlo de la lista es lo que lo abre. */
describe('enConstruccion', () => {
  it('Avanzado está en construcción', () => {
    expect(enConstruccion('AVANZADO')).toBe(true);
  });

  it('Básico e Intermedio no', () => {
    expect(enConstruccion('BASICO')).toBe(false);
    expect(enConstruccion('INTERMEDIO')).toBe(false);
  });
});
