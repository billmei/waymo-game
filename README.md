# Waymo Care

A browser game about being the robotaxi pit crew in toy San Francisco. Robotaxis pull over with problems, and you run over and fix them before the rider loses patience. Every job is played right on the 3D car: the camera swoops in close and you work on the car itself.

| Job | What happened | What you do |
| --- | --- | --- |
| **Wash** | Mud, dust and seagull droppings, in different places every time | Hold and drag the sponge to scrub the car clean (turn the camera to reach the far side) |
| **Recharge** | Flat battery | Drag the plug to the port, then tap when the needle is in the green (three good taps fills it) |
| **De-cone** | Someone put a traffic cone on the hood | Grab the cones and fling them off the car |
| **Shoo birds** | Pigeons (and gulls, which take two taps) nesting on the warm sensors | Tap them to send them flying |
| **Reboot** | Karl the Fog confused the lidar | Key in the recalibration code with the arrow keys or the on-screen buttons |
| **Vacuum** | Crumbs, popcorn, wrappers and a lost sock in the cabin | The roof comes off: hold and sweep the vacuum over the mess |
| **Close doors** | Riders walked off and left the doors (or the rear hatch) open | Hop on your skateboard and ride into each open door to slam it shut (Space to ollie) |

You play three 100-second shifts: **Morning Rush** Downtown (sunny, with washes, charging, cones and open doors), **Karl the Fog** in the Outer Sunset (foggy, adding sensor reboots and vacuuming) and **Golden Hour** in the Mission (sunset, with every job type). Jobs are dealt from a shuffled deck, so each shift gives you about the same number of every job it has, in a random order. Fast jobs and calm riders score more, jobs done in a row multiply your points up to x2, and the day ends with a Bronze, Silver, Gold or Platinum medal. Your best score is kept in the browser's `localStorage`. There is no online leaderboard.

## Controls

- **Move:** WASD or the arrow keys (relative to the camera), or click or tap the street. Hold to keep steering.
- **Skate:** hold <kbd>Shift</kbd> to ride your skateboard and go faster. On touch screens, tap the skateboard button.
- **Look around:** <kbd>Q</kbd> / <kbd>E</kbd>, drag with the right mouse button, drag with two fingers, or hold the turn arrows. This also works during jobs, to see the other side of the car.
- **Help a car:** click or tap it (or its bubble, or its entry in the job list), or press <kbd>Space</kbd> or <kbd>Enter</kbd> when you're next to it.
- **Jobs:** mouse or touch, directly on the 3D car. Charging, cones, birds and the reboot also work from the keyboard (<kbd>Space</kbd> / arrows). When skating, steer with WASD / arrows or hold the mouse, and press <kbd>Space</kbd> to ollie. <kbd>Esc</kbd> leaves a job.
- **Pause:** <kbd>Esc</kbd> or <kbd>P</kbd>. Mouse wheel zooms.

## Running it

It's a static site with no build step. Serve the folder with any web server and open `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

It also deploys as-is to any static host.

### GitHub Pages

`.github/workflows/pages.yml` publishes the game to GitHub Pages on every push to `main` (or when run by hand from the Actions tab). It publishes only what the game loads (`index.html`, `css/`, `js/` and `lib/`), so `reference/` and `tools/` stay out of the site.

To turn it on once, go to the repository's **Settings → Pages** and set **Source** to **GitHub Actions**. The game is then served at `https://<owner>.github.io/waymo-game/`.

## How it's made

- `js/isle.js`: the island, **generated** by `tools/extract_isle.py`, `src/island.js` and `src/render.js`, verbatim:
  - terrain and neighbourhoods
  - Victorian terraces, flats, towers and the landmarks (Painted Ladies, City Hall, Transamerica, Salesforce, Coit Tower, both bridges and more)
  - trees, boats, sea, sky, clouds, and their shaders and blob shadows

  Don't edit `js/isle.js` by hand; run `python3 tools/extract_isle.py` to regenerate it.
- `js/world.js`: stands the game on that island:
  - boots the island enlarged by `SCALE`, converting between game metres and island units at every call
  - reads each shift's district street grid into a graph for the robotaxis, checked against the island's own colliders
  - paves those streets using the island's terrain shader
  - answers ground-height and collision questions
  - haze and light into the three shifts: its own `promo` grade for the morning, plus Karl the Fog and Golden Hour
- `js/actors.js`: the robotaxi model (with a spinning lidar dome) and the big-headed crew member, both with blob shadows like the island's. It also handles traffic that drives the street graph and pulls over to the curb when something goes wrong (keeping clear of street trees), and the status bubbles.
- `js/jobs.js`: the seven jobs, played in the 3D scene with the main camera. This covers the dirt you scrub off, the charging cart and cable, the cones you fling, the pigeons, the lidar scan rings, the cutaway cabin for vacuuming, and the skateboard. A small job bar shows the hint and progress.
- `js/audio.js`: music and sound effects. The music is Slop Skies' own score (`music/`), looped at Slop's own loop points and levels, and it speeds up for the last 20 seconds. If the files can't be loaded, synthesised stand-ins play instead: a bossa-nova menu theme, a swing-pop gameplay theme and a results theme. The sound effects are synthesised live, such as the referee whistle, crowd cheers, chimes, sponge squeaks, pigeon coos, lidar beeps, door slams, the vacuum's hum and the skateboard's roll.
- `js/lines.js` and `js/voice.js`: the talking, done like Slop Skies' radio. Dispatch (on a radio-filtered line) calls in jobs, cheers you on and sums up each shift, and riders comment when you arrive. Lines show as captions, queue by priority (chatter is dropped while someone is talking), and duck the music. A line plays `voice/<id>.mp3` when `voice/index.json` lists it; until it's recorded, the speaker babbles in little pitched syllables.
- `js/game.js`: the rules, rounds, scoring and HUD. It also covers:
  - the camera: an aerial orbit over the city on the title screen, and a close street-level view in play that swings up over the rooftops whenever the island's buildings would block it, plus an X-ray silhouette when houses hide the crew member
  - click-to-walk pathfinding: A* on a 1 m grid over the play area
  - the screens
- `css/style.css`: the UI.

This is a fan-made game and is not affiliated with Waymo.

## Recording the voices

`tools/gen_voice.py` records every line in `js/lines.js` to `voice/<id>.mp3` and rebuilds `voice/index.json`. It matches Slop Skies' files (`reference/slop-skies/voice/`): trimmed, loudness-normalised, 32 kHz mono mp3 at 56 kbps. It needs `ffmpeg` and an API key for one of two text-to-speech services:

```sh
# OpenAI: gpt-4o-mini-tts, steered by a speaking-style instruction per speaker
OPENAI_API_KEY=... python3 tools/gen_voice.py --provider openai

# ElevenLabs: the most expressive option; design a voice for each speaker with Voice Design and pass its id
ELEVENLABS_API_KEY=... VOICE_DISPATCH=<id> VOICE_RIDER=<id> python3 tools/gen_voice.py --provider elevenlabs
```

It only records lines that don't have a file yet; `--only disp.good` re-records a group and `--force` re-records everything. To add a line, add it to `js/lines.js` and run the script again. Use designed or stock voices, not clones of real people.
