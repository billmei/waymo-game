/* Waymo Care · Sunday Drive · Postcard Scrapbook & Album
   Stores high-res postcard photos in IndexedDB (wc-sunday-photos),
   renders the Scrapbook modal with all 37 landmark cards,
   Rider Thank-You Notes, and Free Drive sandbox settings. */
(function () {
  "use strict";
  const WG = window.WG || (window.WG = {});

  const DB_NAME = "wc-sunday-photos";
  const DB_VERSION = 1;
  const STORE_NAME = "photos";

  const LANDMARK_HINTS = {
    M1: "Spanning the golden strait from the Presidio to Marin.",
    N6: "Historic brick fort nestled directly beneath the Golden Gate Bridge.",
    M2: "Three-legged broadcast spire high above the city.",
    M3: "The windy twin summits offering 360-degree views of the bay.",
    M4: "The towering obelisk at the heart of the Transbay transit center.",
    N30: "Gleaming glass skyscraper standing beside Mission Street.",
    N31: "Slender angular tower rising high into the downtown skyline.",
    M5: "The iconic pyramid with towering wings above the Financial District.",
    M14: "Massive dark carnelian granite tower in the Financial District.",
    M6: "Historic clock tower terminal along the Embarcadero waterfront.",
    M7: "Suspension bridge connecting San Francisco to Yerba Buena Island.",
    N25: "Modern white single-tower self-anchored suspension span.",
    M8: "Art deco fluted column atop Telegraph Hill overlooking the bay.",
    M9: "The infamous island fortress isolated in the middle of San Francisco Bay.",
    M10: "The famous row of Victorian postcard houses facing Alamo Square.",
    N0: "Grassy hilltop park with postcard panoramic views of the downtown skyline.",
    M11: "Historic wooden windmill standing among Golden Gate Park's western tulips.",
    N20: "The majestic southern windmill near the Ocean Beach edge.",
    M12: "Vast coastal strand where Pacific breakers meet the Great Highway.",
    M13: "Rugged sea cliffs and historic lighthouse across the Golden Gate.",
    N2: "Monumental Greco-Roman rotunda and lagoon in the Marina district.",
    N3: "Bustling waterfront wooden pier home to barking sea lions.",
    N5: "Brick waterside baseball stadium where home runs splash into McCovey Cove.",
    N12: "Beaux-Arts civic palace with a majestic gilded dome.",
    N13: "Modern waterfront arena along Mission Bay.",
    N17: "Twin Romanesque spires facing Washington Square in North Beach.",
    N15: "Victorian glasshouse glowing with tropical flora in Golden Gate Park.",
    N19: "Monumental concrete cross rising above the city's highest natural peak.",
    N7: "Historic concrete remains of Sutro Baths perched over the rocky surf.",
    N21: "Neoclassical museum perched high above the cliffs of Lincoln Park.",
    N24: "Mile Rock light platform pounded by Pacific ocean swells.",
    N10: "Flat man-made island with skyline views in the middle of the bay.",
    N8: "Colorful floating homes tucked along the Richardson Bay shoreline.",
    N9: "Lush green mountainous island rising from San Francisco Bay.",
    N14: "Peaceful park lake with stone bridges and a cascading waterfall.",
    N1: "The famous crooked red-brick hairpin turns down Russian Hill.",
    N11: "Sailboats and historic vessels gliding across San Francisco Bay."
  };

  const RIDER_AVATARS = {
    GRANDMA: "👵",
    ARTIST: "🎨",
    LOCAL: "🏃",
    TOURIST: "🎒",
    BARISTA: "☕",
    SURFER: "🏄",
    TECHIE: "💻",
    CHEF: "🧑‍🍳",
    HIKER: "🥾",
    MUSICIAN: "🎷"
  };

  let dbInstance = null;
  const photoCache = new Map();

  function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function savePhoto(record) {
    photoCache.set(record.id, record);
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve(record.id);
        tx.onerror = (e) => reject(e.target.error);
      });
    });
  }

  function getPhoto(id) {
    if (photoCache.has(id)) return Promise.resolve(photoCache.get(id));
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) photoCache.set(id, req.result);
          resolve(req.result || null);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    });
  }

  function deletePhoto(id) {
    photoCache.delete(id);
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
      });
    });
  }

  function clearAllPhotos() {
    photoCache.clear();
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
      });
    });
  }

  /* ---------- Album UI Controller ---------- */
  let activeTab = "postcards";
  let lightboxPhoto = null;

  function open(tab) {
    activeTab = tab || "postcards";
    const modal = document.getElementById("sunday-scrapbook");
    if (!modal) return;
    modal.hidden = false;
    render();
    if (WG.game && WG.game.A) WG.game.A.sfx("open");
  }

  function close() {
    const modal = document.getElementById("sunday-scrapbook");
    if (modal) modal.hidden = true;
    closeLightbox();
    if (WG.game && WG.game.A) WG.game.A.sfx("back");
  }

  function switchTab(t) {
    activeTab = t;
    render();
    if (WG.game && WG.game.A) WG.game.A.sfx("select");
  }

  function openLightbox(photo) {
    lightboxPhoto = photo;
    const lb = document.getElementById("sunday-lightbox");
    if (!lb) return;
    lb.hidden = false;
    const img = lb.querySelector(".lb-img");
    const title = lb.querySelector(".lb-title");
    const meta = lb.querySelector(".lb-meta");
    const star = lb.querySelector(".lb-star");

    img.src = photo.dataUrl;
    title.textContent = photo.landmarkName || "San Francisco Postcard";
    meta.textContent = `${photo.capturedAt || "Today"} · Filter: ${photo.filter || "Natural"}`;
    if (star) star.hidden = !photo.hasWaymo;

    const dlBtn = lb.querySelector(".lb-dl");
    if (dlBtn) {
      dlBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = photo.dataUrl;
        const slug = (photo.landmarkName || "postcard").toLowerCase().replace(/[^a-z0-9]+/g, "-");
        a.download = `waymo-sunday-${slug}.png`;
        a.click();
      };
    }
    if (WG.game && WG.game.A) WG.game.A.sfx("select");
  }

  function closeLightbox() {
    lightboxPhoto = null;
    const lb = document.getElementById("sunday-lightbox");
    if (lb) lb.hidden = true;
  }

  function render() {
    const root = document.getElementById("sunday-scrapbook");
    if (!root) return;

    // Update tab bar buttons
    root.querySelectorAll(".sb-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === activeTab);
    });

    const body = root.querySelector(".sb-body");
    if (!body) return;
    body.innerHTML = "";

    const st = WG.sunday ? WG.sunday.state : { postcards: {}, thankYouNotes: [] };

    if (activeTab === "postcards") {
      renderPostcardsTab(body, st);
    } else if (activeTab === "notes") {
      renderNotesTab(body, st);
    } else if (activeTab === "settings") {
      renderSettingsTab(body, st);
    }
  }

  function renderPostcardsTab(container, st) {
    const marks = (WG.isle && WG.isle.MARKS) || [];
    const collectedCount = Object.keys(st.postcards || {}).length;

    const countHeader = document.createElement("div");
    countHeader.className = "sb-section-desc";
    countHeader.innerHTML = `<span>Captured Postcards: <b>${collectedCount}</b> of <b>${marks.length || 37}</b> Landmarks</span><small>Photograph new landmarks across SF to earn Map Seals!</small>`;
    container.appendChild(countHeader);

    const grid = document.createElement("div");
    grid.className = "sb-grid";

    marks.forEach((m) => {
      const card = document.createElement("div");
      card.className = "sb-card";
      const saved = st.postcards && st.postcards[m.id];

      if (saved) {
        card.classList.add("unlocked");
        card.innerHTML = `
          <div class="sb-thumb-wrap">
            <div class="sb-thumb-loading">Loading...</div>
            <img class="sb-thumb" alt="${m.name}" style="display:none;" />
            ${saved.hasWaymo ? '<div class="sb-star-badge" title="Waymo Spotted!">★</div>' : ""}
          </div>
          <div class="sb-card-info">
            <b>${m.name}</b>
            <small>${saved.filter || "Natural"} · ${saved.capturedAt || ""}</small>
          </div>
        `;
        const img = card.querySelector(".sb-thumb");
        const loading = card.querySelector(".sb-thumb-loading");
        getPhoto(saved.photoId).then((rec) => {
          if (rec && rec.dataUrl) {
            img.src = rec.dataUrl;
            img.style.display = "block";
            loading.style.display = "none";
          }
        });

        card.onclick = () => {
          getPhoto(saved.photoId).then((rec) => {
            if (rec) openLightbox(rec);
          });
        };
      } else {
        card.classList.add("locked");
        const hint = LANDMARK_HINTS[m.id] || "Look for this landmark while cruising through San Francisco.";
        card.innerHTML = `
          <div class="sb-thumb-wrap locked-wrap">
            <div class="sb-lock-icon">📷</div>
          </div>
          <div class="sb-card-info">
            <b>${m.name}</b>
            <small class="sb-hint">${hint}</small>
          </div>
        `;
      }
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  function renderNotesTab(container, st) {
    const notes = st.thankYouNotes || [];
    const header = document.createElement("div");
    header.className = "sb-section-desc";
    header.innerHTML = `<span>Rider Thank-You Notes (<b>${notes.length}</b>)</span><small>Received from grateful passengers after completing hands-on care.</small>`;
    container.appendChild(header);

    if (notes.length === 0) {
      const empty = document.createElement("div");
      empty.className = "sb-empty";
      empty.innerHTML = `
        <p>🧽 No thank-you notes yet.</p>
        <small>When a Waymo has a need (sponge, battery, birds, cones), swoop in from the city view and complete a care task to receive a warm note from your rider!</small>
      `;
      container.appendChild(empty);
      return;
    }

    const list = document.createElement("div");
    list.className = "sb-notes-list";

    notes.slice().reverse().forEach((note) => {
      const card = document.createElement("div");
      card.className = "sb-note-card";
      const icon = RIDER_AVATARS[note.rider] || "🚗";
      card.innerHTML = `
        <div class="sb-note-avatar">${icon}</div>
        <div class="sb-note-content">
          <div class="sb-note-meta">
            <b>${note.rider || "RIDER"}</b>
            <span>Care: ${note.job || "care"}</span>
          </div>
          <blockquote class="sb-note-text">“${note.text || "Thank you for looking after our car!"}”</blockquote>
        </div>
      `;
      list.appendChild(card);
    });

    container.appendChild(list);
  }

  function renderSettingsTab(container, st) {
    const sec = document.createElement("div");
    sec.className = "sb-settings-tab";

    const isFreeDrive = !!st.freeDrive;
    sec.innerHTML = `
      <div class="sb-setting-row">
        <div>
          <b>Free Drive Mode 🕊️</b>
          <p>Instantly part all clouds and unlock every district across San Francisco for pure sandbox cruising.</p>
        </div>
        <button type="button" class="btn ${isFreeDrive ? "primary" : ""}" id="sb-toggle-freedrive">
          ${isFreeDrive ? "Active (All Open)" : "Locked by Seals"}
        </button>
      </div>

      <div class="sb-stats-card">
        <h3>Sunday Drive Records</h3>
        <dl class="sb-stats-list">
          <div><dt>Available Map Seals</dt><dd id="sb-stat-seals">${st.mapSeals || 0}</dd></div>
          <div><dt>Fares Delivered</dt><dd>${st.faresDelivered || 0}</dd></div>
          <div><dt>Hands-on Jobs Cared</dt><dd>${st.totalCared || 0}</dd></div>
          <div><dt>Postcards Photographed</dt><dd>${Object.keys(st.postcards || {}).length} / 37</dd></div>
          <div><dt>Unlocked Districts</dt><dd>${st.unlockedDistricts ? st.unlockedDistricts.length : 1} of 6</dd></div>
        </dl>
      </div>

      <div class="sb-danger-row">
        <div>
          <b>Reset Sunday Drive Data</b>
          <p>Erase Map Seals, collected postcards, and restored progress.</p>
        </div>
        <button type="button" class="btn" id="sb-reset-data">Reset Save</button>
      </div>
    `;

    container.appendChild(sec);

    const fdBtn = sec.querySelector("#sb-toggle-freedrive");
    if (fdBtn) {
      fdBtn.onclick = () => {
        if (WG.sunday) {
          WG.sunday.toggleFreeDrive(!isFreeDrive);
          render();
        }
      };
    }

    const resetBtn = sec.querySelector("#sb-reset-data");
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (confirm("Are you sure you want to reset your Sunday Drive progress and postcards?")) {
          clearAllPhotos().then(() => {
            if (WG.sunday) WG.sunday.resetData();
            render();
          });
        }
      };
    }
  }

  const Album = {
    open,
    close,
    switchTab,
    savePhoto,
    getPhoto,
    deletePhoto,
    clearAllPhotos,
    openLightbox,
    closeLightbox,
    render,
    LANDMARK_HINTS,
    RIDER_AVATARS
  };

  WG.sundayAlbum = Album;
})();
