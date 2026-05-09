// Word Service - loads words from local file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for unique words
let wordCache = [];

// Load words from file and remove duplicates
function loadWordsFromFile() {
  try {
    const filePath = path.join(__dirname, 'words.txt');
    const content = fs.readFileSync(filePath, 'utf-8');
    const words = content.split('\n')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length >= 2 && /^[а-яё]+$/i.test(w));
    
    // Remove duplicates using Set
    const uniqueWords = [...new Set(words)];
    console.log(`Loaded ${uniqueWords.length} unique words from file (was ${words.length} with duplicates)`);
    return uniqueWords;
  } catch (error) {
    console.error('Error loading words from file:', error.message);
    return [];
  }
}

// Get words with caching
export async function getWords(count = 500) {
  if (wordCache.length === 0) {
    wordCache = loadWordsFromFile();
  }

  // Shuffle ALL words to mix difficulty levels, then return subset
  const shuffled = [...wordCache].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Get random word from cache
export function getRandomWord() {
  if (wordCache.length === 0) {
    wordCache = loadWordsFromFile();
  }
  return wordCache[Math.floor(Math.random() * wordCache.length)];
}

// Initialize word cache on startup
export async function initWordCache() {
  wordCache = loadWordsFromFile();
  console.log(`Word service initialized with ${wordCache.length} unique words`);
}

export default { getWords, getRandomWord, initWordCache };
