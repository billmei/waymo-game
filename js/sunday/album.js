/* Waymo Care · Sunday Drive · the Postcard Scrapbook. The photos from Photo Mode live in IndexedDB (wc-sunday-photos:
   the full PNG and a small JPEG thumbnail each); the save (js/sunday/main.js) keeps which landmark each postcard is of.
   The scrapbook has three pages: the 37 landmark postcards (taken or still to find), every photo, and the riders'
   thank-you notes. Any photo opens big, with a button to download it as a PNG. */
(function () {
  "use strict";
  const WG = window.WG,
    I = WG.isle,
    D = WG.sundayData,
    AD = WG.adoptData;
  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const Album = { open: false };

  /* ---------- IndexedDB ---------- */
  const DB = "wc-sunday-photos",
    STORE = "photos";
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      try {
        const rq = indexedDB.open(DB, 1);
        rq.onupgradeneeded = () => {
          const d = rq.result;
          if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
        };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => res(null);
        rq.onblocked = () => res(null);
      } catch (e) {
        res(null);
      }
    });
    return dbp;
  }
  function tx(mode, f) {
    return db().then(
      (d) =>
        new Promise((res) => {
          if (!d) return res(null);
          try {
            const t = d.transaction(STORE, mode),
              st = t.objectStore(STORE),
              rq = f(st);
            t.oncomplete = () => res(rq ? rq.result : true);
            t.onerror = t.onabort = () => res(null);
          } catch (e) {
            res(null);
          }
        }),
    );
  }
  Album.put = (rec) => tx("readwrite", (st) => st.put(rec));
  Album.get = (id) => tx("readonly", (st) => st.get(id));
  Album.del = (id) => tx("readwrite", (st) => st.delete(id));
  Album.all = () =>
    tx("readonly", (st) => st.getAll()).then((a) => (a || []).sort((x, y) => (y.at || 0) - (x.at || 0)));
  Album.wipe = () => tx("readwrite", (st) => st.clear());

  // the key a landmark's postcard is saved under: "N1_Lombard_Street"
  Album.markKey = (m) => m.id + "_" + m.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/_+$/, "");

  /* ---------- downloading ---------- */
  Album.download = function (rec) {
    if (!rec || !rec.blob) return;
    const url = URL.createObjectURL(rec.blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "sunday-drive-" + (rec.markName || "snapshot").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase() + "-" + rec.id + ".png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  /* ---------- the scrapbook ---------- */
  // ctx: { S (the save), markOpen(m) → is the landmark's district open, districtName(m), onClose() }
  let ctx = null,
    tab = "postcards",
    urls = [];
  const box = () => $("#sd-book");
  function freeUrls() {
    for (const u of urls) URL.revokeObjectURL(u);
    urls = [];
  }
  Album.show = function (c, which) {
    ctx = c;
    tab = which || tab;
    const b = box();
    b.hidden = false;
    Album.open = true;
    render();
    const x = b.querySelector(".sd-book-x");
    if (x) setTimeout(() => x.focus({ preventScroll: true }), 30);
  };
  Album.close = function () {
    const b = box();
    if (!Album.open) return false;
    b.hidden = true;
    Album.open = false;
    freeUrls();
    if (ctx && ctx.onClose) ctx.onClose();
    return true;
  };
  function render() {
    const b = box(),
      S = ctx.S,
      got = Object.keys(S.postcards).length;
    b.querySelector(".sd-book-tabs").innerHTML = [
      ["postcards", "📮 Postcards " + got + "/" + I.MARKS.length],
      ["photos", "🖼️ Photos"],
      ["notes", "💌 Thank-You Notes " + S.thankYouNotes.length],
    ]
      .map(([k, l]) => '<button type="button" data-tab="' + k + '" aria-pressed="' + (k === tab) + '">' + l + "</button>")
      .join("");
    b.querySelectorAll(".sd-book-tabs button").forEach((e) =>
      e.addEventListener("click", () => {
        WG.audio.sfx("select");
        tab = e.dataset.tab;
        render();
      }),
    );
    const body = b.querySelector(".sd-book-b");
    freeUrls();
    body.scrollTop = 0;
    if (tab === "postcards") postcards(body);
    else if (tab === "photos") photos(body);
    else notes(body);
  }
  function postcards(body) {
    const S = ctx.S;
    body.innerHTML =
      '<p class="sd-book-lead">Frame a landmark nicely in Photo Mode (<kbd>P</kbd>) to add its postcard. Each new one earns a Map Seal; catch a Waymo in the shot for the golden <b>Waymo Spotted!</b> stamp.</p><div class="sd-cards"></div>';
    const grid = body.querySelector(".sd-cards");
    for (const m of I.MARKS) {
      const key = Album.markKey(m),
        pc = S.postcards[key],
        e = document.createElement("button");
      e.type = "button";
      e.className = "sd-pc" + (pc ? " got" : "") + (pc && pc.hasWaymo ? " waymo" : "");
      const open = ctx.markOpen(m);
      e.innerHTML =
        '<span class="sd-pc-img">' +
        (pc ? "" : open ? "<i>?</i>" : "<i>☁️</i>") +
        "</span><b>" +
        esc(m.name) +
        "</b><small>" +
        esc(pc ? pc.capturedAt + " · " + pc.filter : open ? ctx.districtName(m) : "Under the clouds over " + ctx.districtName(m)) +
        "</small>" +
        (pc && pc.hasWaymo ? '<em class="sd-gold" title="Waymo Spotted!">★</em>' : "");
      grid.appendChild(e);
      if (pc && pc.photoId)
        Album.get(pc.photoId).then((rec) => {
          if (rec && rec.thumb) e.querySelector(".sd-pc-img").style.backgroundImage = "url(" + rec.thumb + ")";
        });
      e.addEventListener("click", () => {
        if (pc && pc.photoId) view(pc.photoId);
        else WG.audio.sfx("back");
      });
    }
  }
  function photos(body) {
    body.innerHTML = '<p class="sd-book-lead">Every photo you\'ve taken, newest first.</p><div class="sd-cards"></div>';
    const grid = body.querySelector(".sd-cards");
    Album.all().then((all) => {
      if (!all.length) {
        grid.outerHTML = '<p class="sd-empty">No photos yet. Press <kbd>P</kbd> (or the 📷 button) for Photo Mode.</p>';
        return;
      }
      for (const rec of all) {
        const e = document.createElement("button");
        e.type = "button";
        e.className = "sd-pc got" + (rec.hasWaymo ? " waymo" : "");
        e.innerHTML =
          '<span class="sd-pc-img"></span><b>' +
          esc(rec.markName || "Snapshot") +
          "</b><small>" +
          esc(rec.date + " · " + rec.filter) +
          "</small>" +
          (rec.hasWaymo ? '<em class="sd-gold" title="Waymo Spotted!">★</em>' : "");
        if (rec.thumb) e.querySelector(".sd-pc-img").style.backgroundImage = "url(" + rec.thumb + ")";
        e.addEventListener("click", () => view(rec.id));
        grid.appendChild(e);
      }
    });
  }
  function notes(body) {
    const S = ctx.S;
    if (!S.thankYouNotes.length) {
      body.innerHTML =
        '<p class="sd-empty">No notes yet. Take care of a car by hand (tap one with a bubble, then <b>Take Care</b>) and its rider will write you one.</p>';
      return;
    }
    body.innerHTML =
      '<div class="sd-notes">' +
      S.thankYouNotes
        .slice()
        .reverse()
        .map((n) => {
          const r = AD.RIDERS[n.rider] || { name: "A rider", icon: "💌" };
          return (
            '<div class="sd-note"><span class="sd-note-i">' +
            r.icon +
            "</span><p>“" +
            esc(n.text) +
            "”</p><small>— " +
            esc(r.name) +
            (D.NEEDS[n.job] ? ", after “" + esc(D.NEEDS[n.job].act.toLowerCase()) + "”" : "") +
            "</small></div>"
          );
        })
        .join("") +
      "</div>";
  }
  // one photo, big, with Download and Delete
  function view(id) {
    Album.get(id).then((rec) => {
      if (!rec) return;
      WG.audio.sfx("open");
      const body = box().querySelector(".sd-book-b"),
        url = rec.blob ? URL.createObjectURL(rec.blob) : rec.thumb;
      if (rec.blob) urls.push(url);
      body.innerHTML =
        '<div class="sd-view"><img alt="" /><div class="sd-view-f"><div><b></b><small></small></div><span>' +
        '<button type="button" class="btn tiny" data-a="back">Back</button>' +
        '<button type="button" class="btn tiny" data-a="del">Delete</button>' +
        '<button type="button" class="btn tiny primary" data-a="dl">Download PNG</button></span></div></div>';
      const img = body.querySelector("img");
      img.src = url;
      img.alt = rec.markName ? "Postcard of " + rec.markName : "A snapshot of San Francisco";
      body.querySelector("b").textContent = (rec.markName || "Snapshot") + (rec.hasWaymo ? " ★ Waymo Spotted!" : "");
      body.querySelector("small").textContent = rec.date + " · " + rec.filter + (rec.border && rec.border !== "None" ? " · " + rec.border : "");
      body.querySelector('[data-a="back"]').addEventListener("click", () => {
        WG.audio.sfx("back");
        render();
      });
      body.querySelector('[data-a="dl"]').addEventListener("click", () => {
        WG.audio.sfx("select");
        Album.download(rec);
      });
      const del = body.querySelector('[data-a="del"]');
      del.addEventListener("click", () => {
        if (!del.dataset.sure) {
          del.dataset.sure = "1";
          del.textContent = "Really delete?";
          return;
        }
        Album.del(rec.id).then(() => {
          // a postcard whose photo is gone keeps its place (and its seal), just without the picture
          const S = ctx.S;
          for (const k in S.postcards) if (S.postcards[k].photoId === rec.id) S.postcards[k].photoId = null;
          if (ctx.onChange) ctx.onChange();
          render();
        });
      });
    });
  }

  WG.sundayAlbum = Album;
})();
