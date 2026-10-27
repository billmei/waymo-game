/* SLOP SKIES · island edition site. Talks to the game only through window.DR (design/kit/SHELL_SPEC.md + docs/isle/CONTRACT.md).
   Style bible §11: the stage is the game UI and the page around it is the 2009 website. The engine draws the title, plane select,
   cards, HUD, pause, results and final menu; this file draws the boot cards (§11.2), runs the pages (§11.4, built by pages.8845c1b17855fc43.js; since
   round 2 only the handheld's sheet and the leaderboard open them), the notice and leaving cards, and the transitions between them.
   Round 2 (client, 9 Oct): no main-menu tile screen and no How to fly: the title's Enter / tap goes straight to the engine's plane
   select; the page around the stage is the stage and one small footer line.
   Kept from Site C2: startup.8845c1b17855fc43.js gating (DRStartup.layout/complete), the DR wiring, the phone switch (GB.want / GB.fit). */
(function () {
  "use strict";
  const DR = window.DR,
    $ = (s) => document.querySelector(s),
    $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const body = document.body,
    root = document.documentElement;
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const fmtT = (s) => {
    s = Math.max(0, s || 0);
    const m = Math.floor(s / 60),
      r = s - m * 60;
    return m + ":" + r.toFixed(1).padStart(4, "0");
  };
  const aircraftOf = (id) =>
    DR.aircraft.find((x) => x.id === (id || DR.aircraftId)) || DR.aircraft[0];
  const isLive = () => /play|brief|paused|down/.test(DR.state);
  const flying = () => /play|brief|down/.test(DR.state);
  const curTarget = () => DR.targets.find((t) => t.status === "up");
  const SHORT = {
    superhornet: "F/A-18E",
    f22: "F-22",
    f35b: "F-35B",
    u2: "U-2S",
    c130j: "C-130J",
    p51: "P-51D",
    t6: "T-6A",
    t33: "T-33",
    c27: "C-27J",
    su29: "Su-29",
  }; // the game's own codes (screens.js SHORT, the Select tiles; style audit S12)
  const PROP = { c130j: 1, p51: 1, t6: 1, c27: 1, su29: 1 };
  const aircraftLabel = (p) =>
    SHORT[typeof p === "string" ? p : p.id] || p.name || p.id;
  const roundName = (t) =>
    !t ? "All Clear" : t.round >= 5 ? "Final Round" : "Round " + t.round;
  let lastResult = null;

  /* ---------- the mark: DR.logoSVG when the screens lane provides it (string or function), else our text lockup ---------- */
  function placeLogos() {
    const L = DR.logoSVG;
    let svg = "";
    try {
      const s = typeof L === "function" ? L({ variant: "site" }) : L;
      if (typeof s === "string" && /^\s*<svg[\s>]/.test(s)) svg = s;
    } catch (e) {}
    if (svg)
      $$(".leave-box .logo").forEach((el) => {
        el.innerHTML = svg;
        el.classList.add("svg");
      });
    if (svg)
      $$("#pf .pf-mark").forEach((el) => {
        if (!el.firstChild) el.innerHTML = svg;
      }); // the loader (client 10 Oct: cut the pre-flight card, show the logo and a spinner)
  }
  placeLogos();
  // the music credit (footer and About) follows what actually plays (style audit S20): our own original score, or the audio lane's
  // private placeholder in a preview; it stays hidden until the engine says which, and this edition never credits anyone else's music
  function musicCredit() {
    try {
      const a = DR.audioInfo && DR.audioInfo();
      if (!a || !a.music) return;
      const t =
        a.music === "placeholder"
          ? "private placeholder (preview only)"
          : "our own original score";
      const ab = document.getElementById("ab-music");
      if (ab) ab.textContent = t;
    } catch (e) {}
  }
  musicCredit();
  try {
    DR.on("ready", musicCredit);
    DR.on("state", musicCredit);
  } catch (e) {}

  /* ---------- sound: the game's mute, and the page's UI sounds through the game's own graph (DR.sfx, bible §14.5) ---------- */
  // MUTE-1 (QA 10 Oct): the page used to play its own tones on a second AudioContext, so M (the game's mute) left them sounding and the
  // Sound button out of step. Now every page sound is a DR.sfx call (it follows the game's mute and unlock), and the button follows DR 'mute'
  let soundOn = !DR.muted;
  const BLIP = {
    hover: "hover",
    click: "select",
    start: "select",
    ok: "select",
    back: "back",
    close: "back",
  }; // ui.hover, ui.select, ui.back
  function blip(kind) {
    if (!soundOn) return;
    const n = BLIP[kind];
    if (n && DR.sfx)
      try {
        DR.sfx(n);
      } catch (e) {}
  }
  // keys the site keeps from the engine still count as the gesture that may start the game's sound: the engine starts it on any
  // click on window, and a click dispatched inside a key handler runs with that key's user activation
  function unlockGame() {
    try {
      window.dispatchEvent(new Event("click"));
    } catch (e) {}
  }
  const sndBtn = $("#snd");
  function paintSound() {
    sndBtn.setAttribute("aria-pressed", String(soundOn));
    sndBtn.textContent = soundOn ? "Sound On" : "Sound Off";
    if (window.SITEPAGES) SITEPAGES.refresh();
  }
  function setSound(on) {
    soundOn = on;
    DR.cmd("mute", !on);
    paintSound();
    if (on) blip("click");
  }
  paintSound();
  try {
    DR.on("mute", (m) => {
      soundOn = !m;
      paintSound();
    });
  } catch (e) {} // the M key (or any DR.cmd('mute')) moves the button too
  // like Full Screen, the toggle hands the keys back to the game (a focused button would take the next Enter / Space in flight)
  sndBtn.addEventListener("click", () => {
    setSound(!soundOn);
    if (!CMP && SCREEN === "none") DR.cmd("focus");
  });
  document.addEventListener("mouseover", (e) => {
    const a =
      e.target.closest &&
      e.target.closest("#stage a,#stage button,#stage .tile");
    if (a && !a.contains(e.relatedTarget) && !a.disabled) blip("hover");
  });

  /* ---------- the stage size: 1280×720 scaled to fit the window under the page header, with the strip just in view ---------- */
  const CMP_W = 900;
  let CMP = "",
    TAB = "map";
  const TOUCH = {
    on: !!(
      matchMedia("(pointer: coarse)").matches &&
      (navigator.maxTouchPoints > 0 || "ontouchstart" in window)
    ),
  };
  function setTouch(on) {
    TOUCH.on = on;
    body.classList.toggle("touch", on);
  }
  addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "touch" && !TOUCH.on) setTouch(true);
    },
    { capture: true },
  );
  setTouch(TOUCH.on);
  const ui = $("#ui"),
    flow = $("#flow"),
    rooms = $("#rooms"),
    dock = $("#dock");
  function fit() {
    const w = Math.min(
        innerWidth,
        (window.screen && screen.width) || innerWidth,
      ),
      h = innerHeight; // a phone's layout viewport can start wide; its screen cannot
    const gb = !!(window.GB && GB.want(w, h));
    if (gb || w < CMP_W) {
      fitCompact(w, h, gb);
      return;
    }
    if (CMP) leaveCompact();
    const cw = root.clientWidth || w;
    const ft = $("#foot"),
      fh = ft && ft.offsetHeight > 0 ? ft.offsetHeight : 50,
      u = clamp(Math.min((cw - 48) / 1280, (h - 14 - 26 - fh) / 720), 0.5, 2); // the stage, with room for the footer under it: the page's 14 px top, the footer's 12 + 14 px margins and its measured height (layout audit L-21: the 84 px guess left the page 6 px taller than the window)
    root.style.setProperty("--u", u.toFixed(4));
    DR.cmd("aspect", "16:9");
    sizeLive();
  }
  function fitCompact(w, h, gb) {
    if (!CMP) {
      CMP = "port";
      body.classList.add("phone");
      flow.appendChild(dock);
      flow.appendChild(rooms);
      closeAll(true);
      setTab(TAB, true);
    }
    root.style.setProperty("--u", ((root.clientWidth || w) / 1280).toFixed(4));
    if (!gb) DR.cmd("aspect", "16:9"); // in the handheld the phone lane picks the aspect (4:3 portrait, 16:9 sideways)
    if (window.GB) GB.fit(gb, w, h);
    sizeLive();
  }
  function leaveCompact() {
    CMP = "";
    body.classList.remove("phone");
    ui.insertBefore(rooms, $("#notice"));
    ui.insertBefore(dock, $("#leave"));
    if (window.GB) GB.fit(false);
    DR.cmd("hud", "full");
    syncState();
  }
  function setTab(t, quiet) {
    TAB = t;
    body.dataset.tab = t;
    $$("#ph-bar [data-tab]").forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.tab === t)),
    );
    if (!quiet && CMP && !body.classList.contains("gb"))
      requestAnimationFrame(() =>
        flow.scrollIntoView({
          block: "start",
          behavior: REDUCED ? "auto" : "smooth",
        }),
      );
    if (window.SITEPAGES) SITEPAGES.refresh();
    sizeLive();
  }
  $("#ph-bar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    setTab(b.dataset.tab);
    blip("click");
  });
  addEventListener("resize", fit);
  addEventListener("load", fit);
  addEventListener("orientationchange", () => setTimeout(fit, 120));
  if (window.visualViewport)
    visualViewport.addEventListener("resize", () => {
      if (CMP) fit();
    });

  /* ---------- live 3D pictures (DR.widget) sized to their box at device resolution; the engine draws the ones on screen ---------- */
  const LIVE = [];
  function live(cv, spec, maxDpr) {
    const rec = {
      cv,
      spec: Object.assign({}, spec),
      maxDpr: maxDpr || 1.5,
      h: null,
    };
    LIVE.push(rec);
    sizeOne(rec);
    rec.h = DR.widget(cv, rec.spec);
    return {
      cv,
      get spec() {
        return rec.spec;
      },
      set(n) {
        if (Object.keys(n).every((k) => rec.spec[k] === n[k])) return;
        Object.assign(rec.spec, n);
        if (rec.h) rec.h.set(n);
      },
      destroy() {
        if (rec.h) rec.h.destroy();
        const i = LIVE.indexOf(rec);
        if (i >= 0) LIVE.splice(i, 1);
      },
    };
  }
  function sizeOne(r) {
    const b = r.cv.getBoundingClientRect();
    if (b.width < 8 || b.height < 8) return;
    const k = Math.min(window.devicePixelRatio || 1, r.maxDpr),
      W = Math.round(b.width * k),
      H = Math.round(b.height * k);
    if (W !== r.cv.width || H !== r.cv.height) {
      r.cv.width = W;
      r.cv.height = H;
      if (r.h) r.h.set({});
    }
  }
  function sizeLive() {
    requestAnimationFrame(() =>
      LIVE.forEach((r) => {
        if (r.cv.isConnected) sizeOne(r);
      }),
    );
  }

  /* ---------- the screens the site draws in the stage ---------- */
  let SCREEN = "boot",
    ROOM = null,
    NOTICE = null,
    ready = DR.state !== "boot" && DR.state !== "error";
  const fsCard = $("#fs"),
    pfCard = $("#pf"),
    notice = $("#notice");
  // bible §11.2 transitions: items vanish on the next frame, fade to black 0.40 s linear, hold ≥ 0.30 s, fade in 0.25 s, then the entrance
  const fade = document.createElement("div");
  fade.id = "fade";
  fade.setAttribute("aria-hidden", "true");
  fade.style.cssText =
    "position:absolute;inset:0;z-index:60;background:#000;opacity:0;pointer-events:none";
  ui.appendChild(fade);
  let fadeT = 0;
  function swap(fn, then) {
    clearTimeout(fadeT);
    if (REDUCED || CMP) {
      fn();
      if (then) then();
      return;
    }
    fade.style.pointerEvents = "auto";
    fade.style.transition = "opacity 400ms linear";
    fade.style.opacity = "1";
    fadeT = setTimeout(() => {
      fn();
      fadeT = setTimeout(() => {
        fade.style.transition = "opacity 250ms linear";
        fade.style.opacity = "0";
        fadeT = setTimeout(() => {
          fade.style.pointerEvents = "none";
          if (then) then();
        }, 260);
      }, 300);
    }, 400);
  }
  function hideAllScreens() {
    $$(".room", rooms).forEach((r) => {
      r.hidden = true;
    });
    notice.hidden = true;
  }
  function closeAll(quiet) {
    clearTimeout(fadeT);
    fade.style.opacity = "0";
    fade.style.pointerEvents = "none";
    hideAllScreens();
    ROOM = null;
    NOTICE = null;
    if (SCREEN !== "boot") SCREEN = "none";
    syncState();
  }
  function openRoom(id, how) {
    if (CMP) {
      const t = ($("#" + id) || {}).dataset;
      if (t && t.tab) {
        setTab(t.tab);
        if (window.GB && GB.on) GB.open(t.tab);
      }
      return;
    }
    if (SCREEN === "boot") return;
    if (flying()) DR.cmd("pause");
    const show = () => {
      hideAllScreens();
      const r = $("#" + id);
      if (!r) return;
      r.hidden = false;
      SCREEN = "room";
      ROOM = id;
      syncState();
      if (window.SITEPAGES) SITEPAGES.show(id);
      sizeLive();
      const f =
        r.querySelector("[data-primary]") || r.querySelector(".rf-back");
      if (f)
        try {
          f.focus({ preventScroll: true });
        } catch (e) {}
    };
    if (how === "now") show();
    else swap(show);
    blip("click");
  }
  function closeRoom() {
    blip("back");
    swap(() => {
      hideAllScreens();
      SCREEN = "none";
      ROOM = null;
      syncState();
      DR.cmd("focus");
    });
  }
  const EDITIONS = {
    fleet: {
      href: "/fleet/",
      q: "Fly the Fleet Week 0.6 edition?",
      p: "Ten Fleet Week aircraft over the real San Francisco, in PlayStation-era 3D. It opens at slop.inc/fleet, exactly as it was.",
      pic: "assets/8845c1b17855fc43/isle/tile-fleet.jpg",
      w: {
        type: "plane",
        kind: "superhornet",
        yaw: 2.3,
        pitch: 0.16,
        roll: 0.3,
      },
    },
    og: {
      href: "/og/",
      q: "Fly the original Slop Skies?",
      p: "The first edition: five pilots and five ad planes over San Francisco. It opens at slop.inc/og, exactly as it was.",
      pic: "assets/8845c1b17855fc43/isle/tile-og.jpg",
      w: { type: "tug", id: "monaco", yaw: 2.3, pitch: 0.1, roll: 0.1 },
    },
  };
  let ntLive = null,
    noticeFrom = "none";
  function openNotice(id) {
    const ed = EDITIONS[id];
    if (!ed) return;
    if (CMP) {
      location.href = ed.href;
      return;
    }
    if (flying()) DR.cmd("pause");
    noticeFrom = SCREEN === "notice" ? noticeFrom : SCREEN;
    NOTICE = id;
    SCREEN = "notice";
    $("#nt-q").textContent = ed.q;
    $("#nt-p").textContent = ed.p;
    $("#nt-ok").setAttribute("href", ed.href);
    $(".nt-pic").style.backgroundImage = "url(" + ed.pic + ")";
    notice.hidden = false;
    const cv = $(".nt-pic canvas");
    if (!ntLive) ntLive = live(cv, ed.w, 2);
    else ntLive.set(Object.assign({ kind: undefined, id: undefined }, ed.w));
    sizeLive();
    try {
      $("#nt-ok").focus({ preventScroll: true });
    } catch (e) {}
    syncState();
    blip("click");
  }
  function closeNotice() {
    notice.hidden = true;
    NOTICE = null;
    SCREEN = noticeFrom === "notice" ? "none" : noticeFrom;
    syncState();
    blip("back");
    if (SCREEN === "none" && !CMP) DR.cmd("focus");
  }
  $("#nt-no").addEventListener("click", closeNotice);
  notice.addEventListener("click", (e) => {
    if (e.target === notice) closeNotice();
  });

  /* ---------- starting a run ---------- */
  // a page's fly button opens the engine's plane select; the Hangar's "Fly this plane" (fly = true) goes straight to the run
  function startRun(fly) {
    blip("start");
    unlockGame();
    swap(() => {
      hideAllScreens();
      SCREEN = "none";
      syncState();
      const s = DR.state;
      if (fly || s === "select") DR.cmd("fly");
      else if (s === "title" || s === "result") DR.cmd("start");
      DR.cmd("focus");
    });
  }
  function startFlow() {
    const s = DR.state;
    if (SCREEN === "boot") return;
    if (s === "title") {
      startRun();
      return;
    }
    closeAll();
    if (s === "select" || s === "result") {
      DR.cmd("fly");
      blip("start");
    } else if (s === "paused") {
      DR.cmd("resume");
      blip("click");
    } else if (s === "error") {
      location.reload();
      return;
    }
    DR.cmd("focus");
  }
  function toStage() {
    const r = $("#stage").getBoundingClientRect();
    if (r.top < -20 || r.bottom > innerHeight + 20)
      $("#stage").scrollIntoView({
        block: "center",
        behavior: REDUCED ? "auto" : "smooth",
      });
  }
  function go(id) {
    if (id === "record") id = "records";
    if (id === "how") id = "howto";
    if (id === "aircraft" || id === "fleet") id = "hangar";
    if (id === "banners" || id === "map") id = "targets";
    if (id === "play") {
      toStage();
      startFlow();
      return;
    }
    if (id === "title") {
      toStage();
      if (DR.state === "title" && SCREEN !== "boot") closeAll();
      return;
    }
    if ($("#" + id) && $("#" + id).classList.contains("room")) {
      toStage();
      openRoom(id);
    }
  }
  document.addEventListener("click", (e) => {
    const n = e.target.closest("[data-notice]");
    if (n && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      toStage();
      openNotice(n.dataset.notice);
      return;
    }
    const r = e.target.closest("#stage .room [data-room],#flow [data-room]");
    if (r) {
      e.preventDefault();
      go(r.dataset.room);
      return;
    }
    const a = e.target.closest("[data-go]");
    if (!a) return;
    e.preventDefault();
    go(a.dataset.go);
  });

  /* ---------- press links: the 2009 site's "you are leaving" card ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-leave]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey)
      return;
    e.preventDefault();
    if (flying()) DR.cmd("pause");
    $("#leave-p").textContent =
      "You are leaving Slop Skies for " + a.dataset.leave + ".";
    $("#leave-yes").setAttribute("href", a.getAttribute("href"));
    $("#leave").hidden = false;
    toStage();
    $("#leave-no").focus({ preventScroll: true });
    blip("click");
  });
  function closeLeave() {
    $("#leave").hidden = true;
    blip("back");
  }
  $("#leave-no").addEventListener("click", closeLeave);
  $("#leave-yes").addEventListener("click", () =>
    setTimeout(() => {
      $("#leave").hidden = true;
    }, 50),
  );

  /* ---------- boot (bible §11.2): "Fly safe" once per session, then the pre-flight check while the engine still loads ---------- */
  // client 10 Oct: no 'Fasten your seatbelt' card; the loader goes straight to the game. Sound unlocks on the first real key or tap
  // (the engine listens for it), so nothing is lost by skipping the card
  let fsDone = true;
  let lastP = 0;
  function paintLoad(p) {
    lastP = p;
    $("#pf-n").textContent = Math.round(p * 100);
    $$(".pf-slot").forEach((s) => {
      const ok = p >= +s.dataset.at - 1e-6;
      if (ok !== s.classList.contains("ok")) {
        s.classList.toggle("ok", ok);
        s.querySelector(".pf-s").textContent = ok ? "OK!" : "Checking…";
      }
    });
  }
  function bootCards() {
    if (SCREEN !== "boot") return;
    if (CMP) {
      fsCard.hidden = pfCard.hidden = true;
      if (ready) finishBoot();
      return;
    }
    if (!fsDone) {
      fsCard.hidden = false;
      pfCard.hidden = true;
      return;
    }
    fsCard.hidden = true;
    if (!ready) {
      pfCard.hidden = false;
      return;
    }
    finishBoot();
  }
  function dismissFs() {
    if (fsCard.hidden) return;
    fsDone = true;
    try {
      sessionStorage.setItem("isle-flysafe", "1");
    } catch (e) {}
    blip("ok");
    unlockGame();
    fsCard.hidden = true;
    bootCards();
  }
  fsCard.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dismissFs();
  });
  let booted = false;
  function finishBoot() {
    if (booted) return;
    booted = true;
    pfCard.hidden = true;
    fsCard.hidden = true;
    SCREEN = "none";
    body.classList.remove("is-boot");
    if (window.DRStartup) DRStartup.complete();
    syncState();
    sizeLive();
    // the keys belong to the game from here: put focus on the stage (#dr-screen), never on a link of the page around it, so the next
    // Enter goes to Select a Plane / starts the run instead of following whatever link a click or the browser left focused
    if (!CMP) DR.cmd("focus");
    const h = location.hash.slice(1);
    if (
      h &&
      h !== "play" &&
      $("#" + h) &&
      $("#" + h).classList.contains("room")
    )
      setTimeout(() => go(h), 60);
  }
  DR.on("progress", (p) => {
    paintLoad(p);
    if (window.DRStartup) DRStartup.progress(p);
  });
  DR.on("error", () => {
    if (window.DRStartup) DRStartup.fail();
    syncState();
  });
  if (DR.state === "error" && window.DRStartup) DRStartup.fail();
  DR.on("ready", () => {
    paintLoad(1);
    ready = true;
    placeLogos();
    body.classList.add("scene-live");
    /* style audit S06: the pages sit over the live picture, blurred (site.8845c1b17855fc43.css), not the still */ if (
      !(window.GB && GB.on)
    )
      DR.cmd("aspect", "16:9");
    if (SCREEN === "boot") setTimeout(bootCards, pfCard.hidden ? 0 : 350);
  });
  let fontsReady = false,
    layoutReady = false;
  function maybeLayout() {
    if (!fontsReady || document.readyState === "loading" || layoutReady) return;
    fit();
    requestAnimationFrame(() => {
      fit();
      requestAnimationFrame(() => {
        layoutReady = true;
        if (window.DRStartup) DRStartup.layout();
        sizeLive();
        bootCards();
      });
    });
  }
  document.addEventListener("DOMContentLoaded", maybeLayout, { once: true });
  // startup.8845c1b17855fc43.js keeps a slow load visible: show its notice on the pre-flight card too
  setTimeout(() => {
    if (SCREEN === "boot" && !ready)
      $("#pf-m").innerHTML =
        'Still loading <b id="pf-n">' +
        Math.round(lastP * 100) +
        '</b>% · <a href="" style="color:inherit">Reload</a>';
  }, 15000);

  /* ---------- the keyboard: the site's screens take the keys the engine would act on ---------- */
  const NAVK =
    /^(Enter|NumpadEnter|Space|Escape|Backspace|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|KeyW|KeyA|KeyS|KeyD|KeyP|Tab)$/;
  function swallow(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    unlockGame();
  }
  addEventListener(
    "keydown",
    (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || CMP) return;
      if (window.LBUI && LBUI.mode && LBUI.mode !== "miss") return; // the name entry has the keys
      const k = e.code,
        act = document.activeElement;
      if (!$("#leave").hidden) {
        if (k === "Escape") {
          swallow(e);
          closeLeave();
        }
        return;
      }
      if (SCREEN === "boot") {
        if (
          !fsCard.hidden &&
          !/^(Shift|Control|Alt|Meta|CapsLock|Tab)/.test(k)
        ) {
          swallow(e);
          dismissFs();
        } else if (/Enter|Space/.test(k)) swallow(e);
        return;
      }
      if (SCREEN === "none") return; // the title's Enter goes to the engine: straight to Select a Plane (round 2)
      // under a site screen the engine's own letter keys stay off (R restarted and Q quit a
      // paused run under a page); only its global M (mute) and V (radio) still reach it
      if (
        /^(KeyH|Slash|KeyR|KeyQ|KeyI|KeyC|KeyT|KeyF)$/.test(k) &&
        !(
          act &&
          (/^(INPUT|TEXTAREA|SELECT)$/.test(act.tagName) ||
            act.isContentEditable)
        )
      ) {
        swallow(e);
        return;
      }
      if (!NAVK.test(k) || k === "Tab") return;
      swallow(e);
      const back = k === "Escape" || k === "Backspace",
        ok = k === "Enter" || k === "NumpadEnter" || k === "Space";
      const dx =
          k === "ArrowLeft" || k === "KeyA"
            ? -1
            : k === "ArrowRight" || k === "KeyD"
              ? 1
              : 0,
        dy =
          k === "ArrowUp" || k === "KeyW"
            ? -1
            : k === "ArrowDown" || k === "KeyS"
              ? 1
              : 0;
      if (SCREEN === "notice") {
        if (back) closeNotice();
        else if (ok) {
          if (act && notice.contains(act) && act.click) act.click();
          else $("#nt-ok").click();
        } else if (dx) {
          const b = [$("#nt-no"), $("#nt-ok")];
          b[dx < 0 ? 0 : 1].focus({ preventScroll: true });
        }
        return;
      }
      if (SCREEN === "room") {
        const r = $("#" + ROOM);
        if (back) {
          closeRoom();
          return;
        }
        if (ok) {
          if (act && r && r.contains(act) && act.click && act !== r)
            act.click();
          else {
            const p = r && r.querySelector("[data-primary]");
            if (p) p.click();
          }
          return;
        }
        if (window.SITEPAGES && SITEPAGES.key(ROOM, dx, dy)) return;
        if (dx || dy) {
          const f = $$(
            'button:not([disabled]),a[href],[tabindex="0"]',
            r,
          ).filter((x) => x.offsetParent);
          if (!f.length) return;
          const i = f.indexOf(act);
          const n = f[(i + (dx || dy) + f.length) % f.length] || f[0];
          n.focus({ preventScroll: true });
          blip("hover");
        }
      }
    },
    true,
  );

  /* ---------- state ---------- */
  function syncState() {
    const s = DR.state;
    [
      "boot",
      "title",
      "select",
      "brief",
      "play",
      "paused",
      "down",
      "result",
      "error",
    ].forEach((k) => body.classList.toggle("st-" + k, k === s));
    body.classList.toggle("is-live", flying());
    body.classList.toggle("on-page", SCREEN === "room" || SCREEN === "notice");
    if (window.SITEPAGES) SITEPAGES.refresh();
  }
  const splits = {};
  DR.on("state", (now, was) => {
    if (now === "select" || (now === "brief" && was === "select"))
      Object.keys(splits).forEach((k) => delete splits[k]);
    if (SCREEN === "room" && !/paused|title/.test(now)) closeAll();
    if (now === "select" && CMP) setTab("aircraft", true);
    syncState();
  });
  DR.on("aircraft", () => syncState());
  DR.on("round", () => syncState());
  DR.on("kill", (id, split) => {
    splits[id] = split;
    syncState();
  }); // the game plays the banner-down sound itself (MUTE-1: no second kill tone)
  DR.on("result", (r) => {
    lastResult = r;
    syncState();
  });

  /* ---------- boot ---------- */
  DR.cmd("hud", "full"); // the picture carries the whole HUD; the site adds no readouts
  DR.cmd("aspect", "16:9");
  fit();
  syncState();
  const fams = [
    '800 20px "Isle Label"',
    '500 16px "Isle Body"',
    '800 20px "Isle Numerals"',
  ];
  Promise.all(fams.map((f) => document.fonts.load(f, "A1")))
    .catch(() => {})
    .then(() => document.fonts.ready)
    .then(() => {
      fontsReady = true;
      maybeLayout();
    });
  window.SITE = {
    go,
    blip,
    fmtT,
    esc,
    aircraftOf,
    aircraftLabel,
    roundName,
    isLive,
    flying,
    curTarget,
    splits,
    live,
    sizeLive,
    startFlow,
    startRun,
    openRoom,
    closeRoom,
    openNotice,
    toStage,
    PROP,
    SHORT,
    get lastResult() {
      return lastResult;
    },
    get page() {
      return SCREEN === "room"
        ? {
            records: "record",
            hangar: "aircraft",
            targets: "map",
            howto: "how",
            about: "menu",
          }[ROOM] || ROOM
        : CMP
          ? TAB
          : "";
    },
    get screen() {
      return SCREEN;
    },
    get room() {
      return ROOM;
    },
    get compact() {
      return !!CMP;
    },
    get sound() {
      return soundOn;
    },
    setSound,
    _pics: () => ({ live: LIVE.length }),
  };
})();
