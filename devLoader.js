(function() {
  const bundleUrl = 'grammarForgeDevBundle.js';
  const cacheBuster = '?_ts=' + Date.now(); // forces fresh fetch
  const script = document.createElement('script');
  script.src = bundleUrl + cacheBuster;
  document.head.appendChild(script);
})();