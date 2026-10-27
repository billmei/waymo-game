# Playtest and level-design scripts

Headless checks used while designing the landmark levels. Each one drives the game in Playwright's Chromium (SwiftShader WebGL), so it is slow but needs no GPU.

To run them, serve the repository on port 8123 (`python3 -m http.server 8123` from the repo root), then run the scripts from this folder. Images and JSON are written to the current directory.

| Script | What it does |
| --- | --- |
| `dump.js` | Prints every island landmark (`WG.isle.MARKS`): position, ground height, height. |
| `ev.js '<js expression>'` | Evaluates an expression in the booted page and prints the result. Used for terrain heights, collider checks and similar. |
| `probe.js '<json zones>'` | ASCII map of a district grid: district name, water (`~`) or collider (`#`) at each street corner. |
| `topdown.js '<json zones>'` + `annotate.py <keys>` | Renders a zone from straight above and draws its street graph, play area, start point and landmarks. |
| `play.js <shifts> [briefSeconds]` | Opens each shift's briefing, starts it and screenshots both (`s<k>_brief.png`, `s<k>_play.png`). |
| `occl.js <shift> [pick]` | Puts the crew member behind a building and screenshots with the see-through on and off. |
| `doors.js` | Starts shift 1, forces a door job on the nearest car and steers into the doors. |
| `router.js` | Page-side road routers: `__route` (grade-limited A*) and `__walk` (a walker that hugs the hill). |
| `roads.js '<json job>'` + `ann_rd.py <zone>` | Routes trial roads with `router.js` over a zone and renders them from above. |
| `td2.js <zone> <cx> <cz> <halfWidth>` + `ann2.py <zone>` | Renders a zone as `world.js` builds it, including one-way roads and generated houses. This needs the experimental road and house code, which is not in `main`. |

Zone, landmark and route coordinates are island units. The game's metres are island units × `world.js` `SCALE` (1.6).
