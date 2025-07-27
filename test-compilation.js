import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the sample story
const sampleStoryPath = path.join(__dirname, 'client/src/data/sample-story.ink');
const sampleStory = fs.readFileSync(sampleStoryPath, 'utf8');

console.log('=== Sample Story Content ===');
console.log(sampleStory);
console.log('\n=== Testing API Compilation ===');

// Test compilation via API
fetch('http://localhost:3000/api/compile', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ source: sampleStory })
})
.then(response => response.json())
.then(data => {
  console.log('=== Compilation Result ===');
  console.log('Success:', !data.error);
  
  if (data.compiled) {
    console.log('\n=== Compiled JSON Structure ===');
    console.log('Root length:', data.compiled.root ? data.compiled.root.length : 'no root');
    
    if (data.compiled.root) {
      data.compiled.root.forEach((item, index) => {
        console.log(`Root[${index}]:`, typeof item, item && typeof item === 'object' ? Object.keys(item) : item);
        
        if (item && typeof item === 'object' && item['global decl']) {
          console.log(`  Global declarations found:`, item['global decl']);
        }
      });
    }
    
    // Test our variable extractor (skip for now since it's TypeScript)
    console.log('\n=== Manual Variable Check ===');
    console.log('Looking for global declarations in root array...');
    if (data.compiled.root) {
      data.compiled.root.forEach((item, index) => {
        if (item && typeof item === 'object' && item['global decl']) {
          console.log(`Found global decl at root[${index}]:`, JSON.stringify(item['global decl'], null, 2));
        }
      });
    }
  }
  
  if (data.error) {
    console.log('Error:', data.error);
  }
})
.catch(error => {
  console.error('Request failed:', error);
});
