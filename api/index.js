const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { generatePrompts, generateSinglePrompt } = require('./game');

const IS_VERCEL = !!process.env.VERCEL;
const app = express();
const router = express.Router();

app.use(cors());
app.use(express.json());

let db;
try {
  const dbPath = path.resolve(__dirname, '../data/movies.db');
  console.log(`[API] Connecting to DB at ${dbPath}`);
  db = new Database(dbPath, {
    readonly: IS_VERCEL,
    fileMustExist: true,
  });
  console.log('[API] DB connection successful');
} catch (err) {
  console.error('[API] DB connection error:', err);
}

if (!IS_VERCEL) {
  // Ensure cache tables
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS tvdb_search_cache (
      q TEXT PRIMARY KEY,
      json TEXT,
      ts INTEGER
    );
    CREATE TABLE IF NOT EXISTS tvdb_movie_cache (
      id TEXT PRIMARY KEY,
      json TEXT,
      ts INTEGER
    );
  `);
    // Clear search cache on startup to ensure fresh data during dev
    db.exec(`DELETE FROM tvdb_search_cache;`);
  } catch (e) {
    console.error('Failed to ensure cache tables', e);
  }
}

const TVDB_BASE = 'https://api4.thetvdb.com/v4';
let inMemoryToken = null;

function readFileTrim(p) {
  try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; }
}

function getApiKey() {
  const envKey = process.env.TVDB_APIKEY && process.env.TVDB_APIKEY.trim();
  if (envKey) return envKey;
  const p = path.resolve(__dirname, 'etl/api key.txt');
  const fileKey = readFileTrim(p);
  return fileKey || null;
}

function getTokenFromEnvOrFile() {
  const envToken = process.env.TVDB_TOKEN && process.env.TVDB_TOKEN.trim();
  if (envToken) return envToken;
  const tokenPath = path.resolve(__dirname, 'etl/token.txt');
  const fileToken = readFileTrim(tokenPath);
  return fileToken || null;
}

async function loginTvdb() {
  const apikey = getApiKey();
  const pin = (process.env.TVDB_PIN || readFileTrim(path.resolve(__dirname, 'etl/pin.txt')) || '').trim();
  if (!apikey) throw new Error('TVDB_APIKEY_missing');
  const body = pin ? { apikey, pin } : { apikey };
  const { data } = await tv.post(`/login`, body, { headers: { 'Content-Type': 'application/json' } });
  const token = data?.data?.token;
  if (!token) throw new Error('TVDB_login_failed');
  inMemoryToken = token;
  try { fs.writeFileSync(path.resolve(__dirname, 'etl/token.txt'), token, 'utf8'); } catch {}
  return token;
}

async function getTvdbToken() {
  if (inMemoryToken) return inMemoryToken;
  const existing = getTokenFromEnvOrFile();
  if (existing) { inMemoryToken = existing; return existing; }
  const token = await loginTvdb();
  return token;
}

async function tvdbRequestOnce(method, url, options = {}) {
  const token = await getTvdbToken();
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  return tv.request({ method, url, ...options, headers });
}

async function tvdbRequestWithRefresh(method, url, options = {}) {
  try {
    return await tvdbRequestOnce(method, url, options);
  } catch (e) {
    const status = e?.response?.status;
    if (status === 401 || status === 403) {
      inMemoryToken = null;
      await loginTvdb();
      return await tvdbRequestOnce(method, url, options);
    }
    throw e;
  }
}
const tv = axios.create({ baseURL: TVDB_BASE, timeout: 12000 });

(async () => {
  try {
    await loginTvdb();
    console.log('TVDB login: OK');
  } catch (e) {
    console.warn('TVDB login skipped:', e?.message || e);
  }
})();

router.get('/health', (req, res) => {
  res.json({ ok: true });
});

router.get('/daily-prompts', (req, res) => {
  const date = new Date();
  const seed = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const prompts = generatePrompts(seed);
  res.json({ prompts });
});

// TVDB raw proxy endpoints for debugging in the browser
router.get('/tvdb/search', async (req, res) => {
  try {
    const { data } = await tvdbRequestWithRefresh('GET', `/search`, { params: req.query });
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json(e?.response?.data || { error: String(e?.message || e) });
  }
});
router.get('/tvdb/movies/:id/extended', async (req, res) => {
  try {
    const { id } = req.params;
    const { data } = await tvdbRequestWithRefresh('GET', `/movies/${id}/extended`, { params: req.query });
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json(e?.response?.data || { error: String(e?.message || e) });
  }
});
router.get('/tvdb/movies/:id/people', async (req, res) => {
  try {
    const { id } = req.params;
    const { data } = await tvdbRequestWithRefresh('GET', `/movies/${id}/people`, { params: req.query });
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json(e?.response?.data || { error: String(e?.message || e) });
  }
});

router.get('/search-sqlite', (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json({ items: [] });
  let rows = [];
  try {
    const stmtFts = db.prepare(
      `SELECT b.tconst, b.primaryTitle, b.startYear
       FROM title_fts f
       JOIN title_basics b ON b.tconst = f.tconst
       WHERE f.title MATCH ?
       LIMIT 20`
    );
    rows = stmtFts.all(q.replace(/\s+/g, ' '));
  } catch (e) {
    const stmt = db.prepare(
      `SELECT tconst, primaryTitle, startYear
       FROM title_basics
       WHERE primaryTitle LIKE ?
       ORDER BY numVotes DESC NULLS LAST
       LIMIT 20`
    );
    rows = stmt.all(`%${q}%`);
  }
  res.json({ items: rows });
});

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q || q.length < 2) return res.json({ items: [] });

  if (!IS_VERCEL) {
    const cached = db.prepare('SELECT json FROM tvdb_search_cache WHERE q=?').get(q);
    if (cached) {
      try {
        // The cached value is the raw TVDB response `data` object.
        // We need to wrap it in a `payload` object with an `items` key for the client.
        const data = JSON.parse(cached.json);
        const payload = { items: (data && data.data) ? data.data : [] };
        return res.json(payload);
      } catch { }
    }
  }

  try {
    const { data } = await tvdbRequestWithRefresh('GET', '/search', { params: { query: q, type: 'movie', limit: 20 }});
    // Prioritize English titles if available
    if (data && Array.isArray(data.data)) {
      data.data.forEach(item => {
        if (typeof item.translations?.eng === 'string' && item.translations.eng) {
          item.name = item.translations.eng;
        }
      });
    }
    // Note: we cache the raw `data` from TVDB, not the `payload`
    if (!IS_VERCEL) {
      db.prepare('INSERT OR REPLACE INTO tvdb_search_cache(q,json,ts) VALUES(?,?,?)')
        .run(q, JSON.stringify(data), Date.now());
    }
    const payload = { items: (data && data.data) ? data.data : [] };
    res.json(payload);
  } catch (e) {
    const status = e?.response?.status || (e?.message?.includes('TVDB_APIKEY_missing') ? 401 : 502);
    const tvdb = e?.response?.data;
    const hint = e?.message === 'TVDB_APIKEY_missing' ? 'Set TVDB_APIKEY env or create src/etl/api key.txt' : undefined;
    res.status(status).json({ error: 'tvdb_search_failed', tvdb, hint, message: String(e?.message || e), stack: e?.stack });
  }
});

router.get('/movie/:id', async (req, res) => {
  const id = req.params.id; // TVDB movie id (number-like string)
  if (!IS_VERCEL) {
    const cached = db.prepare('SELECT json FROM tvdb_movie_cache WHERE id=?').get(id);
    if (cached) {
      try {
        const obj = JSON.parse(cached.json);
        const people = Array.isArray(obj.people) ? obj.people : [];
        const hasDirector = people.some((p) => /director/i.test(p?.peopleType || '') || /director/i.test(p?.role || ''));
        const hasActor = people.some((p) => /actor/i.test(p?.peopleType || ''));
        if (hasDirector && hasActor) {
          return res.json(obj);
        }
        // else fall through to refresh/enrich from TVDB
      } catch { }
    }
  }
  try {
    // Ask explicitly for people via meta, per TVDB v4 docs
    const { data } = await tvdbRequestWithRefresh('GET', `/movies/${id}/extended`, { params: { meta: 'people' } });
    const payload = data && data.data ? data.data : data;

    // Prioritize English title if available, before caching
    if (typeof payload.translations?.eng === 'string' && payload.translations.eng) {
      payload.name = payload.translations.eng;
    }

    // Enrich people with full pagination over people endpoint and include characters array
    let people = Array.isArray(payload.people) ? [...payload.people] : [];
    if (Array.isArray(payload.characters) && payload.characters.length) {
      people = mergePeople(people, payload.characters);
    }
    const allPeople = await fetchAllMoviePeople(id).catch(() => []);
    if (Array.isArray(allPeople) && allPeople.length) {
      people = mergePeople(people, allPeople);
    }
    // Final fallback: derive directors from search metadata if still missing
    const hasDirector = people.some((p) => /director/i.test(p?.peopleType || '') || /director/i.test(p?.role || ''));
    if (!hasDirector) {
      try {
        const sr = await tvdbRequestWithRefresh('GET', `/search`, { params: { query: payload.name || '', type: 'movie', limit: 10 } });
        const items = (sr.data && sr.data.data) ? sr.data.data : [];
        const hit = items.find((it) => String(it.tvdb_id) === String(id));
        const dirStr = hit && hit.director;
        if (dirStr && typeof dirStr === 'string') {
          const dirs = dirStr.split(',').map((s) => s.trim()).filter(Boolean);
          for (const d of dirs) people.push({ name: d, peopleType: 'Director' });
        }
      } catch {}
    }
    payload.people = people;

    // Normalize genres on payload; fallback to search item if missing/empty
    payload.genres = await enrichGenres(payload, id);

    // Extract poster URL
    payload.posterUrl = payload.image || payload.image_url || (payload.artworks && payload.artworks.find(a => a.type === 14 && a.language === 'eng')?.image) || null;

    if (!IS_VERCEL) {
      db.prepare('INSERT OR REPLACE INTO tvdb_movie_cache(id,json,ts) VALUES(?,?,?)')
        .run(id, JSON.stringify(payload), Date.now());
    }

    // Sanitize payload to send to client
    const clientPayload = {
      id: payload.id,
      name: payload.name,
      year: payload.year,
      runtime: payload.runtime,
      genres: payload.genres,
      people: payload.people,
      posterUrl: payload.posterUrl,
      releaseDate: payload.releaseDate,
      // New fields for prompts
      originalLanguage: payload.originalLanguage,
      budget: payload.budget,
      boxOffice: payload.boxOffice,
      awards: payload.awards,
    };

    res.json(clientPayload);
  } catch (e) {
    const status = e?.response?.status || (e?.message?.includes('TVDB_APIKEY_missing') ? 401 : 502);
    const tvdb = e?.response?.data;
    const hint = e?.message === 'TVDB_APIKEY_missing' ? 'Set TVDB_APIKEY env or create src/etl/api key.txt' : undefined;
    res.status(status).json({ error: 'tvdb_movie_failed', tvdb, hint, message: e?.message });
  }
});

const port = process.env.PORT || 5176;
if (!IS_VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

app.use('/api', router);
module.exports = app;

// Helper to merge people arrays, normalizing keys
function mergePeople(base, extra) {
  const norm = (p) => ({
    // Prefer personName (the actor's name) over character name
    name: p?.personName || p?.person?.name || p?.name || '',
    peopleType: p?.peopleType || p?.type || p?.job || p?.category || (p?.type===3 ? 'Actor' : ''),
    role: p?.role || p?.characters || p?.name || '',
  });
  const out = [...base.map(norm)];
  for (const p of extra) {
    const np = norm(p);
    if (!np.name) continue;
    if (!out.some(x => x.name === np.name && (x.peopleType||'').toLowerCase() === (np.peopleType||'').toLowerCase())) {
      out.push(np);
    }
  }
  return out;
}

async function enrichGenres(payload, id) {
  const raw = payload?.genres;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((g) => (typeof g === 'string' ? g : g?.name || '')).filter(Boolean);
  }
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object') {
    const names = raw.map((g) => g?.name || '').filter(Boolean);
    if (names.length) return names;
  }
  try {
    const name = payload?.name || payload?.translations?.eng || '';
    if (!name) return [];
    const sr = await tvdbRequestWithRefresh('GET', `/search`, { params: { query: name, type: 'movie', limit: 10 } });
    const items = (sr.data && sr.data.data) ? sr.data.data : [];
    const hit = items.find((it) => String(it.tvdb_id) === String(id)) || items[0];
    const genres = Array.isArray(hit?.genres) ? hit.genres : [];
    return genres.map((g) => String(g)).filter(Boolean);
  } catch {
    return [];
  }
}

// Fully page through /movies/{id}/people to collect cast and crew
async function fetchAllMoviePeople(id) {
  const results = [];
  let page = 0;
  for (let i = 0; i < 25; i++) {
    const resp = await tvdbRequestWithRefresh('GET', `/movies/${id}/people`, { params: { page } });
    const body = resp?.data;
    const arr = Array.isArray(body?.data) ? body.data
      : Array.isArray(body?.people) ? body.people
      : Array.isArray(body) ? body
      : [];
    if (!arr.length) break;
    results.push(...arr);
    const next = body?.links?.next;
    if (next == null) {
      // Try naive increment if no links object
      page += 1;
      // Heuristic: if shorter page encountered, stop next loop after a short page
      if (arr.length < 50) break;
    } else {
      page = Number(next);
      if (!Number.isFinite(page)) break;
    }
  }
  // Also try actors endpoint if present
  try {
    const r2 = await tvdbRequestWithRefresh('GET', `/movies/${id}/actors`);
    const a2 = Array.isArray(r2?.data?.data) ? r2.data.data : (Array.isArray(r2?.data) ? r2.data : []);
    if (Array.isArray(a2) && a2.length) results.push(...a2);
  } catch {}
  return results;
}

