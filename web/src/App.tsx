import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import './App.css'
import { searchMovies, getMovieDetails, getDailyPrompts, getPersonByName, type PersonLookup } from './api'
import { generatePrompts, generateSinglePrompt, generateNPrompts, allPossiblePrompts, buildPromptFromServer } from './prompts'
import type { Prompt } from './prompts';
import type { Cell, TvdbMovieDetails, LogEntry, TvdbSearchItem } from './types'
import { parseMoney } from './utils';

const MAX_GUESSES = 10;
type GameMode = 'daily' | 'fixed';

// Create a map of all possible prompts by their ID for easy look-up
const promptsById = new Map<string, Prompt>();
allPossiblePrompts.forEach(p => promptsById.set(p.id, p));

function generateBoard(prompts: Prompt[]): Cell[] {
  return prompts.map((prompt) => ({ prompt }));
}

function getDailyKey(mode: GameMode) {
  const now = new Date();
  // Use UTC date to ensure players in different timezones get the same puzzle on the same day
  const base = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  return mode === 'daily' ? `daily-game-${base}` : `fixed-${base}`;
}


function App() {
  const [cells, setCells] = useState<Cell[]>([]);
  const [actorImages, setActorImages] = useState<Record<string, string | null>>({});
  const [dimmedActorCells, setDimmedActorCells] = useState<Record<number, boolean>>({});
  const dimTimeoutsRef = useRef<Record<number, number>>({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TvdbSearchItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [guessesLeft, setGuessesLeft] = useState(MAX_GUESSES);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'gameOver'>('playing');
  const [mode, setMode] = useState<GameMode>('daily');
  const [fixedGuesses, setFixedGuesses] = useState<number>(0);
  const [hydrating, setHydrating] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [hoveredTip, setHoveredTip] = useState<null | (LogEntry & { x: number; y: number; anchorLeft: number })>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [tipPos, setTipPos] = useState<null | { left: number; top: number; width: number }>(null);
  const [actorPreview, setActorPreview] = useState<null | { url: string; idx: number; rect: { left: number; top: number; width: number; height: number } }>(null);
  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches));
  }, []);
  const appRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [resultsPos, setResultsPos] = useState<null | { left: number; top: number; width: number }>(null);
  const [cellSize, setCellSize] = useState<number>(140);
  const sharedScore = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('score');
    if (raw == null || raw.trim() === '') return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  }, []);
  const [dailySeed, setDailySeed] = useState<string>('');
  const [rerollCount, setRerollCount] = useState<number>(0);
  const [showReset, setShowReset] = useState<boolean>(false);

  // Initial setup
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-mode', mode);
    } catch {}
  }, [mode]);

  useEffect(() => {
    const startDailyGame = async () => {
      setHydrating(true);
      const dailyKey = getDailyKey(mode);
      const savedState = localStorage.getItem(dailyKey);

      if (savedState) {
        const { cells, logs, guessesLeft, score, gameState, dailySeed, rerollCount, mode: savedMode, marathonGuesses, fixedGuesses } = JSON.parse(savedState);
        // Migration: if Fixed mode save has 25 cells from old 5x5, reset to 16
        if ((savedMode || mode) === 'fixed' && Array.isArray(cells) && cells.length > 16) {
          const prompts = generateNPrompts(16);
          setCells(generateBoard(prompts as Prompt[]));
          setLogs([]);
          setGuessesLeft(Number.POSITIVE_INFINITY as unknown as number);
          setScore(0);
          setGameState('playing');
          setDebugMode(false);
          setDailySeed('');
          setRerollCount(0);
          setFixedGuesses(0);
          // overwrite saved state to avoid rehydrating 25 again
          const dailyKey = getDailyKey('fixed');
          const stateToSave = {
            cells: generateBoard(prompts as Prompt[]),
            logs: [],
            guessesLeft: Number.POSITIVE_INFINITY,
            score: 0,
            gameState: 'playing' as const,
            dailySeed: '',
            rerollCount: 0,
            mode: 'fixed' as const,
            fixedGuesses: 0,
          };
          try { localStorage.setItem(dailyKey, JSON.stringify(stateToSave)); } catch {}
          setHydrating(false);
          return;
        }
        // We need to re-hydrate the prompts with their `test` functions
        const hydratedCells = cells.map((cell: Cell) => ({
          ...cell,
          prompt: promptsById.get(cell.prompt.id)
        }));
        setCells(hydratedCells);
        setLogs(logs);
        setGuessesLeft(typeof guessesLeft === 'number' && Number.isFinite(guessesLeft) ? guessesLeft : MAX_GUESSES);
        setScore(score);
        // Correct stale game-over if guesses remain in Daily
        if (mode === 'daily' && gameState === 'gameOver' && (typeof guessesLeft === 'number' ? guessesLeft : MAX_GUESSES) > 0) {
          setGameState('playing');
          setShowGameOver(false);
        } else {
          setGameState(gameState);
        }
        setDailySeed(dailySeed || '');
        setRerollCount(rerollCount || 0);
        setMode(savedMode || 'daily');
        setFixedGuesses((fixedGuesses ?? marathonGuesses) || 0);
      } else {
        // New state for this mode
        if (mode === 'daily') {
          const { seed, prompts } = await getDailyPrompts();
          const hydratedPrompts = prompts.map((p: { id: string; label: string }) => {
            const found = promptsById.get(p.id);
            return found || buildPromptFromServer(p.id, p.label);
          });
          setCells(generateBoard(hydratedPrompts as Prompt[]));
          setLogs([]);
          setGuessesLeft(MAX_GUESSES);
          setScore(0);
          setGameState('playing');
          setDebugMode(false);
          setDailySeed(seed || '');
          setRerollCount(0);
          setFixedGuesses(0);
        } else {
          const prompts = generateNPrompts(16);
          setCells(generateBoard(prompts as Prompt[]));
          setLogs([]);
          setGuessesLeft(Number.POSITIVE_INFINITY as unknown as number);
          setScore(0);
          setGameState('playing');
          setDebugMode(false);
          setDailySeed('');
          setRerollCount(0);
          setFixedGuesses(0);
        }
      }
      setHydrating(false);
    };

    startDailyGame();
  }, [mode]);

  // Save game state to localStorage whenever it changes
  useEffect(() => {
    if (cells.length === 0 || debugMode || hydrating) return; // Don't save empty initial state, debug, or during hydration
    const dailyKey = getDailyKey(mode);
    const stateToSave = {
      cells,
      logs,
      guessesLeft,
      score,
      gameState,
      dailySeed,
      rerollCount,
      mode,
      fixedGuesses,
    };
    localStorage.setItem(dailyKey, JSON.stringify(stateToSave));
  }, [cells, logs, guessesLeft, score, gameState, debugMode, dailySeed, rerollCount, mode, fixedGuesses]);

  // Show How-To on first visit
  useEffect(() => {
    try {
      const key = 'afgf-howto-shown-v1';
      const seen = localStorage.getItem(key);
      if (!seen) {
        setShowHowTo(true);
      }
    } catch {}
  }, []);


  const debounceRef = useRef<number | null>(null);
  const doSearch = useCallback((q: string) => {
    setQuery(q);
    const t = q.trim();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (t.length < 2) { setResults([]); return; }
    debounceRef.current = window.setTimeout(async () => {
      const list = await searchMovies(t);
      setResults(list);
      // calculate results overlay position based on search input
      try {
        const host = searchRef.current;
        if (host) {
          const inputEl = host.querySelector('.searchBar') as HTMLElement | null;
          const el = inputEl || host;
          const r = el.getBoundingClientRect();
          setResultsPos({ left: r.left, top: r.bottom + 4, width: r.width });
        }
      } catch {}
    }, 250);
  }, []);

  const applyMovie = useCallback(async (tvdbId: string, title: string) => {
    if (logs.some(log => log.id === tvdbId)) {
      setQuery('');
      setResults([]);
      return;
    }
    setSubmitting(true);
    try {
      const details = await getMovieDetails(tvdbId);
      if (!details) {
        setSubmitting(false); // unlock on error
        return;
      }

      const satisfiedPrompts: Prompt[] = [];
      const highlight: LogEntry['highlight'] = {};
      const nextCells = cells.map(cell => {
        if (cell.filledBy || cell.clearing) return cell;
        const ok = cell.prompt.test(details as TvdbMovieDetails, title);
        if (ok) {
          satisfiedPrompts.push(cell.prompt);
          // Capture highlight reasons based on which prompt matched
          try {
            const pid = cell.prompt.id;
            if (/^actor-/.test(pid)) {
              const actorName = cell.prompt.label.replace(/^Stars\s+/i, '');
              highlight.actors = Array.from(new Set([...(highlight.actors || []), actorName]));
            }
            if (pid === 'budget-under-1m') {
              highlight.budgetUnder1m = true;
            }
            const dec = pid.match(/^year-(\d{4})s$/);
            if (dec) {
              highlight.decade = Number(dec[1]);
            }
            if (pid === 'budget-over-100m') highlight.budgetOver100m = true;
            if (pid === 'box-office-10x') highlight.boxOffice10x = true;
            if (pid === 'box-office-flop') highlight.boxOfficeFlop = true;
            if (pid === 'lang-non-english') highlight.languageNonEnglish = true;
            if (pid === 'runtime-short') highlight.runtimeShort = true;
            if (pid === 'runtime-epic') highlight.runtimeEpic = true;
            if (pid === 'year-before-2000') highlight.yearBefore = 2000;
            if (pid === 'year-after-2000') highlight.yearAfter = 2000;
            if (pid === 'year-after-2020') highlight.yearAfter = 2020;
            if (pid === 'year-before-1970') highlight.yearBefore = 1970;
            if (pid === 'written-and-directed-same') {
              const dirs = (details.people || []).filter(p => /director/i.test(p.peopleType || p.type || '')).map(p => p.name);
              highlight.directors = Array.from(new Set([...(highlight.directors || []), ...dirs]));
            }
            if (/^director-/.test(pid)) {
              const dirLabel = cell.prompt.label.replace(/^Directed by\s+/i, '');
              // Handle team prompts
              const teamMap: Record<string, string[]> = {
                'Coen Brothers': ['Joel Coen', 'Ethan Coen'],
                'Russo Brothers': ['Anthony Russo', 'Joe Russo'],
                'The Wachowskis': ['Lana Wachowski', 'Lilly Wachowski'],
              };
              const names = teamMap[dirLabel] || [dirLabel];
              highlight.directors = Array.from(new Set([...(highlight.directors || []), ...names]));
            }
            if (/^genre-/.test(pid)) {
              const g = cell.prompt.label.replace(/^Genre:\s+/i, '');
              highlight.genres = Array.from(new Set([...(highlight.genres || []), g]));
            }
            if (/^(title-|starts-the|one-word|has-number|has-color|has-colon)/.test(pid)) {
              highlight.title = true;
            }
            if (pid === 'title-alliterative' || pid === 'title-long-5') {
              highlight.title = true;
            }
            if (/^award-/.test(pid)) {
              highlight.awards = true;
            }
          } catch {}
          return { ...cell, filledBy: { id: tvdbId, title, posterUrl: (details as TvdbMovieDetails).posterUrl } };
        }
        return cell;
      });

      const guessScore = satisfiedPrompts.length;
      
      // A correct guess was made, keep UI locked for animations
      setScore(s => s + guessScore);
      if (mode === 'daily') setGuessesLeft(n => n - 1);
      if (mode === 'fixed') setFixedGuesses(n => n + 1);
      setCells(nextCells);
      
      // Append to log
      const year = (() => {
        if (details.year != null) return details.year;
        if (details.releaseDate) {
          const n = Number(String(details.releaseDate).slice(0,4));
          return Number.isNaN(n) ? undefined : n;
        }
        return undefined;
      })();
      const people = Array.isArray(details.people) ? details.people : [];
      const directors = people.filter(p => /director/i.test(p.peopleType || p.type || '')).map(p => p.name);
      const stars = people.filter(p => /actor|actress/i.test(p.peopleType || p.type || '')).map(p => p.name).slice(0, 6);
      
      setLogs(prev => [{
        id: tvdbId,
        title,
        year,
        runtime: details.runtime,
        genres: details.genres,
        directors,
        stars,
        posterUrl: details.posterUrl,
        timestamp: Date.now(),
        // Add new prompt-relevant data to the log entry
        language: details.originalLanguage,
        budget: parseMoney(details.budget),
        boxOffice: parseMoney(details.boxOffice),
        awards: (details.awards || []).map((a, i) => ({ id: `${tvdbId}-award-${i}`, name: a.name, isWinner: a.isWinner })),
        clearedPrompts: satisfiedPrompts.map(p => p.label),
        score: guessScore,
        highlight,
      }, ...prev]);
      // Clear input and results after successful apply
      setQuery('');
      setResults([]);

      if (mode === 'daily') {
        // After a delay, mark filled cells as 'clearing'
        setTimeout(() => {
          setCells(currentCells => currentCells.map(cell => {
            // Only mark the *newly* filled cells for clearing
            if (cell.filledBy?.id === tvdbId) {
              return { ...cell, clearing: true };
            }
            return cell;
          }));
        }, 1500);

        // After another delay (for fade-out), replace them with new prompts
        setTimeout(() => {
          setCells(currentCells => {
            let currentPrompts = currentCells.map(c => c.prompt);
            let updatedRerollCount = rerollCount;
            
            const nextCells = currentCells.map(cell => {
              if (cell.clearing) {
                const newPrompt = generateSinglePrompt(currentPrompts, dailySeed, updatedRerollCount);
                currentPrompts.push(newPrompt);
                updatedRerollCount++;
                return { prompt: newPrompt };
              }
              return cell;
            });

            setRerollCount(updatedRerollCount);
            return nextCells;
          });
          setSubmitting(false); // Re-enable submissions
        }, 3000);
      } else {
        // Marathon: no clearing or replacement; just re-enable submissions
        setSubmitting(false);
      }

    } catch (error) {
      console.error("Error applying movie:", error);
      setSubmitting(false);
    }
  }, [cells, logs, dailySeed, rerollCount]);

  useEffect(() => {
    if (hydrating) return;
    if (mode === 'daily') {
      if (guessesLeft <= 0 && gameState === 'playing') {
        setGameState('gameOver');
        setShowGameOver(true);
      }
    } else {
      if (gameState === 'playing' && cells.length > 0 && cells.every(c => !!c.filledBy)) {
        setGameState('gameOver');
        setShowGameOver(true);
      }
    }
  }, [guessesLeft, gameState, mode, cells, hydrating]);

  // Keep tooltip within viewport by measuring after render
  useLayoutEffect(() => {
    if (!hoveredTip || !tipRef.current) { setTipPos(null); return; }
    const w = Math.min(460, window.innerWidth - 24);
    // Defer to ensure DOM has dimensions
    const raf = window.requestAnimationFrame(() => {
      const rect = tipRef.current ? tipRef.current.getBoundingClientRect() : { height: 220 } as any;
      const h = rect.height || 220;
      let left = hoveredTip.anchorLeft - w;
      if (left < 12) left = 12;
      const maxLeft = Math.max(12, window.innerWidth - w - 12);
      if (left > maxLeft) left = maxLeft;
      let top = hoveredTip.y;
      const maxTop = Math.max(12, window.innerHeight - h - 12);
      if (top > maxTop) top = maxTop;
      if (top < 12) top = 12;
      setTipPos({ left, top, width: w });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [hoveredTip]);

  // Recompute tooltip position on resize/scroll
  useEffect(() => {
    function onWinChange() {
      if (!hoveredTip) return;
      // trigger re-layout effect
      setTipPos(null);
      setTimeout(() => setTipPos((p) => p), 0);
    }
    window.addEventListener('resize', onWinChange);
    window.addEventListener('scroll', onWinChange, true);
    return () => {
      window.removeEventListener('resize', onWinChange);
      window.removeEventListener('scroll', onWinChange, true);
    };
  }, [hoveredTip]);

  // Dismiss tooltip on any tap for touch devices (including tapping the tooltip itself or anywhere else)
  useEffect(() => {
    if (!isTouchDevice) return;
    function onDocClick() {
      setHoveredTip(null);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [isTouchDevice]);

  // (reroll feature removed in marathon work; kept out to reduce warnings)

  const startDebugGame = useCallback(() => {
    setDebugMode(true);
    const prompts = generatePrompts();
    setCells(generateBoard(prompts as Prompt[]));
    setActorImages({});
    setDimmedActorCells({});
    setLogs([]);
    setGuessesLeft(MAX_GUESSES);
    setScore(0);
    setGameState('playing');
    setShowGameOver(false);
    setQuery('');
    setResults([]);
  }, []);

  const onCopyShareLink = useCallback(async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('score', String(score));
      const link = url.toString();
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        // Use Web Share API on mobile if available
        await navigator.share({ title: 'A Few Good Films', text: `I scored ${score} points!`, url: link });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback copy
        const ta = document.createElement('textarea');
        ta.value = link;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  }, [score]);

  const onInputKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || submitting || gameState === 'gameOver') return;
    const top = results[0];
    if (top) {
      await applyMovie(top.tvdbId, top.rawTitle);
      return;
    }
    const list = await searchMovies(query.trim());
    if (list.length > 0) {
      const first = list[0];
      await applyMovie(first.tvdbId, first.rawTitle);
    }
  }, [results, submitting, query, applyMovie, gameState]);

  // Dynamically size cells to fit rows/cols within viewport
  useEffect(() => {
    function recalc() {
      const grid = gridRef.current;
      const app = appRef.current;
      const toolbar = toolbarRef.current;
      // search is inside toolbar; don't subtract twice
      // results overlay does not affect layout height
      if (!grid) return;
      // Compute available width for the board from viewport, subtracting log width and playArea gap
      const playArea = grid.parentElement?.parentElement as HTMLElement | null; // boardWrap -> playArea
      const logPanel = playArea?.querySelector('.logPanel') as HTMLElement | null;
      const viewportW = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
      const gapPlay = playArea ? parseFloat(getComputedStyle(playArea).gap || '10') : 10;
      // const logW = logPanel ? logPanel.offsetWidth : 0;
      const vw = Math.max(0, viewportW - (logPanel ? 0 : 0) - gapPlay - 16);
      const vh = window.innerHeight;
      const appCS = app ? getComputedStyle(app) : null;
      const appPadTop = appCS ? parseFloat(appCS.paddingTop || '0') : 0;
      const appPadBottom = appCS ? parseFloat(appCS.paddingBottom || '0') : 0;
      // margins are negligible in fit-content layout
      const toolbarH = toolbar ? toolbar.getBoundingClientRect().height : 0;
      const toolbarMB = toolbar ? parseFloat(getComputedStyle(toolbar).marginBottom || '0') : 0;
      const searchH = 0;
      const resultsH = 0;
      // results overlay doesn't affect layout
      // Read grid gap from computed style
      const cs = getComputedStyle(grid);
      const gap = parseFloat(cs.gap || '10') || 10;
      const gridMT = parseFloat(cs.marginTop || '0') || 0;
      const paddingAndMargins = appPadTop + appPadBottom + toolbarMB + gridMT;
      const safety = 0;
      const availableH = vh - toolbarH - searchH - resultsH - paddingAndMargins - safety;
      // Size cells to fit viewport (Fixed is now 4x4 like Daily)
      const cols = 4;
      const rows = 4;
      const maxByWidth = Math.floor((vw - gap * (cols - 1)) / cols);
      const maxByHeight = Math.floor((availableH - gap * (rows - 1)) / rows);
      const size = Math.max(64, Math.min(maxByWidth, maxByHeight));
      setCellSize(size);
    }
    recalc();
    window.addEventListener('resize', recalc);
    // also keep results overlay aligned if open
    function recalcResults() {
      if (!resultsPos) return;
      try {
        const host = searchRef.current;
        if (host) {
          const inputEl = host.querySelector('.searchBar') as HTMLElement | null;
          const el = inputEl || host;
          const r = el.getBoundingClientRect();
          setResultsPos({ left: r.left, top: r.bottom + 4, width: r.width });
        }
      } catch {}
    }
    window.addEventListener('scroll', recalcResults, true);
    window.addEventListener('resize', recalcResults);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalcResults, true);
      window.removeEventListener('resize', recalcResults);
    };
  }, [results.length, logs.length, resultsPos, mode]);

  // Desktop-only: lock page scrolling when the app fully fits within the viewport
  useEffect(() => {
    function applyScrollLock() {
      if (!appRef.current) return;
      if (isTouchDevice) {
        document.body.classList.remove('noScroll');
        return;
      }
      const rect = appRef.current.getBoundingClientRect();
      const fits = rect.height <= window.innerHeight;
      if (fits) document.body.classList.add('noScroll');
      else document.body.classList.remove('noScroll');
    }
    applyScrollLock();
    window.addEventListener('resize', applyScrollLock);
    return () => window.removeEventListener('resize', applyScrollLock);
  }, [isTouchDevice, mode, cellSize, cells.length, logs.length, showHowTo, showGameOver]);

  return (
    <div className="app" ref={appRef}>
      {(() => {
        const params = new URLSearchParams(window.location.search);
        const shared = params.get('score');
        if (!shared) return null;
        return (
          <div className="shareNotice">Shared score: <strong>{Number(shared)}</strong></div>
        );
      })()}
      <div className="toolbar" ref={toolbarRef}>
        <div className="toolbarTop">
          <div className="title" onClick={() => {
            setShowReset(true);
            window.setTimeout(() => setShowReset(false), 6000);
          }}>Screen Test</div>
          {showReset && (
            <button
              className="debugBtn"
              onClick={() => {
                const ok = window.confirm('Reset all saved data? This will reload the app.');
                if (!ok) return;
                try { localStorage.clear(); } catch {}
                window.location.reload();
              }}
            >RESET SAVE</button>
          )}
          <button className="howToBtn modeSwitchBtn" onClick={() => {
            setMode(m => {
              const next = m === 'daily' ? 'fixed' : 'daily';
              setCells([]);
              return next;
            });
          }}>{mode === 'daily' ? 'Switch to Fixed' : 'Switch to Daily'}</button>
        </div>
        <div className="toolbarCenter">
          <div className="searchWrap" ref={searchRef}>
            <div className="searchBar">
              <input
                className="searchInput"
                value={query}
                placeholder="Search a movie title"
                onChange={(e) => doSearch(e.target.value)}
                onKeyDown={onInputKeyDown}
                disabled={gameState === 'gameOver'}
              />
              {query && <button className="clearBtn" onClick={() => { setQuery(''); setResults([]); }}>Clear</button>}
            </div>
            {results.length > 0 && resultsPos && createPortal(
              <div
                className="results resultsOverlay"
                ref={resultsRef}
                style={{ position: 'fixed', left: resultsPos.left, top: resultsPos.top, width: resultsPos.width, zIndex: 200000 }}
              >
                {results.slice(0,10).map(r => {
                  const isGuessed = logs.some(log => log.id === r.tvdbId);
                  return (
                    <button key={r.tvdbId} className="resultBtn" disabled={submitting || isGuessed} onClick={() => applyMovie(r.tvdbId, r.rawTitle)}>
                      {r.thumb && <img src={r.thumb} alt="" />}
                      <span>{r.displayTitle}</span>
                    </button>
                  );
                })}
              </div>,
              document.body
            )}
          </div>
        </div>
        <div className="toolbarBottom">
          <div className="toolbarCounters">
            <div className="counterPanel">Score: <strong>{score}</strong></div>
            {mode === 'daily' ? (
              <div className="counterPanel">Guesses Left: <strong>{guessesLeft}</strong></div>
            ) : (
              <div className="counterPanel">Guesses Used: <strong>{fixedGuesses}</strong></div>
            )}
          </div>
          <div className="toolbarActions">
            <button className="howToBtn" onClick={() => setShowHowTo(true)}>HOW TO PLAY</button>
            {gameState === 'gameOver' && !showGameOver && (
              <button className="howToBtn" onClick={() => setShowGameOver(true)}>VIEW SUMMARY</button>
            )}
          </div>
        </div>
      </div>

      <div className="playArea">
        <div className="boardWrap">
          <div className="grid" ref={gridRef} style={{ ['--cell-size' as any]: `${cellSize}px` }}>
            {cells.map((cell, idx) => {
              const poster = cell.filledBy?.posterUrl;
              const isFilled = !!cell.filledBy;
              const isClearing = !!cell.clearing;
              // For unsolved actor prompts, show a faint actor image as background hint
              let hintImg: string | undefined;
              if (!isFilled && /^actor-/.test(cell.prompt.id)) {
                const actorName = cell.prompt.label.replace(/^Stars\s+/i, '');
                const img = actorImages[actorName];
                if (img) hintImg = img;
                // trigger fetch if missing and not already requested
                if (img === undefined) {
                  (async () => {
                    const info: PersonLookup | null = await getPersonByName(actorName);
                    setActorImages(prev => ({ ...prev, [actorName]: info?.imageUrl || null }));
                  })();
                }
              }
              const isActorHint = !isFilled && /^actor-/.test(cell.prompt.id);
              const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches));
              const isDim = isActorHint && (isTouch ? !!dimmedActorCells[idx] : false);
              return (
                <div
                  key={idx}
                  className={`cell ${isClearing ? 'clearing' : ''} ${isActorHint ? 'actorHintCell' : ''} ${isDim ? 'dim' : ''}`}
                  style={{ width: cellSize, height: cellSize, backgroundImage: poster ? `url(${poster})` : undefined, backgroundSize: poster ? 'cover' : undefined, backgroundPosition: 'center' }}
                  onMouseEnter={(e) => { if (!isTouch && isActorHint && hintImg) { const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); setActorPreview({ url: hintImg, idx, rect: { left: r.left, top: r.top, width: r.width, height: r.height } }); } }}
                  onMouseLeave={() => { if (!isTouch && actorPreview && actorPreview.idx === idx) setActorPreview(null); }}
                  onClick={(e) => {
                    if (isActorHint && isTouch) {
                      e.stopPropagation();
                      // Always start (or restart) the timer immediately on tap
                      const tmap = dimTimeoutsRef.current || {};
                      if (tmap[idx]) {
                        window.clearTimeout(tmap[idx]);
                        delete tmap[idx];
                      }
                      if (hintImg) {
                        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                        setActorPreview({ url: hintImg, idx, rect: { left: r.left, top: r.top, width: r.width, height: r.height } });
                      }
                      setDimmedActorCells(prev => ({ ...prev, [idx]: true }));
                      tmap[idx] = window.setTimeout(() => {
                        setDimmedActorCells(curr => ({ ...curr, [idx]: false }));
                        setActorPreview(prev => (prev && prev.idx === idx ? null : prev));
                        delete dimTimeoutsRef.current[idx];
                      }, 3000);
                      dimTimeoutsRef.current = tmap;
                    }
                  }}
                >
                  {!isFilled && hintImg && <div className="hintOverlay" style={{ backgroundImage: `url(${hintImg})` }} />}
                  <div className={isFilled ? 'cellContent filled' : 'cellContent empty'}>
                    {isFilled ? (
                      <>
                        <div className="promptPanel">{cell.prompt.label}</div>
                        {poster && <div className="posterOverlay" />}
                        <div className="titleBar">{cell.filledBy && <span className="titleBadge">{cell.filledBy.title}</span>}</div>
                      </>
                    ) : (
                      <div className="promptLarge">{cell.prompt.label}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {showGameOver && (
            <div className="gameOverOverlay">
              <div className="gameOverContent">
                <h2>Game Over!</h2>
                <p>Your final score is: <strong>{score}</strong></p>
                {sharedScore != null && (
                  <p>
                    {score === sharedScore && 'You matched the shared score.'}
                    {score > sharedScore && `You beat the shared score by ${score - sharedScore}.`}
                    {score < sharedScore && `You were ${sharedScore - score} short of the shared score.`}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={onCopyShareLink}>{copied ? 'Link Copied!' : 'Copy Share Link'}</button>
                  <button onClick={() => setShowGameOver(false)}>CLOSE</button>
                  <button onClick={startDebugGame}>Play Again (Debug)</button>
                </div>
              </div>
            </div>
          )}
        </div>
        <aside className="logPanel">
          <div className="logHeader">
            <span>Log</span>
          </div>
          <div className="logBody">
            {logs.length === 0 && <div className="logEmpty">No guesses yet.</div>}
            {logs.map((entry) => (
              <div
                key={`${entry.id}-${entry.timestamp}`}
                className="logItem"
                onMouseLeave={() => { if (!isTouchDevice) setHoveredTip(null); }}
                onMouseEnter={(e) => {
                  if (isTouchDevice) return;
                  const rowRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const logEl = document.querySelector('.logPanel') as HTMLElement | null;
                  const logLeft = logEl ? logEl.getBoundingClientRect().left : rowRect.left;
                  setHoveredTip({ ...entry, x: rowRect.right, y: rowRect.top, anchorLeft: logLeft });
                }}
                onClick={(e) => {
                  if (!isTouchDevice) return;
                  // prevent immediate document click handler from closing right away
                  e.stopPropagation();
                  const rowRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const logEl = document.querySelector('.logPanel') as HTMLElement | null;
                  const logLeft = logEl ? logEl.getBoundingClientRect().left : rowRect.left;
                  setHoveredTip((prev) => {
                    if (prev && prev.id === entry.id && prev.timestamp === entry.timestamp) return null;
                    return { ...entry, x: rowRect.right, y: rowRect.top, anchorLeft: logLeft };
                  });
                }}
              >
                <div className="logCard">
                  <div className="logPosterWrap">
                    {entry.posterUrl && <img className="logPoster" src={entry.posterUrl} alt="" />}
                    <div className="logScoreBadge">+{entry.score != null ? entry.score : 0}</div>
                  </div>
                  <div className="logTitle">{entry.title}{entry.year ? ` (${entry.year})` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
      {hoveredTip && (
        <div
          ref={tipRef}
          className="tipFloating"
          style={{
            position: 'fixed',
            left: tipPos ? tipPos.left : Math.max(12, hoveredTip.anchorLeft - Math.min(460, window.innerWidth - 24)),
            top: tipPos ? tipPos.top : Math.max(12, Math.min(hoveredTip.y, window.innerHeight - 12 - 220)),
            maxWidth: Math.min(460, window.innerWidth - 24),
            maxHeight: Math.min(520, window.innerHeight - 24),
            overflow: 'auto',
            zIndex: 100000
          }}
        >
          <div className="tipTopSection">
            {hoveredTip.posterUrl && <img className="tipPoster" src={hoveredTip.posterUrl} alt="" />}
            {hoveredTip.clearedPrompts && hoveredTip.clearedPrompts.length > 0 && (
              <div className="tipCleared">
                <div className="tipKey">Cleared</div>
                <ul>
                  {hoveredTip.clearedPrompts.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="tipTitle">
            <span className={hoveredTip.highlight?.title ? 'hl' : ''}>{hoveredTip.title}</span>
            {hoveredTip.year ? (
              <> (
                <span className={((() => {
                  const dec = hoveredTip.highlight?.decade;
                  if (!dec) return '';
                  const y = Number(String(hoveredTip.year).slice(0,4));
                  return (y >= dec && y <= dec + 9) ? 'hl' : '';
                })())}>{hoveredTip.year}</span>
              )</>
            ) : null}
          </div>
          <div className="tipRow"><span className="tipKey">Genres</span><span className="tipVal">{
            hoveredTip.genres && hoveredTip.genres.length > 0 ? (
              hoveredTip.genres.map((g, i) => {
                const isHl = (hoveredTip.highlight?.genres || []).some(a => new RegExp(a.replace(/[-\/\\^$*+?.()|[\]{}]/g, '.'), 'i').test(g));
                return <span key={i} className={isHl ? 'hl' : ''}>{g}{i < hoveredTip.genres!.length - 1 ? ', ' : ''}</span>;
              })
            ) : 'None'
          }</span></div>
          <div className="tipRow"><span className="tipKey">Runtime</span><span className="tipVal">{hoveredTip.runtime != null ? `${hoveredTip.runtime} min` : 'None'}</span></div>
          <div className="tipRow"><span className="tipKey">Director</span><span className="tipVal">{
            hoveredTip.directors && hoveredTip.directors.length > 0 ? (
              hoveredTip.directors.map((d, i) => {
                const isHl = (hoveredTip.highlight?.directors || []).some(a => new RegExp(a.replace(/[-\/\\^$*+?.()|[\]{}]/g, '.'), 'i').test(d));
                return <span key={i} className={isHl ? 'hl' : ''}>{d}{i < hoveredTip.directors!.length - 1 ? ', ' : ''}</span>;
              })
            ) : 'None'
          }</span></div>
          <div className="tipRow"><span className="tipKey">Stars</span><span className="tipVal">{
            hoveredTip.stars && hoveredTip.stars.length > 0 ? (
              hoveredTip.stars.map((s, i) => {
                const isHl = (hoveredTip.highlight?.actors || []).some(a => new RegExp(a.replace(/[-\/\\^$*+?.()|[\]{}]/g, '.'), 'i').test(s));
                return <span key={i} className={isHl ? 'hl' : ''}>{s}{i < hoveredTip.stars!.length - 1 ? ', ' : ''}</span>;
              })
            ) : 'None'
          }</span></div>
          <div className="tipRow"><span className="tipKey">Language</span><span className="tipVal"><span className={hoveredTip.highlight?.languageNonEnglish ? 'hl' : ''}>{hoveredTip.language ? hoveredTip.language.toUpperCase() : 'N/A'}</span></span></div>
          <div className="tipRow"><span className="tipKey">Budget</span><span className="tipVal">{hoveredTip.budget && hoveredTip.budget > 0 ? <span className={hoveredTip.highlight?.budgetUnder1m || hoveredTip.highlight?.budgetOver100m ? 'hl' : ''}>{`$${hoveredTip.budget.toLocaleString()}`}</span> : 'None'}</span></div>
          <div className="tipRow"><span className="tipKey">Box Office</span><span className="tipVal">{hoveredTip.boxOffice && hoveredTip.boxOffice > 0 ? <span className={hoveredTip.highlight?.boxOffice10x || hoveredTip.highlight?.boxOfficeFlop ? 'hl' : ''}>{`$${hoveredTip.boxOffice.toLocaleString()}`}</span> : 'None'}</span></div>
          <div className="tipRow"><span className="tipKey">Awards</span><span className="tipVal"><span className={hoveredTip.highlight?.awards ? 'hl' : ''}> {
            (() => {
              const wins = (hoveredTip.awards || []).filter(a => a.isWinner);
              const oscars = wins.filter(a => a.isWinner && a.name === 'Academy Awards');
              if (wins.length === 0) return 'None';
              let str = `${wins.length} win${wins.length === 1 ? '' : 's'}`;
              if (oscars.length > 0) {
                str += ` (${oscars.length} Oscar${oscars.length === 1 ? '' : 's'})`;
              }
              return str;
            })()
          }</span></span></div>
        </div>
      )}

      {actorPreview && (() => {
        const scale = 1.2;
        const ow = actorPreview.rect.width * scale;
        const oh = actorPreview.rect.height * scale;
        const left = actorPreview.rect.left + (actorPreview.rect.width / 2) - (ow / 2);
        const top = actorPreview.rect.top + (actorPreview.rect.height / 2) - (oh / 2);
        return (
          <div className="actorPreviewOverlay" aria-hidden>
            <div className="actorPreviewImg" style={{ left, top, width: ow, height: oh, position: 'fixed', backgroundImage: `url(${actorPreview.url})`, filter: 'grayscale(100%) brightness(0.55)' }} />
          </div>
        );
      })()}

      {showHowTo && (
        <div className="overlayModal" role="dialog" aria-modal="true">
          <div className="modalCard">
            <h3>How to Play</h3>
            <p><strong>Daily:</strong> You have 10 guesses to check off as many boxes as possible. Checked boxes are replaced with new prompts. Each box is worth 1 point, and one movie can satisfy multiple prompts.</p>
            <p><strong>Fixed:</strong> Prompts do not refresh when filled. There’s no guess limit; the goal is to fill all boxes in as few guesses as possible.</p>
            <div className="modalActions">
              <button className="okBtn" onClick={() => { try { localStorage.setItem('afgf-howto-shown-v1', '1'); } catch {} setShowHowTo(false); }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
