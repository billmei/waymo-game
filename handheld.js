/* SLOP SKIES · isle edition — the handheld (phones only; shorter side < 600 CSS px).
   The Game Boy layout of the Fleet shell (site-c2 v18-v21) kept key for key, re-cut in the moulded language of the 2006 handhelds and
   motion remotes (research dossier 06): a glossy white body with sky-blue accents (client pick), a screen window with a black mask, a
   hinge capsule under it, a lockup row (the printed two-tier wordmark, four player lamps, SPECIAL), an analog stick in an octagonal
   gate, a clear sky-blue A dome and a white B key on a raised sky jacket, 1/2-style TGT/BRK caps in a shared well over it, round − / +
   keys for SELECT / START with a TILT key in the centre position between them, and a graded dot speaker under that row. Everything is
   drawn in CSS/SVG; no reference artwork ships.
   Kept from the Fleet shell: one pointer handler with every pointer tracked by pointerId (stick + FIRE + BOOST together, a thumb slides
   between keys, the gap between A and B presses both), labels placed LG px clear of their key's visible shape, the frame measured from
   100dvh (innerHeight fallback; claude.ai's artifact iframe included), re-layout on resize / orientationchange / visualViewport, all four
   safe-area insets (through --gb-sa*, so a test can stand in for a notch), the keyboard freeze for the name entry, and no selection,
   loupe or scroll under a thumb.
   New (isle): DR.cmd('aspect') asks for a 4:3 picture in portrait and 16:9 sideways; TILT steers by the phone's attitude (paper-plane
   hold: twist to bank, lift the top edge to climb) through DR.cmd('pad'), with the stick adding trim; English print only (CONTROL.md).
   site.8845c1b17855fc43.js calls GB.want(w, h) and GB.fit(on, w, h) from fitCompact(); everything else lives here and in handheld.8845c1b17855fc43.css. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s),
    body = document.body,
    root = document.documentElement,
    DR = window.DR;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const flying = () => /^(play|brief|down)$/.test(DR.state);
  const LG = 6,
    WM = 8;
  // label gap; the even margin every recess (A/B island, ring wells) keeps round its keys
  const DVH = !!(window.CSS && CSS.supports && CSS.supports("height", "1dvh"));
  const FACE = "#F3F4F6";
  // the shell's top colour: the browser's status-bar tint while the shell shows
  let on = false,
    land = false,
    sheet = false,
    kb = false,
    H0 = 0,
    home = null,
    homeNext = null,
    G = {},
    SH = {},
    swallowT = 0,
    aspect = "";

  /* ---------- the shell ---------- */
  // speakers, holes with a 1-px lip under each. grille(D, rows, pitch): one column per diameter in D. Portrait: the remote's graded
  // grille turned on its side, 6 x 3 (3/4.4/5.4/5.4/4.4/3 px on a 10-px pitch; 2 rows on short phones), centred under the − TILT + row
  // on the shell's axis; sideways a 3 x 2 grid of 5-px holes on a 9-px pitch at the top of each wing (the handheld's lid speakers)
  const grille = (D, rows, pitch, cls) => {
    const w = (D.length - 1) * pitch + 12,
      h = (rows - 1) * pitch + 12;
    return (
      '<svg class="' +
      cls +
      '" viewBox="0 0 ' +
      w +
      " " +
      h +
      '" width="' +
      w +
      '" height="' +
      h +
      '" aria-hidden="true">' +
      Array.from(
        {
          length: rows,
        },
        (_, r) =>
          D.map((d, c) => {
            const x = 6 + c * pitch,
              y = 6 + r * pitch,
              q = d / 2;
            return (
              '<circle cx="' +
              x +
              '" cy="' +
              (y + 0.8) +
              '" r="' +
              (q + 0.3) +
              '" fill="#fff"/><circle cx="' +
              x +
              '" cy="' +
              y +
              '" r="' +
              q +
              '" fill="url(#gbHole)"/>'
            );
          }).join(""),
      ).join("") +
      "</svg>"
    );
  };
  const SPK_D = [3, 4.4, 5.4, 5.4, 4.4, 3],
    SPK_P = 10;
  const holeDef =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><radialGradient id="gbHole" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="#6A6F75"/><stop offset=".55" stop-color="#80868C"/><stop offset="1" stop-color="#B2B8BE"/></radialGradient></defs></svg>';
  // the stick housing: a glossy boss with an octagonal gate cut into it, its floor in shade (a hole, not a ring), and four printed
  // direction dashes on the boss's rim, outside the cap's travel (the cap and the dark gap round it are .gb-nub and move together)
  const oct = (r) =>
    Array.from(
      {
        length: 8,
      },
      (_, i) => {
        const k = ((i + 0.5) * Math.PI) / 4;
        return (
          (50 + r * Math.cos(k)).toFixed(2) +
          "," +
          (50 + r * Math.sin(k)).toFixed(2)
        );
      },
    ).join(" ");
  const DASH_IN = 43.2,
    CAP = 0.54;
  // the dashes' inner end and the cap's diameter, in housing units (/100)
  const housing =
    '<svg class="gb-house" viewBox="0 0 100 100" aria-hidden="true"><defs>' +
    '<radialGradient id="gbBoss" cx="38%" cy="24%" r="84%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".4" stop-color="#F7F8FA"/><stop offset=".78" stop-color="#E4E8EC"/><stop offset="1" stop-color="#CFD5DC"/></radialGradient>' +
    '<radialGradient id="gbGate" cx="50%" cy="38%" r="62%"><stop offset="0" stop-color="#9BA3AC"/><stop offset=".55" stop-color="#B4BBC3"/><stop offset="1" stop-color="#D3D8DE"/></radialGradient>' +
    '<linearGradient id="gbGateLip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4E565E" stop-opacity=".8"/><stop offset=".45" stop-color="#4E565E" stop-opacity="0"/><stop offset=".62" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="1"/></linearGradient>' +
    '<linearGradient id="gbRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#E3E7EB"/><stop offset="1" stop-color="#B7BEC6"/></linearGradient></defs>' +
    '<circle cx="50" cy="50" r="49.4" fill="url(#gbBoss)"/><circle cx="50" cy="50" r="49" fill="none" stroke="url(#gbRim)" stroke-width=".9"/>' +
    '<path d="M11 36 A41 41 0 0 1 36 10.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".95"/>' +
    '<polygon points="' +
    oct(36) +
    '" fill="url(#gbGate)"/><polygon points="' +
    oct(36) +
    '" fill="none" stroke="url(#gbGateLip)" stroke-width="1.6"/>' +
    [[0], [90], [180], [270]]
      .map(
        (d) =>
          '<rect x="49.2" y="' +
          (50 - DASH_IN - 4.4) +
          '" width="1.6" height="4.4" rx=".8" fill="#A3AAB2" transform="rotate(' +
          d[0] +
          ' 50 50)"/>',
      )
      .join("") +
    "</svg>";
  // printed glyphs: TILT's paper plane (our mark, sky blue), TARGET's crosshair and BRAKE's double bar (grey print on the caps)
  const plane =
    '<svg class="gb-tilt-g" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.6 11.2 20.9 3.4c.6-.3 1.2.3.9.9l-7.8 18.3c-.3.6-1.1.6-1.3 0l-2.2-6.6a1 1 0 0 0-.6-.6L3.3 13.2c-.6-.2-.7-1.7-.7-2z" fill="currentColor"/><path d="m10.2 13.8 6.6-6.6" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".85"/></svg>';
  const cross =
    '<svg class="gb-gl" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="5.2" fill="none" stroke="currentColor" stroke-width="1.35"/><path d="M10 1.5v4.3M10 14.2v4.3M1.5 10h4.3M14.2 10h4.3" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>';
  const bars =
    '<svg class="gb-gl" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 7.4h11M4.5 12.6h11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  // the wordmark (the logo lane's two-tier lockup, design/logo-isle/svg, ids prefixed so they cannot clash with the page): printed flat
  // on the shell under the hinge, as the remotes print their grey logotype; the glossy version on the boot screen's thin band
  const MARK =
    '<svg viewBox="-20 -916 2234 958" class="gb-mark" aria-hidden="true" focusable="false"><defs><linearGradient id="gbFgg" gradientUnits="userSpaceOnUse" x1="0" y1="-886" x2="0" y2="-569.2"><stop offset="0" stop-color="#A8A8AC"/><stop offset="1" stop-color="#828288"/><\/linearGradient><linearGradient id="gbFgb" gradientUnits="userSpaceOnUse" x1="0" y1="-660" x2="0" y2="0"><stop offset="0" stop-color="#34AAEC"/><stop offset="1" stop-color="#1076C8"/><\/linearGradient><\/defs><path fill="url(#gbFgg)" fill-rule="evenodd" d="M1098 -886L915.7 -886A67.4 67.4 0 0 0 848.3 -818.6L848.3 -757.5A62.2 62.2 0 0 0 910.5 -695.3L1023.9 -695.3A5.2 5.2 0 0 1 1029.1 -690.1L1029.1 -640.4A5.2 5.2 0 0 1 1023.9 -635.2L848.3 -635.2L848.3 -569.2L1033.2 -569.2A64.8 64.8 0 0 0 1098 -634L1098 -696.4A64.8 64.8 0 0 0 1033.2 -761.2L922.4 -761.2A5.2 5.2 0 0 1 917.1 -766.5L917.1 -814.8A5.2 5.2 0 0 1 922.4 -820L1098 -820ZM1182 -886L1239.4 -886L1239.4 -569.2L1182 -569.2ZM1327.5 -748.2A58.3 58.3 0 0 1 1385.8 -806.5L1512.5 -806.5A58.3 58.3 0 0 1 1570.8 -748.2L1570.8 -627.5A58.3 58.3 0 0 1 1512.5 -569.2L1385.8 -569.2A58.3 58.3 0 0 1 1327.5 -627.5ZM1384.9 -736.1A13 13 0 0 1 1397.9 -749.1L1500.4 -749.1A13 13 0 0 1 1513.4 -736.1L1513.4 -639.6A13 13 0 0 1 1500.4 -626.6L1397.9 -626.6A13 13 0 0 1 1384.9 -639.6ZM1659.1 -748.2A58.3 58.3 0 0 1 1717.3 -806.5L1844.1 -806.5A58.3 58.3 0 0 1 1902.3 -748.2L1902.3 -627.5A58.3 58.3 0 0 1 1844.1 -569.2L1716.4 -569.2L1716.4 -527.5L1659.1 -527.5ZM1716.4 -736.1A13 13 0 0 1 1729.5 -749.1L1831.9 -749.1A13 13 0 0 1 1845 -736.1L1845 -639.6A13 13 0 0 1 1831.9 -626.6L1729.5 -626.6A13 13 0 0 1 1716.4 -639.6Z"/><path fill="url(#gbFgb)" d="M240 12Q182 12 120 -17Q58 -46 10 -112L104 -202Q131 -168 172 -147Q213 -126 256 -126Q277 -126 293.5 -132Q310 -138 319 -149Q328 -160 328 -176Q328 -202 309 -217Q290 -232 254 -254L202 -286Q156 -315 129 -353.5Q102 -392 102 -452Q102 -510 134 -557.5Q166 -605 219.5 -633.5Q273 -662 336 -662Q393 -662 446 -635Q499 -608 536 -560L446 -468Q421 -494 393.5 -509Q366 -524 334 -524Q311 -524 296 -517Q281 -510 273.5 -497.5Q266 -485 266 -470Q266 -448 286 -434Q306 -420 346 -394L404 -358Q452 -328 473 -294.5Q494 -261 494 -204Q494 -145 463 -96Q432 -47 375 -17.5Q318 12 240 12ZM512 0 652 -696H812L736 -320H740L904 -500H1080L874 -278L992 0H832L764 -186L696 -118L672 0ZM1032 0 1132 -500H1292L1192 0ZM1526 12Q1426 12 1366 -46Q1306 -104 1306 -204Q1306 -273 1331 -329.5Q1356 -386 1397 -427Q1438 -468 1488 -490Q1538 -512 1588 -512Q1649 -512 1685.5 -486Q1722 -460 1738 -417Q1754 -374 1754 -322Q1754 -297 1749 -272Q1744 -247 1738 -228Q1732 -209 1728 -202H1426L1438 -306H1620Q1622 -311 1623 -317Q1624 -323 1624 -330Q1624 -347 1619 -360.5Q1614 -374 1601.5 -382Q1589 -390 1568 -390Q1552 -390 1532.5 -382Q1513 -374 1495 -354.5Q1477 -335 1465.5 -301.5Q1454 -268 1454 -216Q1454 -175 1468.5 -152Q1483 -129 1507 -119.5Q1531 -110 1560 -110Q1581 -110 1606.5 -118Q1632 -126 1648 -138L1700 -44Q1669 -19 1624 -3.5Q1579 12 1526 12ZM1928 12Q1900 12 1866.5 1.5Q1833 -9 1802.5 -30.5Q1772 -52 1750 -84L1830 -160Q1859 -128 1887.5 -116Q1916 -104 1938 -104Q1953 -104 1966 -108.5Q1979 -113 1986.5 -120.5Q1994 -128 1994 -138Q1994 -151 1984 -160Q1974 -169 1955 -179Q1936 -189 1910 -204Q1873 -225 1843.5 -260Q1814 -295 1814 -344Q1814 -392 1841 -430Q1868 -468 1914 -490Q1960 -512 2016 -512Q2069 -512 2111 -489.5Q2153 -467 2184 -432L2104 -350Q2085 -368 2062 -381Q2039 -394 2016 -394Q1992 -394 1978 -383.5Q1964 -373 1964 -358Q1964 -337 1990 -325Q2016 -313 2044 -296Q2068 -283 2091 -264.5Q2114 -246 2129 -219.5Q2144 -193 2144 -156Q2144 -106 2116.5 -68Q2089 -30 2040 -9Q1991 12 1928 12Z"/><\/svg>\n';
  const MARK_GLOSS =
    '<svg viewBox="-112.8 -1008.8 2419.5 1176.5" class="gb-boot-mark" aria-hidden="true" focusable="false"><defs><linearGradient id="gbYgg" gradientUnits="userSpaceOnUse" x1="0" y1="-886" x2="0" y2="-569.2"><stop offset="0" stop-color="#A8A8AC"/><stop offset="1" stop-color="#828288"/><\/linearGradient><linearGradient id="gbYgb" gradientUnits="userSpaceOnUse" x1="0" y1="-673.2" x2="0" y2="0"><stop offset="0" stop-color="#34AAEC"/><stop offset=".55" stop-color="#2290DE"/><stop offset="1" stop-color="#1076C8"/><\/linearGradient><linearGradient id="gbYgl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".78"/><stop offset="1" stop-color="#fff" stop-opacity=".14"/><\/linearGradient><clipPath id="gbYcsk"><path d="M240 12Q182 12 120 -17Q58 -46 10 -112L104 -202Q131 -168 172 -147Q213 -126 256 -126Q277 -126 293.5 -132Q310 -138 319 -149Q328 -160 328 -176Q328 -202 309 -217Q290 -232 254 -254L202 -286Q156 -315 129 -353.5Q102 -392 102 -452Q102 -510 134 -557.5Q166 -605 219.5 -633.5Q273 -662 336 -662Q393 -662 446 -635Q499 -608 536 -560L446 -468Q421 -494 393.5 -509Q366 -524 334 -524Q311 -524 296 -517Q281 -510 273.5 -497.5Q266 -485 266 -470Q266 -448 286 -434Q306 -420 346 -394L404 -358Q452 -328 473 -294.5Q494 -261 494 -204Q494 -145 463 -96Q432 -47 375 -17.5Q318 12 240 12ZM512 0 652 -696H812L736 -320H740L904 -500H1080L874 -278L992 0H832L764 -186L696 -118L672 0ZM1032 0 1132 -500H1292L1192 0ZM1526 12Q1426 12 1366 -46Q1306 -104 1306 -204Q1306 -273 1331 -329.5Q1356 -386 1397 -427Q1438 -468 1488 -490Q1538 -512 1588 -512Q1649 -512 1685.5 -486Q1722 -460 1738 -417Q1754 -374 1754 -322Q1754 -297 1749 -272Q1744 -247 1738 -228Q1732 -209 1728 -202H1426L1438 -306H1620Q1622 -311 1623 -317Q1624 -323 1624 -330Q1624 -347 1619 -360.5Q1614 -374 1601.5 -382Q1589 -390 1568 -390Q1552 -390 1532.5 -382Q1513 -374 1495 -354.5Q1477 -335 1465.5 -301.5Q1454 -268 1454 -216Q1454 -175 1468.5 -152Q1483 -129 1507 -119.5Q1531 -110 1560 -110Q1581 -110 1606.5 -118Q1632 -126 1648 -138L1700 -44Q1669 -19 1624 -3.5Q1579 12 1526 12ZM1928 12Q1900 12 1866.5 1.5Q1833 -9 1802.5 -30.5Q1772 -52 1750 -84L1830 -160Q1859 -128 1887.5 -116Q1916 -104 1938 -104Q1953 -104 1966 -108.5Q1979 -113 1986.5 -120.5Q1994 -128 1994 -138Q1994 -151 1984 -160Q1974 -169 1955 -179Q1936 -189 1910 -204Q1873 -225 1843.5 -260Q1814 -295 1814 -344Q1814 -392 1841 -430Q1868 -468 1914 -490Q1960 -512 2016 -512Q2069 -512 2111 -489.5Q2153 -467 2184 -432L2104 -350Q2085 -368 2062 -381Q2039 -394 2016 -394Q1992 -394 1978 -383.5Q1964 -373 1964 -358Q1964 -337 1990 -325Q2016 -313 2044 -296Q2068 -283 2091 -264.5Q2114 -246 2129 -219.5Q2144 -193 2144 -156Q2144 -106 2116.5 -68Q2089 -30 2040 -9Q1991 12 1928 12Z"/><\/clipPath><clipPath id="gbYcsl"><path clip-rule="evenodd" d="M1098 -886L915.7 -886A67.4 67.4 0 0 0 848.3 -818.6L848.3 -757.5A62.2 62.2 0 0 0 910.5 -695.3L1023.9 -695.3A5.2 5.2 0 0 1 1029.1 -690.1L1029.1 -640.4A5.2 5.2 0 0 1 1023.9 -635.2L848.3 -635.2L848.3 -569.2L1033.2 -569.2A64.8 64.8 0 0 0 1098 -634L1098 -696.4A64.8 64.8 0 0 0 1033.2 -761.2L922.4 -761.2A5.2 5.2 0 0 1 917.1 -766.5L917.1 -814.8A5.2 5.2 0 0 1 922.4 -820L1098 -820ZM1182 -886L1239.4 -886L1239.4 -569.2L1182 -569.2ZM1327.5 -748.2A58.3 58.3 0 0 1 1385.8 -806.5L1512.5 -806.5A58.3 58.3 0 0 1 1570.8 -748.2L1570.8 -627.5A58.3 58.3 0 0 1 1512.5 -569.2L1385.8 -569.2A58.3 58.3 0 0 1 1327.5 -627.5ZM1384.9 -736.1A13 13 0 0 1 1397.9 -749.1L1500.4 -749.1A13 13 0 0 1 1513.4 -736.1L1513.4 -639.6A13 13 0 0 1 1500.4 -626.6L1397.9 -626.6A13 13 0 0 1 1384.9 -639.6ZM1659.1 -748.2A58.3 58.3 0 0 1 1717.3 -806.5L1844.1 -806.5A58.3 58.3 0 0 1 1902.3 -748.2L1902.3 -627.5A58.3 58.3 0 0 1 1844.1 -569.2L1716.4 -569.2L1716.4 -527.5L1659.1 -527.5ZM1716.4 -736.1A13 13 0 0 1 1729.5 -749.1L1831.9 -749.1A13 13 0 0 1 1845 -736.1L1845 -639.6A13 13 0 0 1 1831.9 -626.6L1729.5 -626.6A13 13 0 0 1 1716.4 -639.6Z"/><\/clipPath><filter id="gbYsh" x="-10%" y="-20%" width="120%" height="150%"><feGaussianBlur stdDeviation="18.5"/><\/filter><\/defs><g transform="translate(0 29.7)" opacity=".34" fill="#0B3E8A" stroke="#0B3E8A" stroke-width="87.1" stroke-linejoin="round" filter="url(#gbYsh)"><path fill-rule="evenodd" d="M1098 -886L915.7 -886A67.4 67.4 0 0 0 848.3 -818.6L848.3 -757.5A62.2 62.2 0 0 0 910.5 -695.3L1023.9 -695.3A5.2 5.2 0 0 1 1029.1 -690.1L1029.1 -640.4A5.2 5.2 0 0 1 1023.9 -635.2L848.3 -635.2L848.3 -569.2L1033.2 -569.2A64.8 64.8 0 0 0 1098 -634L1098 -696.4A64.8 64.8 0 0 0 1033.2 -761.2L922.4 -761.2A5.2 5.2 0 0 1 917.1 -766.5L917.1 -814.8A5.2 5.2 0 0 1 922.4 -820L1098 -820ZM1182 -886L1239.4 -886L1239.4 -569.2L1182 -569.2ZM1327.5 -748.2A58.3 58.3 0 0 1 1385.8 -806.5L1512.5 -806.5A58.3 58.3 0 0 1 1570.8 -748.2L1570.8 -627.5A58.3 58.3 0 0 1 1512.5 -569.2L1385.8 -569.2A58.3 58.3 0 0 1 1327.5 -627.5ZM1384.9 -736.1A13 13 0 0 1 1397.9 -749.1L1500.4 -749.1A13 13 0 0 1 1513.4 -736.1L1513.4 -639.6A13 13 0 0 1 1500.4 -626.6L1397.9 -626.6A13 13 0 0 1 1384.9 -639.6ZM1659.1 -748.2A58.3 58.3 0 0 1 1717.3 -806.5L1844.1 -806.5A58.3 58.3 0 0 1 1902.3 -748.2L1902.3 -627.5A58.3 58.3 0 0 1 1844.1 -569.2L1716.4 -569.2L1716.4 -527.5L1659.1 -527.5ZM1716.4 -736.1A13 13 0 0 1 1729.5 -749.1L1831.9 -749.1A13 13 0 0 1 1845 -736.1L1845 -639.6A13 13 0 0 1 1831.9 -626.6L1729.5 -626.6A13 13 0 0 1 1716.4 -639.6Z"/><path d="M240 12Q182 12 120 -17Q58 -46 10 -112L104 -202Q131 -168 172 -147Q213 -126 256 -126Q277 -126 293.5 -132Q310 -138 319 -149Q328 -160 328 -176Q328 -202 309 -217Q290 -232 254 -254L202 -286Q156 -315 129 -353.5Q102 -392 102 -452Q102 -510 134 -557.5Q166 -605 219.5 -633.5Q273 -662 336 -662Q393 -662 446 -635Q499 -608 536 -560L446 -468Q421 -494 393.5 -509Q366 -524 334 -524Q311 -524 296 -517Q281 -510 273.5 -497.5Q266 -485 266 -470Q266 -448 286 -434Q306 -420 346 -394L404 -358Q452 -328 473 -294.5Q494 -261 494 -204Q494 -145 463 -96Q432 -47 375 -17.5Q318 12 240 12ZM512 0 652 -696H812L736 -320H740L904 -500H1080L874 -278L992 0H832L764 -186L696 -118L672 0ZM1032 0 1132 -500H1292L1192 0ZM1526 12Q1426 12 1366 -46Q1306 -104 1306 -204Q1306 -273 1331 -329.5Q1356 -386 1397 -427Q1438 -468 1488 -490Q1538 -512 1588 -512Q1649 -512 1685.5 -486Q1722 -460 1738 -417Q1754 -374 1754 -322Q1754 -297 1749 -272Q1744 -247 1738 -228Q1732 -209 1728 -202H1426L1438 -306H1620Q1622 -311 1623 -317Q1624 -323 1624 -330Q1624 -347 1619 -360.5Q1614 -374 1601.5 -382Q1589 -390 1568 -390Q1552 -390 1532.5 -382Q1513 -374 1495 -354.5Q1477 -335 1465.5 -301.5Q1454 -268 1454 -216Q1454 -175 1468.5 -152Q1483 -129 1507 -119.5Q1531 -110 1560 -110Q1581 -110 1606.5 -118Q1632 -126 1648 -138L1700 -44Q1669 -19 1624 -3.5Q1579 12 1526 12ZM1928 12Q1900 12 1866.5 1.5Q1833 -9 1802.5 -30.5Q1772 -52 1750 -84L1830 -160Q1859 -128 1887.5 -116Q1916 -104 1938 -104Q1953 -104 1966 -108.5Q1979 -113 1986.5 -120.5Q1994 -128 1994 -138Q1994 -151 1984 -160Q1974 -169 1955 -179Q1936 -189 1910 -204Q1873 -225 1843.5 -260Q1814 -295 1814 -344Q1814 -392 1841 -430Q1868 -468 1914 -490Q1960 -512 2016 -512Q2069 -512 2111 -489.5Q2153 -467 2184 -432L2104 -350Q2085 -368 2062 -381Q2039 -394 2016 -394Q1992 -394 1978 -383.5Q1964 -373 1964 -358Q1964 -337 1990 -325Q2016 -313 2044 -296Q2068 -283 2091 -264.5Q2114 -246 2129 -219.5Q2144 -193 2144 -156Q2144 -106 2116.5 -68Q2089 -30 2040 -9Q1991 12 1928 12Z"/><\/g><g fill="#fff" stroke="#fff" stroke-width="87.1" stroke-linejoin="round"><path d="M1098 -886L915.7 -886A67.4 67.4 0 0 0 848.3 -818.6L848.3 -757.5A62.2 62.2 0 0 0 910.5 -695.3L1023.9 -695.3A5.2 5.2 0 0 1 1029.1 -690.1L1029.1 -640.4A5.2 5.2 0 0 1 1023.9 -635.2L848.3 -635.2L848.3 -569.2L1033.2 -569.2A64.8 64.8 0 0 0 1098 -634L1098 -696.4A64.8 64.8 0 0 0 1033.2 -761.2L922.4 -761.2A5.2 5.2 0 0 1 917.1 -766.5L917.1 -814.8A5.2 5.2 0 0 1 922.4 -820L1098 -820ZM1182 -886L1239.4 -886L1239.4 -569.2L1182 -569.2ZM1327.5 -748.2A58.3 58.3 0 0 1 1385.8 -806.5L1512.5 -806.5A58.3 58.3 0 0 1 1570.8 -748.2L1570.8 -627.5A58.3 58.3 0 0 1 1512.5 -569.2L1385.8 -569.2A58.3 58.3 0 0 1 1327.5 -627.5ZM1384.9 -736.1A13 13 0 0 1 1397.9 -749.1L1500.4 -749.1A13 13 0 0 1 1513.4 -736.1L1513.4 -639.6A13 13 0 0 1 1500.4 -626.6L1397.9 -626.6A13 13 0 0 1 1384.9 -639.6ZM1659.1 -748.2A58.3 58.3 0 0 1 1717.3 -806.5L1844.1 -806.5A58.3 58.3 0 0 1 1902.3 -748.2L1902.3 -627.5A58.3 58.3 0 0 1 1844.1 -569.2L1716.4 -569.2L1716.4 -527.5L1659.1 -527.5ZM1716.4 -736.1A13 13 0 0 1 1729.5 -749.1L1831.9 -749.1A13 13 0 0 1 1845 -736.1L1845 -639.6A13 13 0 0 1 1831.9 -626.6L1729.5 -626.6A13 13 0 0 1 1716.4 -639.6Z"/><path d="M240 12Q182 12 120 -17Q58 -46 10 -112L104 -202Q131 -168 172 -147Q213 -126 256 -126Q277 -126 293.5 -132Q310 -138 319 -149Q328 -160 328 -176Q328 -202 309 -217Q290 -232 254 -254L202 -286Q156 -315 129 -353.5Q102 -392 102 -452Q102 -510 134 -557.5Q166 -605 219.5 -633.5Q273 -662 336 -662Q393 -662 446 -635Q499 -608 536 -560L446 -468Q421 -494 393.5 -509Q366 -524 334 -524Q311 -524 296 -517Q281 -510 273.5 -497.5Q266 -485 266 -470Q266 -448 286 -434Q306 -420 346 -394L404 -358Q452 -328 473 -294.5Q494 -261 494 -204Q494 -145 463 -96Q432 -47 375 -17.5Q318 12 240 12ZM512 0 652 -696H812L736 -320H740L904 -500H1080L874 -278L992 0H832L764 -186L696 -118L672 0ZM1032 0 1132 -500H1292L1192 0ZM1526 12Q1426 12 1366 -46Q1306 -104 1306 -204Q1306 -273 1331 -329.5Q1356 -386 1397 -427Q1438 -468 1488 -490Q1538 -512 1588 -512Q1649 -512 1685.5 -486Q1722 -460 1738 -417Q1754 -374 1754 -322Q1754 -297 1749 -272Q1744 -247 1738 -228Q1732 -209 1728 -202H1426L1438 -306H1620Q1622 -311 1623 -317Q1624 -323 1624 -330Q1624 -347 1619 -360.5Q1614 -374 1601.5 -382Q1589 -390 1568 -390Q1552 -390 1532.5 -382Q1513 -374 1495 -354.5Q1477 -335 1465.5 -301.5Q1454 -268 1454 -216Q1454 -175 1468.5 -152Q1483 -129 1507 -119.5Q1531 -110 1560 -110Q1581 -110 1606.5 -118Q1632 -126 1648 -138L1700 -44Q1669 -19 1624 -3.5Q1579 12 1526 12ZM1928 12Q1900 12 1866.5 1.5Q1833 -9 1802.5 -30.5Q1772 -52 1750 -84L1830 -160Q1859 -128 1887.5 -116Q1916 -104 1938 -104Q1953 -104 1966 -108.5Q1979 -113 1986.5 -120.5Q1994 -128 1994 -138Q1994 -151 1984 -160Q1974 -169 1955 -179Q1936 -189 1910 -204Q1873 -225 1843.5 -260Q1814 -295 1814 -344Q1814 -392 1841 -430Q1868 -468 1914 -490Q1960 -512 2016 -512Q2069 -512 2111 -489.5Q2153 -467 2184 -432L2104 -350Q2085 -368 2062 -381Q2039 -394 2016 -394Q1992 -394 1978 -383.5Q1964 -373 1964 -358Q1964 -337 1990 -325Q2016 -313 2044 -296Q2068 -283 2091 -264.5Q2114 -246 2129 -219.5Q2144 -193 2144 -156Q2144 -106 2116.5 -68Q2089 -30 2040 -9Q1991 12 1928 12Z"/><\/g><path fill="url(#gbYgg)" fill-rule="evenodd" d="M1098 -886L915.7 -886A67.4 67.4 0 0 0 848.3 -818.6L848.3 -757.5A62.2 62.2 0 0 0 910.5 -695.3L1023.9 -695.3A5.2 5.2 0 0 1 1029.1 -690.1L1029.1 -640.4A5.2 5.2 0 0 1 1023.9 -635.2L848.3 -635.2L848.3 -569.2L1033.2 -569.2A64.8 64.8 0 0 0 1098 -634L1098 -696.4A64.8 64.8 0 0 0 1033.2 -761.2L922.4 -761.2A5.2 5.2 0 0 1 917.1 -766.5L917.1 -814.8A5.2 5.2 0 0 1 922.4 -820L1098 -820ZM1182 -886L1239.4 -886L1239.4 -569.2L1182 -569.2ZM1327.5 -748.2A58.3 58.3 0 0 1 1385.8 -806.5L1512.5 -806.5A58.3 58.3 0 0 1 1570.8 -748.2L1570.8 -627.5A58.3 58.3 0 0 1 1512.5 -569.2L1385.8 -569.2A58.3 58.3 0 0 1 1327.5 -627.5ZM1384.9 -736.1A13 13 0 0 1 1397.9 -749.1L1500.4 -749.1A13 13 0 0 1 1513.4 -736.1L1513.4 -639.6A13 13 0 0 1 1500.4 -626.6L1397.9 -626.6A13 13 0 0 1 1384.9 -639.6ZM1659.1 -748.2A58.3 58.3 0 0 1 1717.3 -806.5L1844.1 -806.5A58.3 58.3 0 0 1 1902.3 -748.2L1902.3 -627.5A58.3 58.3 0 0 1 1844.1 -569.2L1716.4 -569.2L1716.4 -527.5L1659.1 -527.5ZM1716.4 -736.1A13 13 0 0 1 1729.5 -749.1L1831.9 -749.1A13 13 0 0 1 1845 -736.1L1845 -639.6A13 13 0 0 1 1831.9 -626.6L1729.5 -626.6A13 13 0 0 1 1716.4 -639.6Z"/><path fill="url(#gbYgb)" d="M240 12Q182 12 120 -17Q58 -46 10 -112L104 -202Q131 -168 172 -147Q213 -126 256 -126Q277 -126 293.5 -132Q310 -138 319 -149Q328 -160 328 -176Q328 -202 309 -217Q290 -232 254 -254L202 -286Q156 -315 129 -353.5Q102 -392 102 -452Q102 -510 134 -557.5Q166 -605 219.5 -633.5Q273 -662 336 -662Q393 -662 446 -635Q499 -608 536 -560L446 -468Q421 -494 393.5 -509Q366 -524 334 -524Q311 -524 296 -517Q281 -510 273.5 -497.5Q266 -485 266 -470Q266 -448 286 -434Q306 -420 346 -394L404 -358Q452 -328 473 -294.5Q494 -261 494 -204Q494 -145 463 -96Q432 -47 375 -17.5Q318 12 240 12ZM512 0 652 -696H812L736 -320H740L904 -500H1080L874 -278L992 0H832L764 -186L696 -118L672 0ZM1032 0 1132 -500H1292L1192 0ZM1526 12Q1426 12 1366 -46Q1306 -104 1306 -204Q1306 -273 1331 -329.5Q1356 -386 1397 -427Q1438 -468 1488 -490Q1538 -512 1588 -512Q1649 -512 1685.5 -486Q1722 -460 1738 -417Q1754 -374 1754 -322Q1754 -297 1749 -272Q1744 -247 1738 -228Q1732 -209 1728 -202H1426L1438 -306H1620Q1622 -311 1623 -317Q1624 -323 1624 -330Q1624 -347 1619 -360.5Q1614 -374 1601.5 -382Q1589 -390 1568 -390Q1552 -390 1532.5 -382Q1513 -374 1495 -354.5Q1477 -335 1465.5 -301.5Q1454 -268 1454 -216Q1454 -175 1468.5 -152Q1483 -129 1507 -119.5Q1531 -110 1560 -110Q1581 -110 1606.5 -118Q1632 -126 1648 -138L1700 -44Q1669 -19 1624 -3.5Q1579 12 1526 12ZM1928 12Q1900 12 1866.5 1.5Q1833 -9 1802.5 -30.5Q1772 -52 1750 -84L1830 -160Q1859 -128 1887.5 -116Q1916 -104 1938 -104Q1953 -104 1966 -108.5Q1979 -113 1986.5 -120.5Q1994 -128 1994 -138Q1994 -151 1984 -160Q1974 -169 1955 -179Q1936 -189 1910 -204Q1873 -225 1843.5 -260Q1814 -295 1814 -344Q1814 -392 1841 -430Q1868 -468 1914 -490Q1960 -512 2016 -512Q2069 -512 2111 -489.5Q2153 -467 2184 -432L2104 -350Q2085 -368 2062 -381Q2039 -394 2016 -394Q1992 -394 1978 -383.5Q1964 -373 1964 -358Q1964 -337 1990 -325Q2016 -313 2044 -296Q2068 -283 2091 -264.5Q2114 -246 2129 -219.5Q2144 -193 2144 -156Q2144 -106 2116.5 -68Q2089 -30 2040 -9Q1991 12 1928 12Z"/><g clip-path="url(#gbYcsk)"><ellipse cx="1097" cy="-825" rx="1511.6" ry="547.8" fill="url(#gbYgl)"/><\/g><g clip-path="url(#gbYcsl)"><rect x="838.3" y="-896" width="1074.1" height="155.7" rx="63.4" fill="url(#gbYgl)" opacity=".8"/><\/g><\/svg>\n';
  const gb = document.createElement("div");
  gb.id = "gb";
  gb.hidden = true;
  gb.inert = body.classList.contains("is-layout-pending");
  gb.innerHTML =
    holeDef +
    '<div class="gb-body"><i class="gb-edge" aria-hidden="true"></i>' +
    '<div class="gb-bezel">' +
    '<div class="gb-lcd"><div class="gb-boot"><span class="gb-boot-band"><b class="gb-boot-t" role="img" aria-label="SLOP SKIES">' +
    MARK_GLOSS +
    '</b></span><i class="gb-bar"><u></u></i><span class="gb-boot-m">LOADING THE ISLAND</span></div>' +
    '<b class="gb-osd" aria-hidden="true"></b><div class="gb-toast" role="status" aria-live="polite" hidden></div></div>' +
    "</div>" +
    '<div class="gb-hinge" aria-hidden="true"><i></i><i></i><i></i><b class="gb-pwr"></b></div>' +
    '<div class="gb-logo"><span class="gb-brand" aria-hidden="true"><b class="gb-word">' +
    MARK +
    '</b><span class="gb-sub">FOG CITY ACES</span></span><button type="button" class="gb-special" disabled aria-label="Special empty: collect a mystery box"><b>SPECIAL</b><i class="gb-slit" aria-hidden="true"></i><span>FIND ? BOX</span></button></div>' +
    '<div class="gb-ctl">' +
    '<i class="gb-abw" aria-hidden="true"></i><i class="gb-tbw" aria-hidden="true"></i>' +
    '<div class="gb-c gb-stick" data-c="stick" role="img" aria-label="Stick: fly, or move the menu cursor">' +
    housing +
    '<b class="gb-nub"><u></u></b></div>' +
    '<div class="gb-c gb-btn gb-a" data-c="a" role="button" aria-label="A: fire, confirm"><b>A</b></div>' +
    '<div class="gb-c gb-btn gb-b" data-c="b" role="button" aria-label="B: boost, back"><b>B</b></div>' +
    '<div class="gb-c gb-sm gb-tgt" data-c="tgt" role="button" aria-label="Next target">' +
    cross +
    '<b class="gb-w">TARGET</b></div>' +
    '<div class="gb-c gb-sm gb-brk" data-c="brake" role="button" aria-label="Brake">' +
    bars +
    '<b class="gb-w">BRAKE</b></div>' +
    '<div class="gb-c gb-key gb-sel" data-c="select" role="button" aria-label="Minus: site menu"><i></i></div>' +
    '<div class="gb-c gb-key gb-start" data-c="start" role="button" aria-label="Plus: pause"><i></i></div>' +
    '<button type="button" class="gb-tilt" aria-pressed="false" aria-label="Tilt steering: off. Tap to turn on">' +
    plane +
    "</button>" +
    '<span class="gb-lab gb-l-stick">STICK</span>' +
    '<span class="gb-lab gb-l-a">FIRE</span>' +
    '<span class="gb-lab gb-l-b">BOOST</span>' +
    '<span class="gb-lab gb-l-tgt">TARGET</span>' +
    '<span class="gb-lab gb-l-brk">BRAKE</span>' +
    '<span class="gb-lab gb-l-sel">MENU</span>' +
    '<span class="gb-lab gb-l-tilt">TILT</span>' +
    '<span class="gb-lab gb-l-start">PAUSE</span>' +
    '<span class="gb-leds" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
    '<span class="gb-spk" aria-hidden="true">' +
    grille(SPK_D, 3, SPK_P, "gb-spk-g") +
    "</span>" +
    '<span class="gb-lid gb-lid-l" aria-hidden="true">' +
    grille([5, 5, 5], 2, 9, "gb-lid-g") +
    '</span><span class="gb-lid gb-lid-r" aria-hidden="true">' +
    grille([5, 5, 5], 2, 9, "gb-lid-g") +
    "</span>" +
    "</div>" +
    "</div>";
  body.appendChild(gb);
  const head = document.createElement("div");
  head.id = "gb-head";
  head.hidden = true;
  head.innerHTML =
    '<button type="button" class="gb-close"><u></u><b>BACK TO GAME</b></button><span class="gb-head-t">SITE MENU</span>';
  body.appendChild(head);
  const lcd = gb.querySelector(".gb-lcd"),
    ctl = gb.querySelector(".gb-ctl"),
    nub = gb.querySelector(".gb-nub"),
    osd = gb.querySelector(".gb-osd");
  const spk = gb.querySelector(".gb-spk"),
    dsL = gb.querySelector(".gb-lid-l"),
    dsR = gb.querySelector(".gb-lid-r"),
    abw = gb.querySelector(".gb-abw"),
    tbw = gb.querySelector(".gb-tbw"),
    leds = gb.querySelector(".gb-leds"),
    toastEl = gb.querySelector(".gb-toast");
  const tiltBtn = gb.querySelector(".gb-tilt"),
    logo = gb.querySelector(".gb-logo");
  const special = gb.querySelector(".gb-special"),
    specialStatus = special.querySelector("span");
  const EL = {};
  gb.querySelectorAll("[data-c]").forEach((e) => {
    EL[e.dataset.c] = e;
  });
  [
    "gesturestart",
    "gesturechange",
    "dblclick",
    "selectstart",
    "contextmenu",
  ].forEach((t) => {
    gb.addEventListener(t, (e) => e.preventDefault());
    head.addEventListener(t, (e) => e.preventDefault());
  });
  // iOS pinch / double-tap zoom, text selection and the long-press menu on the shell
  // touches on the keys never start a selection, the loupe or a scroll (pointer events still arrive: they fire before the touch events).
  // TILT is a real button with its own click (the motion-permission prompt needs one), so its touches are left alone.
  const isTilt = (e) =>
    !!(e.target && e.target.closest && e.target.closest(".gb-tilt"));
  ["touchstart", "touchmove"].forEach((t) =>
    ctl.addEventListener(
      t,
      (e) => {
        if (e.cancelable && !isTilt(e)) e.preventDefault();
      },
      {
        passive: false,
      },
    ),
  );

  /* ---------- HOW TO: the handheld drawn with its controls numbered (replaces the touch card while the shell is on) ---------- */
  const how = document.createElement("div");
  how.className = "gb-how";
  const callout = (n) =>
    '<g class="gb-how-n"><circle cx="' +
    n[0] +
    '" cy="' +
    n[1] +
    '" r="6.5" fill="#fff" stroke="#2EA6E0" stroke-width="1.4"/><text x="' +
    n[0] +
    '" y="' +
    (n[1] + 3) +
    '" text-anchor="middle" font-size="8.5" font-weight="700" fill="#1C7FB2">' +
    n[2] +
    "</text></g>";
  how.innerHTML =
    '<svg class="gb-how-d" viewBox="0 0 160 252" width="160" height="252" aria-hidden="true">' +
    '<defs><linearGradient id="gbHowSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FCBF2"/><stop offset=".7" stop-color="#D7F0FC"/><stop offset=".71" stop-color="#4FB9DE"/><stop offset="1" stop-color="#2E9CCB"/></linearGradient></defs>' +
    '<rect x="6" y="3" width="148" height="246" rx="16" fill="#F4F6F8" stroke="#C6CCD3" stroke-width="1.2"/>' +
    '<rect x="14" y="11" width="132" height="98" rx="8" fill="#E8ECF0"/><rect x="21" y="18" width="118" height="84" rx="2" fill="#15171A"/><rect x="24" y="21" width="112" height="78" fill="url(#gbHowSky)"/>' +
    '<rect x="12" y="115" width="136" height="7" rx="3.5" fill="#DCE1E6"/><path d="M31 115v7M129 115v7" stroke="#9AA1A9" stroke-width=".8"/><circle cx="138" cy="118.5" r="1.3" fill="#5BE04B"/>' +
    '<text x="15" y="134" font-size="6" font-weight="700" fill="#A0A6AC">Slop</text><text x="13" y="142" font-size="10" font-weight="800" font-style="italic" fill="#2290DE">Skies</text><rect x="100" y="127" width="46" height="15" rx="7.5" fill="#E2E6EA"/>' +
    '<g fill="#2E3033"><rect x="72" y="133" width="3" height="3" rx=".7"/><rect x="78" y="133" width="3" height="3" rx=".7"/><rect x="84" y="133" width="3" height="3" rx=".7"/><rect x="90" y="133" width="3" height="3" rx=".7"/></g><rect x="72" y="133" width="3" height="3" rx=".7" fill="#3DB6FF"/>' +
    '<circle cx="42" cy="175" r="23" fill="#EEF1F4" stroke="#C9CFD5"/><polygon points="34.6,157.2 49.4,157.2 59.8,167.6 59.8,182.4 49.4,192.8 34.6,192.8 24.2,182.4 24.2,167.6" fill="#B5BCC4"/><circle cx="42" cy="175" r="10.5" fill="#F8F9FA" stroke="#C9CFD5"/>' +
    '<rect x="96" y="160" width="54" height="28" rx="14" fill="#BFE3F6" transform="rotate(-24 123 174)"/><rect x="100.5" y="141.5" width="43" height="18" rx="9" fill="#E3E7EB" transform="rotate(-25.6 121.5 150.5)"/>' +
    '<circle cx="135" cy="168" r="10.5" fill="#BFE6F8" stroke="#79BDE0" stroke-width="1.2"/><circle cx="112" cy="179" r="9" fill="#FCFCFD" stroke="#C3C9CF" stroke-width="1.2"/>' +
    '<circle cx="133" cy="145" r="7" fill="#FCFCFD" stroke="#C3C9CF" stroke-width="1.2"/><circle cx="110" cy="156" r="7" fill="#FCFCFD" stroke="#C3C9CF" stroke-width="1.2"/>' +
    '<circle cx="60" cy="214" r="6" fill="#FCFCFD" stroke="#C3C9CF"/><circle cx="80" cy="216.5" r="6.5" fill="#FCFCFD" stroke="#7FC4E6"/><path d="M76.6 216.2l7-3-3 7-1-2.6z" fill="#2EA6E0"/><circle cx="100" cy="214" r="6" fill="#FCFCFD" stroke="#C3C9CF"/>' +
    '<g fill="#7C8389">' +
    [0, 1, 2, 3, 4, 5]
      .map((c) =>
        [0, 1]
          .map(
            (r) =>
              '<circle cx="' +
              (67.5 + c * 5) +
              '" cy="' +
              (233 + r * 5) +
              '" r="' +
              (c === 0 || c === 5 ? 0.8 : 1.2) +
              '"/>',
          )
          .join(""),
      )
      .join("") +
    "</g>" +
    [
      [42, 175, 1],
      [135, 168, 2],
      [112, 179, 3],
      [110, 156, 4],
      [133, 145, 5],
      [100, 214, 6],
      [60, 214, 7],
      [123, 134, 8],
      [80, 216.5, 9],
    ]
      .map(callout)
      .join("") +
    "</svg>" +
    '<ol class="gb-how-k">' +
    "<li><b>1</b><span>STICK</span><em>FLY · MENUS</em></li>" +
    "<li><b>2</b><span>A FIRE</span><em>HOLD · OK</em></li>" +
    "<li><b>3</b><span>B BOOST</span><em>HOLD · BACK</em></li>" +
    "<li><b>4</b><span>BRAKE</span><em>HOLD</em></li>" +
    "<li><b>5</b><span>TARGET</span><em>NEXT</em></li>" +
    "<li><b>6</b><span>+ PAUSE</span><em>START</em></li>" +
    "<li><b>7</b><span>− MENU</span><em>THIS SHEET</em></li>" +
    "<li><b>8</b><span>SPECIAL</span><em>TAP TO USE</em></li>" +
    "<li><b>9</b><span>TILT</span><em>TAP ON · HOLD OFF</em></li>" +
    '</ol><p class="gb-how-p">Stick: it pushes the nose. Up climbs, down dives, left and right turn the nose that way (the plane tilts into the turn); let go and it flies straight and level. Pause (+) switches Steering between Simple and Pro (a flight stick). A and B together: press the gap between them.</p>' +
    '<p class="gb-how-p">TILT: hold the phone face up like a paper plane. Twist it to turn, lift the top edge to climb, dip it to dive. The stick still works on top. Tap TILT or the stick to re-centre; hold TILT to turn it off. Turn on portrait lock first.</p>' +
    '<p class="gb-how-p">A ? box stores a special. Tap SPECIAL when ready. The Super Hornet calls four Blue Angel wingmen: they form up, then attack the nearest ad plane in view.</p>';
  // the card can be built after this script runs (pages.8845c1b17855fc43.js loads later and may rebuild its rooms), so the diagram attaches lazily: now,
  // whenever the page adds nodes until it is in place, and again each time the sheet or a tab opens
  function attachHow() {
    const c1b = $("#m-c1 .c1-b");
    if (c1b && how.parentNode !== c1b) c1b.appendChild(how);
    return !!c1b;
  }
  if (!attachHow() && window.MutationObserver) {
    const mo = new MutationObserver(() => {
      if (attachHow()) mo.disconnect();
    });
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  /* ---------- geometry: keys, their visible shapes (stadiums: a segment and a radius) and label placement ---------- */
  const px = (v) => Math.round(v) + "px";
  const stad = (x1, y1, x2, y2, r) => ({
    x1,
    y1,
    x2,
    y2,
    r,
  });
  function box(e, x, y, w, h) {
    e.style.left = px(x);
    e.style.top = px(y);
    e.style.width = px(w);
    e.style.height = px(h);
  }
  // a round key: diameter d, its skirt (px below) and the ring/well round it; hit radius never under 22 (44-px target)
  function round(id, cx, cy, d, depth, ring, e) {
    cx = Math.round(cx);
    cy = Math.round(cy);
    d = Math.round(d);
    e = e || EL[id];
    box(e, cx - d / 2, cy - d / 2, d, d);
    if (EL[id])
      G[id] = {
        cx,
        cy,
        r: Math.max(d / 2 + 6, 22),
      };
    SH[id] = [stad(cx, cy, cx, cy + depth, d / 2 + ring)];
    return {
      cx,
      cy,
      d,
    };
  }
  // landscape shoulder keys: 88x44 on the top edge, 4-px skirt
  function shoulder(id, cx) {
    cx = Math.round(cx);
    box(EL[id], cx - 44, 0, 88, 44);
    G[id] = {
      cx,
      cy: 22,
      r: 44,
      sh: true,
    };
    SH[id] = [stad(cx - 22, 22, cx + 22, 26, 22)];
  }
  function dRS(R, s) {
    let m = 1e9;
    for (let i = 0; i <= 40; i++) {
      const k = i / 40,
        x = s.x1 + (s.x2 - s.x1) * k,
        y = s.y1 + (s.y2 - s.y1) * k,
        dx = Math.max(R.l - x, 0, x - R.r),
        dy = Math.max(R.t - y, 0, y - R.b);
      m = Math.min(m, Math.hypot(dx, dy));
    }
    return m - s.r;
  }
  // a caption under its key ('down'), over it ('up') or to its left ('left'): the first whole-pixel position, moving away from the key,
  // where it is LG clear of every shape on the shell (each key with its skirt and hole, and both recesses), not only its own key's
  function label(cls, id, x, y, mode, maxR) {
    const e = gb.querySelector(".gb-l-" + cls),
      w = e.offsetWidth,
      h = e.offsetHeight,
      S = [];
    for (const k in SH) for (const q of SH[k]) if (S.indexOf(q) < 0) S.push(q);
    let l = mode === "left" ? Math.round(x - w) : Math.round(x - w / 2),
      t =
        mode === "left"
          ? Math.round(y - h / 2)
          : mode === "up"
            ? Math.round(y - h)
            : Math.round(y);
    if (maxR && l + w > maxR) l = Math.floor(maxR - w);
    for (let i = 0; i < 240; i++) {
      const R = {
        l,
        t,
        r: l + w,
        b: t + h,
      };
      if (S.every((q) => dRS(R, q) >= LG + 0.4)) break;
      if (mode === "left") l -= 1;
      else if (mode === "up") t -= 1;
      else t += 1;
    }
    e.style.left = l + "px";
    e.style.top = t + "px";
    return {
      l,
      t,
      r: l + w,
      b: t + h,
    };
  }
  // a recess round two keys (a stadium on their centre line): the frosted A/B jacket (WM clear of both keys and their skirts) and, in
  // portrait, the shallow well TGT and BRK share (WS clear). Each recess becomes a shape of both its keys, so captions keep clear of it
  const SKA = 2,
    SKB = 3,
    RA = 2;
  // A's and B's skirts (px); the hole round A
  let WS = 5;
  // the small keys' well margin (4 on short phones)
  function recess(el, p, q, r, oy) {
    const d = Math.hypot(p.cx - q.cx, p.cy - q.cy);
    el.style.width = d + 2 * r + "px";
    el.style.height = 2 * r + "px";
    el.style.left = (p.cx + q.cx) / 2 - (d + 2 * r) / 2 + "px";
    el.style.top = (p.cy + q.cy) / 2 + oy - r + "px";
    el.style.transform =
      "rotate(" + Math.atan2(p.cy - q.cy, p.cx - q.cx) + "rad)";
    return stad(q.cx, q.cy + oy, p.cx, p.cy + oy, r + 1);
  }
  function island(wm) {
    const r =
        Math.max(EL.a.offsetWidth / 2 + RA, EL.b.offsetWidth / 2 + 1) + wm,
      ws = recess(abw, G.a, G.b, r, 1.5);
    SH.a.push(ws);
    SH.b.push(ws);
    return r;
  }
  function well() {
    const ws = recess(
      tbw,
      G.tgt,
      G.brake,
      EL.tgt.offsetWidth / 2 + RING + WS,
      1,
    );
    SH.tgt.push(ws);
    SH.brake.push(ws);
  }
  // the − TILT + captions share one baseline (the centre key itself sits 3 px lower, as on the remote)
  function capRow(py) {
    const L = [
      label("sel", "select", G.select.cx, G.select.cy, "down"),
      label("tilt", "tilt", G.select.cx / 2 + G.start.cx / 2, py + 3, "down"),
      label("start", "start", G.start.cx, G.start.cy, "down"),
    ];
    const t = Math.max(...L.map((q) => q.t));
    for (const c of ["sel", "tilt", "start"])
      gb.querySelector(".gb-l-" + c).style.top = t + "px";
    return t + LAB1;
  }
  function ledsAt(cx, top, pitch) {
    leds.style.setProperty("--gb-lp", pitch + "px");
    const w = 3 * pitch + 7;
    leds.style.left = Math.round(cx - w / 2) + "px";
    leds.style.top = Math.round(top) + "px";
  }

  // portrait, relative to A's centre. The right thumb's four keys are one stepped group: the frosted A/B jacket on the Game Boy diagonal
  // and, GJ px above it and parallel, the shallow well TGT and BRK share (weapons column TGT over FIRE, speed column BRK over BOOST),
  // captioned above it. The stick is centred on that group's height. Under them, on the shell's axis: the − TILT + row, its captions and
  // the speaker (the remote's order: − HOME +, then the grille). The four lamps sit in the lockup row with the wordmark (handheld.8845c1b17855fc43.js
  // lockupRow), as the remote prints its lamps beside its logo.
  const LAB1 = 12,
    RING = 2;
  // caption height; the hole round the small keys
  let GJ = 9,
    SPKG = 9,
    FG = 14;
  // the gap between the recesses; − TILT + captions to the speaker; cluster to the − TILT + row (short: 7, 7, 10)
  const UX = 1.28 / Math.hypot(1.28, 0.58),
    UY = -0.58 / Math.hypot(1.28, 0.58);
  // the A/B axis (B to A), a unit vector
  function clusterP(w, s, a, m, k, rows) {
    const dA = a * 1.08,
      dB = a * 0.92,
      isl = Math.max(dA / 2 + RA, dB / 2 + 1) + WM,
      rw = m / 2 + RING + WS;
    const ax = w - Math.max(dA / 2 + 22, w * 0.12),
      bx = ax - 1.28 * a,
      by = 0.58 * a,
      sx = Math.max(s / 2 + 14, w * 0.25);
    // TGT/BRK sit at (ox, -to) from A/B, their centre line GJ + both radii from the jacket's. Straight up where the stick is close; where
    // there is room (narrower sticks) the pair steps up-left, square to the jacket, which saves height on short phones
    const D = isl + GJ + rw,
      ox = Math.min(-0.06 * a, Math.max(UY * D, sx + s / 2 + 1 + 12 + rw - bx)),
      to = (D - ox * UY) / UX;
    const rTop = -to - rw - LG - LAB1 - 1,
      rBot = by + 1.5 + isl + LG + LAB1 + 1;
    // TARGET's caption over the well; BOOST's under the jacket
    const sSpan = s + 1 + LG + LAB1,
      sTop = (rTop + rBot) / 2 - sSpan / 2;
    const gTop = Math.min(rTop, sTop),
      gBot = Math.max(rBot, sTop + sSpan),
      kr = k / 2 + RING,
      spkH = (rows - 1) * SPK_P + 6;
    return {
      ax,
      bx,
      by,
      ox,
      sx,
      sy: sTop + s / 2,
      dA,
      dB,
      kr,
      to,
      gTop,
      gBot,
      rTop,
      rBot,
      spkH,
      h: gBot - gTop + FG + 2 * kr + 3 + LG + LAB1 + SPKG + spkH,
    };
  }
  // visual sizes from the width (iPhone 15: stick 160, A 78 / B 67); every hit target stays >= 44 px whatever the visual size
  function sizesP(w, f, rows) {
    const s = clamp(w * 0.42 * f, 100, 176),
      a = clamp(w * 0.19 * f, 50, 82),
      m = clamp(a * 0.62, 40, 48),
      k = clamp(a * 0.47, 30, 36);
    return {
      s,
      a,
      m,
      k,
      P: clusterP(w, s, a, m, k, rows),
    };
  }
  function portrait(w) {
    // shrunk only when the height cannot hold the cluster (a 2-row speaker first)
    const fitH = () => ctl.getBoundingClientRect().height;
    let h = fitH(),
      f = 1,
      rows = 3,
      s,
      a,
      m,
      k,
      P;
    const size = () => {
      ({ s, a, m, k, P } = sizesP(w, f, rows));
    };
    size();
    // tall phones: a little air above the screen window; the rest of the slack goes round the cluster
    const tall = h - 14 - P.h > 110;
    if (tall) {
      gb.style.setProperty("--gb-bx", "6px");
      gb.classList.add("gb-tall");
      h = fitH();
    }
    if (P.h > h - 14) {
      rows = 2;
      size();
    }
    for (let i = 0; i < 8 && P.h > h - 14 && f > 0.6; i++) {
      f *= Math.max(0.9, (h - 14) / P.h);
      size();
    }
    const slack = Math.max(0, h - 14 - P.h),
      M = Math.min(34, slack * 0.3),
      T = 8 + (slack - M) * 0.5,
      y0 = T - P.gTop;
    // 8 px kept clear under the lockup row, 6 at the foot; y0: A's centre in ctl px
    const ay = y0,
      by = y0 + P.by;
    round("a", P.ax, ay, P.dA, SKA, RA);
    round("b", P.bx, by, P.dB, SKB, 1);
    round("tgt", P.ax + P.ox, ay - P.to, m, 2, RING);
    round("brake", P.bx + P.ox, by - P.to, m, 2, RING);
    round("stick", P.sx, y0 + P.sy, s, 0, 1);
    for (const id of ["a", "b"])
      EL[id].style.fontSize = Math.round(EL[id].offsetWidth * 0.38) + "px";
    // the − TILT + row (the remote's − HOME + arc: the centre key sits a little lower)
    const py = y0 + P.gBot + FG + M + P.kr,
      sp = clamp(w * 0.19, Math.max(58, k * 1.75), 84);
    // the row spans half the shell
    round("select", w / 2 - sp, py, k, 2, RING);
    round("start", w / 2 + sp, py, k, 2, RING);
    round("tilt", w / 2, py + 3, k + 2, 2, RING, tiltBtn);
    island(WM);
    well();
    label("stick", "stick", G.stick.cx, G.stick.cy, "down");
    label("a", "a", G.a.cx + 0.1 * a, G.a.cy, "down", w - 4);
    label("b", "b", G.b.cx, G.b.cy, "down");
    label("tgt", "tgt", G.tgt.cx, G.tgt.cy, "up", w - 4);
    label("brk", "brake", G.brake.cx - 0.12 * a, G.brake.cy, "up");
    // BRAKE leans off the well's rising edge
    const capB = capRow(py);
    if (spk.dataset.rows !== String(rows)) {
      spk.dataset.rows = rows;
      spk.innerHTML = grille(SPK_D, rows, SPK_P, "gb-spk-g");
    }
    const sw = +spk.firstElementChild.getAttribute("width");
    spk.style.right = spk.style.bottom = "";
    spk.style.left = Math.round(w / 2 - sw / 2) + "px";
    spk.style.top = Math.round(capB + SPKG - 3.3) + "px";
    lockupRow(w);
  }
  // portrait lockup row: the wordmark left, SPECIAL right, and the four lamps between them on the shell's axis (or centred in the gap)
  function lockupRow(w) {
    const c = ctl.getBoundingClientRect(),
      L = logo.getBoundingClientRect(),
      br = gb.querySelector(".gb-brand").getBoundingClientRect(),
      sr = special.getBoundingClientRect();
    const a = br.right - c.left + 14,
      b = sr.left - c.left - 14;
    let pitch = 24,
      lw = 3 * pitch + 7;
    if (b - a < lw) {
      pitch = Math.max(14, Math.floor((b - a - 7) / 3));
      lw = 3 * pitch + 7;
    }
    const cx = clamp(w / 2, a + lw / 2, Math.max(a + lw / 2, b - lw / 2));
    ledsAt(cx, (L.top + L.bottom) / 2 - c.top - 7, pitch);
  }
  /* ---------- round 4, the tall screen (client 10 Oct: "make the screen taller on mobile") ----------
     The picture takes the height the deck can spare. The deck is recomposed in two columns, as the Game Boy Advance lays out its face:
     the stick with the − TILT + row under it on the left (where the GBA keeps START / SELECT), the right thumb's stepped group (TGT/BRK
     well over the A/B jacket) on the right, and the graded speaker, two rows, under FIRE (the GBA's speaker sits under its A/B). The
     lockup row (wordmark, lamps, SPECIAL) and the hinge stay as they were, the hinge a little slimmer. Every key keeps its hole, gloss,
     caption and 44-px target.
     Modes ('tall' is the default; ?screen=1:1 or ?screen=4:3, also in the hash, or GB.setScreen(mode) picks another for the client):
       tall  the tallest picture (at most 3:4) that leaves the deck at its comfortable size: the stick 37.8 % of the shell's width and
             the A dome 19 % (144 and 72 px on an iPhone 15); the picture is kept at 4:3 or taller while the controls can shrink to 80 %
       1:1   a square picture, the deck at the earlier shell's sizes (stick 160 / A 80 on an iPhone 15), shrunk only if the height needs it
       4:3   the earlier shell exactly (portrait(): 4:3 picture, the − TILT + row and the speaker on the shell's axis) */
  const SCREENS = {
    tall: "tall",
    "1:1": "1:1",
    11: "1:1",
    square: "1:1",
    "4:3": "4:3",
    43: "4:3",
  };
  let screenMode =
      SCREENS[
        ((location.search + "&" + location.hash).match(
          /screen=(tall|1:1|11|square|4:3|43)/,
        ) || [])[1]
      ] || "tall",
    CF = 1;
  const CHH = 9 + 11,
    CTLY = 14;
  // the compact hinge (margin + height, handheld.8845c1b17855fc43.css .gb-compact); 8 px clear under the lockup row + 6 at the foot
  function sizesC(w, f) {
    const s = clamp(w * 0.378 * f, 112, 176),
      a = clamp(w * 0.176 * f, 52, 82),
      m = clamp(a * 0.62, 40, 48),
      k = clamp(a * 0.47, 30, 36);
    return {
      s,
      a,
      m,
      k,
      P: clusterC(w, s, a, m, k),
    };
  }
  // the compact cluster, relative to A's centre: the right group from clusterP, the stick column beside it (the stick, its caption, the
  // − TILT + row and its captions), both columns centred on each other; h is the union's height
  function clusterC(w, s, a, m, k) {
    const P = clusterP(w, s, a, m, k, 2),
      kr = k / 2 + RING,
      rH = P.rBot - P.rTop;
    const lH = s + 1 + LG + LAB1 + FG + 2 * kr + 3 + LG + LAB1,
      H = Math.max(lH, rH),
      top = P.rTop - (H - rH) / 2,
      sTop = top + (H - lH) / 2;
    const sp = Math.max(k + 2 * RING + 12, 46);
    // − to TILT to +, centre to centre: the captions (PAUSE is the widest) keep 8 px apart
    return Object.assign(P, {
      kr,
      sp,
      sy: sTop + s / 2,
      py: sTop + s + 1 + LG + LAB1 + FG + kr,
      gTop: top,
      gBot: top + H,
      h: H,
    });
  }
  // the picture's height for the shell's inner box (iw x ih) and the lockup row's height lk; sets CF (the controls' scale)
  function compactFit(iw, ih, lk) {
    const lw = Math.max(200, Math.floor((iw - 16) / 2) * 2),
      free = ih - 12 - CHH - 4 - lk - CTLY;
    // less the bezel (6 + 6), the hinge, the lockup row with its margin and the cluster's clearances
    const pic = (f) => Math.floor(free - sizesC(iw, f).P.h);
    // the picture's height the controls leave at scale f
    let f = screenMode === "1:1" ? 1.11 : 1,
      lh,
      w = lw;
    if (screenMode === "1:1") {
      while (f > 0.8 && pic(f) < lw) f -= 0.01;
      lh = Math.min(lw, pic(f));
    } else {
      while (f > 0.8 && pic(f) < (lw * 3) / 4) f -= 0.01;
      lh = Math.min(pic(f), Math.round((lw * 4) / 3));
    }
    lh = Math.max(150, lh);
    if (lh < (lw * 3) / 4) w = Math.max(200, Math.floor((lh * 4) / 3 / 2) * 2);
    // a squat window (a short tablet split): never wider than 4:3, as before
    CF = f;
    return {
      lw: w,
      lh,
    };
  }
  function portraitC(w) {
    const h = ctl.getBoundingClientRect().height;
    let s, a, m, k, P;
    const size = () => {
      ({ s, a, m, k, P } = sizesC(w, CF));
    };
    size();
    for (let i = 0; i < 8 && P.h > h - CTLY && CF > 0.6; i++) {
      CF *= Math.max(0.9, (h - CTLY) / P.h);
      size();
    }
    // rounding left it a pixel short
    const slack = Math.max(0, h - CTLY - P.h),
      y0 = 8 + slack * 0.5 - P.gTop;
    // A's centre in ctl px; any slack (a picture capped at 3:4) splits round the cluster
    const ay = y0,
      by = y0 + P.by;
    round("a", P.ax, ay, P.dA, SKA, RA);
    round("b", P.bx, by, P.dB, SKB, 1);
    round("tgt", P.ax + P.ox, ay - P.to, m, 2, RING);
    round("brake", P.bx + P.ox, by - P.to, m, 2, RING);
    round("stick", P.sx, y0 + P.sy, s, 0, 1);
    for (const id of ["a", "b"])
      EL[id].style.fontSize = Math.round(EL[id].offsetWidth * 0.38) + "px";
    // the − TILT + row under the stick, on its axis (TILT 3 px lower, the remote's arc)
    const py = y0 + P.py;
    round("select", P.sx - P.sp, py, k, 2, RING);
    round("start", P.sx + P.sp, py, k, 2, RING);
    round("tilt", P.sx, py + 3, k + 2, 2, RING, tiltBtn);
    island(WM);
    well();
    label("stick", "stick", G.stick.cx, G.stick.cy, "down");
    const fire = label("a", "a", G.a.cx + 0.1 * a, G.a.cy, "down", w - 4);
    const boost = label("b", "b", G.b.cx, G.b.cy, "down");
    label("tgt", "tgt", G.tgt.cx, G.tgt.cy, "up", w - 4);
    label("brk", "brake", G.brake.cx - 0.12 * a, G.brake.cy, "up");
    capRow(py);
    // the speaker: 6 x 2 under FIRE, centred on its caption and kept inside the shell; left out where the deck has no room for it
    if (spk.dataset.rows !== "2") {
      spk.dataset.rows = "2";
      spk.innerHTML = grille(SPK_D, 2, SPK_P, "gb-spk-g");
    }
    const sw = +spk.firstElementChild.getAttribute("width"),
      sh = +spk.firstElementChild.getAttribute("height");
    const sl = Math.round(
        clamp((fire.l + fire.r) / 2 - sw / 2, boost.r + 8, w - 4 - sw),
      ),
      st = Math.round(fire.b + SPKG - 3.3);
    spk.style.right = spk.style.bottom = "";
    spk.style.left = sl + "px";
    spk.style.top = st + "px";
    spk.style.display = st + sh <= h - 4 && sl + sw <= w - 4 ? "" : "none";
    lockupRow(w);
  }
  function landscape(w, h, lw, lh, bt, room) {
    // GBA-style: the screen centred, the wings each side. Left wing: BRAKE shoulder, a lid speaker, the stick, the − TILT + row. Right
    // wing: TGT shoulder, a lid speaker, the A/B island. The printed lockup, the lamps and SPECIAL sit under the screen, as the GBA prints
    // its name under its screen; with no room there (a short frame) SPECIAL drops to the foot of the right wing
    const wing = (w - lw - 20) / 2,
      rx = w - wing,
      top = 44 + 4 + 10;
    shoulder("brake", wing / 2);
    shoulder("tgt", rx + wing / 2);
    // a 3 x 2 lid speaker at the top of each wing, beside the screen window
    const dsy = Math.round(bt + 4);
    dsL.style.left = px(wing - 38);
    dsL.style.top = px(Math.max(top - 6, dsy));
    dsR.style.left = px(rx + 8);
    dsR.style.top = px(Math.max(top - 6, dsy));
    const top2 = Math.max(top, dsy + 30) + 4;
    // the controls start under the speakers
    // every control, its ring and its caption keeps EDGE px from the wing's outer edge and from the bezel's outer ring. The − TILT + row
    // is anchored on its outer captions (PAUSE is the widest) so both ends keep that margin
    const EDGE = 8,
      cw = (c) => gb.querySelector(".gb-l-" + c).offsetWidth / 2;
    const k = clamp(wing * 0.2, 28, 34),
      eL = Math.max(k / 2 + RING, cw("sel")),
      eR = Math.max(k / 2 + RING, cw("start"));
    const sp = Math.min(52, (wing - 2 * EDGE - eL - eR) / 2),
      rcx = EDGE + eL + sp + Math.max(0, (wing - 2 * EDGE - eL - eR) / 2 - sp);
    const row = () => 2 * (k / 2 + RING) + 3 + LG + LAB1;
    let s = clamp(
      Math.min(wing * 0.8, wing - 2 * EDGE - 2, (h - top2) * 0.5),
      84,
      150,
    );
    const gl = () => s + 1 + LG + LAB1 + 12 + row();
    if (gl() > h - 4 - top2) s = Math.max(84, s - (gl() - (h - 4 - top2)));
    const y0 = top2 + Math.max(0, (h - 4 - top2 - gl()) / 2),
      sx = wing / 2;
    round("stick", sx, y0 + s / 2, s, 0, 1);
    const py = y0 + s + 1 + LG + LAB1 + 12 + k / 2 + RING;
    round("select", rcx - sp, py, k, 2, RING);
    round("start", rcx + sp, py, k, 2, RING);
    round("tilt", rcx, py + 3, k + 2, 2, RING, tiltBtn);
    // right wing: A/B in their jacket on a steeper diagonal than portrait (the wing is narrow and tall), the jacket EDGE px inside the wing
    const DX = 0.6,
      DY = 1.12,
      WML = 6,
      isl0 = (A) => (1.08 * A) / 2 + RA + WML;
    // centres 1.27 a apart: the same gap between the keys as portrait gives
    let a = clamp(Math.min(wing * 0.46, h * 0.2), 46, 72);
    if (DX * a + 2 * isl0(a) > wing - 2 * EDGE - 2)
      a = Math.max(44, (wing - 2 * EDGE - 2 - 2 * (RA + WML)) / (DX + 1.08));
    // 1 px each side for rounding
    const foot = room ? h - 6 : h - 58,
      dA = a * 1.08,
      dB = a * 0.92,
      isl = isl0(a),
      ga = DY * a + isl * 2 + LG + LAB1;
    const ay = top2 + Math.max(0, (foot - top2 - ga) / 2) + isl,
      ax = rx + wing / 2 + (DX * a) / 2;
    round("a", ax, ay, dA, SKA, RA);
    round("b", ax - DX * a, ay + DY * a, dB, SKB, 1);
    island(WML);
    for (const id of ["a", "b"])
      EL[id].style.fontSize = Math.round(EL[id].offsetWidth * 0.38) + "px";
    label("stick", "stick", G.stick.cx, G.stick.cy, "down");
    label("a", "a", G.a.cx + 0.1 * a, G.a.cy, "down", w - 4);
    label("b", "b", G.b.cx, G.b.cy, "down");
    capRow(py);
    // under the screen: lockup left, lamps centred, SPECIAL right (ctl and the body share their origin offset: measure it)
    const b0 = gb.querySelector(".gb-body").getBoundingClientRect(),
      c0 = ctl.getBoundingClientRect(),
      ox = c0.left - b0.left,
      oy = c0.top - b0.top;
    gb.classList.toggle("gb-lowroom", !room);
    const ly = bt + lh + 12 + 8;
    if (room) {
      logo.style.left = px(ox + wing + 6);
      logo.style.top = px(oy + ly);
      logo.style.width = px(lw + 8);
      ledsAt(w / 2, ly + 14, 26);
    } else {
      logo.style.left = px(ox + rx + wing / 2 - 54);
      logo.style.top = px(oy + h - 50);
      logo.style.width = "108px";
      ledsAt(-999, -999, 26);
    }
  }
  function layout() {
    if (!DVH) gb.style.height = innerHeight + "px";
    const F = gb.getBoundingClientRect(),
      W = Math.round(F.width) || innerWidth,
      H = Math.round(F.height) || innerHeight;
    // the frame (an iframe's own viewport inside claude.ai), not the screen
    land = W > H;
    gb.classList.toggle("gb-land", land);
    gb.classList.toggle("gb-port", !land);
    H0 = H;
    const comp = !land && screenMode !== "4:3";
    gb.classList.toggle("gb-compact", comp);
    const bd = gb.querySelector(".gb-body"),
      cs = getComputedStyle(bd),
      iw = W - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      ih =
        (Math.round(bd.getBoundingClientRect().height) || H) -
        parseFloat(cs.paddingTop) -
        parseFloat(cs.paddingBottom);
    const short = !land && ih < 700;
    // short phones: a 12-px hinge, a lower lockup row and tighter gaps round the − TILT + row
    SPKG = short ? 7 : 9;
    FG = short ? 10 : 14;
    GJ = short ? 7 : 9;
    WS = short ? 4 : 5;
    gb.classList.toggle("gb-short", short);
    gb.classList.remove("gb-tall");
    gb.style.setProperty("--gb-bx", "0px");
    // the wordmark grows with the shell (portrait: 11.6 % of the width, 10 % on short phones; 30 px sideways); the lockup row holds it
    // with FOG CITY ACES under it
    const mh = land
        ? 30
        : comp
          ? Math.round(clamp(iw * 0.095, 30, 42))
          : Math.round(clamp(iw * (short ? 0.1 : 0.116), 34, 50)),
      lk = short || comp ? Math.max(mh + 12, 46) : mh + 15;
    // never under SPECIAL's 44 px; the tall screen's deck prints it a little smaller
    gb.style.setProperty("--gb-mh", mh + "px");
    gb.style.setProperty("--gb-lk", lk + "px");
    let lw,
      lh,
      bt = 0,
      room = false;
    // portrait: a 4:3 picture as wide as the window allows (a 6-px black mask and the 2-px step each side, plus 2 px of air); sideways:
    // 16:9 between two wings of at least 132 px, with a 44-px row under it for the printed lockup when the height allows, centred
    if (comp) ({ lw, lh } = compactFit(iw, ih, lk));
    // round 4: the tall screen
    else if (!land) {
      const need =
        (short ? 12 : 16) +
        8 +
        4 +
        lk +
        12 +
        sizesP(iw, short ? 0.84 : 0.86, short ? 2 : 3).P.h;
      // hinge, lockup, margins and the cluster at 86 % (80 % with a 2-row speaker on short phones): the screen keeps its size first
      lw = Math.min(iw - 16, ((ih - 16 - need) * 4) / 3, 640);
      lw = Math.max(200, Math.floor(lw / 4) * 4);
      lh = (lw * 3) / 4;
    } else {
      const maxW = iw - 2 * 132 - 20;
      room = ih >= 300;
      const under = room ? 52 : 0;
      // the lockup row: 8 px gap + 44 px
      lw = Math.min(maxW, ((ih - 16 - under) * 16) / 9);
      lw = Math.floor(lw / 16) * 16;
      lh = (lw * 9) / 16;
      bt = Math.max(2, Math.floor((ih - (lh + 12) - under) / 2));
    }
    gb.style.setProperty("--lw", lw + "px");
    gb.style.setProperty("--lh", lh + "px");
    gb.style.setProperty("--gb-bt", bt + "px");
    setAspect(land ? "16:9" : comp ? lw + ":" + lh : "4:3");
    // the tall screen asks for its window's own ratio
    if (!land) logo.style.left = logo.style.top = logo.style.width = "";
    if (!comp) spk.style.display = "";
    G = {};
    SH = {};
    const R = ctl.getBoundingClientRect(),
      bz = gb.querySelector(".gb-bezel").getBoundingClientRect();
    if (comp) portraitC(R.width);
    else if (!land) portrait(R.width);
    else landscape(R.width, R.height, lw, lh, bt, room);
    // the sheet starts under the screen window; with the tall screen it may lap over the picture's foot so it always keeps half the frame
    // (iPhone 15: 426 px, as roomy as beside the 4:3 window; the game is paused while the sheet is open)
    const bez =
        gb.querySelector(".gb-bezel").getBoundingClientRect().bottom + 4,
      full = /^(result|select)$/.test(DR.state);
    // layout audit L-19: on the Flight Record and Select the sheet starts under the screen, never over it
    body.style.setProperty(
      "--gb-st",
      (land ? 0 : Math.round(full ? bez : Math.min(bez, H * 0.5))) + "px",
    );
    gb.style.setProperty(
      "--gb-deck",
      (land
        ? 0
        : Math.round(
            gb.querySelector(".gb-hinge").getBoundingClientRect().bottom -
              gb.getBoundingClientRect().top,
          )) + "px",
    );
    // where the deck's gloss starts
  }
  function setAspect(a) {
    if (a === aspect) return;
    aspect = a;
    DR.cmd("aspect", a);
  }

  /* ---------- re-layout: frame resize, rotation, the URL bar and the keyboard (visualViewport) ---------- */
  function typing() {
    const a = document.activeElement;
    return !!(
      a &&
      /^(INPUT|TEXTAREA)$/.test(a.tagName) &&
      a.closest &&
      a.closest("#field")
    );
  }
  function vv() {
    const v = window.visualViewport;
    return v
      ? {
          t: v.offsetTop,
          h: v.height,
        }
      : {
          t: 0,
          h: innerHeight,
        };
  }
  // keyboard up while typing in the sheet: the shell keeps its last size (no squashed screen), the sheet fills the visible part above
  // the keyboard and the field is scrolled into it
  function kbSync() {
    const v = vv(),
      want = on && sheet && typing() && H0 > 0 && v.h < H0 - 100;
    if (want !== kb) {
      kb = want;
      body.classList.toggle("gb-kb", kb);
      gb.style.height = kb ? H0 + "px" : DVH ? "" : innerHeight + "px";
    }
    if (kb) {
      body.style.setProperty("--gb-kt", Math.round(v.t) + "px");
      body.style.setProperty("--gb-kh", Math.round(v.h) + "px");
      fieldInView();
    }
    return kb;
  }
  function fieldInView() {
    const a = document.activeElement,
      f = $("#field");
    if (!a || !f || !typing()) return;
    const r = a.getBoundingClientRect(),
      fr = f.getBoundingClientRect();
    if (r.top < fr.top + 8 || r.bottom > fr.bottom - 8)
      f.scrollTop +=
        r.top - fr.top - Math.max(8, Math.min(48, (fr.height - r.height) / 3));
  }
  let raf = 0;
  function relayout() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!on) return;
      if (kbSync()) return;
      layout();
      tick(true);
    });
  }
  addEventListener("resize", relayout);
  addEventListener("orientationchange", () => {
    relayout();
    setTimeout(relayout, 400);
    setTimeout(() => tiltRecentre("turn"), 450);
  });
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", relayout);
    visualViewport.addEventListener("scroll", () => {
      if (kb) kbSync();
    });
  }
  document.addEventListener("focusin", () => setTimeout(relayout, 50));
  document.addEventListener("focusout", () => setTimeout(relayout, 50));
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(relayout);

  /* ---------- on / off (called by site.8845c1b17855fc43.js fitCompact / leaveCompact) ---------- */
  // the browser's own bars take the shell's face colour while it shows (the page's sky theme colour comes back when it goes; phones start on
  // the face colour already, index.html's first theme-color, r10)
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')],
    metaWas = metas.map((m) => m.content);
  function themeColor(shell) {
    metas.forEach((m, i) => {
      m.content = shell ? FACE : metaWas[i];
    });
  }
  // CP24 verify: the Top 10 name entry (#dock, leaderboard-ui.8845c1b17855fc43.js) lives in the screen while the handheld shows, over the picture, so the end
  // of a run never opens the site's menu sheet; it goes back to the compact page flow when the handheld goes
  const dockIn = () => {
    const d = $("#dock");
    return !!(d && d.parentNode === lcd);
  };
  function fit(want) {
    {
      const d = $("#dock");
      if (want && d && d.parentNode !== lcd) lcd.appendChild(d);
      else if (!want && d && d.parentNode === lcd) {
        const f = $("#flow");
        if (f) f.appendChild(d);
      }
    }
    if (!want) {
      if (!on) return;
      on = false;
      gb.hidden = true;
      head.hidden = true;
      body.classList.remove("gb", "gb-sheet", "gb-kb");
      root.classList.remove("gb-doc");
      sheet = false;
      kb = false;
      gb.style.height = "";
      release();
      tiltOff();
      themeColor(false);
      const scr = $("#dr-screen");
      if (home && scr.parentNode !== home)
        home.insertBefore(
          scr,
          homeNext && homeNext.parentNode === home ? homeNext : null,
        );
      aspect = "";
      DR.cmd("aspect", "16:9");
      DR.cmd("touch", "auto");
      DR.cmd("radiobtn", true);
      DR.cmd("hud", "site");
      return;
    }
    if (!on) {
      on = true;
      gb.hidden = false;
      body.classList.add("gb");
      root.classList.add("gb-doc");
      themeColor(true);
      const scr = $("#dr-screen");
      if (scr.parentNode !== lcd) {
        home = scr.parentNode;
        homeNext = scr.nextSibling;
        lcd.appendChild(scr);
      }
      DR.cmd("touch", false);
      DR.cmd("radiobtn", false);
      syncSheet();
    }
    // no RADIO switch in the picture; Flight Control's VOICE switch is in the sheet
    if (DR.hud !== "lite") DR.cmd("hud", "lite");
    // Flight Control's captions go into the picture; the round and clock sit in the screen's corner (.gb-osd)
    if (kbSync()) return;
    layout();
    tick(true);
  }

  /* ---------- the sheet: the compact site, opened by SELECT; closed for flight ---------- */
  const TABN = {
    aircraft: "HANGAR",
    map: "TARGETS",
    how: "HOW TO FLY",
    record: "RECORDS",
    menu: "ABOUT",
  };
  // the sheet's header names the tab's page (style audit S12, layout L-23)
  function syncSheet() {
    body.classList.toggle("gb-sheet", on && sheet);
    head.hidden = !(on && sheet);
  }
  function openSheet(tab) {
    if (!on) return;
    if (flying()) DR.cmd("pause");
    sheet = true;
    syncSheet();
    release();
    swallowT = 0;
    attachHow();
    if (tab) {
      const b = $('#ph-bar [data-tab="' + tab + '"]');
      if (b) b.click();
    }
    swallowT = performance.now() + 450;
    dispatchEvent(new Event("resize"));
    headTitle();
  }
  function closeSheet() {
    if (!sheet) return;
    if (typing()) document.activeElement.blur();
    sheet = false;
    syncSheet();
    kbSync();
    swallowT = performance.now() + 450;
  }
  function headTitle() {
    head.querySelector(".gb-head-t").textContent =
      TABN[body.dataset.tab] || "SITE MENU";
  }
  head.querySelector(".gb-close").addEventListener("click", () => {
    closeSheet();
    buzz();
  });
  $("#ph-bar") &&
    $("#ph-bar").addEventListener("click", () =>
      setTimeout(() => {
        attachHow();
        headTitle();
      }, 0),
    );
  addEventListener(
    "click",
    (e) => {
      if (
        performance.now() < swallowT &&
        !(e.target.closest && e.target.closest("#gb-head"))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    {
      capture: true,
    },
  );

  // SPECIAL has its own pointer; tapping it never releases the stick or held A/B.
  function useSpecial() {
    const item = (DR.telemetry || {}).item;
    if (
      !on ||
      sheet ||
      !/^(play|brief)$/.test(DR.state) ||
      !item ||
      !item.ready
    )
      return;
    buzz();
    DR.cmd("special");
    tick(true);
  }
  special.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    useSpecial();
  });
  special.addEventListener("click", (e) => {
    e.preventDefault();
    if (e.detail === 0) useSpecial();
  });

  /* ---------- input: every pointer by id ---------- */
  const P = new Map(),
    held = {
      a: false,
      b: false,
      tgt: false,
      brake: false,
      select: false,
      start: false,
    };
  const stick = {
    id: null,
    x: 0,
    y: 0,
    t0: 0,
    max: 0,
  };
  function hit(x, y) {
    const r = ctl.getBoundingClientRect();
    x -= r.left;
    y -= r.top;
    if (G.a && G.b) {
      const mx = (G.a.cx + G.b.cx) / 2,
        my = (G.a.cy + G.b.cy) / 2,
        d = Math.hypot(G.a.cx - G.b.cx, G.a.cy - G.b.cy);
      if (Math.hypot(x - mx, y - my) < d * 0.2) return "ab";
    }
    // the gap: both
    let best = null,
      bd = 1e9;
    for (const k in G) {
      const g = G[k];
      let d;
      if (g.sh) d = Math.abs(x - g.cx) <= 44 && y >= 0 && y <= 48 ? 0 : 1e9;
      else {
        d = Math.hypot(x - g.cx, y - g.cy);
        if (d > g.r) d = 1e9;
      }
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    return best;
  }
  // the cap travels until its edge is 2.5 housing units short of the printed dashes (it never covers them); its dark gap travels with it
  function moveStick(e) {
    const g = G.stick;
    if (!g) return;
    const r = ctl.getBoundingClientRect(),
      R = g.r * 0.72,
      T = (EL.stick.offsetWidth * (DASH_IN - CAP * 50 - 2.5)) / 100;
    let dx = (e.clientX - r.left - g.cx) / R,
      dy = (e.clientY - r.top - g.cy) / R;
    const m = Math.hypot(dx, dy);
    stick.max = Math.max(stick.max, m);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    if (m < 0.08) {
      dx = dy = 0;
    }
    stick.x = dx;
    stick.y = dy;
    nub.style.transform =
      "translate(" + (dx * T).toFixed(1) + "px," + (dy * T).toFixed(1) + "px)";
  }
  function buzz() {
    try {
      if (navigator.vibrate) navigator.vibrate(8);
    } catch (e) {}
  }
  // Android only; iPhones get no haptics from the web, so nothing depends on it
  function recompute() {
    const was = Object.assign({}, held);
    for (const k in held) held[k] = false;
    for (const c of P.values()) {
      if (c === "ab") {
        held.a = held.b = true;
      } else if (c && c !== "stick") held[c] = true;
    }
    for (const k in held) {
      EL[k].classList.toggle("on", held[k]);
      if (held[k] && !was[k]) press(k);
    }
    pushPad();
  }
  // layout audit L-11: on the tall deck the − TILT + row sits just under the stick; in flight a thumb that slips off the stick must not open
  // the menu sheet, pause or switch TILT on, so those presses within 400 ms of the stick's release are ignored
  const slipped = () =>
    flying() && stick.upT && performance.now() - stick.upT < 400;
  function press(k) {
    if ((k === "select" || k === "start") && slipped()) return;
    buzz();
    if (DR.state === "boot") return;
    // the Top 10 entry in the screen: A or START saves, B deletes a letter (skips when empty), SELECT skips; any key closes the saved card;
    // the "not in the Top 10" card closes on B or SELECT and leaves START to the game's final menu (Play Again), as Enter does on a desktop
    const lb = window.LBUI && LBUI.mode && dockIn() ? LBUI.mode : "";
    if (lb === "form") {
      if (k === "start" || k === "a") LBUI.save();
      else if (k === "b") LBUI.del();
      else if (k === "select") LBUI.skip();
      return;
    }
    if (lb === "done") {
      if (/^(start|a|b|select)$/.test(k)) LBUI.skip();
      return;
    }
    if (lb === "miss" && (k === "b" || k === "select")) {
      LBUI.skip();
      return;
    }
    if (k === "select") {
      sheet ? closeSheet() : openSheet();
      return;
    }
    if (k === "start") {
      DR.cmd("nav", "start");
      return;
    }
    if (k === "a" && DR.state === "brief" && TL.st === "on") tiltRecentre("a");
    // the card's "hold like a paper plane, press A"
    if (flying()) {
      if (k === "tgt") DR.cmd("nav", "tgt");
      return;
    }
    if (k === "a" || k === "b") DR.cmd("nav", k);
  }
  let lastPad = "";
  const r3 = (v) => Math.round(v * 1000) / 1000;
  function pushPad() {
    const f = flying(),
      p = f
        ? {
            sx: r3(clamp(stick.x + TL.x, -1, 1)),
            sy: r3(clamp(stick.y + TL.y, -1, 1)),
            fire: held.a,
            boost: held.b,
            brake: held.brake,
          }
        : null,
      k = JSON.stringify(p);
    if (k !== lastPad) {
      lastPad = k;
      DR.cmd("pad", p);
    }
  }
  function release() {
    P.clear();
    stick.id = null;
    stick.x = stick.y = 0;
    nub.style.transform = "";
    EL.stick.classList.remove("on");
    for (const k in held) {
      held[k] = false;
      EL[k].classList.remove("on");
    }
    TL.x = TL.y = TL.fp = TL.fr = TL.bank = TL.climb = 0;
    lastPad = "";
    if (DR.state !== "boot") {
      DR.cmd("pad", null);
      if (TL.sentTilt) {
        TL.sentTilt = false;
        DR.cmd("tilt", null);
      }
    }
  }
  gb.addEventListener("pointerdown", (e) => {
    if (!on || (!ctl.contains(e.target) && e.target !== ctl) || isTilt(e))
      return;
    const c = hit(e.clientX, e.clientY);
    e.preventDefault();
    try {
      gb.setPointerCapture(e.pointerId);
    } catch (_) {}
    if (c === "stick" && stick.id === null) {
      stick.id = e.pointerId;
      stick.t0 = performance.now();
      stick.max = 0;
      P.set(e.pointerId, "stick");
      EL.stick.classList.add("on");
      moveStick(e);
      buzz();
      recompute();
      navStick();
      return;
    }
    P.set(e.pointerId, c === "stick" ? null : c);
    recompute();
  });
  gb.addEventListener("pointermove", (e) => {
    if (!P.has(e.pointerId)) return;
    if (e.pointerId === stick.id) {
      moveStick(e);
      pushPad();
      navStick();
      return;
    }
    const c = hit(e.clientX, e.clientY),
      was = P.get(e.pointerId);
    if (
      c !== was &&
      c !== "stick" &&
      !(
        c === null &&
        was &&
        (was === "ab" ||
          (G[was] &&
            Math.hypot(
              e.clientX - ctl.getBoundingClientRect().left - G[was].cx,
              e.clientY - ctl.getBoundingClientRect().top - G[was].cy,
            ) <
              G[was].r + 14))
      )
    ) {
      P.set(e.pointerId, c);
      recompute();
    }
    // a thumb slides onto the next button; a small wobble off the edge keeps the one it is on
  });
  const up = (e) => {
    if (!P.has(e.pointerId)) return;
    if (e.pointerId === stick.id) {
      const tap =
        e.type === "pointerup" &&
        performance.now() - stick.t0 < 250 &&
        stick.max < 0.08;
      stick.id = null;
      stick.x = stick.y = 0;
      stick.upT = performance.now();
      nub.style.transform = "";
      EL.stick.classList.remove("on");
      navDir = "";
      if (tap && TL.st === "on" && flying()) tiltRecentre("tap");
    }
    // a tap on the stick cap without moving it re-centres TILT
    P.delete(e.pointerId);
    recompute();
  };
  gb.addEventListener("pointerup", up);
  gb.addEventListener("pointercancel", up);
  gb.addEventListener("lostpointercapture", up);
  gb.addEventListener("contextmenu", (e) => e.preventDefault());
  addEventListener("blur", () => {
    if (on) release();
  });

  // the stick in menus: a direction past half travel is a cursor step, repeating while held (the engine plays the cursor sound)
  let navDir = "",
    navT = 0;
  function navStick() {
    if (flying() || stick.id === null) {
      navDir = "";
      return;
    }
    const x = stick.x,
      y = stick.y,
      m = Math.max(Math.abs(x), Math.abs(y)),
      d =
        m < 0.5
          ? ""
          : Math.abs(x) > Math.abs(y)
            ? x > 0
              ? "right"
              : "left"
            : y > 0
              ? "down"
              : "up";
    if (d !== navDir) {
      navDir = d;
      if (d) {
        DR.cmd("nav", d);
        navT = performance.now() + 450;
      }
    }
  }
  function navRepeat(now) {
    if (navDir && stick.id !== null && !flying() && now >= navT) {
      DR.cmd("nav", navDir);
      navT = now + 170;
    }
  }

  /* ---------- TILT: the phone is the plane (style bible §15.5, dossier 06 §3.5) ----------
     Hold it face up like a paper plane, top edge forward. Twist it to bank (right edge down = bank right); lift the top edge to climb.
     Gravity "up" comes from beta/gamma as a vector (no gimbal jump through an upright hold), is turned into screen axes with
     screen.orientation (checked against gravity once sideways, for the iOS builds that reported the angle backwards), and read as
     pitch/roll against a neutral pose: the mean of the last 250 ms (spread under 2°, else "HOLD STILL") taken when TILT comes on, at each
     flight start, on A during the pre-flight card, after a turn of the phone, on a tap of the stick cap and on a tap of the TILT key.
     Two channels:
       tilt (contract seam S1): DR.cmd('tilt', {bank, climb}) in degrees every frame while flying (null when it stops); the engine flies
         the plane to that attitude (its default) or, after DR.cmd('tiltMode', 'rate'), as stick. Shaping per bible §15.5: dead zones
         2.5° / 3°, full 35° / 25°, exponent 1.4, 60 ms smoothing, bank = roll x 1.5 (±70°), climb = pitch x 1.6 (±60°). Used when the
         engine has the seam (DR.caps.tilt, or a DR.tiltMode string). #tilt=rate|attitude sends that tiltMode (A/B board).
       pad (fallback for an engine without S1, e.g. the Fleet-era engine this branch builds against): DR.cmd('pad') each frame gets tilt
         + stick, summed and clamped; 3° dead zone, full deflection 25°, a 0.15 s low-pass. The engine flies pad.sy through its invert
         setting in Pro steering, so the sign is pre-flipped: nose up always climbs (Simple steering never inverts).
     The stick itself goes to DR.cmd('pad') as a screen direction (sx right, sy down). Round 4: in the engine's Simple steering (the
     touch default, DR.steer) that is where the plane goes: up climbs, down dives, left and right turn (r7: they turn the nose itself, with no
     bank, and every touch on the stick also counts as touch for the engine's 'auto' steering); in Pro it is a flight stick.
     The key is a real <button> outside the pointer tracking: DeviceOrientationEvent.requestPermission() runs inside its touchend/click.
     Tap: on (or re-centre while on). Hold 0.6 s: off. GB.tiltToggle() lets the sheet or a card offer the same switch from its own click. */
  const TP = {
    rate: {
      dzR: 3,
      dzP: 3,
      fullR: 25,
      fullP: 25,
      k: 1,
      tau: 0.15,
    },
    attitude: {
      dzR: 2.5,
      dzP: 3,
      fullR: 35,
      fullP: 25,
      k: 1.4,
      tau: 0.06,
      bankGain: 1.5,
      climbGain: 1.6,
      bankMax: 70,
      climbMax: 60,
    },
  };
  const TC = {
    channel: null,
    mode: null,
    flat: -0.2,
    maxRoll: 70,
    calMs: 250,
    calSpread: 2,
    hold: 600,
    presets: TP,
  };
  // channel 'tilt'|'pad' and mode 'attitude'|'rate' override the defaults
  const TL = {
    st: "off",
    ev: null,
    n: 0,
    buf: [],
    P0: 0,
    R0: 0,
    fp: 0,
    fr: 0,
    x: 0,
    y: 0,
    bank: 0,
    climb: 0,
    cal: null,
    flip: false,
    theta: 0,
    lastT: 0,
    warnT: 0,
    wake: null,
    waking: false,
    timer: 0,
    told: false,
    bad: false,
    sentTilt: false,
  };
  const D2R = Math.PI / 180,
    wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  const isSecure = () => window.isSecureContext !== false;
  // the engine has S1 when it says so: DR.caps.tilt, or the mode it mirrors on DR (DR.tiltMode, as it mirrors DR.aspect and DR.hud).
  // DR.edition alone is not enough: the isle engine sets it before it has the tilt channel, and tilt must keep steering meanwhile.
  const tiltChannel = () =>
    TC.channel ||
    ((DR.caps && DR.caps.tilt) || typeof DR.tiltMode === "string"
      ? "tilt"
      : "pad");
  const tiltModeAsked = () =>
    TC.mode || (location.hash.match(/tilt=(rate|attitude)/) || [])[1] || null;
  // null: the engine's default (attitude)
  function screenAngle() {
    const so = screen.orientation;
    let a =
      so && typeof so.angle === "number"
        ? so.angle
        : typeof window.orientation === "number"
          ? window.orientation
          : 0;
    return (((Math.round(a / 90) * 90) % 360) + 360) % 360;
  }
  function upVec(beta, gamma) {
    const b = beta * D2R,
      g = gamma * D2R;
    return [-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g)];
  }
  // gravity "up" in device axes (x right, y top edge, z out of the screen)
  function attitude(beta, gamma) {
    const u = upVec(beta, gamma),
      t = ((TL.theta + (TL.flip ? 180 : 0)) % 360) * D2R,
      c = Math.cos(t),
      s = Math.sin(t);
    const sx = u[0] * c - u[1] * s,
      sy = u[0] * s + u[1] * c,
      sz = u[2];
    // into screen axes (θ = 90: the phone turned anticlockwise)
    return {
      pitch: Math.atan2(sy, sz) / D2R,
      roll: Math.asin(clamp(-sx, -1, 1)) / D2R,
      sz,
      ux: u[0],
    };
  }
  const shape = (v, dz, full, k) => {
    const m = Math.abs(v);
    return m <= dz
      ? 0
      : Math.sign(v) * Math.min(1, Math.pow((m - dz) / (full - dz), k));
  };
  function onOri(e) {
    if (e.beta == null || e.gamma == null) return;
    const t = performance.now();
    TL.ev = {
      b: +e.beta,
      g: +e.gamma,
      t,
    };
    TL.n++;
    TL.buf.push([t, TL.ev.b, TL.ev.g]);
    while (TL.buf.length && t - TL.buf[0][0] > 600) TL.buf.shift();
    if (TL.st === "wait") {
      clearTimeout(TL.timer);
      tiltState("on");
      tiltRecentre("on");
    }
  }
  // neutral pose from raw samples [t, beta, gamma]: false when they spread more than calSpread
  function neutralFrom(S, force) {
    if (TL.theta === 90 || TL.theta === 270) {
      const ux = S.reduce((a, q) => a + upVec(q[1], q[2])[0], 0) / S.length;
      if (Math.abs(ux) > 0.25) TL.flip = (TL.theta === 90) !== ux > 0;
    }
    // anticlockwise ⇒ device x points up
    const A = S.map((q) => attitude(q[1], q[2])),
      ps = A.map((q) => q.pitch),
      rs = A.map((q) => q.roll);
    const spread = Math.max(
      Math.max(...ps) - Math.min(...ps),
      Math.max(...rs) - Math.min(...rs),
    );
    if (spread > TC.calSpread && !force) return false;
    let sp = 0;
    for (const p of ps) sp += wrap180(p - ps[0]);
    TL.P0 = wrap180(ps[0] + sp / ps.length);
    TL.R0 = rs.reduce((x, y) => x + y, 0) / rs.length;
    TL.fp = TL.fr = 0;
    return true;
  }
  function tiltRecentre(why) {
    if (TL.st !== "on") return;
    TL.theta = screenAngle();
    TL.x = TL.y = TL.bank = TL.climb = 0;
    const now = performance.now(),
      S = TL.buf.filter((q) => now - q[0] <= TC.calMs);
    if (why !== "turn" && S.length >= 3 && neutralFrom(S)) {
      TL.cal = null;
      tiltSaid(why);
      return;
    }
    TL.cal = {
      t0: now,
      last: TL.n,
      tries: why === "retry" && TL.cal ? TL.cal.tries + 1 : 0,
      why: why === "retry" && TL.cal ? TL.cal.why : why,
    };
    // collect the next 250 ms
  }
  function calStep(now) {
    const C = TL.cal;
    if (now - C.t0 < TC.calMs) return;
    const S = TL.buf.filter((q) => q[0] >= C.t0);
    if (!S.length) return;
    if (!neutralFrom(S, C.tries >= 2)) {
      toast("HOLD STILL");
      tiltRecentre("retry");
      return;
    }
    TL.cal = null;
    tiltSaid(C.why);
  }
  function tiltSaid(why) {
    if (why === "on") {
      toast("TILT ON · HOLD LIKE A PAPER PLANE");
      if (!TL.told && !land) {
        TL.told = true;
        toast("TIP: TURN ON PORTRAIT LOCK");
      }
    } else if (why === "tap" || why === "key") toast("TILT CENTRED");
    else if (why === "a") toast("READY · TILT CENTRED");
  }
  function tiltFrame(now) {
    if (TL.st !== "on" || !TL.ev) {
      TL.lastT = now;
      return;
    }
    const dt = clamp((now - (TL.lastT || now)) / 1000, 0.001, 0.1);
    TL.lastT = now;
    if (TL.cal) {
      calStep(now);
      TL.x = TL.y = TL.bank = TL.climb = 0;
      return;
    }
    const ch = tiltChannel(),
      K = TP[ch === "tilt" ? "attitude" : "rate"],
      A = attitude(TL.ev.b, TL.ev.g);
    let dp = wrap180(A.pitch - TL.P0),
      dr = A.roll - TL.R0;
    TL.bad = A.sz < TC.flat || Math.abs(A.roll) > TC.maxRoll;
    // screen facing down, or the phone banked past 70°: no input
    if (TL.bad) {
      dp = dr = 0;
      if (flying() && now > TL.warnT) {
        TL.warnT = now + 2500;
        toast("LEVEL YOUR PHONE");
      }
    }
    const q = 1 - Math.exp(-dt / K.tau);
    TL.fp += (dp - TL.fp) * q;
    TL.fr += (dr - TL.fr) * q;
    const r = shape(TL.fr, K.dzR, K.fullR, K.k),
      p = shape(TL.fp, K.dzP, K.fullP, K.k);
    if (ch === "tilt") {
      TL.x = TL.y = 0;
      TL.bank = clamp(r * K.fullR * K.bankGain, -K.bankMax, K.bankMax);
      TL.climb = clamp(p * K.fullP * K.climbGain, -K.climbMax, K.climbMax);
    } else {
      TL.bank = TL.climb = 0;
      TL.x = r;
      TL.y = DR.invert || DR.steer === "simple" ? -p : p;
    }
    // Simple steering (round 4) never inverts: sy < 0 climbs
  }
  function pushTilt() {
    // the S1 channel: the target bank and climb, every frame while flying; null once when it stops
    const want = TL.st === "on" && flying() && tiltChannel() === "tilt";
    if (want) {
      DR.cmd("tilt", {
        bank: +TL.bank.toFixed(2),
        climb: +TL.climb.toFixed(2),
      });
      TL.sentTilt = true;
    } else if (TL.sentTilt) {
      TL.sentTilt = false;
      DR.cmd("tilt", null);
    }
  }
  function sayMode() {
    const m = tiltModeAsked();
    if (m && tiltChannel() === "tilt") DR.cmd("tiltMode", m);
  }
  // the A/B board's choice, if any
  function tiltState(st) {
    TL.st = st;
    const onNow = st === "on";
    tiltBtn.classList.toggle("on", onNow);
    tiltBtn.classList.toggle("wait", st === "ask" || st === "wait");
    gb.classList.toggle("gb-tilting", onNow);
    tiltBtn.setAttribute("aria-pressed", onNow ? "true" : "false");
    tiltBtn.setAttribute(
      "aria-label",
      onNow
        ? "Tilt steering: on. Tap to re-centre, hold to turn off"
        : st === "off"
          ? "Tilt steering: off. Tap to turn on"
          : "Tilt steering: starting",
    );
    if (!onNow) {
      TL.x = TL.y = TL.fp = TL.fr = TL.bank = TL.climb = 0;
      TL.cal = null;
      TL.bad = false;
    }
    pushPad();
    pushTilt();
    wakeSync();
  }
  function tiltListen() {
    TL.buf = [];
    addEventListener("deviceorientation", onOri);
    tiltState("wait");
    clearTimeout(TL.timer);
    sayMode();
    TL.timer = setTimeout(() => {
      if (TL.st === "wait") {
        tiltOff();
        toast("NO MOTION SENSOR · USE THE STICK");
      }
    }, 1000);
  }
  function tiltDenied() {
    if (TL.st === "off") return;
    tiltOff();
    toast(
      "MOTION ACCESS IS OFF FOR THIS SITE. QUIT AND REOPEN SAFARI, THEN TAP TILT AGAIN.",
    );
  }
  function tiltOff() {
    removeEventListener("deviceorientation", onOri);
    clearTimeout(TL.timer);
    TL.ev = null;
    TL.buf = [];
    if (TL.st !== "off") tiltState("off");
  }
  // turn TILT on: must run synchronously inside a click / touchend handler (iOS asks for motion access here, with no await before it)
  function tiltOn() {
    if (!on || TL.st !== "off") return;
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) {
      toast("NO MOTION SENSOR · USE THE STICK");
      return;
    }
    if (!isSecure()) {
      toast("TILT NEEDS A SECURE (HTTPS) PAGE");
      return;
    }
    if (typeof DOE.requestPermission === "function") {
      // iOS 13+
      tiltState("ask");
      let q;
      try {
        q = DOE.requestPermission();
      } catch (err) {
        tiltDenied();
        return;
      }
      Promise.resolve(q).then(
        (r) => {
          if (TL.st !== "ask") return;
          if (r === "granted") tiltListen();
          else tiltDenied();
        },
        () => {
          if (TL.st === "ask") tiltDenied();
        },
      );
    } else tiltListen();
  }
  function tiltPress(long) {
    if (slipped()) return;
    buzz();
    if (TL.st === "off") {
      tiltOn();
      return;
    }
    if (TL.st === "ask") return;
    if (long || TL.st === "wait") {
      tiltOff();
      toast("TILT OFF · STICK STEERS");
      return;
    }
    tiltRecentre("key");
  }
  // the key: touch = touchstart/touchend on the button (touchend is a user activation; it is cancelled so no click follows), mouse and
  // keyboard = click. A press that slides off the key does nothing.
  let tDown = 0,
    tTouchEnd = 0;
  tiltBtn.addEventListener(
    "touchstart",
    (e) => {
      tDown = e.timeStamp;
      tiltBtn.classList.add("down");
    },
    {
      passive: true,
    },
  );
  tiltBtn.addEventListener(
    "touchend",
    (e) => {
      tiltBtn.classList.remove("down");
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      tTouchEnd = performance.now();
      const t = e.changedTouches && e.changedTouches[0],
        r = tiltBtn.getBoundingClientRect();
      if (
        t &&
        (t.clientX < r.left - 12 ||
          t.clientX > r.right + 12 ||
          t.clientY < r.top - 12 ||
          t.clientY > r.bottom + 12)
      )
        return;
      tiltPress(e.timeStamp - tDown >= TC.hold);
    },
    {
      passive: false,
    },
  );
  tiltBtn.addEventListener("touchcancel", () =>
    tiltBtn.classList.remove("down"),
  );
  tiltBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    if (e.pointerType === "mouse") {
      tDown = e.timeStamp;
      tiltBtn.classList.add("down");
    }
  });
  tiltBtn.addEventListener("pointerup", (e) => {
    e.stopPropagation();
    if (e.pointerType === "mouse") tiltBtn.classList.remove("down");
  });
  tiltBtn.addEventListener("pointerleave", () =>
    tiltBtn.classList.remove("down"),
  );
  tiltBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (performance.now() - tTouchEnd < 700) return;
    tiltPress(e.detail > 0 && e.timeStamp - tDown >= TC.hold);
  });
  // no dimming while flying by tilt (few touches reach the screen); released on pause, result, TILT off and when the page hides
  async function wakeSync() {
    const want = TL.st === "on" && on && flying() && !document.hidden;
    if (
      want &&
      !TL.wake &&
      !TL.waking &&
      navigator.wakeLock &&
      navigator.wakeLock.request
    ) {
      TL.waking = true;
      try {
        const l = await navigator.wakeLock.request("screen");
        TL.wake = l;
        l.addEventListener("release", () => {
          if (TL.wake === l) TL.wake = null;
        });
      } catch (e) {}
      TL.waking = false;
      if (!(TL.st === "on" && on && flying() && !document.hidden)) wakeSync();
    } else if (!want && TL.wake) {
      const l = TL.wake;
      TL.wake = null;
      try {
        l.release();
      } catch (e) {}
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && on) release();
    wakeSync();
  });

  // short messages over the bottom of the screen (tilt prompts; never anything the game says)
  const TQ = [];
  let toastT = 0;
  function toast(msg) {
    if (
      TQ[TQ.length - 1] === msg ||
      (TQ.length === 0 && !toastEl.hidden && toastEl.textContent === msg)
    )
      return;
    TQ.push(msg);
    if (!toastT) toastNext();
  }
  function toastNext() {
    const m = TQ.shift();
    if (m === undefined) {
      toastEl.classList.remove("in");
      toastT = setTimeout(() => {
        toastEl.hidden = true;
        toastT = 0;
      }, 220);
      return;
    }
    toastEl.textContent = m;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add("in"));
    toastT = setTimeout(toastNext, m.length > 34 ? 3600 : 1700);
  }

  /* ---------- the screen corner: round and clock while flying (the 'lite' HUD leaves them to the site); lamps; SPECIAL ---------- */
  const pad2 = (n) => String(n).padStart(2, "0"),
    fmt = (t) => {
      t = Math.max(0, t || 0);
      return (
        pad2(Math.floor(t / 60)) +
        ":" +
        pad2(Math.floor(t % 60)) +
        "." +
        Math.floor((t * 10) % 10)
      );
    };
  let lastTxt = "";
  function tick(force) {
    if (!on) return;
    const s = DR.state,
      T = DR.telemetry || {},
      f = flying();
    // the pause screen prints its own round and time
    // the island edition's HUD keeps its timer pill and target cards even in 'lite' mode, so the corner readout is only for the older
    // engines whose lite HUD drops them (it would sit on the HUD's top-left badge)
    const txt =
      f && DR.edition !== "isle"
        ? "R" + (T.round || 1) + "  " + fmt(T.time)
        : "";
    if (txt !== lastTxt || force) {
      lastTxt = txt;
      osd.textContent = txt;
      osd.hidden = !txt;
    }
    gb.classList.toggle("gb-up", s !== "boot");
    const item = T.item,
      ready = !!(item && item.ready),
      active = !!(item && item.active);
    const usable = ready && !sheet && /^(play|brief)$/.test(s);
    const phase =
      ready && item.hint
        ? "NO TARGET"
        : active
          ? {
              form: "FORMING",
              attack: "ATTACK",
              peel: "PEELING",
            }[item.phase] || "ACTIVE"
          : ready
            ? "READY"
            : "FIND ? BOX";
    special.disabled = !usable;
    special.classList.toggle("ready", usable);
    special.classList.toggle("active", active);
    specialStatus.textContent = phase;
    special.title =
      item && item.hint
        ? item.hint
        : item && item.label
          ? item.label +
            (ready ? ": tap SPECIAL to use" : ": " + phase.toLowerCase())
          : "Collect a ? box to store a special";
    special.setAttribute("aria-label", special.title);
  }
  DR.on("progress", (p) => {
    const u = gb.querySelector(".gb-bar u");
    if (u) u.style.width = Math.round(p * 100) + "%";
  });
  DR.on("ready", () => {
    gb.classList.add("gb-ready");
    attachHow();
    if (on && aspect) {
      const a = aspect;
      aspect = "";
      setAspect(a);
    }
    if (TL.st !== "off") sayMode();
    tick(true);
  });
  // the engine takes 'aspect' once it is up: say it again
  if (DR.state && DR.state !== "boot") gb.classList.add("gb-ready");
  DR.on("state", (now, was) => {
    lastPad = "";
    pushPad();
    if (on && sheet && /^(brief|play)$/.test(now)) closeSheet();
    // flight: the sheet is closed
    if (
      /^(brief|play)$/.test(now) &&
      !/^(brief|play|down|paused)$/.test(was || "")
    ) {
      tiltRecentre("flight");
      if (now === "brief" && TL.st === "on")
        toast("HOLD LIKE A PAPER PLANE · PRESS A");
    }
    // each flight starts level from the way the phone is held
    pushTilt();
    // (the name entry no longer opens the sheet at the result: it waits for the final menu and shows in the screen; see dockIn)
    wakeSync();
    tick(true);
  });
  let lt = 0;
  (function loop(now) {
    requestAnimationFrame(loop);
    if (!on) return;
    navRepeat(now);
    tiltFrame(now);
    if (TL.st === "on") {
      pushPad();
      pushTilt();
    }
    if (now - lt > 100) {
      lt = now;
      tick();
    }
  })(0);

  window.GB = {
    // a phone or a tablet held small: a touch screen whose short side is under 600 px (layout audit L-04: a short mouse-only desktop window,
    // e.g. a 1080p laptop at 150 % with the browser maximised, ~1280×590, keeps the desktop stage, which already scales down)
    want(w, h) {
      if (Math.min(w, h) >= 600) return false;
      try {
        return (
          matchMedia("(pointer: coarse)").matches ||
          (navigator.maxTouchPoints > 0 &&
            !matchMedia("(hover: hover)").matches)
        );
      } catch (e) {
        return true;
      }
    },
    fit(want) {
      fit(!!want);
    },
    open: openSheet,
    close: closeSheet,
    relayout,
    get on() {
      return on;
    },
    get sheet() {
      return sheet;
    },
    get land() {
      return land;
    },
    get kb() {
      return kb;
    },
    get aspect() {
      return aspect;
    },
    get screenMode() {
      return screenMode;
    },
    setScreen(m) {
      m = SCREENS[m];
      if (m && m !== screenMode) {
        screenMode = m;
        relayout();
      }
      return screenMode;
    },
    // round 4: 'tall' (default), '1:1', '4:3'
    get deck() {
      return {
        mode: screenMode,
        f: +CF.toFixed(3),
        stick: EL.stick.offsetWidth,
        a: EL.a.offsetWidth,
        b: EL.b.offsetWidth,
        lcd: [
          parseFloat(gb.style.getPropertyValue("--lw")),
          parseFloat(gb.style.getPropertyValue("--lh")),
        ],
        speaker: spk.style.display !== "none",
      };
    },
    get geo() {
      const r = ctl.getBoundingClientRect(),
        o = {};
      for (const k in G)
        o[k] = {
          x: Math.round(r.left + G[k].cx),
          y: Math.round(r.top + G[k].cy),
          r: Math.round(G[k].r),
        };
      const t = tiltBtn.getBoundingClientRect();
      o.tilt = {
        x: Math.round(t.left + t.width / 2),
        y: Math.round(t.top + t.height / 2),
        r: Math.round(t.width / 2),
      };
      return o;
    },
    get stick() {
      return {
        x: stick.x,
        y: stick.y,
        held: Object.assign({}, held),
        pointers: P.size,
      };
    },
    get tilt() {
      return {
        state: TL.st,
        channel: tiltChannel(),
        mode: tiltModeAsked(),
        x: TL.x,
        y: TL.y,
        bank: TL.bank,
        climb: TL.climb,
        P0: TL.P0,
        R0: TL.R0,
        theta: TL.theta,
        flip: TL.flip,
        cal: !!TL.cal,
        bad: TL.bad,
        events: TL.n,
        wake: !!TL.wake,
      };
    },
    tiltToggle() {
      if (TL.st === "off") tiltOn();
      else {
        tiltOff();
        toast("TILT OFF · STICK STEERS");
      }
    },
    // call it from your own click handler
    tiltRecentre() {
      tiltRecentre("key");
    },
    tiltCfg: TC,
  };
})();
