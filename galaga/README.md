# Galaga Web **ULTRA** (Vanilla)

Arcade estilo **Galaga** en **HTML5 Canvas + JS puro** — sin librerías.  
Incluye: **selector de dificultad**, **sprites opcionales**, **coreografías JSON** (figura-8 / espiral / enjambres seno), **partículas con blending additive**, dives Bezier, jefe con espiral doble, **power-ups**, HUD, pausa/mute/modo daltónico, **tabla de récords por nombre** y soporte **mobile**.

## Ejecutar
1. Guardá estos archivos en una carpeta:
   - `index.html`
   - `styles.css`
   - `game.js`
   - `README.md`
2. (Opcional) Agregá `/assets` con sprites:
/assets
player.png
enemy_basic.png
enemy_fast.png
enemy_tank.png
boss.png
3. Abrí `index.html` en tu navegador. Primer tap/click habilita audio en mobile.

## Controles
- **Desktop**: `←/→` o `A/D` mover · `Espacio` disparar · `P` pausar · `M` mute.
- **Mobile**: arrastrá en la franja inferior para mover · botón 🔥 dispara · ⏸ pausa.

## Dificultad
Selector en la barra superior (**Fácil / Normal / Difícil**). Persiste en `localStorage`.  
Afecta: velocidad/cadencia enemiga, HP de jefes, vidas del jugador, cadencia de disparo y multiplicador de puntaje.

## Sprites
Botón **🖼️** (ON/OFF). Si los PNG existen en `/assets`, se usan automáticamente; si no, se dibuja vectorial.  
Dimensiones sugeridas:
- `player.png` 24×24
- `enemy_basic.png` 24×16
- `enemy_fast.png` 24×16
- `enemy_tank.png` 24×16
- `boss.png` 48×24

## Coreografías (JSON)
El **Spawner** mezcla formaciones base + eventos de biblioteca:
- `sine_swarm` → oleadas *fast* laterales con trayectoria seno.
- `figure8` → grupo en **figura 8** (lemniscata simple) alrededor del centro.
- `spiral_in` → espiral hacia el centro desde izquierda/derecha.

Podés tunear en `ChoreoLibrary` (nombre + `params`) y en `ChoreoFns` (funciones).

## Power-ups
- `double` (doble disparo, 10 s)
- `rapid` (+30% ROF, 10 s)
- `shield` (absorbe 1 impacto)

## Leaderboard
- Botón **🏆** abre la tabla. Guarda **Top-10** con nombre y dificultad.
- Botón **Reiniciar** borra la tabla (no el High Score global).

## Rendimiento
- Pooling para balas y partículas.
- `requestAnimationFrame` + `deltaTime`.
- Culling fuera de pantalla.
- Partículas con **`globalCompositeOperation='lighter'`** (blending additive).

## Licencia
MIT. Código listo para extender.

---

### Ajustes rápidos
- Cadencia jugador: `Player.fireCooldownBase`.
- Probabilidad de drop: `chance(0.12)` en muerte de enemigo.
- HP de tanques/jefe: en `Enemy` + ajuste por dificultad (`DIFFS`).
- Frecuencia de coreografías: `spawner.patternTimer` en `spawnLevel`.

---

¡Listo, Alejandro! Tenés un **Galaga** que ya juega en Primera.  
¿Próxima fase? **Sprites animados**, **colisiones SAT**, **parry** (escudo activo), **jefes múltiples**, **modo Endless** con ranking global (si montamos backend). Cuando digas, lo soltamos 🚀

