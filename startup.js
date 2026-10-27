/* Keep the first paint stable while the game, fonts and responsive layout initialize. */
(function () {
  "use strict";
  let finished = false,
    failed = false,
    layoutShown = false,
    message = "Loading San Francisco…",
    progress = 0;
  function paint() {
    const status = document.getElementById("startup-status"),
      bar = document.getElementById("startup-progress");
    if (status) status.textContent = message;
    if (bar) bar.value = progress;
  }
  function fail() {
    if (finished) return;
    failed = true;
    message = "Could not finish loading. Please reload.";
    paint();
    if (layoutShown) {
      document.body.classList.add("is-layout-pending");
      document
        .querySelectorAll("#field, #ph-bar, #gb, #gb-head")
        .forEach((el) => {
          el.inert = true;
        });
      document.getElementById("startup").hidden = false;
    }
  }
  function resourceError(event) {
    const el = event.target;
    if (
      el &&
      (el.tagName === "SCRIPT" ||
        (el.tagName === "LINK" && el.rel === "stylesheet"))
    ) {
      // Optional third-party analytics must never keep the game behind the loading screen.
      if (new URL(el.src || el.href, location.href).origin === location.origin)
        fail();
    } else if (
      event.filename &&
      new URL(event.filename, location.href).origin === location.origin
    )
      fail();
  }
  addEventListener("error", resourceError, true);
  function loadingKey(event) {
    if (
      !document.body ||
      !document.body.classList.contains("is-layout-pending") ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.key === "Tab" ||
      (event.target.closest && event.target.closest("#startup a"))
    )
      return;
    // The engine listens on window too; inert alone cannot prevent a hidden run starting.
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  addEventListener("keydown", loadingKey, true);
  document.addEventListener("DOMContentLoaded", paint, { once: true });
  const slow = setTimeout(() => {
    if (finished || failed) return;
    message = "Still loading. You can reload if needed.";
    paint();
  }, 15000);
  window.DRStartup = {
    progress(value) {
      if (failed || finished) return;
      progress = Math.max(0, Math.min(1, value));
      paint();
    },
    preparing() {
      if (failed || finished) return;
      message = "Setting up the screen…";
      paint();
    },
    fail,
    layout() {
      if (failed || layoutShown) return;
      layoutShown = true;
      document
        .querySelectorAll("#field, #ph-bar, #gb, #gb-head")
        .forEach((el) => {
          el.inert = false;
        });
      document.body.classList.remove("is-layout-pending");
      document.getElementById("startup").hidden = true;
    },
    complete() {
      if (failed || finished) return;
      this.layout();
      finished = true;
      clearTimeout(slow);
      removeEventListener("error", resourceError, true);
      removeEventListener("keydown", loadingKey, true);
    },
  };
})();
