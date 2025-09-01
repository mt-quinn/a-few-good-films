const seedrandom = require('seedrandom');

// --- Data Sources ---
const DIRECTORS = [
  'Steven Spielberg', 'Martin Scorsese', 'Quentin Tarantino', 'Alfred Hitchcock',
  'Stanley Kubrick', 'Christopher Nolan', 'Akira Kurosawa',
  'Spike Lee', 'Wes Anderson', 'David Fincher', 'Denis Villeneuve',
  'James Cameron', 'Peter Jackson', 'Ridley Scott', 'Tim Burton', 'Coen Brothers',
  'The Wachowskis', 'Sofia Coppola', 'Greta Gerwig', 'Bong Joon-ho', 'Hayao Miyazaki',
  'Guillermo del Toro', 'Jordan Peele', 'Taika Waititi', 'David Lynch',
  'J.J. Abrams', 'Robert Zemeckis', 'Jon Favreau', 'Sam Raimi', 'Clint Eastwood',
  'George Clooney', 'M Night Shyamalan', 'Russo Brothers', 'George Lucas',
  'Zack Snyder', 'Joss Whedon', 'Michael Bay', 'John Carpenter', 'David Cronenberg',
  'John Hughes', 'Terry Gilliam'
];

const ACTORS = [
  // Classics & Legends
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

  // Modern Superstars
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

  // Rising Stars
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
  if (director === 'Russo Brothers') {
    return {
      id: `director-russo-brothers`,
      label: `Directed by the Russo Brothers`,
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
  // Year
  { id: 'year-before-2000', label: 'Released before 2000' },
  { id: 'year-after-2000', label: 'Released after 2000' },
  { id: 'year-after-2020', label: 'Released after 2020' },
  { id: 'year-before-1970', label: 'Released before 1970' },
  
  // Title
  { id: 'title-possessive', label: `Title is possessive ('s)` },
  { id: 'title-long-5', label: 'Title is 5 words or longer' },
  { id: 'title-alliterative', label: 'Alliterative title' },
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

const promptCategories = [
  { weight: 2, source: DIRECTORS.map(directorPrompt) },
  { weight: 5, source: ACTORS.map(actorPrompt) },
  { weight: 4, source: GENRES.map(genrePrompt) },
  { weight: 2, source: DECADES.map(decadePrompt) },
  { weight: 3, source: staticPrompts }
];

const totalWeight = promptCategories.reduce((sum, cat) => sum + cat.weight, 0);

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

  for (let i = 0; i < 16; i++) {
    const newPrompt = generateSinglePrompt(generatedPrompts, rng);
    generatedPrompts.push(newPrompt);
  }

  return shuffle(generatedPrompts, rng);
}

function generateSinglePrompt(existingPrompts, rng) {
  const existingIds = new Set(existingPrompts.map(p => p.id));

  // Loop indefinitely until a valid, unused prompt is found.
  while (true) {
    const randomWeight = rng() * totalWeight;
    let currentWeight = 0;

    for (const category of promptCategories) {
      currentWeight += category.weight;
      if (randomWeight < currentWeight) {
        // This is the chosen category.
        const availableInCategory = category.source.filter(p => !existingIds.has(p.id));

        if (availableInCategory.length > 0) {
          // Pick a random prompt from the available ones in this category and return it.
          const randomIndex = Math.floor(rng() * availableInCategory.length);
          return availableInCategory[randomIndex];
        }

        // If no prompts were available, break to try another category.
        break;
      }
    }
  }
}

module.exports = { generatePrompts, generateSinglePrompt };
