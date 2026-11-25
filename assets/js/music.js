(function () {
  var COPIED_MS = 2000;

  var audio = document.getElementById("player").querySelector("audio");

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

      audio.play().catch(function (err) {
        console.warn("cannot start the song:", err);
      });
    });
    toggle.hidden = false;
  }

  function start() {
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

    shared.querySelector(".track-play").click();
    history.replaceState(history.state, "", window.location.pathname + window.location.hash);
  }

  ["play", "pause", "ended", "emptied"].forEach(function (type) {
    audio.addEventListener(type, drawRows);
  });
  window.addEventListener("page:load", start);
  start();
})();
