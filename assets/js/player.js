(function () {
  var KEY = "player";

  var player = document.getElementById("player");
  if (!player) return;

  var titleEl = player.querySelector(".player-title");
  var audio = player.querySelector("audio");
  var tracks = Array.from(document.querySelectorAll(".track-play"));

  function readState() {
    try {
      var state = JSON.parse(sessionStorage.getItem(KEY));
      var valid =
        state &&
        typeof state.src === "string" &&
        typeof state.title === "string" &&
        Number.isFinite(state.time) &&
        state.time >= 0 &&
        typeof state.playing === "boolean";
      return valid ? state : null;
    } catch (err) {
      console.warn("cannot read the player state:", err);
      return null;
    }
  }

  function markCurrent(src) {
    tracks.forEach(function (link) {
      link.ariaCurrent = link.getAttribute("href") === src ? "true" : null;
    });
  }

  function load(state) {
    titleEl.textContent = state.title;
    audio.src = state.src;
    audio.currentTime = state.time;
    player.hidden = false;
    markCurrent(state.src);
    if (!state.playing) return;

    audio.play().catch(function (err) {
      console.warn("cannot start the song:", err);
    });
  }

  function stop() {
    audio.pause();
    audio.removeAttribute("src");
    // Removing src alone keeps the old song loaded in the controls.
    audio.load();
    player.hidden = true;
    markCurrent(null);
  }

  function play(link) {
    load({ src: link.getAttribute("href"), title: link.textContent, time: 0, playing: true });
  }

  function restore() {
    var state = readState();
    if (state) load(state);
    else stop();
  }

  tracks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

      event.preventDefault();
      play(link);
    });
  });

  audio.onended = function () {
    if (tracks.length === 0) return;

    var current = tracks.findIndex(function (link) {
      return link.getAttribute("href") === audio.getAttribute("src");
    });
    play(tracks[(current + 1) % tracks.length]);
  };

  player.querySelector(".player-close").addEventListener("click", function () {
    stop();
    try {
      sessionStorage.removeItem(KEY);
    } catch (err) {
      console.warn("cannot remove the player state:", err);
    }
  });

  window.addEventListener("pagehide", function () {
    if (!audio.hasAttribute("src")) return;

    try {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({
          src: audio.getAttribute("src"),
          title: titleEl.textContent,
          time: audio.currentTime,
          playing: !audio.paused,
        })
      );
    } catch (err) {
      console.warn("cannot save the player state:", err);
    }
    audio.pause();
  });

  window.addEventListener("pageshow", function (event) {
    if (event.persisted) restore();
  });

  restore();
})();
