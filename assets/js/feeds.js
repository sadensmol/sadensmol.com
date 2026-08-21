(function () {
  var container = document.getElementById("interesting-blogs");
  if (!container) return;

  var API = "https://api.rss2json.com/v1/api.json?rss_url=";
  var CACHE_KEY = "interesting-blogs-cache-v2";
  var CACHE_TTL = 24 * 60 * 60 * 1000;
  var MAX_PER_FEED = 12;
  var PAGE_SIZE = 20;

  var feedsEl = container.querySelector("ul");
  var moreBtn = container.querySelector(".feeds-more");
  var visibleItems = [];
  var shown = 0;
  var feeds;
  try {
    feeds = JSON.parse(container.getAttribute("data-feeds"));
  } catch (e) {
    return;
  }

  function parseDate(str) {
    if (!str) return new Date(0);
    var d = new Date(str);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  function createItem(item) {
    var li = document.createElement("li");

    if (item.date) {
      var d = new Date(item.date);
      if (d.getTime()) {
        var time = document.createElement("time");
        time.setAttribute("datetime", d.toISOString().split("T")[0]);
        time.textContent = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        li.appendChild(time);
      }
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
    source.appendChild(document.createTextNode(" \u2014 "));
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

  function limitPerSource(items) {
    var result = [];
    var sourceDays = {};
    var sourceCount = {};

    items.forEach(function (item) {
      var key = item.source;
      var day = new Date(item.date).toISOString().split("T")[0];
      var dayKey = key + "|" + day;

      if (!sourceCount[key]) sourceCount[key] = 0;
      if (!sourceDays[dayKey]) sourceDays[dayKey] = 0;

      if (sourceCount[key] >= MAX_PER_FEED) return;
      if (sourceDays[dayKey] >= 1) return;

      sourceDays[dayKey]++;
      sourceCount[key]++;
      result.push(item);
    });

    return result;
  }

  function showMore() {
    var next = visibleItems.slice(shown, shown + PAGE_SIZE);
    next.forEach(function (item) {
      feedsEl.appendChild(createItem(item));
    });
    shown += next.length;

    if (moreBtn) {
      var remaining = visibleItems.length - shown;
      if (remaining > 0) {
        moreBtn.hidden = false;
        moreBtn.textContent = "Load more (" + remaining + ")";
      } else {
        moreBtn.hidden = true;
      }
    }
  }

  function renderItems(allItems) {
    allItems.sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
    visibleItems = limitPerSource(allItems);
    shown = 0;

    while (feedsEl.firstChild) {
      feedsEl.removeChild(feedsEl.firstChild);
    }

    if (!visibleItems.length) {
      var li = document.createElement("li");
      li.textContent = "No recent posts found.";
      feedsEl.appendChild(li);
      if (moreBtn) moreBtn.hidden = true;
      return;
    }

    showMore();
  }

  if (moreBtn) {
    moreBtn.addEventListener("click", showMore);
  }

  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var cache = JSON.parse(raw);
      if (Date.now() - cache.ts > CACHE_TTL) return null;
      return cache.items;
    } catch (e) {
      return null;
    }
  }

  function saveCache(items) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items: items }));
    } catch (e) {}
  }

  var cached = loadCache();
  if (cached) {
    renderItems(cached);
    return;
  }

  var allItems = [];
  var completed = 0;

  feeds.forEach(function (feed) {
    fetch(API + encodeURIComponent(feed.url) + "&count=" + MAX_PER_FEED)
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.status !== "ok" || !data.items) return;
        var items = data.items.slice(0, MAX_PER_FEED).map(function (entry) {
          return {
            title: entry.title,
            link: entry.link,
            date: parseDate(entry.pubDate).toISOString(),
            source: feed.name,
            site: feed.site,
          };
        });
        allItems = allItems.concat(items);
      })
      .catch(function () {})
      .finally(function () {
        completed++;
        if (completed === feeds.length) {
          saveCache(allItems);
          renderItems(allItems);
        }
      });
  });
})();
