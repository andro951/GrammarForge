(function() {
  const bundleUrl = 'https://andro951.github.io/GrammarForge/grammarForgeBundle.js';
  const cacheBuster = '?_ts=' + Date.now(); // forces fresh fetch
  const script = document.createElement('script');
  script.src = bundleUrl + cacheBuster;
  document.head.appendChild(script);
})();