// Posts subscribe forms into a hidden iframe so readers stay on the blog,
// then swaps the form for a "check your inbox" note once Buttondown answers.
(function () {
  var forms = document.querySelectorAll('.subscribe-form');
  if (!forms.length) return;

  var frame = document.createElement('iframe');
  frame.name = 'subscribe-frame';
  frame.hidden = true;
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);

  var pending = null;
  frame.addEventListener('load', function () {
    if (!pending) return;
    pending.innerHTML = '<p class="subscribe-done">Almost there! Check your inbox to confirm your subscription.</p>';
    pending = null;
  });

  forms.forEach(function (form) {
    form.target = 'subscribe-frame';
    form.addEventListener('submit', function () {
      pending = form;
      form.querySelector('button').disabled = true;
    });
  });
})();
