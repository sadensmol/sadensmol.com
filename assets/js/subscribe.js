// Posts subscribe forms into a hidden iframe so readers stay on the blog,
// then swaps the form for a "check your inbox" note once Buttondown answers.
(function () {
  var bound = new WeakSet();
  var frame = null;
  var pending = null;

  function createFrame() {
    frame = document.createElement('iframe');
    frame.name = 'subscribe-frame';
    frame.hidden = true;
    frame.setAttribute('aria-hidden', 'true');
    document.body.appendChild(frame);

    frame.addEventListener('load', function () {
      if (!pending) return;
      pending.innerHTML = '<p class="subscribe-done">Almost there! Check your inbox to confirm your subscription.</p>';
      pending = null;
    });
  }

  function bindForms() {
    var forms = document.querySelectorAll('.subscribe-form');
    if (!forms.length) return;

    if (!frame) createFrame();

    forms.forEach(function (form) {
      if (bound.has(form)) return;

      bound.add(form);
      form.target = 'subscribe-frame';
      form.addEventListener('submit', function () {
        pending = form;
        form.querySelector('button').disabled = true;
      });
    });
  }

  function closeHeaderPopups() {
    document.querySelectorAll('body > header details.subscribe[open]').forEach(function (popup) {
      popup.open = false;
    });
  }

  window.addEventListener('page:load', function () {
    closeHeaderPopups();
    bindForms();
  });
  bindForms();
})();
