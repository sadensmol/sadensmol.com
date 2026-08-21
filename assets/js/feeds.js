(function () {
  var container = document.getElementById("interesting-blogs");
  if (!container) return;

  var moreBtn = container.querySelector(".feeds-more");
  var feedsEl = container.querySelector("ul");
  if (!moreBtn || !feedsEl) return;

  var src = container.getAttribute("data-src");
  var packSize = parseInt(container.getAttribute("data-pack-size"), 10) || 20;

  // The first pack is rendered server-side, so start after it.
  var shownPacks = 1;
  var packs = null;
  var loading = false;

  // Entries arrive sorted newest first. Deal them into packs of packSize that
  // hold at most one entry per blog, so a single prolific source can never take
  // over a pack. Anything skipped falls into a later pack.
  function buildPacks(all) {
    var remaining = all;
    var result = [];

    while (remaining.length) {
      var pack = [];
      var used = {};
      var leftover = [];

      for (var i = 0; i < remaining.length; i++) {
        var item = remaining[i];
        if (pack.length < packSize && !used[item.source]) {
          used[item.source] = true;
          pack.push(item);
        } else {
          leftover.push(item);
        }
      }

      result.push(pack);
      remaining = leftover;
    }

    return result;
  }

  function createItem(item) {
    var li = document.createElement("li");

    var d = new Date(item.date);
    if (d.getTime()) {
      var time = document.createElement("time");
      time.setAttribute("datetime", item.date);
      time.textContent = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
      li.appendChild(time);
    }

    var span = document.createElement("span");
    span.className = "feed-entry";

    var a = document.createElement("a");
    a.href = item.link;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = item.title;
    span.appendChild(a);

    var source = document.createElement("span");
    source.className = "feed-source";
    source.appendChild(document.createTextNode(" — "));
    var sourceLink = document.createElement("a");
    sourceLink.href = item.site;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener";
    sourceLink.textContent = item.source;
    source.appendChild(sourceLink);
    span.appendChild(source);

    li.appendChild(span);
    return li;
  }

  function showNextPack() {
    var pack = packs[shownPacks];
    if (!pack) {
      moreBtn.remove();
      return;
    }

    pack.forEach(function (item) {
      feedsEl.appendChild(createItem(item));
    });
    shownPacks++;

    if (shownPacks >= packs.length) moreBtn.remove();
  }

  moreBtn.addEventListener("click", function () {
    if (packs) {
      showNextPack();
      return;
    }
    if (loading) return;

    loading = true;
    moreBtn.disabled = true;
    moreBtn.textContent = "Loading...";

    fetch(src)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (all) {
        packs = buildPacks(all);
        moreBtn.disabled = false;
        moreBtn.textContent = "Load more";
        showNextPack();
      })
      .catch(function () {
        moreBtn.textContent = "Could not load more";
      })
      .finally(function () {
        loading = false;
      });
  });
})();
