# Simón (HTML/CSS/JS puros)

Un juego tipo “Simón dice” sin frameworks ni librerías externas. Accesible, responsive y con tabla de récords persistente (localStorage).

## Cómo correr
Solo abrí `index.html` en tu navegador moderno. No requiere servidor.

## Objetivo
Memorizar y repetir la secuencia de colores/sonidos. Cada ronda agrega un paso. Si fallás, termina la partida y podés guardar tu puntaje.

## Controles
- **Botones:** Iniciar, Pausar/Continuar, Reiniciar, Sonido ON/OFF, Dificultad (Fácil/Medio/Difícil), Modo Estricto.
- **Teclado:** A (verde), S (rojo), K (amarillo), L (azul).  
  Tab navega; Enter/Espacio activan el botón enfocado.

## Puntuación
- +1 por cada paso correcto.
- **Bonus:** +n al completar la ronda n.

## Dificultad (ritmo)
- **Fácil:** 800ms encendido / 300ms apagado  
- **Medio:** 600ms encendido / 250ms apagado  
- **Difícil:** 420ms encendido / 200ms apagado  
**Modo Estricto:** si errás, **game over** inmediato. Si está desactivado, se repite la secuencia como ayuda.

## Sonido
Cada color tiene un tono propio usando Web Audio API (AudioContext). Botón **Sonido** para mutear/desmutear.

## Tabla de Récords
- Clave de `localStorage`: `simon:records`
- Estructura: array de `{ name, score, dateISO }`
- Orden: descendente por `score`, **Top 10**.
- **Guardar récord:** aparece un modal al finalizar la partida. Nombre 3–12 caracteres.
- **Borrar récords:** botón “🗑 Borrar récords” (con confirmación).
- Si superás el mejor puntaje local, aparece confeti 🎉.

## Accesibilidad
- Roles y `aria-pressed` en pads.
- Foco visible (`:focus-visible`).
- Contraste y formas/icónicas en cada color para no depender solo del color.
- `aria-live` para tablero y toasts.

## Licencia
MIT — Usalo, modificalo, compartilo.
