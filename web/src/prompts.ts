import type { TvdbMovieDetails } from './types';
import { parseMoney } from './utils';

export interface Prompt {
  id: string;
  label: string;
  test: (movie: TvdbMovieDetails, title: string) => boolean;
}

// --- Data Sources ---
const DIRECTORS = [
  'Steven Spielberg', 'Martin Scorsese', 'Quentin Tarantino', 'Alfred Hitchcock',
  'Stanley Kubrick', 'Christopher Nolan', 'Akira Kurosawa',
  'Spike Lee', 'Wes Anderson', 'David Fincher', 'Denis Villeneuve',
  'James Cameron', 'Peter Jackson', 'Ridley Scott', 'Tim Burton', 'Coen Brothers',
  'The Wachowskis', 'Sofia Coppola', 'Greta Gerwig', 'Bong Joon-ho', 'Hayao Miyazaki',
  'Guillermo del Toro', 'Jordan Peele', 'Taika Waititi', 'David Lynch'
];

const ACTORS = [
  'Tom Hanks', 'Leonardo DiCaprio', 'Denzel Washington', 'Meryl Streep',
  'Robert De Niro', 'Al Pacino', 'Jack Nicholson', 'Morgan Freeman',
  'Samuel L. Jackson', 'Kate Winslet', 'Brad Pitt', 'Cate Blanchett',
  'Jodie Foster', 'Anthony Hopkins', 'Daniel Day-Lewis', 'Christian Bale',
  'Tilda Swinton', 'Joaquin Phoenix', 'Frances McDormand', 'Philip Seymour Hoffman',
  'Viola Davis', 'Amy Adams', 'Jeff Bridges', 'Gary Oldman', 'Julianne Moore',
  'Scarlett Johansson', 'Ryan Gosling', 'Ryan Reynolds', 'Emma Stone', 'Natalie Portman',
  'Keanu Reeves', 'Sandra Bullock', 'Hugh Jackman', 'Anne Hathaway', 'Tom Cruise',
  'Keira Knightley', 'Matt Damon', 'Ben Affleck', 'George Clooney', 'Emily Blunt',
  'Michael Fassbender', 'Idris Elba', 'Mahershala Ali', 'Adam Driver', 'Robert Downey Jr.',
  'Zendaya', 'Anya Taylor-Joy', 'Timothée Chalamet', 'Florence Pugh', 'Brie Larson'
];

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller',
  'Western'
];

const DECADES = [1970, 1980, 1990, 2000, 2010];

// --- Prompt Generator Functions ---

// Utility to create a regex-safe version of a name for matching
const nameToRegex = (name: string) => new RegExp(name.replace(/\s+/g, '\\s+'), 'i');

const getYear = (m: TvdbMovieDetails): number => {
  if (m.year != null) {
    const y = Number(String(m.year).slice(0, 4));
    if (!Number.isNaN(y)) return y;
  }
  if (m.releaseDate != null) {
    const s = String(m.releaseDate);
    const yy = Number(s.slice(0, 4));
    if (!Number.isNaN(yy)) return yy;
  }
  return NaN;
};

// --- Generator Templates ---

const directorPrompt = (director: string): Prompt => {
  // Special case for directorial teams
  if (director === 'Coen Brothers') {
    return {
      id: `director-coen-brothers`,
      label: `Directed by the Coen Brothers`,
      test: (m) => {
        const directors = (m.people || []).filter(p => /director/i.test(p.peopleType || p.type || ''));
        const hasJoel = directors.some(d => /Joel Coen/i.test(d.name));
        const hasEthan = directors.some(d => /Ethan Coen/i.test(d.name));
        return hasJoel && hasEthan;
      }
    };
  }
  if (director === 'The Wachowskis') {
    return {
      id: `director-the-wachowskis`,
      label: `Directed by The Wachowskis`,
      test: (m) => {
        const directors = (m.people || []).filter(p => /director/i.test(p.peopleType || p.type || ''));
        const hasLana = directors.some(d => /Lana Wachowski/i.test(d.name));
        const hasLilly = directors.some(d => /Lilly Wachowski/i.test(d.name));
        return hasLana && hasLilly;
      }
    };
  }
  
  return {
    id: `director-${director.toLowerCase().replace(/\s+/g, '-')}`,
    label: `Directed by ${director}`,
    test: (m) => (m.people || []).some(p => /director/i.test(p.peopleType || p.type || '') && nameToRegex(director).test(p.name))
  };
};

const actorPrompt = (actor: string): Prompt => ({
  id: `actor-${actor.toLowerCase().replace(/\s+/g, '-')}`,
  label: `Stars ${actor}`,
  test: (m) => (m.people || []).some(p => /actor|actress/i.test(p.peopleType || p.type || '') && nameToRegex(actor).test(p.name))
});

const genrePrompt = (genre: string): Prompt => ({
  id: `genre-${genre.toLowerCase().replace(/\s+/g, '-')}`,
  label: `Genre: ${genre}`,
  test: (m) => (m.genres || []).some(g => new RegExp(genre.replace('Sci-Fi', '(Science\\s*Fiction|Sci[-\\s]*Fi)'), 'i').test(g))
});

const decadePrompt = (decade: number): Prompt => ({
  id: `year-${decade}s`,
  label: `Released in the ${decade}s`,
  test: (m) => {
    const y = getYear(m);
    return y >= decade && y <= decade + 9;
  }
});

const staticPrompts: Prompt[] = [
  // Title
  { id: 'starts-the', label: 'Title starts with "The"', test: (_, title) => /^the\b/i.test(title) },
  { id: 'one-word', label: 'One-word title', test: (_, title) => title.trim().split(/\s+/g).length === 1 },
  { id: 'has-number', label: 'Title contains a number', test: (_, title) => {
    const spelledOutNumbers = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion';
    const romanNumerals = 'II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX';
    const numberRegex = new RegExp(`\\d|\\b(${spelledOutNumbers})\\b|\\b(${romanNumerals})\\b`, 'i');
    return numberRegex.test(title);
  } },
  { id: 'has-color', label: 'Title contains a color', test: (_, title) => /(red|blue|green|black|white|gold|silver|pink|purple|brown|gray|grey|orange|yellow)\b/i.test(title) },
  { id: 'has-colon', label: 'Has a subtitle (colon)', test: (_, title) => /:/.test(title) },
  
  // Runtime
  { id: 'runtime-short', label: 'Runtime < 90 min', test: (m) => Number(m.runtime ?? 1e9) < 90 },
  { id: 'runtime-epic', label: 'Runtime ≥ 150 min', test: (m) => Number(m.runtime ?? 0) >= 150 },
  
  // People
  { id: 'written-and-directed-same', label: 'Written & Directed by same person', test: (m) => {
      const dirs = new Set((m.people||[]).filter(p => /director/i.test(p.peopleType|| p.type || '')).map(p => p.name.toLowerCase()));
      if (dirs.size === 0) return false;
      const wrs = new Set((m.people||[]).filter(p => /writer/i.test(p.peopleType|| p.type || '')).map(p => p.name.toLowerCase()));
      for (const d of dirs) if (wrs.has(d)) return true;
      return false;
    }
  },

  // Language
  { id: 'lang-non-english', label: 'Not in the English language', test: (m) => m.originalLanguage !== 'eng' },

  // Budget & Box Office
  { id: 'budget-under-1m', label: 'Budget < $1 million', test: (m) => parseMoney(m.budget) < 1000000 },
  { id: 'budget-over-100m', label: 'Budget > $100 million', test: (m) => parseMoney(m.budget) > 100000000 },
  { id: 'box-office-10x', label: 'Grossed > 10x budget', test: (m) => {
    const budget = parseMoney(m.budget);
    const boxOffice = parseMoney(m.boxOffice);
    return budget > 0 && boxOffice > (budget * 10);
  }},
  { id: 'box-office-flop', label: 'Grossed < 2x budget', test: (m) => {
    const budget = parseMoney(m.budget);
    const boxOffice = parseMoney(m.boxOffice);
    return budget > 0 && boxOffice < (budget * 2);
  }},
  
  // Awards
  { id: 'award-oscar-winner', label: 'Won at least one Oscar', test: (m) => {
    const oscars = (m.awards || []).filter(a => a.isWinner && a.name === 'Academy Awards');
    return oscars.length > 0;
  }},
  { id: 'award-multi-oscar-winner', label: 'Won multiple Oscars', test: (m) => {
    const oscars = (m.awards || []).filter(a => a.isWinner && a.name === 'Academy Awards');
    return oscars.length > 1;
  }},
  { id: 'award-no-oscars', label: 'Won no Oscars', test: (m) => {
    const oscars = (m.awards || []).filter(a => a.isWinner && a.name === 'Academy Awards');
    return oscars.length === 0;
  }},
  { id: 'award-10-plus', label: 'Won 10+ major awards', test: (m) => {
    const wins = (m.awards || []).filter(a => a.isWinner);
    return wins.length >= 10;
  }},
];

export const allPossiblePrompts = [
  ...DIRECTORS.map(directorPrompt),
  ...ACTORS.map(actorPrompt),
  ...GENRES.map(genrePrompt),
  ...DECADES.map(decadePrompt),
  ...staticPrompts
];

// --- Main Generation Logic ---

// Helper to shuffle an array
function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function generatePrompts(): Prompt[] {
  const generatedPrompts: Prompt[] = [];

  // Add a balanced mix of prompt types for a 16-cell grid
  shuffle(DIRECTORS).slice(0, 2).forEach(d => generatedPrompts.push(directorPrompt(d)));
  shuffle(ACTORS).slice(0, 6).forEach(a => generatedPrompts.push(actorPrompt(a)));
  shuffle(GENRES).slice(0, 4).forEach(g => generatedPrompts.push(genrePrompt(g)));
  shuffle(DECADES).slice(0, 2).forEach(d => generatedPrompts.push(decadePrompt(d)));
  
  // Add static prompts and ensure we have 16 total
  const remaining = 16 - generatedPrompts.length;
  generatedPrompts.push(...shuffle(staticPrompts).slice(0, remaining));

  return shuffle(generatedPrompts);
}

export function generateSinglePrompt(existingPrompts: Prompt[]): Prompt {
  const allPossiblePrompts = [
    ...DIRECTORS.map(directorPrompt),
    ...ACTORS.map(actorPrompt),
    ...GENRES.map(genrePrompt),
    ...DECADES.map(decadePrompt),
    ...staticPrompts
  ];

  const existingIds = new Set(existingPrompts.map(p => p.id));
  const availablePrompts = allPossiblePrompts.filter(p => !existingIds.has(p.id));

  if (availablePrompts.length === 0) {
    // Fallback in case we run out of unique prompts, though unlikely.
    return shuffle(allPossiblePrompts)[0];
  }

  return shuffle(availablePrompts)[0];
}
