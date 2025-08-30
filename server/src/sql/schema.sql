PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA temp_store=MEMORY;

-- Core tables
CREATE TABLE IF NOT EXISTS title_basics (
  tconst TEXT PRIMARY KEY,
  titleType TEXT,
  primaryTitle TEXT,
  originalTitle TEXT,
  isAdult INTEGER,
  startYear INTEGER,
  endYear INTEGER,
  runtimeMinutes INTEGER,
  genres TEXT,
  numVotes INTEGER,
  averageRating REAL
);

CREATE TABLE IF NOT EXISTS title_ratings (
  tconst TEXT PRIMARY KEY,
  averageRating REAL,
  numVotes INTEGER
);

CREATE TABLE IF NOT EXISTS title_directors (
  tconst TEXT,
  nconst TEXT
);
CREATE INDEX IF NOT EXISTS idx_title_directors_tconst ON title_directors(tconst);
CREATE INDEX IF NOT EXISTS idx_title_directors_nconst ON title_directors(nconst);

CREATE TABLE IF NOT EXISTS title_writers (
  tconst TEXT,
  nconst TEXT
);
CREATE INDEX IF NOT EXISTS idx_title_writers_tconst ON title_writers(tconst);
CREATE INDEX IF NOT EXISTS idx_title_writers_nconst ON title_writers(nconst);

CREATE TABLE IF NOT EXISTS title_principals (
  tconst TEXT,
  ordering INTEGER,
  nconst TEXT,
  category TEXT
);
CREATE INDEX IF NOT EXISTS idx_title_principals_tconst ON title_principals(tconst);
CREATE INDEX IF NOT EXISTS idx_title_principals_nconst ON title_principals(nconst);
CREATE INDEX IF NOT EXISTS idx_title_principals_cat ON title_principals(category);

CREATE TABLE IF NOT EXISTS names (
  nconst TEXT PRIMARY KEY,
  primaryName TEXT
);

-- Full-text search for titles
CREATE VIRTUAL TABLE IF NOT EXISTS title_fts USING fts5(
  tconst UNINDEXED,
  title,
  content=''
);


