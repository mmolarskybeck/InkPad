import { extractInkVariables } from './client/src/lib/ink-variable-utils.ts';

// Test with the actual structure we found
const testJSON = {
  root: [
    {
      // ... story content
    },
    "done",
    {
      "london": {},
      "astonished": {},
      "nod": {},
      "ending": {},
      "global decl": [
        'ev',
        'str',
        '^Passepartout',
        '/str',
        { 'VAR=': 'player_name' },
        80,
        { 'VAR=': 'days_remaining' },
        1,
        { 'VAR=': 'has_passport' },
        0,
        { 'VAR=': 'countries_visited' },
        '/ev',
        'end',
        null
      ]
    }
  ]
};

console.log('Testing variable extraction...');
const result = extractInkVariables(testJSON);
console.log('Result:', result);
