const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '../../../');
const DB_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DB_DIR, 'movies.db');
const DATA_ROOT = path.resolve(__dirname, '../../../Film Databases');

const FILES = {
  basics: path.join(DATA_ROOT, 'title.basics.tsv'),
  ratings: path.join(DATA_ROOT, 'title.ratings.tsv'),
  crew: path.join(DATA_ROOT, 'title.crew.tsv'),
  principals: path.join(DATA_ROOT, 'title.principals.tsv'),
  names: path.join(DATA_ROOT, 'name.basics.tsv'),
};

const VOTE_MIN = Number(process.env.VOTE_MIN || 5000);
const MAX_ROWS = process.env.MAX_ROWS ? Number(process.env.MAX_ROWS) : null; // for sampling

function parseTSVLine(line) {
  // Basic TSV split; values may contain commas, not tabs.
  return line.split('\t').map((v) => (v === '\\N' ? null : v));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function importAll() {
  ensureDir(DB_DIR);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  const schema = fs.readFileSync(path.resolve(__dirname, '../sql/schema.sql'), 'utf-8');
  db.exec(schema);

  // Load ratings first to filter on numVotes
  console.log('Loading ratings...');
  const ratingsMap = new Map();
  await streamFile(FILES.ratings, (cols, i) => {
    if (i === 0) return; // header
    const [tconst, averageRating, numVotes] = cols;
    const nv = Number(numVotes);
    if (!Number.isFinite(nv)) return;
    if (nv >= VOTE_MIN) ratingsMap.set(tconst, { averageRating: Number(averageRating), numVotes: nv });
  }, MAX_ROWS);
  console.log('Ratings loaded:', ratingsMap.size);

  // Basics
  console.log('Importing basics...');
  const insertBasics = db.prepare(
    `INSERT INTO title_basics (tconst, titleType, primaryTitle, originalTitle, isAdult, startYear, endYear, runtimeMinutes, genres, numVotes, averageRating)
     VALUES (@tconst, @titleType, @primaryTitle, @originalTitle, @isAdult, @startYear, @endYear, @runtimeMinutes, @genres, @numVotes, @averageRating)`
  );
  const insertFts = db.prepare(`INSERT INTO title_fts (tconst, title) VALUES (?, ?)`);
  const txBasics = db.transaction((rows) => {
    for (const r of rows) {
      insertBasics.run(r);
      if (r.titleType === 'movie') insertFts.run(r.tconst, r.primaryTitle);
    }
  });

  const basicsBatch = [];
  await streamFile(FILES.basics, (cols, i) => {
    if (i === 0) return; // header
    const [tconst, titleType, primaryTitle, originalTitle, isAdult, startYear, endYear, runtimeMinutes, genres] = cols;
    if (titleType !== 'movie') return;
    const rating = ratingsMap.get(tconst);
    if (!rating) return;
    basicsBatch.push({
      tconst,
      titleType,
      primaryTitle,
      originalTitle,
      isAdult: isAdult ? Number(isAdult) : 0,
      startYear: startYear ? Number(startYear) : null,
      endYear: endYear ? Number(endYear) : null,
      runtimeMinutes: runtimeMinutes ? Number(runtimeMinutes) : null,
      genres,
      numVotes: rating.numVotes,
      averageRating: rating.averageRating,
    });
    if (basicsBatch.length >= 1000) {
      txBasics(basicsBatch.splice(0));
    }
  }, MAX_ROWS);
  if (basicsBatch.length) txBasics(basicsBatch);

  // Names (only those referenced later)
  console.log('Indexing names referenced by crew/principals...');
  const referencedNames = new Set();

  // Crew → directors/writers tables
  console.log('Importing crew...');
  const insertDir = db.prepare(`INSERT INTO title_directors (tconst, nconst) VALUES (?, ?)`);
  const insertWri = db.prepare(`INSERT INTO title_writers (tconst, nconst) VALUES (?, ?)`);
  const txCrew = db.transaction((rows) => {
    for (const { tconst, directors, writers } of rows) {
      for (const d of directors) insertDir.run(tconst, d), referencedNames.add(d);
      for (const w of writers) insertWri.run(tconst, w), referencedNames.add(w);
    }
  });

  let crewBatch = [];
  const hasTitle = db.prepare('SELECT 1 FROM title_basics WHERE tconst=?');
  await streamFile(FILES.crew, (cols, i) => {
    if (i === 0) return;
    const [tconst, directorsStr, writersStr] = cols;
    if (!hasTitle.get(tconst)) return;
    const directors = (directorsStr || '').split(',').filter(Boolean);
    const writers = (writersStr || '').split(',').filter(Boolean);
    crewBatch.push({ tconst, directors, writers });
    if (crewBatch.length >= 1000) txCrew(crewBatch.splice(0));
  }, MAX_ROWS);
  if (crewBatch.length) txCrew(crewBatch);

  // Principals → cast table (store only actor/actress and small ordering)
  console.log('Importing principals (actors only)...');
  const insertPrin = db.prepare(
    `INSERT INTO title_principals (tconst, ordering, nconst, category) VALUES (?, ?, ?, ?)`
  );
  const txPrin = db.transaction((rows) => {
    for (const r of rows) insertPrin.run(r.tconst, r.ordering, r.nconst, r.category), referencedNames.add(r.nconst);
  });
  let prinBatch = [];
  await streamFile(FILES.principals, (cols, i) => {
    if (i === 0) return;
    const [tconst, ordering, nconst, category] = [cols[0], Number(cols[1]), cols[2], cols[3]];
    if (!hasTitle.get(tconst)) return;
    if (category !== 'actor' && category !== 'actress') return;
    prinBatch.push({ tconst, ordering, nconst, category });
    if (prinBatch.length >= 2000) txPrin(prinBatch.splice(0));
  }, MAX_ROWS ? Math.min(MAX_ROWS * 10, MAX_ROWS) : null);
  if (prinBatch.length) txPrin(prinBatch);

  // Names table, but only referenced
  console.log('Importing names...');
  const insertName = db.prepare(`INSERT INTO names (nconst, primaryName) VALUES (?, ?)`);
  const txNames = db.transaction((rows) => {
    for (const r of rows) insertName.run(r.nconst, r.primaryName);
  });
  let nameBatch = [];
  await streamFile(FILES.names, (cols, i) => {
    if (i === 0) return;
    const [nconst, primaryName] = [cols[0], cols[1]];
    if (!referencedNames.has(nconst)) return;
    nameBatch.push({ nconst, primaryName });
    if (nameBatch.length >= 2000) txNames(nameBatch.splice(0));
  }, MAX_ROWS ? Math.min(MAX_ROWS * 5, MAX_ROWS) : null);
  if (nameBatch.length) txNames(nameBatch);

  // Optimize
  console.log('Creating indexes and optimizing...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_basics_title ON title_basics(primaryTitle);
    CREATE INDEX IF NOT EXISTS idx_basics_year ON title_basics(startYear);
    CREATE INDEX IF NOT EXISTS idx_basics_runtime ON title_basics(runtimeMinutes);
    CREATE INDEX IF NOT EXISTS idx_basics_type ON title_basics(titleType);
  `);

  console.log('Done. DB at', DB_PATH);
}

async function streamFile(filePath, onLine, maxLines) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let i = 0;
  for await (const line of rl) {
    const cols = parseTSVLine(line);
    onLine(cols, i++);
    if (maxLines && i >= maxLines) break;
  }
}

importAll().catch((e) => {
  console.error(e);
  process.exit(1);
});


