/* SLOP SKIES · island edition: the leaderboard UI. Same logic as Site C2 v15b, new look (the ready card and stamp-row pills):
   1. NAME ENTRY as a sport-room panel over the results, inside the stage (#dock #lb-entry; on phones, at the top of the sheet), on 'result':
      10 slots, the A–Z / 0–9 grid, Enter saves, Esc skips; an estimated rank, then the real one and five rows of the board.
      CP22 · Top 10 only (client, CP19): the entry opens only for a run that would place in the overall TOP 10 (LB.qualify);
      a slower run gets a short card instead (TOP 10 IS AT 00:24.1 — FLY AGAIN, the board's 1st, 2nd and 10th, and where this run
      would land, not saved). Fewer than 10 saved times: every run qualifies. Board unreachable or slow (3 s): the entry opens as before.
   2. TOP 10 in the RECORD page's hook #lb-top10. The BEST TIME rows beside it are the per-aircraft tabs (click a aircraft; ALL resets).
   3. The parts list's RECORDER row shows the fastest saved time while you are not flying.
   Uses window.LB (leaderboard.8845c1b17855fc43.js), window.SITE (site.8845c1b17855fc43.js) and window.DR. Nothing here invents a score. */
(function () {
  "use strict";
  const S = window.SITE,
    DR = window.DR,
    LB = window.LB;
  if (!S || !DR || !LB) return;
  const $ = (s) => document.querySelector(s),
    body = document.body;
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const pad = (n, w) => String(Math.max(0, Math.round(n))).padStart(w, "0");
  const dg = (s) =>
    esc(s).replace(/[0-9]+/g, (m) => '<span class="dg">' + m + "</span>");
  // names: digits in the numeral face (site.8845c1b17855fc43.css .dg)
  const ord = (n) =>
    n == null
      ? "1000+"
      : n +
        (n % 100 >= 11 && n % 100 <= 13
          ? "th"
          : ["th", "st", "nd", "rd"][n % 10] || "th");
  // 1st, 2nd (style audit S12: not 1ST)
  const day = (ts) => {
    const d = new Date(ts);
    return pad(d.getMonth() + 1, 2) + "." + pad(d.getDate(), 2);
  };
  const callOf = (id) => {
    const p = (DR.aircraft || []).find((x) => x.id === id);
    return p ? S.aircraftLabel(p) : String(id || "").toUpperCase();
  };
  const blip = (k) => {
    try {
      S.blip(k);
    } catch (e) {}
  };
  const SRC = {
    worker: ["Global"],
    artifact: ["Shared"],
    local: ["This computer"],
  };
  const WHERE = {
    worker: "Saves to the Slop Skies server",
    artifact: "Saves to this page",
    local: "Saves on this computer",
  };
  const NOTE = {
    worker: [
      "",
      "Saved names and times are kept on the Slop Skies server. No account needed. Names are checked for inappropriate language with Cloudflare AI. A temporary cookie protects score submissions; a daily IP hash limits abuse.",
    ],
    artifact: ["", "This board is shared by everyone who can open this page."],
    local: [
      "",
      "Saved names and times are kept on this computer only. Nothing is sent anywhere.",
    ],
  };
  const ERR = {
    name: "Names are 3 to 10 letters, numbers or spaces.",
    name_blocked: "Please pick another name.",
    duplicate: "This run is already saved.",
    moderation_unavailable: "The name check is busy. Please try again.",
    run_invalid: "This run could not be checked. Fly again!",
    rate: "Too many saves. Try again soon.",
    full: "The board is full.",
    storage: "This browser will not store it.",
    total: "A run must take 20 seconds to 30 minutes.",
    splits: "The round times do not add up.",
    build: "This build cannot save here.",
    aircraft: "Unknown aircraft.",
    runId: "The game sent no run id.",
    origin: "Saving only works on the Slop Skies site.",
  };
  const errText = (code) =>
    ERR[code] || "This run can't be saved (" + String(code || "error") + ").";

  /* ================= 1. NAME ENTRY (in the TELEMETRY module) ================= */
  const host = $("#lb-entry");
  if (!host) return;
  const KEYS = ["ABCDEFGHIJKLM", "NOPQRSTUVWXYZ", "0123456789"];
  host.setAttribute("role", "group");
  host.setAttribute("aria-label", "Name entry");
  host.innerHTML =
    '<div id="lbe-form">' +
    '<div class="lbe-slots"><b>Enter your name</b><span class="lbe-cells" id="lbe-cells"></span><em id="lbe-est"></em>' +
    '<input id="lbe-name" type="text" maxlength="10" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done" inputmode="text" pattern="[A-Za-z0-9 ]*" aria-label="Your name: 3 to 10 letters, numbers or spaces"></div>' +
    '<div class="lbe-keys" id="lbe-keys" aria-label="Letters">' +
    KEYS.map(
      (row, i) =>
        "<div>" +
        row
          .split("")
          .map(
            (ch) =>
              '<button type="button" tabindex="-1" data-k="' +
              ch +
              '">' +
              ch +
              "</button>",
          )
          .join("") +
        (i === 2
          ? '<button type="button" tabindex="-1" data-k=" " class="w" aria-label="Space">SP</button><button type="button" tabindex="-1" data-k="DEL" class="w" aria-label="Delete">DEL</button>'
          : "") +
        "</div>",
    ).join("") +
    "</div>" +
    '<div class="lbe-act"><button type="button" class="lbe-btn lbe-go" id="lbe-save">Save <kbd>Enter</kbd></button>' +
    '<button type="button" class="lbe-btn" id="lbe-skip">Skip <kbd>Esc</kbd></button><span class="lbe-src" id="lbe-src"></span></div>' +
    '<p class="lbe-msg" id="lbe-msg" aria-live="polite"></p>' +
    "</div>" +
    '<div id="lbe-done" hidden>' +
    '<div class="lbe-ok"><b>Saved!</b><b class="lbe-nm" id="lbe-nm"></b><span id="lbe-r"></span></div>' +
    '<ol class="lbe-mini" id="lbe-mini"></ol>' +
    '<div class="lbe-act"><button type="button" class="lbe-btn lbe-go" id="lbe-board">Top 10 ›</button>' +
    '<button type="button" class="lbe-btn" id="lbe-close">Close <kbd>Esc</kbd></button><span class="lbe-src" id="lbe-dnote"></span></div>' +
    '<p class="lbe-msg bad" id="lbe-dmsg"></p>' +
    "</div>" +
    '<div id="lbe-miss" style="display:flex;flex-direction:column;gap:4px" hidden>' +
    '<div class="lbe-ok"><b>The Top 10 starts at</b><b class="lbe-nm" id="lbe-cut"></b><span>Fly again!</span></div>' +
    '<ol class="lbe-mini" id="lbe-mmini"></ol>' +
    '<div class="lbe-act"><button type="button" class="lbe-btn lbe-go" id="lbe-mboard">Top 10 ›</button>' +
    '<span class="lbe-src" id="lbe-mnote"></span></div>' +
    '<p class="lbe-msg" id="lbe-mmsg">Name entry is for the Top 10 only.</p>' +
    "</div>";
  host.hidden = true;
  const input = $("#lbe-name"),
    cells = $("#lbe-cells");
  cells.innerHTML = Array.from(
    {
      length: 10,
    },
    (_, i) => "<i" + (i < 3 ? ' class="min"' : "") + "></i>",
  ).join("");
  let run = null,
    mode = "",
    busy = false,
    runErr = "";

  function setMsg(id, txt, bad) {
    const m = $(id);
    m.classList.toggle("bad", !!bad);
    m.textContent = txt || "";
  }
  function drawCells() {
    const v = input.value,
      at = Math.min(v.length, 9);
    Array.from(cells.children).forEach((c, i) => {
      c.textContent = v[i] && v[i] !== " " ? v[i] : "";
      c.classList.toggle("sp", v[i] === " ");
      c.classList.toggle("d", /[0-9]/.test(v[i] || ""));
      c.classList.toggle("cur", mode === "form" && i === at && v.length < 10);
      c.classList.toggle("full", i < v.length);
    });
    $("#lbe-save").disabled = busy || !!runErr || LB.cleanName(v).length < 3;
  }
  function type(k) {
    if (mode !== "form" || busy) return;
    input.value =
      k === "DEL" ? input.value.slice(0, -1) : LB.keepName(input.value + k);
    setMsg("#lbe-msg", runErr ? errText(runErr) : "", !!runErr);
    drawCells();
    blip("click");
  }
  function show(on) {
    host.hidden = !on;
    body.classList.toggle("lb-on", on);
  }
  function open(r, est) {
    const total = typeof r.total === "number" ? r.total : r.time;
    run = {
      aircraft: r.aircraft,
      total,
      splits: (r.splits || []).slice(),
      build: r.build,
      runId: r.runId,
      report: {
        kills: r.kills,
        flags: r.flags,
        wall: r.wall,
        shots: r.shots,
        hits: r.hits,
      },
    };
    runErr = LB.checkRun(run);
    $("#lbe-est").textContent = "";
    $("#lbe-form").hidden = false;
    $("#lbe-done").hidden = true;
    $("#lbe-miss").hidden = true;
    mode = "form";
    busy = false;
    input.value = LB.keepName(LB.lastName());
    show(true);
    setMsg(
      "#lbe-msg",
      runErr
        ? errText(runErr)
        : window.GB && GB.on
          ? "Tap 3 to 10 letters. A saves, B deletes."
          : "Type 3 to 10 letters, numbers or spaces.",
      !!runErr,
    );
    LB.ready.then((b) => {
      $("#lbe-src").textContent = WHERE[b] || WHERE.local;
    });
    drawCells();
    focusName();
    if (typeof est === "string") {
      $("#lbe-est").textContent = est;
      return;
    }
    // the Top 10 gate already knows the rank
    const id = run.runId;
    // estimated rank: where this time would land among the fastest 50
    if (!runErr)
      LB.top({
        limit: 50,
      }).then((res) => {
        if (!run || run.runId !== id || mode !== "form" || !res.ok) return;
        const n = res.rows.filter((x) => x.total <= total).length + 1;
        $("#lbe-est").textContent =
          (res.rows.length >= 50 && n > 50 ? "50+" : ord(n)) + " if saved";
      });
  }
  // the Top 10 gate: ask the board first; only a run that would place in the overall TOP 10 opens the entry
  let gating = "";
  const estText = (q) => (q.rank == null ? "50+" : ord(q.rank)) + " if saved";
  function gate(r) {
    const total = typeof r.total === "number" ? r.total : r.time,
      id = r.runId;
    gating = id;
    LB.qualify(total)
      .catch(() => ({
        ok: false,
        qualifies: true,
      }))
      .then((q) => {
        if (gating !== id) return;
        gating = "";
        if (!q.qualifies) miss(r, total, q);
        else
          open(
            r,
            q.ok &&
              !LB.checkRun(
                Object.assign({}, r, {
                  total,
                }),
              )
              ? estText(q)
              : undefined,
          );
        sheetOn();
      });
  }
  // phones: the entry used to open in the handheld's menu sheet (the site's tabs over the results); since the CP24 verify it sits in the
  // handheld's own screen, over the picture, so nothing opens the sheet any more
  function sheetOn() {}
  function miss(r, total, q) {
    run = null;
    busy = false;
    mode = "miss";
    $("#lbe-form").hidden = true;
    $("#lbe-done").hidden = true;
    $("#lbe-miss").hidden = false;
    show(true);
    if (document.activeElement === input) input.blur();
    $("#lbe-cut").textContent = S.fmtT(q.cut);
    $("#lbe-mnote").textContent =
      (SRC[q.backend] || SRC.local)[0] + " · " + pad(q.count, 3);
    const me = {
      id: "",
      name: "You (not saved)",
      aircraft: r.aircraft,
      total: Math.round(total * 10) / 10,
      rank: q.rank,
      me: true,
      gap: true,
    };
    const rows = q.rows.slice(0, 2).concat([
      Object.assign({}, q.rows[LB.TOP_N - 1], {
        gap: true,
      }),
      me,
    ]);
    $("#lbe-mmini").innerHTML = rows
      .map(
        (x) =>
          '<li class="' +
          (x.me ? "me" : "") +
          (x.gap ? " gap" : "") +
          '"><b>' +
          (x.rank == null ? "50+" : ord(x.rank)) +
          '</b><span class="lbe-mn">' +
          dg(x.name) +
          "</span><span>" +
          esc(callOf(x.aircraft)) +
          "</span><i>" +
          S.fmtT(x.total) +
          "</i></li>",
      )
      .join("");
  }
  const touchy = () => body.classList.contains("touch");
  // phones: the keyboard opens only when the slots are tapped, never from the letter grid
  // the entry is a panel in the stage (site.8845c1b17855fc43.css #dock): bring the stage into view and focus the name (verifier: it opened unseen)
  function focusName(force) {
    if (touchy() && force !== true) return;
    if (mode === "form" && !body.classList.contains("on-page")) {
      if (S.toStage && !S.compact) S.toStage();
      try {
        input.focus();
      } catch (e) {}
    }
  }
  function close() {
    gating = "";
    if (!mode) return;
    mode = "";
    show(false);
    if (document.activeElement === input) input.blur();
    if (!body.classList.contains("on-page")) DR.cmd("focus");
  }
  async function save() {
    if (mode !== "form" || busy || !run) return;
    const c = LB.check(
      Object.assign(
        {
          name: input.value,
        },
        run,
      ),
    );
    if (!c.ok) {
      setMsg("#lbe-msg", errText(c.error), true);
      blip("close");
      focusName();
      return;
    }
    busy = true;
    drawCells();
    setMsg("#lbe-msg", "Checking the name…");
    const res = await LB.submit(
      Object.assign(
        {
          name: input.value,
        },
        run,
      ),
    );
    busy = false;
    if (!res.ok) {
      setMsg("#lbe-msg", errText(res.error), true);
      drawCells();
      blip("close");
      focusName();
      return;
    }
    blip("start");
    showDone(res);
  }
  async function showDone(res) {
    mode = "done";
    $("#lbe-form").hidden = true;
    $("#lbe-done").hidden = false;
    $("#lbe-miss").hidden = true;
    if (document.activeElement === input) input.blur();
    const e = res.entry;
    $("#lbe-nm").innerHTML = dg(e.name);
    $("#lbe-r").textContent =
      ord(res.rank) +
      " of " +
      res.of +
      " · " +
      callOf(e.aircraft) +
      " " +
      ord(res.aircraftRank) +
      " of " +
      res.aircraftOf;
    $("#lbe-dnote").textContent = (SRC[res.backend] || SRC.local)[0];
    setMsg(
      "#lbe-dmsg",
      res.fellBack
        ? "The server could not be reached, so it is kept on this computer."
        : "",
      !!res.fellBack,
    );
    const t = await LB.top({
      limit: 10,
    });
    if (mode !== "done") return;
    let rows = t.ok ? t.rows : [];
    const i = rows.findIndex((r) => r.id === e.id);
    if (i < 0)
      rows = rows.slice(0, 3).concat([
        Object.assign({}, e, {
          rank: res.rank,
          mine: true,
          gap: true,
        }),
      ]);
    else
      rows =
        i < 4
          ? rows.slice(0, 4)
          : rows.slice(0, 3).concat([
              Object.assign({}, rows[i], {
                gap: true,
              }),
            ]);
    $("#lbe-mini").innerHTML = rows
      .map(
        (r) =>
          '<li class="' +
          (r.id === e.id ? "me" : "") +
          (r.gap ? " gap" : "") +
          '"><b>' +
          ord(r.rank) +
          '</b><span class="lbe-mn">' +
          dg(r.name) +
          "</span><span>" +
          esc(callOf(r.aircraft)) +
          "</span><i>" +
          S.fmtT(r.total) +
          "</i></li>",
      )
      .join("");
    try {
      $("#lbe-board").focus({
        preventScroll: true,
      });
    } catch (err) {}
  }

  input.addEventListener("input", () => {
    const v = LB.keepName(input.value);
    if (v !== input.value) input.value = v;
    if (!runErr) setMsg("#lbe-msg", "");
    drawCells();
  });
  input.addEventListener("keydown", (e) => {
    if (e.code === "Enter" || e.code === "NumpadEnter" || e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      save();
    } else if (e.code === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      blip("close");
    }
  });
  input.addEventListener("blur", () => setTimeout(drawCells, 0));
  $("#lbe-keys").addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) e.preventDefault();
  });
  // keep the caret in the name
  $("#lbe-keys").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-k]");
    if (b) {
      type(b.dataset.k);
      if (touchy() && document.activeElement === input) input.blur();
      focusName();
    }
  });
  $(".lbe-slots").addEventListener("click", () => {
    if (!(window.GB && GB.on)) focusName(true);
  });
  // the handheld types with the letter grid and its keys, no OS keyboard over the shell
  {
    const dk = $("#dock");
    if (dk)
      dk.addEventListener("click", (e) => {
        if (e.target === dk && mode === "miss") {
          close();
          blip("close");
        }
      });
  }
  // the "not in the Top 10" card closes on a tap beside it
  $("#lbe-save").addEventListener("click", save);
  $("#lbe-skip").addEventListener("click", () => {
    close();
    blip("close");
  });
  $("#lbe-close").addEventListener("click", () => {
    close();
    blip("close");
  });
  $("#lbe-board").addEventListener("click", () => {
    close();
    tab = "all";
    S.go("record");
    blip("click");
  });
  $("#lbe-mboard").addEventListener("click", () => {
    close();
    tab = "all";
    S.go("record");
    blip("click");
  });
  // while the entry is open on the TOP page it takes the keyboard (the arcade way): letters, digits, space, delete, Enter, Esc
  addEventListener(
    "keydown",
    (e) => {
      if (
        !mode ||
        mode === "miss" ||
        body.classList.contains("on-page") ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      // the miss card leaves the keys to the game (Enter = FLY AGAIN)
      if (
        e.target === input ||
        (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
      )
        return;
      const k = e.code;
      // the "Saved!" card (TOP10-1): Enter / Space on its focused button presses that button and nothing else (it used to reach the game too,
      // whose final menu then started Play Again); elsewhere Enter, Space or Esc closes the card. Either way the game never sees the key
      if (mode === "done") {
        if (/^(Escape|Enter|NumpadEnter|Space)$/.test(k)) {
          e.stopPropagation();
          const btn =
            e.target &&
            e.target.closest &&
            e.target.closest("#lb-entry button");
          if (k === "Escape" || !btn) {
            e.preventDefault();
            close();
            blip("close");
          }
        }
        return;
      }
      if (k === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        blip("close");
        return;
      }
      if (k === "Enter" || k === "NumpadEnter") {
        e.preventDefault();
        e.stopPropagation();
        save();
        return;
      }
      if (k === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        type("DEL");
        focusName();
        return;
      }
      if (/^(Key[A-Z]|Digit[0-9]|Space)$/.test(k)) {
        e.preventDefault();
        e.stopPropagation();
        type(k === "Space" ? " " : k.slice(-1));
        focusName();
      }
    },
    true,
  );
  // round 2: on the desktop stage the entry waits for the final menu (the engine's 'resultmenu', after Next; bible §10.8), so it never
  // covers Finish or the Flight Record; an engine without that event opens it after 15 s. CP24 verify: the phone's handheld waits for it
  // too and shows the entry in its own screen (handheld.8845c1b17855fc43.js moves #dock there), so the results never bring back the site menu and never
  // show two prompts at once; only the narrow-window page without the handheld still opens it at once, in its page flow.
  let pendR = null,
    pendT = 0;
  DR.on("result", (r) => {
    if (!r || !r.runId || LB.isMine(r.runId)) return;
    if (S.compact && !(window.GB && GB.on)) {
      gate(r);
      return;
    }
    pendR = r;
    clearTimeout(pendT);
    pendT = setTimeout(() => {
      if (pendR === r) {
        pendR = null;
        if (DR.state === "result") gate(r);
      }
    }, 15000);
  });
  DR.on("resultmenu", () => {
    const r = pendR;
    if (!r) return;
    pendR = null;
    clearTimeout(pendT);
    gate(r);
  });
  DR.on("state", (now) => {
    if (now !== "result") {
      gating = "";
      pendR = null;
      clearTimeout(pendT);
      close();
    } else if (mode === "form") setTimeout(focusName, 0);
  });
  addEventListener("hashchange", () => setTimeout(focusName, 0));

  /* ================= 2. TOP 10 on the RECORD page (#lb-top10); the BEST TIME rows pick the aircraft ================= */
  let tab = "all",
    token = 0;
  const cache = {};
  function rowsHTML(res) {
    const rows = res && res.ok ? res.rows : [],
      out = [];
    for (let i = 0; i < 10; i++) {
      const r = rows[i];
      if (!r) {
        out.push(
          '<li class="empty"><b>' +
            (i + 1) +
            '</b><span class="lb-nm">----------</span><span class="lb-pl"></span><i>-:--.-</i></li>',
        );
        continue;
      }
      out.push(
        '<li class="' +
          (r.mine ? "mine" : "") +
          (i === 0 ? " first" : "") +
          '" title="' +
          esc(r.name + " · " + callOf(r.aircraft) + " · " + day(r.ts)) +
          '"><b>' +
          r.rank +
          '</b><span class="lb-nm">' +
          dg(r.name) +
          "</span>" +
          '<span class="lb-pl">' +
          (r.mine ? "<em>You</em>" : esc(callOf(r.aircraft))) +
          "</span><i>" +
          S.fmtT(r.total) +
          "</i></li>",
      );
    }
    let msg = "";
    if (!res) msg = "Loading the board…";
    else if (!res.ok) msg = "Can’t reach the board right now.";
    else if (!rows.length)
      msg =
        "No times saved yet" +
        (tab === "all" ? "." : " for the " + esc(callOf(tab)) + ".");
    return (
      out.join("") +
      (msg
        ? '<li class="lb-empty"><b>' +
          msg +
          "</b>" +
          (res && res.ok && !rows.length
            ? "<span>Finish all five rounds, then enter your name.</span>"
            : "") +
          "</li>"
        : "")
    );
  }
  function paint(res) {
    const el = $("#lb-top10");
    if (!el) return;
    el.innerHTML = rowsHTML(res);
    const hd = $("#lb-tab");
    if (hd) {
      hd.textContent =
        tab === "all" ? "All aircraft" : callOf(tab) + " · show all";
      hd.classList.toggle("on", tab !== "all");
    }
    const b = LB.backend,
      cnt = $("#lb-count");
    if (cnt)
      cnt.textContent = b
        ? SRC[b][0] + (res && res.ok ? " · " + res.count + " saved" : "")
        : "";
    document
      .querySelectorAll("#rc-best tr[data-p]")
      .forEach((tr) => tr.classList.toggle("lb-sel", tr.dataset.p === tab));
    const n = $("#lb-note");
    if (n && b) n.textContent = NOTE[b][1];
  }
  function board(force) {
    if (!$("#lb-top10")) return;
    const key = tab,
      c = cache[key];
    paint(c ? c.res : null);
    if (c && !force && Date.now() - c.at < 20000) return;
    const my = ++token;
    LB.top({
      aircraft: tab,
      limit: 10,
    }).then((res) => {
      cache[key] = {
        res,
        at: Date.now(),
      };
      if (my === token && tab === key) paint(res);
    });
  }
  function pick(p) {
    if (p === tab) p = "all";
    tab = p;
    board(true);
    blip("click");
  }
  document.addEventListener("click", (e) => {
    const tr = e.target.closest("#rc-best tr[data-p]");
    if (tr) {
      pick(tr.dataset.p);
      return;
    }
    if (e.target.closest("#lb-tab")) pick("all");
  });
  document.addEventListener("keydown", (e) => {
    const tr = e.target.closest && e.target.closest("#rc-best tr[data-p]");
    if (tr && (e.code === "Enter" || e.code === "Space")) {
      e.preventDefault();
      pick(tr.dataset.p);
    }
  });

  /* ================= 3. the RECORDER row: fastest saved time, out of flight ================= */
  let topRow = null;
  function strip() {
    const el = document.querySelector('[data-live="record"]');
    if (!el || S.isLive()) return;
    // in flight the row shows the clock (site.8845c1b17855fc43.js)
    const txt = topRow ? "1st " + S.fmtT(topRow.total) : "";
    if (el.textContent !== txt) el.textContent = txt;
    const a = el.closest("a");
    if (a) {
      if (topRow)
        a.title =
          "Fastest saved time: " +
          topRow.name +
          " · " +
          callOf(topRow.aircraft) +
          " · " +
          S.fmtT(topRow.total) +
          " (" +
          (SRC[LB.backend] || SRC.local)[0] +
          ")";
      else a.removeAttribute("title");
    }
  }
  function refreshTop() {
    LB.top({
      limit: 1,
    }).then((r) => {
      topRow = (r.ok && r.rows[0]) || null;
      strip();
    });
  }
  DR.on("state", () => setTimeout(strip, 0));
  DR.on("ready", () => setTimeout(strip, 400));

  /* ================= wiring ================= */
  LB.on("change", () => {
    Object.keys(cache).forEach((k) => delete cache[k]);
    refreshTop();
    if (S.page === "record") board(true);
  });
  LB.ready.then(() => {
    refreshTop();
    if (S.page === "record") board(true);
  });
  window.LBUI = {
    board,
    open,
    close,
    refreshTop,
    strip,
    save,
    type,
    skip() {
      close();
      blip("close");
    },
    del() {
      if (mode === "form" && !busy && !input.value) {
        close();
        blip("close");
      } else type("DEL");
    },
    // the handheld's B: delete a letter, or skip when empty
    get mode() {
      return mode;
    },
    get tab() {
      return tab;
    },
  };
})();
