# Waymo Care

A browser game about being the robotaxi pit crew in toy San Francisco. Robotaxis pull over with problems, and you run over and fix them before the rider loses patience. Every job is played right on the 3D car: the camera swoops in close and you work on the car itself.

| Job | What happened | What you do |
| --- | --- | --- |
| **Wash** | Mud, dust and seagull droppings | Hold and drag the sponge to scrub the car clean |
| **Recharge** | Flat battery | Drag the plug to the port, then tap when the needle is in the green (three good taps fills it) |
| **De-cone** | Someone put a traffic cone on the hood | Grab the cones and fling them off the car |
| **Shoo birds** | Pigeons (and gulls, which take two taps) nesting on the warm sensors | Tap them to send them flying |
| **Reboot** | Karl the Fog confused the lidar | Key in the recalibration code with the arrow keys or the on-screen buttons |
| **Vacuum** | Crumbs, popcorn, wrappers and a lost sock in the cabin | The roof comes off: hold and sweep the vacuum over the mess |
| **Close doors** | Riders walked off and left the doors open | Hop on your skateboard and ride into each open door to slam it shut (Space to ollie) |

You play three 100-second shifts: **Morning Rush** (sunny, with washes, charging, cones and open doors), **Karl the Fog** (foggy, adding sensor reboots and vacuuming) and **Golden Hour** (sunset, with every job type). Fast jobs and calm riders score more, jobs done in a row multiply your points up to x2, and the day ends with a Bronze, Silver, Gold or Platinum medal. Your best score is kept in the browser's `localStorage`. There is no online leaderboard.

## Controls

- **Move:** WASD or the arrow keys, or click or tap the street. Hold to keep steering.
- **Help a car:** click or tap it (or its bubble, or its entry in the job list), or press <kbd>Space</kbd> when you're next to it.
- **Jobs:** mouse or touch, directly on the 3D car. Charging, cones, birds and the reboot also work from the keyboard (<kbd>Space</kbd> / arrows). When skating, steer with WASD / arrows or hold the mouse, and press <kbd>Space</kbd> to ollie. <kbd>Esc</kbd> leaves a job.
- **Pause:** <kbd>Esc</kbd> or <kbd>P</kbd>. Mouse wheel zooms.

## Running it

It's a static site with no build step. Serve the folder with any web server and open `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

It also deploys as-is to GitHub Pages or any static host.

## How it's made

- `js/isle.js`: the island, **generated** by `tools/extract_isle.py`, `src/island.js` and `src/render.js`, verbatim:
  - terrain and neighbourhoods
  - Victorian terraces, flats, towers and the landmarks (Painted Ladies, City Hall, Transamerica, Salesforce, Coit Tower, both bridges and more)
  - trees, boats, sea, sky, clouds, and their shaders and blob shadows

  Don't edit `js/isle.js` by hand; run `python3 tools/extract_isle.py` to regenerate it.
- `js/world.js`: stands the game on that island:
  - boots the island enlarged by `SCALE`, converting between game metres and island units at every call
  - reads Western Addition's street grid into a graph for the robotaxis, checked against the island's own colliders
  - paves those streets using the island's terrain shader
  - answers ground-height and collision questions
  - haze and light into the three shifts: its own `promo` grade for the morning, plus Karl the Fog and Golden Hour
- `js/actors.js`: the robotaxi model (with a spinning lidar dome) and the big-headed crew member, both with blob shadows like the island's. It also handles traffic that drives the street graph and pulls over to the curb when something goes wrong (keeping clear of street trees), and the status bubbles.
- `js/jobs.js`: the seven jobs, played in the 3D scene with the main camera. This covers the dirt you scrub off, the charging cart and cable, the cones you fling, the pigeons, the lidar scan rings, the cutaway cabin for vacuuming, and the skateboard. A small job bar shows the hint and progress.
- `js/audio.js`: all music and sound effects, synthesised live with Web Audio. There are no audio files. It includes a bossa-nova menu theme, a swing-pop gameplay theme that speeds up for the last 20 seconds, a results theme, and SFX such as the referee whistle, crowd cheers, chimes, sponge squeaks, pigeon coos, lidar beeps, door slams, the vacuum's hum and the skateboard's roll.
- `js/game.js`: the rules, rounds, scoring and HUD. It also covers:
  - the camera: an aerial orbit over the city on the title screen, and a close street-level view in play that swings up over the rooftops whenever the island's buildings would block it, plus an X-ray silhouette when houses hide the crew member
  - click-to-walk pathfinding: A* on a 1 m grid over the play area
  - the screens
- `css/style.css`: the UI.

This is a fan-made game and is not affiliated with Waymo.
