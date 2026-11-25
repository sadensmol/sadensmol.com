(function () {
  var page = null;

  function bindToc(signal) {
    var toc = document.querySelector(".toc-sidebar");
    if (!toc) return;

    var links = toc.querySelectorAll("a");
    var headings = [];

    links.forEach(function (link) {
      var id = decodeURIComponent(link.getAttribute("href").slice(1));
      var heading = document.getElementById(id);
      if (heading) headings.push({ el: heading, link: link });
    });

    function updateActive() {
      var current = null;
      var offset = 100;

      for (var i = 0; i < headings.length; i++) {
        if (headings[i].el.getBoundingClientRect().top <= offset) {
          current = headings[i];
        }
      }

      links.forEach(function (link) {
        link.classList.remove("active");
      });
      if (current) current.link.classList.add("active");
    }

    window.addEventListener("scroll", updateActive, { passive: true, signal: signal });
    updateActive();
  }

  // Image lightbox: a click on any post image shows it in full size.
  function bindLightbox(signal) {
    var content = document.querySelector(".post-content");
    if (!content) return;
    var imgs = content.querySelectorAll("img");
    if (!imgs.length) return;

    var box = document.createElement("div");
    box.className = "lightbox";
    var full = document.createElement("img");
    var close = document.createElement("button");
    close.className = "lightbox-close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = "&times;";
    box.appendChild(full);
    box.appendChild(close);
    document.body.appendChild(box);

    function open(img) {
      full.src = img.currentSrc || img.src;
      full.alt = img.alt || "";
      box.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function hide() {
      box.classList.remove("open");
      document.body.style.overflow = "";
      full.removeAttribute("src");
    }

    imgs.forEach(function (img) {
      img.addEventListener(
        "click",
        function () {
          open(img);
        },
        { signal: signal }
      );
    });
    box.addEventListener("click", hide);
    document.addEventListener(
      "keydown",
      function (event) {
        if (event.key === "Escape" && box.classList.contains("open")) hide();
      },
      { signal: signal }
    );

    signal.addEventListener("abort", function () {
      hide();
      box.remove();
    });
  }

  function bindPage() {
    if (page) page.abort();
    page = new AbortController();
    bindToc(page.signal);
    bindLightbox(page.signal);
  }

  window.addEventListener("page:load", bindPage);
  bindPage();
})();
