/* SLOP SKIES · island edition: the pages (§11.4): How to Fly, Hangar, Targets, Records, About (round 2: no main menu;
   the pages open as the handheld's sheet tabs on phones and from the leaderboard). Pictures are renders of our own island (assets/8845c1b17855fc43/isle, tools/stills.js) with live renders of our aircraft and tugs from the
   game (DR.widget) on top, and our own line drawings. Nothing here is copied artwork. */
(function () {
  "use strict";
  const S = window.SITE,
    DR = window.DR,
    $ = (s) => document.querySelector(s),
    $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = S.esc,
    dg = (s) =>
      esc(s).replace(/[0-9]+/g, (m) => '<span class="dg">' + m + "</span>");
  // digits in the numeral face: AUTH0's zero is not an O

  /* ================= icons (our drawings): room roundels and tooltip badges ================= */
  const svgI = (p, vb) =>
    '<svg viewBox="' +
    (vb || "0 0 48 48") +
    '" aria-hidden="true">' +
    p +
    "</svg>";
  // the room roundels (style audit S10, S13): the game's header roundel, white glyphs with a teal keyline (site.8845c1b17855fc43.css .rh-ro svg) on the aqua disc;
  // the plane is the game's own jet mark (screens.js jetIcon), the one plane pictogram
  const T = "#FFFFFF";
  const ICON = {
    plane: svgI(
      '<g transform="translate(24 24) rotate(-35.5) scale(1.42)"><path d="M15 0Q13-1.7 8-1.9L1.5-10.5H-2.4L.6-2-8-1.7-11.4-6H-13.6L-12-.6V.6L-13.6 6H-11.4L-8 1.7.6 2-2.4 10.5H1.5L8 1.9Q13 1.7 15 0Z" fill="#fff"/><ellipse cx="8.6" cy="0" rx="2.6" ry=".9" fill="#55C3E6"/></g>',
    ),
    tug: svgI(
      '<path d="M4 22h11v12H4z" fill="none" stroke="' +
        T +
        '" stroke-width="3" stroke-linejoin="round"/><path d="M15 28h7" stroke="' +
        T +
        '" stroke-width="2.5"/><path d="M22 24c0-2 1.6-3.4 4-3.4h11c3 0 6 1.6 7 3.4 1-.1 1 7.2 0 7.1-1 1.8-4 3.4-7 3.4H26c-2.4 0-4-1.4-4-3.4z" fill="' +
        T +
        '"/><path d="M28 20l2-6h4l1 6M28 35l2 5h4l1-5" fill="' +
        T +
        '"/>',
    ),
    clock: svgI(
      '<circle cx="24" cy="26" r="15" fill="none" stroke="' +
        T +
        '" stroke-width="4"/><path d="M24 17v10l7 4" fill="none" stroke="' +
        T +
        '" stroke-width="4" stroke-linecap="round"/><rect x="19" y="5" width="10" height="5" rx="2" fill="' +
        T +
        '"/>',
    ),
    keys: svgI(
      '<rect x="17" y="8" width="13" height="11" rx="3" fill="' +
        T +
        '"/><rect x="3" y="21" width="13" height="11" rx="3" fill="' +
        T +
        '"/><rect x="17" y="21" width="13" height="11" rx="3" fill="' +
        T +
        '"/><rect x="31" y="21" width="13" height="11" rx="3" fill="' +
        T +
        '"/><rect x="6" y="35" width="35" height="8" rx="3" fill="' +
        T +
        '"/>',
    ),
    star: svgI(
      '<path d="M24 5l5.6 11.5 12.6 1.8-9.1 8.9 2.1 12.6L24 33.9l-11.2 5.9 2.1-12.6-9.1-8.9 12.6-1.8z" fill="' +
        T +
        '"/>',
    ),
    cloud: svgI(
      '<path d="M13 37a8 8 0 0 1-1-15.9A12 12 0 0 1 35 18a9 9 0 0 1 1 18z" fill="' +
        T +
        '"/>',
    ),
    sliders: svgI(
      '<g stroke="' +
        T +
        '" stroke-width="4" stroke-linecap="round"><path d="M8 14h32M8 24h32M8 34h32"/></g><g fill="#fff" stroke="' +
        T +
        '" stroke-width="3.5"><circle cx="17" cy="14" r="5"/><circle cx="31" cy="24" r="5"/><circle cx="20" cy="34" r="5"/></g>',
    ),
  };
  const mask = (p) =>
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
        p +
        "</svg>",
    );
  const BADGE = {
    // tooltip badges: the input style (keyboard and mouse) for the flying tiles, the topic for the others
    keys: mask(
      '<rect x="3" y="9" width="27" height="20" rx="4"/><rect x="33" y="9" width="12" height="20" rx="6"/><rect x="7" y="33" width="34" height="7" rx="3"/>',
    ),
    plane: mask(
      '<path d="M21.5 6c0-2.4 5-2.4 5 0v12.5l15 8.5v4.5l-15-5v9.5l4.5 3.5V42l-7-1.8-7 1.8v-2.5l4.5-3.5V26.5l-15 5V27l15-8.5z"/>',
    ),
    clock: mask(
      '<path d="M24 9a17 17 0 1 1 0 34 17 17 0 0 1 0-34zm-2 8v11l9 5 2-3.4-7-4V17z" fill-rule="evenodd"/>',
    ),
    cloud: mask(
      '<path d="M13 37a8 8 0 0 1-1-15.9A12 12 0 0 1 35 18a9 9 0 0 1 1 18z"/>',
    ),
    star: mask(
      '<path d="M24 5l5.6 11.5 12.6 1.8-9.1 8.9 2.1 12.6L24 33.9l-11.2 5.9 2.1-12.6-9.1-8.9 12.6-1.8z"/>',
    ),
    tug: mask(
      '<path d="M2 18h14v14H2zM20 23c0-2 2-3.5 4.5-3.5H37c3.5 0 7 1.8 8 3.8v5.4c-1 2-4.5 3.8-8 3.8H24.5C22 32.5 20 31 20 29z"/>',
    ),
  };

  /* ================= the main menu: eight tiles in a 4×2 grid (bible §11.3) ================= */
  const TILES = [
    {
      id: "run",
      label: "Banner Run",
      act: "run",
      isNew: true,
      pic: "tile-run",
      ico: "keys",
      w: () => ({
        type: "tug",
        id: (S.curTarget() || DR.targets[0]).id,
        yaw: 1.2,
        pitch: 0.08,
        roll: -0.18,
      }),
    },
    {
      id: "hangar",
      label: "Hangar",
      room: "hangar",
      pic: "tile-hangar",
      ico: "plane",
      w: () => ({
        type: "plane",
        kind: DR.aircraftId,
        yaw: 2.2,
        pitch: 0.1,
        roll: 0.32,
      }),
    },
    {
      id: "targets",
      label: "Targets",
      room: "targets",
      pic: "tile-targets",
      ico: "tug",
      w: () => ({
        type: "tug",
        id: "artisan",
        yaw: 2.05,
        pitch: 0.06,
        roll: 0.12,
      }),
    },
    {
      id: "records",
      label: "Records",
      room: "records",
      pic: "tile-records",
      ico: "clock",
    },
    {
      id: "fleet",
      label: "Fleet Week",
      notice: "fleet",
      pic: "tile-fleet",
      ico: "plane",
      tip: "Fleet Week 0.6",
      w: () => ({
        type: "plane",
        kind: "superhornet",
        yaw: 2.35,
        pitch: 0.12,
        roll: 0.4,
      }),
    },
    {
      id: "og",
      label: "Original",
      notice: "og",
      pic: "tile-og",
      ico: "cloud",
      tip: "The Original",
    },
    {
      id: "about",
      label: "About",
      room: "about",
      pic: "tile-about",
      ico: "star",
    },
  ];
  const tilesEl = $("#tiles");
  // round 2: the main menu is gone; the tiles build only if a page still carries #tiles
  if (tilesEl)
    tilesEl.innerHTML = TILES.map(
      (t, i) =>
        '<a class="tile" href="' +
        (t.notice
          ? t.notice === "fleet"
            ? "/fleet/"
            : "/og/"
          : "#" + (t.room || "play")) +
        '"' +
        (t.act ? ' data-act="' + t.act + '"' : "") +
        (t.room ? ' data-room="' + t.room + '"' : "") +
        (t.notice ? ' data-notice="' + t.notice + '"' : "") +
        ' data-tip="' +
        esc(t.tip || t.label) +
        '" data-ico="' +
        BADGE[t.ico] +
        '" style="left:' +
        (i % 4) * 210 +
        "px;top:" +
        ((i / 4) | 0) * 170 +
        'px" aria-label="' +
        esc(t.tip || t.label) +
        '">' +
        (t.isNew
          ? '<b class="new" aria-hidden="true">NEW</b>'
          : '<b class="lbl">' + esc(t.label) + "</b>") +
        '<span class="pic"><img data-src="assets/8845c1b17855fc43/isle/' +
        t.pic +
        '.jpg" alt="" width="330" height="150" decoding="async">' +
        (t.w ? '<canvas aria-hidden="true"></canvas>' : "") +
        "</span></a>",
    ).join("");
  // the menu's tile names squeeze sideways to fit, as the longer names on the reference tiles do
  function fitLabels() {
    $$(".tile .lbl").forEach((l) => {
      l.style.transform = "";
      const box = 177,
        w = l.scrollWidth;
      if (w > box) l.style.transform = "scaleX(" + (box / w).toFixed(3) + ")";
    });
  }
  if (document.fonts) document.fonts.ready.then(fitLabels);
  const tileLive = {};
  function liveTiles() {
    if (!tilesEl) return;
    TILES.forEach((t, i) => {
      if (!t.w || tileLive[t.id]) return;
      const cv = $$("#tiles .tile")[i].querySelector("canvas");
      tileLive[t.id] = S.live(cv, t.w(), 2);
    });
  }
  function refreshTiles() {
    TILES.forEach((t) => {
      if (t.w && tileLive[t.id]) tileLive[t.id].set(t.w());
    });
  }

  /* ================= room scaffolding: header (roundel, name, rule, title), body, footer (Back, the main action) ================= */
  const head = (id, name, title, icon) =>
    '<header class="room-h"><span class="rh-ro" aria-hidden="true">' +
    ICON[icon] +
    '</span><h2 class="rh-n" id="' +
    id +
    '-h">' +
    name +
    '</h2><i class="rh-rule" aria-hidden="true"></i><span class="rh-t">' +
    title +
    "</span></header>";
  // the Back lollipop (style audit S08): the game's own (screens.js lollipop + backIcon): a blue disc with the round return arrow fused to an
  // aqua pill, the Esc key cap (hidden on touch), "Back"
  const BACK_SVG =
    '<svg viewBox="-.5 -.5 1 1"><path d="M-.216.033A.3.3 0 1 1 .08.38" fill="none" stroke="#fff" stroke-width=".16" stroke-linecap="round"/><path d="M-.42.12H-.1L-.26-.26z" fill="#fff"/></svg>';
  const backBtn = (cls, attrs) =>
    '<button class="lolli ' +
    cls +
    '" type="button" ' +
    attrs +
    '><u class="lo-i" aria-hidden="true">' +
    BACK_SVG +
    '</u><kbd class="lo-k">Esc</kbd><span class="lo-t">Back</span></button>';
  const foot = (go) =>
    '<footer class="room-f">' +
    backBtn("rf-back", "data-back") +
    (go || "") +
    "</footer>";
  const goBtn = (id, txt) =>
    '<button class="rf-go" type="button" id="' +
    id +
    '" data-primary><span>' +
    txt +
    "</span><kbd>Enter</kbd></button>";
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-back]")) {
      e.preventDefault();
      S.closeRoom();
    }
  });

  /* ================= HANGAR: the porthole carousel ================= */
  const STAT = [
    ["speed", "Speed"],
    ["turn", "Turn"],
    ["guns", "Guns"],
    ["assist", "Aim assist"],
  ];
  // the 2009 JP site's minus and plus buttons, our drawing: a white disc in a cyan ring, the sign, and an arrow tip pointing the way it pages
  const pmSvg = (sign) =>
    '<svg viewBox="0 0 112 96"><path d="' +
    (sign ? "M108 48L92 34v28z" : "M4 48l16-14v28z") +
    '" fill="#46B2E6"/><circle cx="56" cy="48" r="38" fill="#fff" stroke="#46B2E6" stroke-width="7"/>' +
    '<circle cx="56" cy="48" r="31" fill="none" stroke="#E2F2FA" stroke-width="3"/><rect x="36" y="43" width="40" height="10" rx="4" fill="#46B2E6"/>' +
    (sign
      ? '<rect x="51" y="28" width="10" height="40" rx="4" fill="#46B2E6"/>'
      : "") +
    "</svg>";
  const minus = pmSvg(false),
    plus = pmSvg(true);
  const bolts = Array.from(
    {
      length: 8,
    },
    (_, i) => {
      const a = ((i + 0.5) / 8) * Math.PI * 2,
        r = 220;
      return (
        '<i class="bolt" style="left:' +
        (195 + Math.cos(a) * r).toFixed(1) +
        "px;top:" +
        (195 + Math.sin(a) * r).toFixed(1) +
        'px"></i>'
      );
    },
  ).join("");
  $("#hangar").innerHTML =
    head("hangar", "Hangar", "Select a Plane", "plane") +
    '<div class="room-b"><div class="hg">' +
    '<button class="pm minus" type="button" id="hg-prev" aria-label="Previous aircraft">' +
    minus +
    "</button>" +
    '<div class="porthole"><canvas aria-hidden="true"></canvas>' +
    bolts +
    '<i class="hinge" aria-hidden="true"></i><i class="latch l" aria-hidden="true"></i><i class="latch r" aria-hidden="true"></i></div>' +
    '<button class="pm plus" type="button" id="hg-next" aria-label="Next aircraft">' +
    plus +
    "</button>" +
    '<div class="hg-dots" id="hg-dots">' +
    DR.aircraft.map(() => "<i></i>").join("") +
    "</div>" +
    '<div class="hg-r"><h3 class="hg-n" id="hg-n"></h3><p class="hg-role" id="hg-role"></p><div class="fact"><p id="hg-bio"></p><div class="dims" id="hg-dims"></div><dl class="stats" id="hg-stats"></dl></div></div>' +
    "</div></div>" +
    foot(goBtn("hg-fly", "Fly This Plane"));
  let pick = DR.aircraftId,
    hgLive = null;
  function drawHangar() {
    const p = S.aircraftOf(pick),
      i = DR.aircraft.indexOf(p),
      live = S.isLive();
    $("#hg-n").textContent = p.name;
    $("#hg-role").textContent =
      (p.role || "") +
      (S.PROP[p.id] ? " · propeller" : " · jet") +
      " · " +
      (i + 1) +
      " of " +
      DR.aircraft.length;
    $("#hg-bio").textContent = p.bio || p.planeNote || "";
    const d = [];
    if (isFinite(p.realSpan))
      d.push("<span><b>" + (+p.realSpan).toFixed(1) + " m</b>wingspan</span>");
    if (isFinite(p.realLength))
      d.push("<span><b>" + (+p.realLength).toFixed(1) + " m</b>length</span>");
    $("#hg-dims").innerHTML = d.join("");
    $("#hg-stats").innerHTML = STAT.map(
      (s) =>
        '<div class="stat"><dt>' +
        s[1] +
        "</dt><dd>" +
        [1, 2, 3, 4, 5]
          .map(
            (k) =>
              "<i" + (k <= (p.stats[s[0]] || 0) ? ' class="f"' : "") + "></i>",
          )
          .join("") +
        "</dd></div>",
    ).join("");
    $$("#hg-dots i").forEach((el, k) => el.classList.toggle("on", k === i));
    const fly = $("#hg-fly"),
      mine = p.id === DR.aircraftId;
    fly.disabled = live && !mine;
    fly.querySelector("span").textContent = live
      ? mine
        ? "Back to the Game"
        : "Locked While Flying"
      : "Fly the " + S.aircraftLabel(p);
    if (!hgLive)
      hgLive = S.live(
        $(".porthole canvas"),
        {
          type: "plane",
          kind: p.id,
          spin: 0.45,
          pitch: 0.16,
        },
        2,
      );
    else
      hgLive.set({
        kind: p.id,
      });
  }
  function step(d) {
    const i = DR.aircraft.findIndex((x) => x.id === pick),
      n = DR.aircraft.length;
    pick = DR.aircraft[(i + d + n) % n].id;
    if (!S.isLive() && /title|select|result|boot/.test(DR.state))
      DR.cmd("aircraft", pick);
    drawHangar();
    S.blip("click");
  }
  $("#hg-prev").addEventListener("click", () => step(-1));
  $("#hg-next").addEventListener("click", () => step(1));
  $("#hg-fly").addEventListener("click", () => {
    const p = pick,
      s = DR.state;
    if (S.isLive()) {
      if (p === DR.aircraftId) {
        S.closeRoom();
      }
      return;
    }
    DR.cmd("aircraft", p);
    S.blip("start");
    if (s === "title" || s === "select" || s === "result") S.startRun(true);
  });

  /* ================= TARGETS: the five banners as 2009 list rows ================= */
  const TOW = {
    // the tug's identity colour, the game's own tug body colour (tugs.js TUG_ID, bible §2.3; style audit S07), and where each sighting comes from (HANDOFF §7)
    paid: {
      c: "#FAB217",
      src: "The Economist, 2026",
    },
    artisan: {
      c: "#7458DE",
      src: "KRON4, 2026",
    },
    arceus: {
      c: "#2A3A63",
      src: "a Fog City Ace, October 2026",
    },
    auth0: {
      c: "#2B313A",
      src: "a Fog City Ace, October 2026",
    },
    monaco: {
      c: "#2B313A",
      src: "Monaco’s CEO, 2026",
    },
  };
  $("#targets").innerHTML =
    head("targets", "Targets", "Five Banner Planes", "tug") +
    '<div class="room-b"><ol class="rows" id="rows">' +
    DR.targets
      .map((t) => {
        const k = TOW[t.id] || {};
        return (
          '<li class="row" data-id="' +
          t.id +
          '" style="--c:' +
          (k.c || "#0F76AD") +
          '">' +
          '<div class="row-l"><h3>' +
          dg(t.name) +
          '</h3><span class="row-pic"><canvas aria-hidden="true"></canvas></span></div>' +
          '<div class="row-m"><span class="cloth">' +
          dg(t.banner) +
          "</span><p>" +
          esc(t.seen) +
          '. <span class="row-src">Source: ' +
          esc(k.src || "press coverage") +
          '.</span></p><span class="row-st">Flying</span></div>' +
          '<div class="row-r"><b class="rn">' +
          (t.round >= 5 ? "F" : t.round) +
          "</b><span>" +
          (t.round >= 5 ? "FINAL ROUND" : "ROUND") +
          "</span></div></li>"
        );
      })
      .join("") +
    "</ol>" +
    '<p class="rows-note">Banner wording only: no logos, and none of these companies is affiliated with Slop Skies. Plane colours are ours.</p></div>' +
    foot(goBtn("tg-fly", "Banner Run"));
  $("#tg-fly").addEventListener("click", () => {
    if (S.isLive()) S.closeRoom();
    else S.startRun();
  });
  function drawTargets() {
    const cur = S.curTarget(),
      live = S.isLive();
    $$("#rows .row").forEach((li) => {
      const t = DR.targets.find((x) => x.id === li.dataset.id),
        down = t.status === "down",
        isCur = t === cur && live;
      li.classList.toggle("down", down);
      li.classList.toggle("cur", isCur);
      const sp = S.splits[t.id];
      li.querySelector(".row-st").textContent = down
        ? "Down" + (sp != null ? " · " + (+sp).toFixed(1) + " s" : "")
        : isCur
          ? "Chase this one"
          : "Flying";
    });
    $("#tg-fly").querySelector("span").textContent = live
      ? "Back to the Game"
      : "Banner Run";
  }
  let rowsLive = false;
  function liveRows() {
    if (rowsLive) return;
    rowsLive = true;
    $$("#rows .row").forEach((li) =>
      S.live(
        li.querySelector("canvas"),
        {
          type: "tug",
          id: li.dataset.id,
          yaw: 2.1,
          pitch: 0.08,
          roll: 0.1,
        },
        2,
      ),
    );
  }

  /* ================= RECORDS ================= */
  function bestOverall() {
    let b = null;
    Object.keys(DR.best || {}).forEach((k) => {
      const v = DR.best[k];
      if (v != null && (b == null || v < b)) b = v;
    });
    return b;
  }
  $("#records").innerHTML =
    head("records", "Records", "Top 10", "clock") +
    '<div class="room-b"><div class="rec"><div class="rec-l">' +
    '<div class="scard"><span class="cap">Best time</span><b class="v none" id="rc-best-v">No time yet</b><span class="cap" id="rc-best-c">Finish all five rounds</span></div>' +
    '<div class="scard"><span class="cap">Last run</span><b class="v none" id="rc-last-v">No run yet</b><div class="splits" id="rc-splits"></div><span class="cap" id="rc-last-c">Your last flight shows here</span></div>' +
    '<p class="bh">Best time per aircraft · <span id="rc-who"></span></p><table class="best" id="rc-best"></table>' +
    '</div><div class="rec-r"><h3>Top 10<button type="button" class="lb-tab" id="lb-tab" title="Show every aircraft">All aircraft</button><span class="src-n" id="lb-count"></span></h3>' +
    '<ol class="top10" id="lb-top10" data-hook="leaderboard-top10">' +
    Array.from(
      {
        length: 10,
      },
      (_, i) =>
        '<li class="empty"><b>' +
        (i + 1) +
        '</b><span class="lb-nm">----------</span><span class="lb-pl"></span><i>-:--.-</i></li>',
    ).join("") +
    "</ol>" +
    '<p class="rec-note" id="lb-note"></p><p class="rec-note">Runs started on this computer: <b id="rc-sorties">0</b>.</p>' +
    "</div></div></div>" +
    foot(goBtn("rc-fly", "Fly Again"));
  $("#rc-fly").addEventListener("click", () => {
    if (S.isLive()) S.closeRoom();
    else S.startRun();
  });
  function drawRecords() {
    const tb = $("#rc-best");
    if (!tb) return;
    tb.innerHTML = DR.aircraft
      .map((p) => {
        const b = DR.best && DR.best[p.id];
        return (
          '<tr data-p="' +
          p.id +
          '" tabindex="0" title="' +
          esc(p.name) +
          '"' +
          (p.id === DR.aircraftId ? ' class="mine"' : "") +
          "><td>" +
          esc(S.aircraftLabel(p)) +
          "</td><td>" +
          (b == null ? "–" : S.fmtT(b)) +
          "</td></tr>"
        );
      })
      .slice(0, 10)
      .join("");
    const b = bestOverall(),
      r = S.lastResult;
    const bv = $("#rc-best-v");
    bv.textContent = b == null ? "No time yet" : S.fmtT(b);
    bv.classList.toggle("none", b == null);
    const bc = $("#rc-best-c");
    bc.classList.toggle("new", !!(r && r.isBest));
    bc.textContent =
      b == null
        ? "Finish all five rounds"
        : r && r.isBest
          ? "Record"
          : "Best on this computer";
    $("#rc-who").textContent = S.aircraftLabel(DR.aircraftId);
    $("#rc-sorties").textContent = String(DR.sorties || 0);
    if (r) {
      const tot = r.total != null ? r.total : r.time;
      $("#rc-last-v").textContent = S.fmtT(tot);
      $("#rc-last-v").classList.remove("none");
      $("#rc-last-c").textContent =
        (r.rank ? "Rank " + r.rank + " · " : "") +
        S.aircraftLabel(r.aircraft || DR.aircraftId);
      $("#rc-splits").innerHTML = (r.splits || [])
        .map(
          (s, i) =>
            "<span>" +
            (i === 4 ? "F" : "R" + (i + 1)) +
            "<b>" +
            (+s).toFixed(1) +
            "</b></span>",
        )
        .join("");
    }
    $("#rc-fly").querySelector("span").textContent = S.isLive()
      ? "Back to the Game"
      : r || DR.sorties > 0
        ? "Fly Again"
        : "Banner Run";
    // no "again" before a first run
    if (window.LBUI) LBUI.board();
  }

  /* ================= HOW TO FLY: the how-to card's content, a pictogram per input (our drawings) ================= */
  const key = (x, y, w, t, h, fs) =>
    '<g><rect x="' +
    x +
    '" y="' +
    (y + 3) +
    '" width="' +
    w +
    '" height="' +
    (h || 24) +
    '" rx="6" fill="#7FA6CF"/><rect x="' +
    x +
    '" y="' +
    y +
    '" width="' +
    w +
    '" height="' +
    (h || 24) +
    '" rx="6" fill="#fff" stroke="#5F86B5" stroke-width="2"/>' +
    '<text x="' +
    (x + w / 2) +
    '" y="' +
    (y + (h || 24) / 2 + (fs || 12) * 0.36) +
    '" text-anchor="middle" font-family="Isle Label,sans-serif" font-weight="800" font-size="' +
    (fs || 12) +
    '" fill="#3D5378">' +
    t +
    "</text></g>";
  const PICT = {
    keys:
      '<svg viewBox="0 0 220 140">' +
      key(58, 18, 28, "W") +
      key(26, 48, 28, "A") +
      key(58, 48, 28, "S") +
      key(90, 48, 28, "D") +
      key(26, 82, 92, "SPACE", 24, 11) +
      key(124, 82, 46, "SHIFT", 24, 10) +
      '<rect x="160" y="16" width="44" height="62" rx="22" fill="#fff" stroke="#5F86B5" stroke-width="2.5"/><path d="M182 16v24M160 40h44" stroke="#5F86B5" stroke-width="2"/><path d="M182 18a20 20 0 0 1 20 20h-20z" fill="#78DCF9"/></svg>',
    touch:
      '<svg viewBox="0 0 220 140"><rect x="30" y="22" width="160" height="96" rx="14" fill="#fff" stroke="#5F86B5" stroke-width="3"/><rect x="42" y="32" width="136" height="76" rx="6" fill="#78DCF9"/>' +
      '<circle cx="72" cy="84" r="16" fill="#fff" opacity=".9"/><circle cx="72" cy="84" r="7" fill="#2B6FA8"/><circle cx="150" cy="78" r="12" fill="#F28A12" stroke="#fff" stroke-width="3"/><circle cx="128" cy="92" r="9" fill="#fff" stroke="#2B6FA8" stroke-width="2.5"/></svg>',
    tilt:
      '<svg viewBox="0 0 220 140"><g transform="rotate(-14 110 74)"><rect x="40" y="40" width="140" height="68" rx="12" fill="#fff" stroke="#5F86B5" stroke-width="3"/><rect x="52" y="49" width="116" height="50" rx="5" fill="#78DCF9"/>' +
      '<path d="M96 76c0-3 3-5 8-5h18c5 0 8 2 9 4-1 2-4 4-9 4h-18c-5 0-8-1-8-3z" fill="#F28A12"/></g><path d="M30 46c-8 18-8 40 2 56M190 46c8 18 8 40-2 56" fill="none" stroke="#2B6FA8" stroke-width="4" stroke-linecap="round"/><path d="M26 98l7 8 5-10M194 50l-7-8-5 10" fill="none" stroke="#2B6FA8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const HOW = [
    [
      "keys",
      "Keyboard and mouse",
      [
        ["Climb / dive", "W  S  or  ↑ ↓"],
        ["Bank and turn", "A  D  or  ← →"],
        ["Fire", "Space or click"],
        ["Boost / brake", "Shift  /  X"],
        ["Special", "F"],
        ["Pause", "Esc"],
      ],
    ],
    [
      "touch",
      "Touch",
      [
        ["Climb / dive", "stick up / down"],
        ["Turn", "stick left / right"],
        ["Fire", "hold A"],
        ["Boost", "hold B"],
        ["Pause", "the pause key"],
      ],
    ], // Simple steering, the touch default (round 4)
    [
      "tilt",
      "Tilt",
      [
        ["Turn", "twist the phone"],
        ["Climb", "lift the top edge"],
        ["Fire", "thumb on A"],
        ["Set up", "turn on TILT"],
      ],
    ],
  ];
  if ($("#howto")) {
    // the How to Fly tab of the phone sheet and the tablet page (layout audit L-08); the handheld shows its own diagram (#m-c1) instead of the cards
    const howB = $("#howto .room-b");
    $("#howto").insertAdjacentHTML(
      "afterbegin",
      head("howto", "How to Fly", "Banner Run", "keys"),
    );
    howB.insertAdjacentHTML(
      "beforeend",
      '<div class="hw">' +
        HOW.map(
          (h) =>
            '<div class="hw-c"><span class="hw-p">' +
            PICT[h[0]] +
            "</span><h3>" +
            h[1] +
            '</h3><dl class="hw-k">' +
            h[2]
              .map((r) => "<dt>" + r[0] + "</dt><dd>" + esc(r[1]) + "</dd>")
              .join("") +
            "</dl></div>",
        ).join("") +
        "</div>" +
        '<p class="hw-rule">Shoot each banner off its plane. Five banners. Fastest time wins.</p>',
    );
    $("#howto").insertAdjacentHTML(
      "beforeend",
      foot(goBtn("hw-fly", "Banner Run")),
    );
    $("#hw-fly").addEventListener("click", () => {
      if (S.isLive()) S.closeRoom();
      else S.startRun();
    });
  }

  /* ================= ABOUT: credits, version, the truthful-content notes, the earlier editions ================= */
  $("#about").innerHTML =
    head("about", "About", "Slop Skies 0.7.0", "star") +
    '<div class="room-b"><div class="ab"><div class="card-n"><h3>Slop Skies 0.7.0</h3>' +
    "<p>Startups hire planes to tow their adverts over San Francisco. Fly for the Fog City Aces over a toy San Francisco and shoot the banners off all five. The clock counts up; the fastest total wins.</p>" +
    '<p>© 2026 Slop Skies. <b>Made by</b> <a href="https://jewk.es" target="_blank" rel="noopener">Donald</a>. <b>Music:</b> <span id="ab-music">our own original score</span>.</p>' + // style audit S20: site.8845c1b17855fc43.js musicCredit() says what plays (the footer no longer carries it: client note 10 Oct)
    "<p><b>Made with</b> three.js r128 (MIT). Fonts: Saira, M PLUS 1p, Source Sans 3, Nunito and Montserrat (SIL Open Font License 1.1), self-hosted.</p>" +
    "<p>The five banners are real: their wording is set in our own lettering, no logos are used, and none of the companies is affiliated with this game. The sightings come from press coverage. No trackers, no ads (except the five we shoot down).</p>" +
    '</div><div class="ed">' +
    '<a class="ed-b" href="/fleet/" data-notice="fleet" style="background-image:url(assets/8845c1b17855fc43/isle/tile-fleet.jpg)"><canvas aria-hidden="true"></canvas><b>Fleet Week</b><em>slop.inc/fleet</em></a>' +
    '<a class="ed-b" href="/og/" data-notice="og" style="background-image:url(assets/8845c1b17855fc43/isle/tile-og.jpg)"><canvas aria-hidden="true"></canvas><b>The Original</b><em>slop.inc/og</em></a>' +
    "</div></div></div>" +
    foot("");
  let edLive = false;
  function liveEd() {
    if (edLive) return;
    edLive = true;
    const c = $$(".ed-b canvas");
    S.live(
      c[0],
      {
        type: "plane",
        kind: "superhornet",
        yaw: 2.3,
        pitch: 0.14,
        roll: 0.35,
      },
      2,
    );
    S.live(
      c[1],
      {
        type: "tug",
        id: "monaco",
        yaw: 2.2,
        pitch: 0.08,
        roll: 0.1,
      },
      2,
    );
  }

  /* ================= show, keys, refresh ================= */
  function show(id) {
    if (id === "hangar") {
      pick = DR.aircraftId;
      drawHangar();
    }
    if (id === "targets") {
      liveRows();
      drawTargets();
    }
    if (id === "records") drawRecords();
    if (id === "about") liveEd();
  }
  function roomKey(room, dx) {
    if (room === "hangar" && dx) {
      step(dx);
      return true;
    }
    return false;
  }
  function refresh() {
    if (!$("#hangar").hidden || S.compact) drawHangar();
    drawTargets();
    drawRecords();
    refreshTiles();
    if (S.compact) {
      liveRows();
      liveEd();
    }
  }
  window.SITEPAGES = {
    refresh,
    show,
    key: roomKey,
    fitLabels,
  };
  liveTiles();
  refresh();
  if (document.fonts) document.fonts.ready.then(() => S.sizeLive());
})();
