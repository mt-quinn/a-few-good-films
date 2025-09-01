import seedrandom from 'seedrandom';
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
  'Stanley Kubrick', 'Christopher Nolan', 
  'Spike Lee', 'Wes Anderson', 'David Fincher', 'Denis Villeneuve',
  'James Cameron', 'Peter Jackson', 'Ridley Scott', 'Tim Burton', 'Coen Brothers',
  'The Wachowskis', 'Hayao Miyazaki',
  'Guillermo del Toro', 'Jordan Peele', 'Taika Waititi', 'David Lynch',
  'J.J. Abrams', 'Robert Zemeckis', 'Jon Favreau', 'Sam Raimi', 'Clint Eastwood',
  'George Clooney', 'M Night Shyamalan', 'Russo Brothers', 'George Lucas',
  'Zack Snyder', 'Joss Whedon', 'Michael Bay', 'John Carpenter', 'David Cronenberg',
  'John Hughes', 'Terry Gilliam'
];

const ACTORS = [
  'Tom Hanks', 'Leonardo DiCaprio', 'Denzel Washington', 'Meryl Streep',
  'Robert De Niro', 'Al Pacino', 'Jack Nicholson', 'Morgan Freeman',
  'Samuel L. Jackson', 'Kate Winslet', 'Brad Pitt', 'Cate Blanchett',
  'Jodie Foster', 'Anthony Hopkins', 'Daniel Day-Lewis', 'Christian Bale',
  'Dustin Hoffman', 'Robin Williams', 'Sean Connery', 'Harrison Ford',
  'Clint Eastwood', 'Julia Roberts', 'Will Smith', 'Tom Cruise', 'Johnny Depp',
  'Sigourney Weaver', 'Sandra Bullock', 'Keanu Reeves', 'Angelina Jolie',
  'Matt Damon', 'George Clooney', 'Joaquin Phoenix', 'Philip Seymour Hoffman',
  'Viola Davis', 'Tilda Swinton', 'Gary Oldman', 'Jeff Bridges', 'Julianne Moore',
  'Natalie Portman', 'Robert Redford', 'Steve McQueen', 'Michael Caine',
  'Sean Penn', 'Whoopi Goldberg', 'Alan Rickman', 'James Earl Jones',
  'Arnold Schwarzenegger', 'Sylvester Stallone', 'Bruce Willis', 'Mel Gibson',
  'Kevin Costner', 'Russell Crowe', 'Bill Murray', 'Eddie Murphy', 'Jim Carrey',
  'Steve Martin', 'John Travolta', 'Kurt Russell', 'Christopher Walken',
  'Scarlett Johansson', 'Ryan Gosling', 'Ryan Reynolds', 'Emma Stone',
  'Hugh Jackman', 'Anne Hathaway', 'Keira Knightley', 'Ben Affleck',
  'Emily Blunt', 'Michael Fassbender', 'Idris Elba', 'Mahershala Ali',
  'Adam Driver', 'Robert Downey Jr.', 'Chris Evans', 'Chris Hemsworth',
  'Mark Ruffalo', 'Jeremy Renner', 'Chris Pratt', 'Dwayne "The Rock" Johnson',
  'Hugh Jackman', 'Patrick Stewart', 'Ian McKellen', 'Daniel Radcliffe',
  'Helena Bonham Carter', 'Ralph Fiennes', 'Liam Neeson', 'Ewan McGregor',
  'Charlize Theron', 'Halle Berry', 'Jennifer Lawrence', 'Reese Witherspoon',
  'Cameron Diaz', 'Drew Barrymore', 'Gwyneth Paltrow', 'Edward Norton',
  'Will Ferrell', 'Steve Carell', 'Tina Fey', 'Tom Hardy', 'Benedict Cumberbatch',
  'Martin Freeman', 'Colin Firth', 'Mark Strong', 'Geoffrey Rush',
  'Javier Bardem', 'Antonio Banderas', 'Christoph Waltz', 'Daniel Craig',
  'Judi Dench', 'Helen Mirren', 'Emma Thompson', 'Orlando Bloom',
  'Viggo Mortensen', 'Elijah Wood', 'Andy Serkis', 'Hugo Weaving',
  'Christopher Lee', 'Willem Dafoe', 'Jeff Goldblum', 'Sam Neill', 'Uma Thurman',
  'Val Kilmer', 'Tommy Lee Jones', 'John Goodman', 'Steve Buscemi',
  'Benicio del Toro', 'Forest Whitaker', 'Jamie Foxx', 'Jon Hamm', 'Elisabeth Moss',
  'Oscar Isaac', 'John Boyega', 'Jake Gyllenhaal', 'Heath Ledger',
  'Bradley Cooper', 'Vin Diesel', 'Jason Statham', 'Jackie Chan',
  'Zendaya', 'Anya Taylor-Joy', 'Timothée Chalamet', 'Florence Pugh', 'Brie Larson'
];

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller',
  'Western', 'Musical', 'War', 'History', 'Family', 'Sport'
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
  if (director === 'Russo Brothers') {
    return {
      id: `director-russo-brothers`,
      label: `Directed by the Russo Brothers`,
      test: (m) => {
        const directors = (m.people || []).filter(p => /director/i.test(p.peopleType || p.type || ''));
        const hasAnthony = directors.some(d => /Anthony Russo/i.test(d.name));
        const hasJoe = directors.some(d => /Joe Russo/i.test(d.name));
        return hasAnthony && hasJoe;
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
  test: (m) => (m.genres || []).some(g => new RegExp(genre.replace('Sci-Fi', '(Science\\s*Fiction|Sci[-\\s]*Fi)').replace('Animation', 'Animation|Anime'), 'i').test(g))
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
  // Year
  { id: 'year-before-2000', label: 'Released before 2000', test: (m) => getYear(m) < 2000 },
  { id: 'year-after-2000', label: 'Released after 2000', test: (m) => getYear(m) > 2000 },
  { id: 'year-after-2020', label: 'Released after 2020', test: (m) => getYear(m) > 2020 },
  { id: 'year-before-1970', label: 'Released before 1970', test: (m) => getYear(m) < 1970 },
  
  // Title
  { id: 'title-possessive', label: `Title is possessive ('s)`, test: (_, title) => /'s\b/.test(title) },
  { id: 'title-long-5', label: 'Title is 5 words or longer', test: (_, title) => title.trim().split(/\s+/g).length >= 5 },
  { id: 'title-alliterative', label: 'Alliterative title', test: (_, title) => {
    const commonWords = new Set(['a', 'an', 'the', 'in', 'on', 'of', 'for', 'to', 'with', 'and', 'or', 'but']);
    const words = title.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => !commonWords.has(w) && w.length >= 1);
    if (words.length < 2) return false;
    const firstLetters = words.map(w => w[0]);
    const letterCounts = firstLetters.reduce((acc, letter) => {
      acc[letter] = (acc[letter] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.values(letterCounts).some(count => count >= 2);
  }},
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

const promptCategories = [
  { weight: 2, source: DIRECTORS.map(directorPrompt) },
  { weight: 3, source: ACTORS.map(actorPrompt) },
  { weight: 3, source: GENRES.map(genrePrompt) },
  { weight: 2, source: DECADES.map(decadePrompt) },
  { weight: 3, source: staticPrompts }
];

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
  const seed = `${new Date().toISOString().split('T')[0]}`; // Create a stable seed for this generation run
  for (let i = 0; i < 16; i++) {
    const newPrompt = generateSinglePrompt(generatedPrompts, seed, i);
    generatedPrompts.push(newPrompt);
  }
  return shuffle(generatedPrompts);
}

export function generateSinglePrompt(existingPrompts: Prompt[], seed: string, rerollIndex: number): Prompt {
  const rng = seedrandom(seed + '-reroll-' + rerollIndex);
  const existingIds = new Set(existingPrompts.map(p => p.id));

  // This is safe because the total number of prompts far exceeds the 16 on the board.
  while (true) {
    const totalWeight = promptCategories.reduce((sum, cat) => {
      const available = cat.source.filter(p => !existingIds.has(p.id));
      return sum + (available.length > 0 ? cat.weight : 0);
    }, 0);
    const randomWeight = rng() * totalWeight;
    let currentWeight = 0;

    for (const category of promptCategories) {
      const availableInCategory = category.source.filter(p => !existingIds.has(p.id));
      if (availableInCategory.length === 0) continue;

      currentWeight += category.weight;
      if (randomWeight < currentWeight) {
        // This is the chosen category.
        
        // Pick a random prompt from the available ones in this category and return it.
        const randomIndex = Math.floor(rng() * availableInCategory.length);
        return availableInCategory[randomIndex];
      }
    }
  }
}
