(function() {
  const BASE_URL = './grammarForge/'; // local folder relative to your HTML

  const files = [
    './grammarForge/grammarForge.js',
    './grammarForge/token.js',
    './grammarForge/tokenDefinition.js',
    './grammarForge/lexer.js',
    './grammarForge/parser.js',
    './grammarForge/exec.js',
    './grammarForge/tokenStream.js',
    './grammarForge/grammarLexer.js',
    './grammarForge/grammarParser.js',
    './grammarForge/grammarParser/functions.js',
    './grammarForge/grammarParser/expression.js',
    './grammarForge/grammarParser/wordBase.js',
    './grammarForge/grammarParser/word.js',
    './grammarForge/grammarParser/qWord.js',
    './grammarForge/grammarParser/par.js',
    './grammarForge/grammarParser/expList.js',
    './grammarForge/grammarParser/rule.js',
    './grammarForge/grammarParser/term.js',
    './grammarForge/flowControl.js',
    './grammarForge/functionDeclaration.js',
    './scriptForge/scriptForge.js',
    './scriptForge/script.js',
    './scriptForge/scriptAction.js',
    './scriptForge/scriptTrigger.js',
    './scriptForge/scriptDataGetter.js',
  ];

  function loadNext(index) {
    if (index >= files.length) {
      // All scripts loaded, fire event
      window.dispatchEvent(new Event('GrammarForgeLoaded'));
      console.log('GrammarForge fully loaded (DEV)');
      return;
    }

    const script = document.createElement('script');
    script.src = files[index];
    script.onload = () => loadNext(index + 1);
    script.onerror = () => console.error('Failed to load:', files[index]);
    document.head.appendChild(script);
  }

  loadNext(0);
})();