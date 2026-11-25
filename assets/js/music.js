(function () {
  var COPIED_MS = 2000;

  var rows = Array.from(document.querySelectorAll(".track"));

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

  rows.forEach(function (row) {
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

  var id = new URLSearchParams(window.location.search).get("play");
  if (!id) return;

  var shared = rows.find(function (row) {
    return row.getAttribute("data-track-id") === id;
  });
  if (!shared) return;

  shared.querySelector(".track-play").click();
  history.replaceState(history.state, "", window.location.pathname + window.location.hash);
})();
