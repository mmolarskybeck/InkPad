// client/src/ink-monarch.ts
export const inkLanguageId = "ink";

export const languageDefinition = {
  // Set default token style
  defaultToken: '',
  
  // Keywords and special tokens
  keywords: [
    'VAR', 'CONST', 'LIST', 'INCLUDE', 'EXTERNAL', 'FUNCTION',
    'END', 'DONE', 'RETURN', 'true', 'false', 'null'
  ],

  // Built-in functions and operators
  operators: [
    '=', '==', '!=', '<', '>', '<=', '>=', '!', '&&', '||',
    '+', '-', '*', '/', '%', '++', '--', '+=', '-=', '?',
    'and', 'or', 'not', 'mod', 'has'
  ],

  // Escape sequences
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      // Knots (=== name ===) - simplified without capture groups
      [/^===.*===$/, 'keyword.control'],
      
      // Stitches (= name)
      [/^=\s*\w+/, 'type.identifier'],
      
      // Variable declarations
      [/^VAR\s+\w+/, 'keyword.control'],
      [/^CONST\s+\w+/, 'keyword.control'],
      [/^LIST\s+\w+/, 'keyword.control'],
      
      // Function declarations
      [/^===\s*function\s+\w+.*===$/, 'entity.name.function'],
      
      // External function declarations
      [/^EXTERNAL\s+\w+/, 'keyword.control'],
      
      // Include statements
      [/^INCLUDE\s+.+$/, 'keyword.control'],
      
      // Diverts (-> destination)
      [/^\s*->\s*\w+/, 'keyword.control'],
      
      // Tunnels (->-> destination ->)
      [/^\s*->\s*->\s*\w+\s*->\s*$/, 'keyword.control'],
      
      // Tunnel returns (->->)
      [/^\s*->\s*->\s*$/, 'keyword.control'],
      
      // Choices (* text) - simplified
      [/^\s*\*+/, 'delimiter.choice'],
      
      // Sticky choices (+ text)  
      [/^\s*\++/, 'delimiter.sticky'],
      
      // Fallback choices (- text)
      [/^\s*-\s+/, 'delimiter.fallback'],
      
      // Choice text in brackets
      [/\[([^\]]*)\]/, 'string.choice'],
      
      // Tags (# tag)
      [/^\s*#\s*\w+/, 'entity.name.tag'],
      
      // Logic blocks ({ condition })
      [/\{[^}]*\}/, 'string.logic'],
      
      // String literals
      [/"([^"\\]|\\.)*"/, 'string'],
      [/"([^"\\]|\\.)*$/, 'string.invalid'],  // unterminated string
      
      // Variables in text (~ variable)
      [/~\s*\w+/, 'variable.name'],
      
      // Comments (// comment)
      [/\/\/.*$/, 'comment'],
      
      // Identifiers and keywords
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@keywords': 'keyword',
          '@operators': 'operator',
          '@default': 'identifier'
        }
      }],
      
      // Numbers
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],
      
      // Delimiters and operators
      [/[{}()\[\]]/, '@brackets'],
      [/[<>]=?|[!=]=?|&&|\|\||[+\-*\/%]/, 'operator'],
      
      // Whitespace
      [/[ \t\r\n]+/, 'white']
    ]
  }
};

// Theme configuration for better syntax highlighting
export const inkTheme = {
  base: 'vs-dark', // or 'vs' for light theme
  inherit: true,
  rules: [
    { token: 'keyword.control', foreground: '#C586C0' },        // Purple for knots, diverts
    { token: 'type.identifier', foreground: '#4EC9B0' },        // Cyan for knot/stitch names
    { token: 'variable.name', foreground: '#9CDCFE' },          // Light blue for variables
    { token: 'delimiter.choice', foreground: '#FFD700' },       // Gold for choice markers
    { token: 'delimiter.sticky', foreground: '#FFA500' },       // Orange for sticky choices
    { token: 'delimiter.fallback', foreground: '#87CEEB' },     // Sky blue for fallbacks
    { token: 'string.choice', foreground: '#CE9178' },          // Salmon for choice text
    { token: 'string.logic', foreground: '#D4D4AA' },           // Light olive for logic
    { token: 'entity.name.function', foreground: '#DCDCAA' },   // Yellow for functions
    { token: 'entity.name.tag', foreground: '#4FC1FF' },        // Bright blue for tags
    { token: 'comment', foreground: '#6A9955' },                // Green for comments
    { token: 'number', foreground: '#B5CEA8' },                 // Light green for numbers
    { token: 'string', foreground: '#CE9178' },                 // Salmon for strings
    { token: 'operator', foreground: '#D4D4D4' },               // Light gray for operators
    { token: 'invalid', foreground: '#FF0000' }                 // Red for invalid tokens
  ],
  colors: {}
};

// Configuration for Monaco Editor
export const inkLanguageConfig = {
  comments: {
    lineComment: '//'
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')']
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' }
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' }
  ]
};