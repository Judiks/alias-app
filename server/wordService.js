// Word Service - fetches words from Wikidata Lexicographical data and other APIs
import fetch from 'node-fetch';

// Cache for words
let wordCache = [];
let lastFetch = 0;
let isLoading = false;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const FETCH_TIMEOUT = 8000; // 8 second timeout per request

// Good fallback words for Alias game
const fallbackWords = [
  'солнце', 'луна', 'звезда', 'космос', 'планета', 'галактика', 'комета',
  'машина', 'самолёт', 'корабль', 'поезд', 'велосипед', 'мотоцикл', 'автобус',
  'собака', 'кошка', 'слон', 'жираф', 'медведь', 'волк', 'лиса', 'заяц', 'тигр',
  'дерево', 'цветок', 'трава', 'лес', 'поле', 'сад', 'парк', 'роща',
  'река', 'озеро', 'море', 'океан', 'водопад', 'ручей', 'болото', 'пруд',
  'гора', 'холм', 'долина', 'пещера', 'скала', 'вулкан', 'каньон', 'ущелье',
  'небо', 'облако', 'дождь', 'снег', 'гроза', 'радуга', 'туман', 'ветер',
  'огонь', 'пламя', 'костёр', 'свеча', 'факел', 'молния', 'искра',
  'дом', 'квартира', 'комната', 'кухня', 'спальня', 'балкон', 'крыша', 'подвал',
  'стол', 'стул', 'кровать', 'шкаф', 'диван', 'кресло', 'полка', 'зеркало',
  'книга', 'газета', 'журнал', 'письмо', 'открытка', 'конверт', 'блокнот',
  'телефон', 'компьютер', 'телевизор', 'радио', 'камера', 'наушники', 'колонка',
  'музыка', 'песня', 'танец', 'концерт', 'опера', 'балет', 'оркестр', 'хор',
  'гитара', 'пианино', 'скрипка', 'барабан', 'флейта', 'труба', 'саксофон',
  'картина', 'скульптура', 'музей', 'галерея', 'выставка', 'театр', 'кино',
  'спорт', 'футбол', 'хоккей', 'теннис', 'баскетбол', 'волейбол', 'плавание',
  'бег', 'прыжок', 'лыжи', 'коньки', 'велоспорт', 'бокс', 'борьба', 'гимнастика',
  'врач', 'учитель', 'инженер', 'повар', 'водитель', 'пилот', 'художник', 'музыкант',
  'полиция', 'пожарный', 'строитель', 'фермер', 'продавец', 'официант', 'парикмахер',
  'школа', 'университет', 'библиотека', 'больница', 'аптека', 'магазин', 'рынок',
  'ресторан', 'кафе', 'отель', 'банк', 'почта', 'вокзал', 'аэропорт', 'порт',
  'завтрак', 'обед', 'ужин', 'хлеб', 'молоко', 'сыр', 'масло', 'яйцо',
  'мясо', 'рыба', 'курица', 'овощи', 'фрукты', 'салат', 'суп', 'каша',
  'яблоко', 'банан', 'апельсин', 'виноград', 'клубника', 'арбуз', 'дыня', 'персик',
  'картофель', 'морковь', 'помидор', 'огурец', 'капуста', 'лук', 'чеснок', 'перец',
  'чай', 'кофе', 'сок', 'вода', 'лимонад', 'молоко', 'какао', 'компот',
  'торт', 'пирог', 'печенье', 'конфета', 'шоколад', 'мороженое', 'варенье', 'мёд',
  'рубашка', 'брюки', 'платье', 'юбка', 'пальто', 'куртка', 'свитер', 'шарф',
  'шапка', 'перчатки', 'носки', 'ботинки', 'туфли', 'кроссовки', 'сапоги', 'тапочки',
  'сумка', 'рюкзак', 'кошелёк', 'зонт', 'очки', 'часы', 'кольцо', 'браслет',
  'праздник', 'свадьба', 'день рождения', 'новый год', 'рождество', 'пасха',
  'подарок', 'сюрприз', 'открытка', 'торт', 'шарик', 'фейерверк', 'гирлянда',
  'любовь', 'дружба', 'счастье', 'радость', 'улыбка', 'смех', 'слёзы', 'мечта',
  'путешествие', 'приключение', 'отпуск', 'каникулы', 'экскурсия', 'поход', 'пикник',
  'карта', 'компас', 'палатка', 'спальник', 'рюкзак', 'фонарик', 'термос',
  'фотография', 'видео', 'селфи', 'альбом', 'рамка', 'плакат', 'постер',
  'игра', 'игрушка', 'кукла', 'машинка', 'конструктор', 'пазл', 'мяч', 'скакалка',
  'шахматы', 'шашки', 'домино', 'карты', 'лото', 'монополия', 'настолка',
  'сказка', 'история', 'легенда', 'миф', 'басня', 'стихи', 'роман', 'детектив',
  'герой', 'злодей', 'принцесса', 'рыцарь', 'дракон', 'волшебник', 'фея', 'эльф',
  'замок', 'дворец', 'башня', 'крепость', 'мост', 'ворота', 'стена', 'ров',
  'меч', 'щит', 'лук', 'стрела', 'копьё', 'топор', 'кинжал', 'доспехи',
  'корона', 'трон', 'скипетр', 'мантия', 'плащ', 'сундук', 'сокровище', 'клад',
  'магия', 'заклинание', 'зелье', 'палочка', 'метла', 'котёл', 'кристалл', 'амулет',
  'робот', 'ракета', 'спутник', 'станция', 'скафандр', 'астронавт', 'пришелец',
  'динозавр', 'мамонт', 'птеродактиль', 'трицератопс', 'тираннозавр', 'ископаемое',
  'пирамида', 'сфинкс', 'мумия', 'фараон', 'саркофаг', 'иероглиф', 'папирус',
  'рыцарь', 'самурай', 'викинг', 'пират', 'ковбой', 'индеец', 'гладиатор',
  'детектив', 'шпион', 'агент', 'полицейский', 'преступник', 'улика', 'следствие',
  'наука', 'эксперимент', 'лаборатория', 'микроскоп', 'телескоп', 'формула', 'атом',
  'химия', 'физика', 'биология', 'математика', 'география', 'история', 'астрономия',
  'изобретение', 'открытие', 'патент', 'учёный', 'профессор', 'студент', 'диплом'
];

// Wikidata SPARQL endpoint
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

// Helper: fetch with timeout
async function fetchWithTimeout(url, options, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Backup: fetch from GitHub word list (fast and reliable)
async function fetchFromGitHub() {
  const words = new Set();
  
  try {
    const response = await fetchWithTimeout(
      'https://raw.githubusercontent.com/hingston/russian/master/10000-russian-words.txt',
      {},
      5000
    );
    const text = await response.text();
    const freqWords = text.split('\n')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length >= 4 && w.length <= 12 && /^[а-яё]+$/i.test(w));
    
    freqWords.slice(50, 4000).forEach(w => words.add(w));
    console.log(`Fetched ${words.size} words from GitHub`);
  } catch (e) {
    console.log('GitHub fetch failed:', e.message);
  }

  return words;
}

// Fetch from Wikidata (background, non-blocking)
async function fetchFromWikidataBackground() {
  const words = new Set();
  
  const query = `
    SELECT DISTINCT ?lemma WHERE {
      ?lexeme dct:language wd:Q7737;
              wikibase:lexicalCategory wd:Q1084;
              wikibase:lemma ?lemma.
      FILTER(LANG(?lemma) = "ru")
      FILTER(STRLEN(?lemma) >= 4 && STRLEN(?lemma) <= 14)
    }
    LIMIT 3000
  `;

  try {
    const response = await fetchWithTimeout(WIKIDATA_SPARQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'AliasGame/1.0'
      },
      body: `query=${encodeURIComponent(query)}`
    }, 15000);

    if (response.ok) {
      const data = await response.json();
      data.results.bindings.forEach(binding => {
        const word = binding.lemma.value.toLowerCase();
        if (/^[а-яё]+$/i.test(word) && word.length >= 4 && word.length <= 14) {
          words.add(word);
        }
      });
      console.log(`Wikidata: fetched ${words.size} nouns`);
    }
  } catch (error) {
    console.log('Wikidata fetch skipped (timeout or error)');
  }

  return words;
}

// Main fetch function - fast startup with background enrichment
async function fetchWordsFromAPI() {
  const allWords = new Set();
  
  // Add fallback words immediately
  fallbackWords.forEach(w => allWords.add(w));
  console.log(`Starting with ${allWords.size} fallback words`);
  
  // Try GitHub first (fast)
  try {
    const githubWords = await fetchFromGitHub();
    githubWords.forEach(w => allWords.add(w));
  } catch (e) {
    console.log('GitHub failed, using fallback only for now');
  }

  console.log(`Quick load complete: ${allWords.size} words`);
  
  // Background: try Wikidata (don't block)
  fetchFromWikidataBackground().then(wikidataWords => {
    if (wikidataWords.size > 0) {
      wikidataWords.forEach(w => wordCache.push(w));
      // Remove duplicates
      wordCache = [...new Set(wordCache)];
      console.log(`Background: added Wikidata words, total now: ${wordCache.length}`);
    }
  }).catch(() => {});

  return Array.from(allWords);
}

// Get words with caching
export async function getWords(count = 100) {
  const now = Date.now();
  
  // Refresh cache if needed
  if (wordCache.length === 0 || now - lastFetch > CACHE_DURATION) {
    console.log('Fetching fresh words from API...');
    const apiWords = await fetchWordsFromAPI();
    
    if (apiWords.length > 0) {
      wordCache = apiWords;
      lastFetch = now;
      console.log(`Cached ${wordCache.length} words`);
    } else {
      wordCache = fallbackWords;
      console.log('Using fallback words');
    }
  }

  // Return shuffled subset
  const shuffled = [...wordCache].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Get random word from cache
export function getRandomWord() {
  if (wordCache.length === 0) {
    return fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
  }
  return wordCache[Math.floor(Math.random() * wordCache.length)];
}

// Initialize word cache on startup
export async function initWordCache() {
  await getWords(100);
  console.log(`Word service initialized with ${wordCache.length} words`);
}

export default { getWords, getRandomWord, initWordCache };
