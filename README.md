# Waymo Care

A browser game about being the robotaxi pit crew in a toy San Francisco. Robotaxis pull over with problems, and you run over and fix them before the rider loses patience:

| Job | What happened | What you do |
| --- | --- | --- |
| **Wash** | Mud, dust and seagull droppings | Hold and drag the sponge to scrub the car clean |
| **Recharge** | Flat battery | Drag the plug to the port, then tap when the needle is in the green (three good taps fills it) |
| **De-cone** | Someone put a traffic cone on the hood | Grab the cones and fling them off the car |
| **Shoo birds** | Pigeons (and gulls, which take two taps) nesting on the warm sensors | Tap them to send them flying |
| **Reboot** | Karl the Fog confused the lidar | Key in the recalibration code with the arrow keys or the on-screen buttons |

You play three 100-second shifts: **Morning Rush** (sunny), **Karl the Fog** (foggy, with sensor reboots) and **Golden Hour** (sunset, with every job type). Fast jobs and calm riders score more, jobs done in a row multiply your points up to x2, and the day ends with a Bronze, Silver, Gold or Platinum medal. Your best score is kept in the browser's `localStorage`. There is no online leaderboard.

## Controls

- **Move:** WASD or the arrow keys, or click or tap the street. Hold to keep steering.
- **Help a car:** click or tap it (or its bubble, or its entry in the job list), or press <kbd>Space</kbd> when you're next to it.
- **Jobs:** mouse or touch. Charge, cones and reboot also work from the keyboard (<kbd>Space</kbd> / arrows). <kbd>Esc</kbd> leaves a job.
- **Pause:** <kbd>Esc</kbd> or <kbd>P</kbd>. Mouse wheel zooms.

## Running it

It's a static site with no build step. Serve the folder with any web server and open `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

It also deploys as-is to GitHub Pages or any static host.

## How it's made

The game is modelled on [Slop Skies](https://slop.inc/), whose shipped source is kept for reference in `reference/slop-skies/`. It uses the same stack: three.js r128 (`lib/three.min.js`), a hand-built low-poly San Francisco, and a glossy, rounded UI in the style of 2006-era console sports games.

- `js/world.js`: the city. It has hills, a 5×5 street grid with crosswalks, painted-lady rows, downtown towers, the Transamerica Pyramid, Coit Tower, the Ferry Building, the Golden Gate and Bay bridges, Alcatraz and the bay, plus the three lighting looks (sun, fog, dusk). Static scenery is merged into a few vertex-coloured meshes.
- `js/actors.js`: the robotaxi model (with a spinning lidar dome), traffic that drives the grid and pulls over when something goes wrong, status bubbles, and the big-headed crew member.
- `js/minigames.js`: the five jobs, drawn on a 2D canvas card.
- `js/audio.js`: all music and sound effects, synthesised live with Web Audio. There are no audio files. It includes a bossa-nova menu theme, a swing-pop gameplay theme that speeds up for the last 20 seconds, a results theme, and SFX such as the referee whistle, crowd cheers, chimes, sponge squeaks, pigeon coos and lidar beeps.
- `js/game.js`: the rules, rounds, scoring, camera, click-to-walk pathfinding (A* on a 1 m grid), the HUD and the screens.
- `css/style.css`: the UI.

This is a fan-made game and is not affiliated with Waymo.
