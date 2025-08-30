const seedrandom = require('seedrandom');

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
  'Viola Davis', 'Amy Adams', 'Jeff Bridges', 'Gary Oldman', 'Julianne Moore'
];

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller',
  'Western'
];

const DECADES = [1970, 1980, 1990, 2000, 2010];

// --- Prompt Generator Functions ---

// Utility to create a regex-safe version of a name for matching
const nameToRegex = (name) => new RegExp(name.replace(/\s+/g, '\\s+'), 'i');

const getYear = (m) => {
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

const directorPrompt = (director) => {
  // Special case for directorial teams
  if (director === 'Coen Brothers') {
    return {
      id: `director-coen-brothers`,
      label: `Directed by the Coen Brothers`,
    };
  }
  if (director === 'The Wachowskis') {
    return {
      id: `director-the-wachowskis`,
      label: `Directed by The Wachowskis`,
    };
  }
  
  return {
    id: `director-${director.toLowerCase().replace(/\s+/g, '-')}`,
    label: `Directed by ${director}`,
  };
};

const actorPrompt = (actor) => ({
  id: `actor-${actor.toLowerCase().replace(/\s+/g, '-')}`,
  label: `Stars ${actor}`,
});

const genrePrompt = (genre) => ({
  id: `genre-${genre.toLowerCase().replace(/\s+/g, '-')}`,
  label: `Genre: ${genre}`,
});

const decadePrompt = (decade) => ({
  id: `year-${decade}s`,
  label: `Released in the ${decade}s`,
});

const staticPrompts = [
  // Title
  { id: 'starts-the', label: 'Title starts with "The"' },
  { id: 'one-word', label: 'One-word title' },
  { id: 'has-number', label: 'Title contains a number' },
  { id: 'has-color', label: 'Title contains a color' },
  { id: 'has-colon', label: 'Has a subtitle (colon)' },
  
  // Runtime
  { id: 'runtime-short', label: 'Runtime < 90 min' },
  { id: 'runtime-epic', label: 'Runtime ≥ 150 min' },
  
  // People
  { id: 'written-and-directed-same', label: 'Written & Directed by same person' },

  // Language
  { id: 'lang-non-english', label: 'Not in the English language' },

  // Budget & Box Office
  { id: 'budget-under-1m', label: 'Budget < $1 million' },
  { id: 'budget-over-100m', label: 'Budget > $100 million' },
  { id: 'box-office-10x', label: 'Grossed > 10x budget' },
  { id: 'box-office-flop', label: 'Grossed < 2x budget' },
  
  // Awards
  { id: 'award-oscar-winner', label: 'Won at least one Oscar' },
  { id: 'award-multi-oscar-winner', label: 'Won multiple Oscars' },
  { id: 'award-no-oscars', label: 'Won no Oscars' },
  { id: 'award-10-plus', label: 'Won 10+ major awards' },
];

// --- Main Generation Logic ---

// Helper to shuffle an array
function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function generatePrompts(seed) {
  const rng = seedrandom(seed);
  const generatedPrompts = [];

  // Add a balanced mix of prompt types for a 16-cell grid
  shuffle([...DIRECTORS], rng).slice(0, 4).forEach(d => generatedPrompts.push(directorPrompt(d)));
  shuffle([...ACTORS], rng).slice(0, 4).forEach(a => generatedPrompts.push(actorPrompt(a)));
  shuffle([...GENRES], rng).slice(0, 4).forEach(g => generatedPrompts.push(genrePrompt(g)));
  shuffle([...DECADES], rng).slice(0, 2).forEach(d => generatedPrompts.push(decadePrompt(d)));
  
  // Add static prompts and ensure we have 16 total
  const remaining = 16 - generatedPrompts.length;
  generatedPrompts.push(...shuffle([...staticPrompts], rng).slice(0, remaining));

  return shuffle(generatedPrompts, rng);
}

function generateSinglePrompt(existingPrompts, seed) {
    const rng = seedrandom(seed);
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
    return shuffle(allPossiblePrompts, rng)[0];
  }

  return shuffle(availablePrompts, rng)[0];
}

module.exports = { generatePrompts, generateSinglePrompt };
