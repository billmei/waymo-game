/* Waymo Care · the game's own additions to the island. Slop Skies' San Francisco is built to be flown over, so round the
   play areas it leaves gaps a street-level game shows up: empty blocks by the landmarks, bare parkland in the Presidio and
   Golden Gate Park. While the island boots (its "extras" step, before the trees, so they keep clear), this fills them in
   with the island's own builders and colours: rows of Victorians and Outer Sunset houses, North Beach flats, downtown
   towers, and the Presidio's Main Post (the red-brick Montgomery Street Barracks on the Parade Ground, Mission Revival
   offices and officers' houses). Everything is in island units; js/world.js scales it. */
(function () {
  "use strict";
  const WG = (window.WG = window.WG || {});
  const D2R = Math.PI / 180;

  // what to build on each play area's blocks: [i, j] is the block between street lines i..i+1 and j..j+1 of the zone's
  // grid (ZONES in js/world.js). Kinds: rows (two rows of the island's terraced Victorians down the block's long sides),
  // sunset (rows of flat-roofed Outer Sunset houses), towers (downtown, four lots a block), hill (single houses, each
  // on its own footing, for streets too steep for a terrace). Only free ground is built on: not a house, landmark,
  // park, Market Street or the Great Highway
  const PLAN = {
    lombard: [
      ["hill", 12, -16],
      ["hill", 13, -16],
      ["hill", 12, -15],
      ["hill", 13, -15],
      ["hill", 17, -16],
      ["hill", 17, -15],
    ],
    downtown: [],
    ladies: [],
    windmills: [
      ["sunset", -29, -5],
      ["sunset", -28, -5],
      ["sunset", -29, -4],
      ["sunset", -28, -4],
      ["sunset", -29, -3],
      ["sunset", -28, -3],
    ],
  };
  for (let i = 17; i <= 20; i++)
    for (let j = -8; j <= -5; j++) PLAN.downtown.push(["towers", i, j]);
  for (let i = 3; i <= 6; i++)
    for (let j = -6; j <= -4; j++) PLAN.ladies.push(["rows", i, j]);
  // play areas whose new houses may stand on parkland (the windmills are in Golden Gate Park)
  const PARKLAND = new Set(["windmills"]);

  // blocks given a raised pad (and a pavement), by zone: js/world.js stands the crew on them
  const PADS = (WG.extraPads = {});

  WG.isleExtras = function (G, HG, SG, K) {
    const ZONES = WG.world.ZONES,
      hitsB = WG.isle.hitsBuilding;
    K.reseed(8808);
    const { R, RR, PK, hex } = K;
    const ROOFS = [
      "#7c706a",
      "#8b9099",
      "#b86f4f",
      "#56608f",
      "#5b7a6c",
      "#a75f45",
    ].map(hex);

    // a block of a zone's grid: its middle, angle and size
    function block(z, i, j) {
      const a = z.ang * D2R,
        c = Math.cos(a),
        s = Math.sin(a),
        lx = (i + 0.5) * z.u,
        lz = (j + 0.5) * z.v;
      return {
        x: lx * c - lz * s,
        z: lx * s + lz * c,
        a,
        c,
        s,
        u: z.u,
        v: z.v,
        W: z.u - 13,
        D: z.v - 13,
      };
    }
    // block-local to island coordinates
    const at = (B, lx, lz) => [
      B.x + lx * B.c - lz * B.s,
      B.z + lx * B.s + lz * B.c,
    ];
    // free ground for a footprint: above the sea, off the roads (Market Street, the Great Highway), off parks (unless
    // park), and clear of every house, tower, tree and landmark already standing
    function free(x, z, sx, sz, rot, park) {
      const c = Math.cos(rot),
        s = Math.sin(rot);
      for (let a = -0.5; a <= 0.5; a += 0.25)
        for (let b = -0.5; b <= 0.5; b += 0.25) {
          const px = x + a * sx * c - b * sz * s,
            pz = z + a * sx * s + b * sz * c,
            gy = K.terrainY(px, pz);
          if (gy < 2.5 || K.occAt(px, pz) === 2) return false;
          if (!park && K.parkAt(px, pz) > 0.35) return false;
          if (hitsB(px, gy + 3, pz, 1) || hitsB(px, gy + 10, pz, 1))
            return false;
        }
      return true;
    }
    // ...and not on a cliff
    function buildable(x, z, sx, sz, rot, steep, park) {
      const f = K.footG(x, z, sx, sz, rot);
      return (
        f.lo > 2.5 &&
        f.hi - f.lo < Math.max(sx, sz) * (steep || 0.36) &&
        free(x, z, sx, sz, rot, park)
      );
    }
    function pad(key, B, i, j, yard) {
      K.blockPad(HG, B.x, B.z, B.a, B.W, B.D, yard, yard === 0);
      K.occRect(B.x, B.z, B.W, B.D, B.a, -2);
      K.urbMark(B.x, B.z, B.u + 2, B.v + 2, B.a);
      (PADS[key] = PADS[key] || new Set()).add(i + "," + j);
    }
    function sideTrees(B) {
      for (const sg of [-1, 1])
        for (let lz = -B.D / 2 + 9; lz <= B.D / 2 - 9; lz += RR(16, 22)) {
          if (R() < 0.55) continue;
          const p = at(B, sg * (B.W / 2 + 2.4), lz);
          if (free(p[0], p[1], 5, 5, B.a, true)) K.streetTree(HG, p[0], p[1]);
        }
    }

    // two rows of terraced houses down the block's long sides, facing the streets (as the island's own blocks)
    function rows(key, B, i, j, kind, park) {
      const sunset = kind === "sunset",
        dep = sunset ? 14.5 : 15,
        len = B.D - 2;
      let n = 0;
      for (const sg of [-1, 1]) {
        const p = at(B, sg * (B.W / 2 - dep / 2), 0);
        if (!buildable(p[0], p[1], dep, len, B.a, 0.3, park)) {
          if (!sunset) side(B, sg, park);
          continue;
        }
        n += K.terrace(
          HG,
          p[0],
          p[1],
          B.a,
          len,
          dep,
          sg,
          sunset ? [7.5, 9.5] : [9.5, 12.5],
          sunset,
          sunset
            ? () => (R() < 0.8 ? 0 : 1)
            : () => {
                const q = R();
                return q < 0.4 ? 0 : q < 0.85 ? 1 : 2;
              },
        );
      }
      if (!n) return;
      pad(key, B, i, j, B.W - 2 * dep - 1);
      sideTrees(B);
    }

    // a house of its own, stood level on a footing: painted walls, a gabled or hipped roof, its front to the street
    function cottage(x, z, rot, w, d, park) {
      const f = K.footG(x, z, w + 2, d + 2, rot);
      if (f.lo < 2.5 || f.hi - f.lo > 12 || !free(x, z, w, d, rot, park))
        return false;
      const yB = f.lo - 1,
        y0 = f.hi + 0.2,
        h = RR(6.5, 9.5),
        wall = hex(PK(K.HCOL)),
        roof = PK(ROOFS);
      if (y0 - yB > 0.4)
        K.cbox(
          G,
          x,
          yB,
          z,
          w + 0.6,
          y0 - yB,
          d + 0.6,
          rot,
          K.LMC.concD,
          K.LMC.concD,
          0.2,
          0,
        );
      K.cbox(G, x, y0, z, w, h, d, rot, wall, false, 0.1, 0, 1, 1);
      if (R() < 0.6)
        K.gable(G, x, y0 + h, z, w, d, RR(2.6, 4), rot, roof, wall);
      else K.hip(G, x, y0 + h, z, w, d, RR(2.2, 3.2), rot, roof);
      K.addColl(x, z, w / 2, d / 2, rot, yB, y0 + h + 3.5);
      K.occRect(x, z, w, d, rot, 1);
      return true;
    }
    // houses stepped up a steep block, each on its own footing, along one long side (sg -1 west, 1 east) or both
    function side(B, sg, park) {
      for (let lz = -B.D / 2 + 5; lz <= B.D / 2 - 5; lz += 10.5) {
        const p = at(B, sg * (B.W / 2 - 6.5), lz);
        cottage(p[0], p[1], B.a, 11, 9, park);
      }
    }
    const hill = (B, park) => [-1, 1].forEach((sg) => side(B, sg, park));

    // a block of separate buildings, two across and two down: downtown towers (between the tall ones already there)
    function lots(key, B, i, j, park) {
      const lw = B.W / 2 - 2,
        ld = B.D / 2 - 2;
      let n = 0;
      for (let ix = 0; ix < 2; ix++)
        for (let iy = 0; iy < 2; iy++) {
          if (R() < 0.06) continue;
          const p = at(B, ((ix - 0.5) * B.W) / 2, ((iy - 0.5) * B.D) / 2);
          if (!buildable(p[0], p[1], lw, ld, B.a, 0.5, park)) continue;
          const h = R() < 0.35 ? RR(80, 150) : RR(34, 80),
            crown = h > 60 ? 1 + ((R() * 4) | 0) : 0,
            k = h > 110 ? 0.84 : 1;
          if (
            K.lot(
              HG,
              p[0],
              p[1],
              lw * k,
              ld * k,
              B.a,
              h,
              PK(K.TOWERC),
              PK(K.ROOFC),
              crown,
            )
          )
            n++;
        }
      if (n) pad(key, B, i, j, 0);
    }

    for (const key in PLAN) {
      const z = ZONES[key],
        park = PARKLAND.has(key);
      if (!z) continue;
      for (const [kind, i, j] of PLAN[key]) {
        const B = block(z, i, j);
        if (kind === "towers") lots(key, B, i, j, park);
        else if (kind === "hill") hill(B, park);
        else rows(key, B, i, j, kind, park);
      }
    }
    presidio(G, K, ZONES.presidio, block, at, free);
  };

  /* ---------- the Presidio's Main Post: the Army's old post under the Golden Gate Bridge. The Montgomery Street
     Barracks (red brick, three storeys, white two-storey porches) line the west side of the Parade Ground lawn; the
     Officers' Club and the post's offices are Mission Revival (white stucco, red tile roofs, curved parapets); white
     officers' houses stand along the streets round them. It all stands on the plateau above Crissy Field ---------- */
  function presidio(G, K, z, block, at, free) {
    if (!z) return;
    const { hex, RR } = K;
    const BRICK = hex("#a4493a"),
      BRICKD = hex("#8c3d31"),
      WHITE = hex("#f4f1e8"),
      STUCCO = hex("#f1ebdc"),
      TILE = hex("#b8573c"),
      SLATE = hex("#6c7078"),
      GREEN = hex("#4f7a54");
    // the ground under a footprint: build from below its low side to above its high side
    function base(x, zz, sx, sz, rot) {
      const f = K.footG(x, zz, sx + 2, sz + 2, rot);
      return {
        yB: f.lo - 1,
        y0: f.hi + 0.2,
        ok:
          f.lo > 2.5 &&
          f.hi - f.lo < 10 &&
          K.rectFree(x, zz, sx, sz, rot, 0) &&
          free(x, zz, sx, sz, rot, true),
      };
    }
    function claim(x, zz, sx, sz, rot, yB, top) {
      K.addColl(x, zz, sx / 2, sz / 2, rot, yB, top);
      K.occRect(x, zz, sx, sz, rot, 3);
      K.obAdd(x, zz, Math.max(sx, sz) * 0.6, top);
    }
    // a building's plinth, so it sits level on a slope
    function plinth(x, zz, sx, sz, rot, b, col) {
      if (b.y0 - b.yB > 0.3)
        K.cbox(
          G,
          x,
          b.yB,
          zz,
          sx + 1,
          b.y0 - b.yB,
          sz + 1,
          rot,
          col || K.LMC.concD,
          col || K.LMC.concD,
          0.3,
          0,
        );
    }
    // a barracks: three storeys of red brick, hipped slate roof, a white two-storey porch along the front (facing +x)
    function barracks(x, zz, rot, sz) {
      const sx = 15,
        h = 12,
        b = base(x, zz, sx + 6, sz, rot);
      if (!b.ok) return false;
      plinth(x, zz, sx, sz, rot, b, BRICKD);
      K.cbox(G, x, b.y0, zz, sx, h, sz, rot, BRICK, false, 0.2, 0, 1, 1);
      K.cbox(
        G,
        x,
        b.y0 + h,
        zz,
        sx + 1,
        0.6,
        sz + 1,
        rot,
        WHITE,
        WHITE,
        0.2,
        0,
      );
      K.hip(G, x, b.y0 + h + 0.6, zz, sx, sz, 4.2, rot, SLATE);
      // the porch: a deck at each floor on white posts, under a flat roof
      const c = Math.cos(rot),
        s = Math.sin(rot),
        P = (lx, lz) => [x + lx * c - lz * s, zz + lx * s + lz * c],
        pw = 3.2,
        pl = sz - 6,
        [px, pz] = P(sx / 2 + pw / 2, 0);
      for (const y of [b.y0 + 0.2, b.y0 + 4.2, b.y0 + 8.2])
        K.cbox(G, px, y, pz, pw, 0.4, pl, rot, WHITE, WHITE, 0, 0);
      for (let lz = -pl / 2 + 0.3; lz <= pl / 2; lz += pl / 8) {
        const [qx, qz] = P(sx / 2 + pw - 0.3, lz);
        K.stick(G, qx, b.y0, qz, qx, b.y0 + 8.6, qz, 0.35, 0.35, WHITE);
      }
      claim(x, zz, sx + pw * 2, sz, rot, b.yB, b.y0 + h + 4.8);
      return true;
    }
    // a Mission Revival building: white stucco, a low red-tile hip roof, a curved parapet over the door (facing +x)
    function mission(x, zz, rot, sx, sz, h) {
      const b = base(x, zz, sx, sz, rot);
      if (!b.ok) return false;
      plinth(x, zz, sx, sz, rot, b);
      K.cbox(G, x, b.y0, zz, sx, h, sz, rot, STUCCO, false, 0.3, 0, 1, 1);
      K.hip(G, x, b.y0 + h, zz, sx, sz, 2.6, rot, TILE);
      const c = Math.cos(rot),
        s = Math.sin(rot),
        P = (lx, y, lz) => [x + lx * c - lz * s, y, zz + lx * s + lz * c],
        fx = sx / 2 + 0.15,
        w = Math.min(9, sz * 0.35),
        y1 = b.y0 + h;
      // the parapet's scalloped gable, with a tile cap
      const prof = [
        [-w, y1 - 0.5],
        [-w, y1 + 1.6],
        [-w * 0.55, y1 + 2.6],
        [-w * 0.3, y1 + 3.6],
        [0, y1 + 4.2],
        [w * 0.3, y1 + 3.6],
        [w * 0.55, y1 + 2.6],
        [w, y1 + 1.6],
        [w, y1 - 0.5],
      ];
      // front and back, a quad per step of the outline (the face's normal points away from the given middle)
      for (let k = 0; k < prof.length - 1; k++) {
        const [l0, t0] = prof[k],
          [l1, t1] = prof[k + 1];
        for (const [d, m] of [
          [fx, fx - 5],
          [fx - 0.6, fx + 5],
        ]) {
          const mid = P(m, y1, 0);
          K.fc(
            G,
            [
              P(d, y1 - 0.5, l0),
              P(d, y1 - 0.5, l1),
              P(d, t1, l1),
              P(d, t0, l0),
            ],
            STUCCO,
            mid[0],
            mid[1],
            mid[2],
          );
        }
      }
      const top = prof.slice(1, -1).map(([lz, y]) => P(fx - 0.3, y + 0.2, lz));
      for (let k = 0; k < top.length - 1; k++)
        K.stick(
          G,
          top[k][0],
          top[k][1],
          top[k][2],
          top[k + 1][0],
          top[k + 1][1],
          top[k + 1][2],
          0.9,
          0.4,
          TILE,
        );
      // an arched porch: a white colonnade along the front
      const pl = sz * 0.6;
      for (let lz = -pl / 2; lz <= pl / 2 + 0.01; lz += pl / 6) {
        const q = P(sx / 2 + 2.2, 0, lz);
        K.stick(G, q[0], b.y0, q[2], q[0], b.y0 + 3.6, q[2], 0.6, 0.6, STUCCO);
      }
      const pc = P(sx / 2 + 1.2, 0, 0);
      K.cbox(
        G,
        pc[0],
        b.y0 + 3.6,
        pc[2],
        2.8,
        0.7,
        pl + 1,
        rot,
        STUCCO,
        TILE,
        0,
        0,
      );
      claim(x, zz, sx + 5, sz, rot, b.yB, y1 + 4.2);
      return true;
    }
    // an officers' house: two white storeys and a steep gable
    function house(x, zz, rot) {
      const sx = 10,
        sz = 12,
        h = 6.5,
        b = base(x, zz, sx, sz, rot);
      if (!b.ok) return false;
      plinth(x, zz, sx, sz, rot, b);
      K.cbox(G, x, b.y0, zz, sx, h, sz, rot, WHITE, false, 0.1, 0, 1, 1);
      K.gable(G, x, b.y0 + h, zz, sx, sz, 4.2, rot, SLATE, WHITE);
      const c = Math.cos(rot),
        s = Math.sin(rot),
        px = x + (sx / 2 + 1.2) * c,
        pz = zz + (sx / 2 + 1.2) * s;
      K.cbox(
        G,
        px,
        b.y0 + 2.8,
        pz,
        2.4,
        0.4,
        sz * 0.7,
        rot,
        WHITE,
        GREEN,
        0,
        0,
      );
      claim(x, zz, sx + 3, sz, rot, b.yB, b.y0 + h + 4.2);
      return true;
    }
    // the Parade Ground's flagpole
    function flag(x, zz) {
      const y = K.terrainY(x, zz);
      K.cbox(
        G,
        x,
        y - 0.5,
        zz,
        2.4,
        1.1,
        2.4,
        0,
        K.LMC.conc,
        K.LMC.conc,
        0.4,
        0,
      );
      K.stick(G, x, y, zz, x, y + 22, zz, 0.35, 0.35, WHITE);
      K.cbox(
        G,
        x + 2.6,
        y + 18.4,
        zz,
        4.6,
        3,
        0.15,
        0,
        hex("#3d5aa8"),
        false,
        0,
        0,
      );
      K.addColl(x, zz, 1.2, 1.2, 0, y - 0.5, y + 22);
    }

    const a = z.ang * D2R,
      FACE_N = a - Math.PI / 2,
      FACE_S = a + Math.PI / 2;
    // white officers' houses along a block's sides (side -1 west, 1 east), facing the street
    function houses(i, j, sides) {
      const B = block(z, i, j);
      for (const side of sides)
        for (let lz = -B.D / 2 + 9; lz <= B.D / 2 - 8; lz += 17) {
          const p = at(B, side * (B.W / 2 - 7), lz + RR(-1, 1));
          house(p[0], p[1], side > 0 ? a : a + Math.PI);
        }
    }
    // the Parade Ground, the lawn on blocks (-15, -17) and (-14, -17), with the flag in the middle
    {
      const P0 = block(z, -15, -17),
        P1 = block(z, -14, -17);
      K.occRect((P0.x + P1.x) / 2, (P0.z + P1.z) / 2, P0.u * 2, P0.D, a, 0);
      flag((P0.x + P1.x) / 2, (P0.z + P1.z) / 2);
    }
    // the Montgomery Street Barracks along its west side, facing it, and two more facing them across the street
    {
      const B = block(z, -16, -17),
        C = block(z, -16, -16);
      for (const lz of [-17, 17]) {
        const p = at(B, B.W / 2 - 11, lz);
        barracks(p[0], p[1], a, 28);
      }
      for (const lz of [-17, 17]) {
        const p = at(C, B.W / 2 - 11, lz);
        barracks(p[0], p[1], a, 28);
      }
    }
    // Mission Revival: the Officers' Club and the post's offices along the south side, facing north onto the lawn, and
    // more on its east side, facing west
    {
      const B = block(z, -15, -16),
        C = block(z, -14, -16),
        E = block(z, -13, -17),
        F = block(z, -13, -16);
      let p = at(B, 0, -B.D / 2 + 10);
      mission(p[0], p[1], FACE_N, 13, 36, 9);
      p = at(C, 0, -C.D / 2 + 11);
      mission(p[0], p[1], FACE_N, 16, 40, 7);
      for (const Q of [B, C]) {
        p = at(Q, 0, Q.D / 2 - 10);
        mission(p[0], p[1], FACE_S, 12, 30, 8);
      }
      for (const Q of [E, F]) {
        p = at(Q, -Q.W / 2 + 10, 0);
        mission(p[0], p[1], a + Math.PI, 13, 34, 9);
        p = at(Q, Q.W / 2 - 9, 0);
        mission(p[0], p[1], a, 11, 28, 7);
      }
    }
    // officers' houses on the slope to the north and down the west side
    for (const i of [-17, -16, -15, -14, -13]) houses(i, -18, [-1, 1]);
    houses(-17, -17, [-1, 1]);
    houses(-17, -16, [-1, 1]);
    houses(-16, -17, [-1]);
    houses(-16, -16, [-1]);
  }
})();
