# Waymo Care

A browser game about being the robotaxi pit crew in toy San Francisco. Robotaxis pull over with problems, and you run over and fix them before the rider loses patience. Every job is played right on the 3D car: the camera swoops in close and you work on the car itself.

Each shift works a few blocks of streets round a different set of San Francisco landmarks. The landmarks get a tour in the shift's briefing and name tags over them in play; some stand in the play area for you to run around, others on the skyline beyond it:

| Shift | Where | Landmarks | Light | Jobs |
| --- | --- | --- | --- | --- |
| 1. **Crooked Street** | Russian Hill, between Lombard Street and Telegraph Hill | Lombard Street, Coit Tower | Morning | Vacuum, Recharge, Close doors |
| 2. **Main Post** | The Presidio, west of the Palace of Fine Arts | Golden Gate Bridge, Palace of Fine Arts | Sunny | + Shoo birds |
| 3. **Lunch Rush** | Downtown, between the Financial District's towers | Transamerica Pyramid, 555 California, Salesforce Tower | Sunny | + Wash |
| 4. **Golden Hour** | Alamo Square | Painted Ladies, Sutro Tower | Sunset | + Remove cones |
| 5. **Karl the Fog** | The west end of Golden Gate Park, by Ocean Beach | Dutch and Murphy windmills | Fog | + Reboot |

Every play area is about 300 to 600 m across. `node tools/map_levels.js` draws a top-down map of each one (see [Maps of the play areas](#maps-of-the-play-areas)).

| Job | What happened | What you do |
| --- | --- | --- |
| **Wash** | Mud, dust and seagull droppings, in different places every time | Hold and drag the sponge to scrub the car clean (turn the camera to reach the far side; the hint reminds you if nothing's been scrubbed for 5 seconds) |
| **Recharge** | Flat battery | Drag the plug to the port, then tap when the needle is in the green (three good taps fills it) |
| **Remove cones** | Someone boxed the car in with traffic cones on the road, so it can't drive off | Grab the cones and fling them out of the way |
| **Shoo birds** | Pigeons (and gulls, which take two taps) nesting on the warm sensors | Tap them to send them flying |
| **Reboot** | The car needs rebooting | Key in the restart code with the arrow keys or the on-screen buttons |
| **Vacuum** | Crumbs, popcorn, wrappers and a lost sock in the cabin | The roof comes off: hold and sweep the vacuum over the mess |
| **Close doors** | Riders walked off and left the doors open | Run round the car and bump each open door shut |

You play five 100-second shifts, each adding one job type to the last. Jobs are dealt from a shuffled deck, so each shift gives you about the same number of every job it has, in a random order. Fast jobs and calm riders score more, jobs done in a row multiply your points up to x2, and the day ends with a Bronze, Silver, Gold or Platinum medal. Your best score is kept in the browser's `localStorage`. There is no online leaderboard.

## Controls

- **Move:** WASD or the arrow keys (relative to the camera), or click or tap the street. Hold to keep steering.
- **Skate:** hold <kbd>Shift</kbd> to ride your skateboard and go faster. On touch screens, tap the skateboard button.
- **Look around:** <kbd>Q</kbd> / <kbd>E</kbd>, drag with the right mouse button, drag with two fingers, or hold the turn arrows. This also works during jobs, to see the other side of the car.
- **Help a car:** click or tap it (or its bubble, or its entry in the job list), or press <kbd>Space</kbd> or <kbd>Enter</kbd> when you're next to it.
- **Jobs:** mouse or touch, directly on the 3D car. Charging, cones, birds and the reboot also work from the keyboard (<kbd>Space</kbd> / arrows). When closing doors, run with WASD / arrows or hold the mouse. <kbd>Esc</kbd> leaves a job.
- **Pause:** <kbd>Esc</kbd>, <kbd>P</kbd> or the pause button. The pause menu shows these instructions again. Mouse wheel zooms.

## Running it

It's a static site with no build step. Serve the folder with any web server and open `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

It also deploys as-is to any static host.

### GitHub Pages

`.github/workflows/pages.yml` publishes the game to GitHub Pages on every push to `main` (or when run by hand from the Actions tab). It publishes only what the game loads (`index.html`, `css/`, `js/`, `lib/` and `voice/`), so `reference/` and `tools/` stay out of the site.

To turn it on once, go to the repository's **Settings → Pages** and set **Source** to **GitHub Actions**. The game is then served at `https://<owner>.github.io/waymo-game/`.

## How it's made

- `js/isle.js`: the island, first extracted by `tools/extract_isle.py` from Slop Skies' `src/core.js`, `src/data.js`, `src/island.js` and `src/render.js`:
  - terrain and neighbourhoods
  - Victorian terraces, flats, towers and the landmarks (Painted Ladies, City Hall, Transamerica, Salesforce, Coit Tower, both bridges and more)
  - trees, boats, sea, sky, clouds, and their shaders and blob shadows

- `js/world.js`: stands the game on that island:
  - boots the island enlarged by `SCALE`, converting between game metres and island units at every call
  - reads each shift's street grid into a graph for the robotaxis, checked against the island's own colliders. Each play area is defined in `ZONES`: its grid (a district's own, a finer one, or a neighbour's for a park), the grid lines that bound it, the districts it keeps, extra walkable ground round a landmark, the steepest street, ground kept clear of streets, and the landmarks it features
  - paves those streets using the island's terrain shader
  - answers ground-height and collision questions
  - lets the camera see through the houses: the island's building, landmark and tree shaders are patched so whatever stands between the camera and the crew member (or the car in a job) goes semi-transparent
  - haze and light into the shifts: its own `promo` grade for the day (with a low eastern sun for the morning), plus Karl the Fog and Golden Hour
- `js/actors.js`: the robotaxi model (with a spinning lidar dome) and the big-headed crew member, both with blob shadows like the island's. It lays out the dirt afresh for every wash (rays cast onto the body from all round the car) and the ring of cones on the road for every boxed-in car. It also handles traffic that drives the street graph and pulls over to the curb when something goes wrong (keeping clear of street trees), and the status bubbles.
- `js/jobs.js`: the seven jobs, played in the 3D scene with the main camera. This covers the dirt you scrub off, the charging cart and cable, the cones you fling off the road, the pigeons, the lidar scan rings, the cutaway cabin for vacuuming, and the run round the car to bump the doors shut. A small job bar shows the hint and progress.
- `js/audio.js`: all music and sound effects, synthesised live with Web Audio. There are no music files. It includes a bossa-nova menu theme, a swing-pop gameplay theme that speeds up for the last 20 seconds, a results theme, and SFX such as the referee whistle, crowd cheers, chimes, sponge squeaks, pigeon coos, lidar beeps, door slams, the vacuum's hum and the skateboard's roll.
- `js/lines.js` and `js/voice.js`: the talking. Dispatch (a sarcastic, bratty young guy) calls in jobs, cheers you on and sums up each shift, and riders comment when you arrive. The riders are a cast of seven San Franciscans, each with their own voice: a wide-eyed tourist from Ohio, an influencer with a vocal fry, a sweet grandma, a founder late for standup, a deadpan local, a dreamy Mission artist and a frazzled student. Lines show as captions, queue by priority (chatter is dropped while someone is talking), and duck the music. A line plays `voice/<id>.mp3` when `voice/index.json` lists it.
- `js/game.js`: the rules, rounds, scoring and HUD. It also covers:
  - the camera: an aerial orbit over the city on the title screen, a tour of the shift's landmarks in the briefing, and a street-level view in play that starts facing the shift's landmark, turns houses in its way see-through (and only swings up over a hill), plus an X-ray silhouette when something else hides the crew member
  - click-to-walk pathfinding: A\* on a 1 m grid over the play area
  - the screens
- `css/style.css`: the UI.

This is a fan-made game and is not affiliated with Waymo.

## Maps of the play areas

`tools/map_levels.js` draws a top-down map of every play area, to check its size and layout. It serves the game, renders the real scene from straight above (north up) and draws on top:

- the play area's boundary (red dashes)
- the ground the crew can walk on (teal)
- the robotaxis' streets (yellow)
- where the crew starts (cyan dot)
- the shift's landmarks (white diamonds, with an arrow and a distance for one off the map)

Each map is headed with the area's size, its walkable ground, its streets, the fleet and how far the farthest corner is from the start. It needs Playwright with Chromium.

```sh
node tools/map_levels.js                  # every play area, into maps/
node tools/map_levels.js presidio ladies  # just these (keys of ZONES in js/world.js)
node tools/map_levels.js --grid --margin 150 --out /tmp/maps
```

`--grid` also draws the grid's street lines, numbered, past the play area, for picking new bounds. `maps/` is ignored by git.

## Recording the voices

Every line is recorded with ElevenLabs (the `eleven_v4` model), one voice per character:

| Speaker | Personality | ElevenLabs voice |
| --- | --- | --- |
| Dispatch | Sarcastic, bratty, high-pitched; cheers you on in a backhanded way | "Waymo Care - Dispatch (bratty, clean)" (Voice Design) |
| Tourist | Wide-eyed dad from Ohio, loud, easily amazed, lovably indignant | "Waymo Care - Tourist" (Voice Design) |
| Influencer | Californian vocal fry, every smudge is a crisis | "Waymo Care - Influencer" (Voice Design) |
| Grandma | Sweet, a little confused, calls you dear | Matilda (pre-made), with `[elderly voice]` |
| Founder | Over-caffeinated, fast and clipped, late for standup | Sarah (pre-made) |
| Local | Deadpan, gravelly, has seen it all | Callum (pre-made) |
| Artist | Dreamy and mellow, finds everything a little cosmic | River (pre-made) |
| Student | Frazzled, sheepish, nervous laugh | Liam (pre-made) |

How each line is performed (ElevenLabs audio tags like `[deadpan]` or `[giggles]`) is in `tools/voice_direction.json`; the captions in the game show the plain line from `js/lines.js`.

`tools/gen_voice.py` records every line in `js/lines.js` to `voice/<id>.mp3` and rebuilds `voice/index.json`. Like the reference voice clips in `reference/`, each line is trimmed, loudness-normalised and encoded as 32 kHz mono mp3 at 56 kbps. It needs `ffmpeg` and an API key for one of two text-to-speech services:

```sh
# OpenAI: gpt-4o-mini-tts, steered by a speaking-style instruction per speaker
OPENAI_API_KEY=... python3 tools/gen_voice.py --provider openai

# ElevenLabs: the voices above, acting out tools/voice_direction.json (override one with VOICE_<SPEAKER>=<id>)
ELEVENLABS_API_KEY=... python3 tools/gen_voice.py --provider elevenlabs

# Takes you generated elsewhere (e.g. in the ElevenLabs app), saved as takes/<id>.mp3
python3 tools/gen_voice.py --from-dir takes/
```

It only records lines that don't have a file yet; `--only disp.good` re-records a group and `--force` re-records everything. To add a line, add it to `js/lines.js` and run the script again. Use designed or stock voices, not clones of real people.
