const LIB_VERSION = '1.0.0';

(function() {
  const files = [
    'grammarForge/grammarForge.js',
    'grammarForge/token.js',
    'grammarForge/tokenDefinition.js',
    'grammarForge/lexer.js',
    'grammarForge/parser.js',
    'grammarForge/exec.js',
    'grammarForge/tokenStream.js',
    'grammarForge/grammarLexer.js',
    'grammarForge/grammarParser.js',
    'grammarForge/grammarParser/functions.js',
    'grammarForge/grammarParser/expression.js',
    'grammarForge/grammarParser/word.js',
    'grammarForge/grammarParser/par.js',
    'grammarForge/grammarParser/rule.js',
    'grammarForge/grammarParser/term.js',
    'grammarForge/flowControl.js',
    'grammarForge/functionDeclaration.js'
  ];

  function loadNext(index, callback) {
    if (index >= files.length) {
      if (callback) callback();
      const evt = new Event('GrammarForgeLoaded');
      window.dispatchEvent(evt);
      return;
    }

    const script = document.createElement('script');
    // Append version to trigger fetch if updated
    script.src = files[index] + '?v=' + LIB_VERSION;
    script.onload = () => loadNext(index + 1, callback);
    document.head.appendChild(script);
  }

  loadNext(0);
})();