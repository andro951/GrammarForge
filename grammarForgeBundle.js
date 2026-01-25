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

  files.forEach(file => {
    const script = document.createElement('script');
    script.src = file;  // relative to HTML file
    script.defer = false;
    document.head.appendChild(script);
  });
})();