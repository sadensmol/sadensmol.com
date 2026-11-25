(function () {
  var COPIED_MS = 2000;
  var OWN_HANDLER = "#player, .track-toggle, .track-play, .track-share, .track-download, a[href]";
  var IGNORED_KEYS = [
    "Escape",
    "Tab",
    "Shift",
    "Control",
    "Alt",
    "AltGraph",
    "Meta",
    "CapsLock",
    "NumLock",
    "ScrollLock",
    "Fn",
    "FnLock",
  ];

  var audio = document.getElementById("player").querySelector("audio");
  var sharedPage = null;
  var waitController = null;

  function share(link, title) {
    var url = new URL(link.getAttribute("href"), window.location.href).href;

    if (navigator.share) {
      return navigator.share({ title: title, url: url }).catch(function (err) {
        if (err.name !== "AbortError") console.warn("cannot share the song:", err);
      });
    }

    return navigator.clipboard.writeText(url).then(function () {
      link.textContent = "Copied!";
      clearTimeout(link.copiedTimer);
      link.copiedTimer = setTimeout(function () {
        link.textContent = "Share";
      }, COPIED_MS);
    });
  }

  function isCurrent(link) {
    return link.getAttribute("href") === audio.getAttribute("src");
  }

  function playAudio() {
    audio.play().catch(function (err) {
      console.warn("cannot start the song:", err);
    });
  }

  function currentPage() {
    return `${window.location.pathname}${window.location.search}`;
  }

  function markPlayed() {
    history.replaceState(Object.assign({}, history.state, { played: true }), "");
  }

  function endRefusedStart() {
    if (waitController) waitController.abort();
    waitController = null;
  }

  function waitForUserAction(src) {
    endRefusedStart();
    if (!audio.paused || audio.getAttribute("src") !== src) return;

    waitController = new AbortController();
    var signal = waitController.signal;

    function startOnAction(event) {
      if (event.type === "keydown" && IGNORED_KEYS.includes(event.key)) return;
      if (event.target.closest && event.target.closest(OWN_HANDLER)) return;

      if (!audio.paused || audio.getAttribute("src") !== src) {
        endRefusedStart();
        return;
      }

      // The browser refuses a touchend that ends a scroll, so an attempt alone does not end the wait.
      playAudio();
    }

    ["click", "keydown", "touchend"].forEach(function (type) {
      document.addEventListener(type, startOnAction, { capture: true, passive: true, signal: signal });
    });
    // The events of the song before this one can arrive late, so they end nothing by themselves.
    ["play", "playing", "emptied"].forEach(function (type) {
      audio.addEventListener(
        type,
        function () {
          if (!audio.paused || audio.getAttribute("src") !== src) endRefusedStart();
        },
        { signal: signal }
      );
    });
  }

  function drawRows() {
    document.querySelectorAll(".track").forEach(function (row) {
      var toggle = row.querySelector(".track-toggle");
      if (!toggle) return;

      var link = row.querySelector(".track-play");
      var playing = isCurrent(link) && !audio.paused;
      row.classList.toggle("playing", playing);
      toggle.setAttribute("aria-label", `${playing ? "Pause" : "Play"} ${link.textContent}`);
    });
  }

  function bindToggle(row) {
    var toggle = row.querySelector(".track-toggle");
    if (!toggle) return;

    var link = row.querySelector(".track-play");
    toggle.addEventListener("click", function () {
      if (!isCurrent(link)) {
        link.click();
        return;
      }

      if (!audio.paused) {
        audio.pause();
        return;
      }

      playAudio();
    });
    toggle.hidden = false;
  }

  function start() {
    sharedPage = null;
    var rows = Array.from(document.querySelectorAll(".track"));

    rows.forEach(function (row) {
      bindToggle(row);

      var link = row.querySelector(".track-share");
      link.addEventListener("click", async function (event) {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

        event.preventDefault();
        try {
          await share(link, row.querySelector(".track-play").textContent);
        } catch (err) {
          // navigator.clipboard is undefined on a page without HTTPS.
          console.warn("cannot copy the link of the song:", err);
        }
      });
    });

    drawRows();

    var id = new URLSearchParams(window.location.search).get("play");
    if (!id) return;

    var shared = rows.find(function (row) {
      return row.getAttribute("data-track-id") === id;
    });
    if (!shared) return;

    sharedPage = currentPage();
    if (history.state && history.state.played) return;

    var link = shared.querySelector(".track-play");
    link.click();
    markPlayed();
    waitForUserAction(link.getAttribute("href"));
  }

  ["play", "pause", "ended", "emptied"].forEach(function (type) {
    audio.addEventListener(type, drawRows);
  });
  // A hash link of the page makes a history entry without a state.
  window.addEventListener("popstate", function () {
    if (currentPage() === sharedPage) markPlayed();
  });
  window.addEventListener("page:load", start);
  start();
})();
