// Opens the pages of the site without a reload: only <main> is replaced, so a
// song in the header player keeps playing.
(function () {
  var SAVE_SCROLL_MS = 300;
  var HEAD_TAGS = [
    'meta[name="description"]',
    'meta[name="author"]',
    'meta[name="keywords"]',
    'meta[name="robots"]',
    'meta[name^="twitter:"]',
    'meta[property^="og:"]',
    'link[rel="canonical"]',
  ].join(", ");

  var main = document.querySelector("main");
  if (!main) return;

  var loadedAssets = siteAssets(document);
  // After Back or Forward, location changes before the content does.
  var shownPage = currentPage();
  var pending = null;
  var restoring = null;
  var saveTimer = null;

  function currentPage() {
    return `${window.location.pathname}${window.location.search}`;
  }

  // Scripts of other origins can come from browser extensions, so a difference
  // in them does not show a new deploy.
  function siteAssets(doc) {
    return Array.from(doc.querySelectorAll('link[rel="stylesheet"], script[src]'))
      .map(function (el) {
        return new URL(el.getAttribute("href") || el.getAttribute("src"), window.location.href);
      })
      .filter(function (url) {
        return url.origin === window.location.origin;
      })
      .map(String)
      .join("\n");
  }

  function abortPending() {
    if (pending) pending.abort();
    pending = null;
  }

  function saveScroll() {
    clearTimeout(saveTimer);
    if (currentPage() !== shownPage) return;

    history.replaceState(Object.assign({}, history.state, { scroll: window.scrollY }), "");
  }

  function saveScrollLater() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveScroll, SAVE_SCROLL_MS);
  }

  function stopRestoring() {
    if (restoring) restoring.abort();
    restoring = null;
  }

  function restoreScroll(top) {
    stopRestoring();
    restoring = new AbortController();
    window.scrollTo(0, top);

    // The page can be too short until its images load.
    var options = { capture: true, passive: true, signal: restoring.signal };
    main.addEventListener(
      "load",
      function () {
        window.scrollTo(0, top);
      },
      options
    );
    ["wheel", "touchstart", "pointerdown", "keydown"].forEach(function (type) {
      window.addEventListener(type, stopRestoring, options);
    });
  }

  function hasSavedScroll() {
    return Boolean(history.state) && Number.isFinite(history.state.scroll);
  }

  function hashTarget() {
    var id = window.location.hash.slice(1);
    if (!id) return null;

    try {
      return document.getElementById(id) || document.getElementById(decodeURIComponent(id));
    } catch (err) {
      console.warn("cannot decode the hash of the page:", err);
      return null;
    }
  }

  function updateHead(page) {
    document.title = page.title;
    document.head.querySelectorAll(HEAD_TAGS).forEach(function (tag) {
      tag.remove();
    });
    page.head.querySelectorAll(HEAD_TAGS).forEach(function (tag) {
      document.head.appendChild(tag);
    });
  }

  function updateMenu(page) {
    var active = Array.from(page.querySelectorAll("body > header a.active")).map(function (link) {
      return link.getAttribute("href");
    });
    document.querySelectorAll("body > header a").forEach(function (link) {
      link.classList.toggle("active", active.includes(link.getAttribute("href")));
    });
  }

  function showContent(page) {
    var nextMain = page.querySelector("main");
    main.replaceWith(nextMain);
    main = nextMain;
    main.setAttribute("tabindex", "-1");
    main.style.outline = "none";
    main.focus({ preventScroll: true });
  }

  function scrollToStart() {
    var target = hashTarget();
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }

  async function fetchPage(url, signal) {
    var response = await fetch(url, { signal: signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (new URL(response.url).origin !== window.location.origin) throw new Error("the page moved to another origin");
    if (!/^text\/html\b/i.test(response.headers.get("content-type") || "")) throw new Error("the page is not HTML");

    var page = new DOMParser().parseFromString(await response.text(), "text/html");
    if (!page.querySelector("main")) throw new Error("the page has no main element");
    if (siteAssets(page) !== loadedAssets) throw new Error("the site has a new version");

    return { url: response.url, document: page };
  }

  async function open(url, isHistoryMove) {
    abortPending();
    var navigation = new AbortController();
    pending = navigation;

    try {
      var page = await fetchPage(url, navigation.signal);
      if (navigation.signal.aborted) return;

      pending = null;
      stopRestoring();

      if (!isHistoryMove) {
        saveScroll();
        var finalUrl = new URL(page.url);
        finalUrl.hash = new URL(url).hash;
        // Like in the browser, a link to the open page adds no history entry.
        if (finalUrl.href === window.location.href) history.replaceState({}, "", finalUrl.href);
        else history.pushState({}, "", finalUrl.href);
      }

      updateHead(page.document);
      updateMenu(page.document);
      showContent(page.document);

      if (isHistoryMove && hasSavedScroll()) restoreScroll(history.state.scroll);
      else scrollToStart();

      window.dispatchEvent(new Event("page:load"));
      // A page:load listener can change the address: music.js removes ?play=.
      shownPage = currentPage();
      saveScrollLater();
    } catch (err) {
      if (navigation.signal.aborted) return;

      console.warn("cannot open the page without a reload:", err);
      if (isHistoryMove) window.location.reload();
      else window.location.assign(url);
    }
  }

  function isPagePath(path) {
    var extension = /\.([^./]+)$/.exec(path);
    return !extension || extension[1].toLowerCase() === "html";
  }

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    var link = event.target.closest("a[href]");
    if (!link || link.hasAttribute("target") || link.hasAttribute("download")) return;

    if (link.origin !== window.location.origin || !isPagePath(link.pathname)) {
      // A swap during the browser's own navigation would cancel it.
      if (/^https?:$/.test(link.protocol)) abortPending();
      return;
    }

    if (`${link.pathname}${link.search}` === currentPage() && link.href.includes("#")) {
      saveScroll();
      return;
    }

    event.preventDefault();
    open(link.href, false);
  });

  window.addEventListener("popstate", function () {
    clearTimeout(saveTimer);
    if (currentPage() !== shownPage) {
      open(window.location.href, true);
      return;
    }

    abortPending();
    if (hasSavedScroll()) restoreScroll(history.state.scroll);
    else saveScrollLater();
  });

  window.addEventListener("scroll", saveScrollLater, { passive: true });
  window.addEventListener("pagehide", saveScroll);

  history.scrollRestoration = "manual";
  if (hasSavedScroll()) restoreScroll(history.state.scroll);
})();
