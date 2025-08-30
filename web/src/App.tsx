import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { searchMovies, getMovieDetails, getDailyPrompts } from './api'
import { generatePrompts, generateSinglePrompt, allPossiblePrompts } from './prompts'
import type { Prompt } from './prompts';
import type { Cell, TvdbMovieDetails, LogEntry, TvdbSearchItem } from './types'
import { parseMoney } from './utils';

const MAX_GUESSES = 10;

// Create a map of all possible prompts by their ID for easy look-up
const promptsById = new Map<string, Prompt>();
allPossiblePrompts.forEach(p => promptsById.set(p.id, p));

function generateBoard(prompts: Prompt[]): Cell[] {
  return prompts.map((prompt) => ({ prompt }));
}

function getDailyKey() {
  const now = new Date();
  // Use UTC date to ensure players in different timezones get the same puzzle on the same day
  return `daily-game-${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
}


function App() {
  const [cells, setCells] = useState<Cell[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TvdbSearchItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [guessesLeft, setGuessesLeft] = useState(MAX_GUESSES);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'gameOver'>('playing');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [hoveredTip, setHoveredTip] = useState<null | (LogEntry & { x: number; y: number; anchorLeft: number })>(null);
  const appRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [cellSize, setCellSize] = useState<number>(140);

  // Initial setup
  useEffect(() => {
    const startDailyGame = async () => {
      const dailyKey = getDailyKey();
      const savedState = localStorage.getItem(dailyKey);

      if (savedState) {
        const { cells, logs, guessesLeft, score, gameState } = JSON.parse(savedState);
        // We need to re-hydrate the prompts with their `test` functions
        const hydratedCells = cells.map((cell: Cell) => ({
          ...cell,
          prompt: promptsById.get(cell.prompt.id)
        }));
        setCells(hydratedCells);
        setLogs(logs);
        setGuessesLeft(guessesLeft);
        setScore(score);
        setGameState(gameState);
      } else {
        // No saved state for today, fetch a new game
        const dailyPrompts = await getDailyPrompts();
        const hydratedPrompts = dailyPrompts.map((p: { id: string }) => promptsById.get(p.id));
        setCells(generateBoard(hydratedPrompts as Prompt[]));
        setLogs([]);
        setGuessesLeft(MAX_GUESSES);
        setScore(0);
        setGameState('playing');
      }
    };

    startDailyGame();
  }, []);

  // Save game state to localStorage whenever it changes
  useEffect(() => {
    if (cells.length === 0) return; // Don't save empty initial state
    const dailyKey = getDailyKey();
    const stateToSave = {
      cells,
      logs,
      guessesLeft,
      score,
      gameState,
    };
    localStorage.setItem(dailyKey, JSON.stringify(stateToSave));
  }, [cells, logs, guessesLeft, score, gameState]);

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
      const nextCells = cells.map(cell => {
        if (cell.filledBy || cell.clearing) return cell;
        const ok = cell.prompt.test(details as TvdbMovieDetails, title);
        if (ok) {
          satisfiedPrompts.push(cell.prompt);
          return { ...cell, filledBy: { id: tvdbId, title, posterUrl: (details as TvdbMovieDetails).posterUrl } };
        }
        return cell;
      });

      const guessScore = satisfiedPrompts.length;
      
      // A correct guess was made, keep UI locked for animations
      setScore(s => s + guessScore);
      setGuessesLeft(n => n - 1);
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
      }, ...prev]);
      // Clear input and results after successful apply
      setQuery('');
      setResults([]);

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
          const existingPrompts = currentCells.map(c => c.prompt);
          return currentCells.map(cell => {
            if (cell.clearing) {
              return { prompt: generateSinglePrompt(existingPrompts) };
            }
            return cell;
          });
        });
        setSubmitting(false); // Re-enable submissions
      }, 3000);

    } catch (error) {
      console.error("Error applying movie:", error);
      setSubmitting(false);
    }
  }, [cells, logs]);

  useEffect(() => {
    if (guessesLeft <= 0 && gameState === 'playing') {
      setGameState('gameOver');
    }
  }, [guessesLeft, gameState]);

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

  // Dynamically size cells to fit 5 rows within viewport
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
      const logW = logPanel ? logPanel.offsetWidth : 0;
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
      // Always render a 4x4 board; size cells to fit viewport
      const cols = 4;
      const rows = 4;
      const maxByWidth = Math.floor((vw - gap * (cols - 1)) / cols);
      const maxByHeight = Math.floor((availableH - gap * (rows - 1)) / rows);
      const size = Math.max(64, Math.min(maxByWidth, maxByHeight));
      setCellSize(size);
    }
    recalc();
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('resize', recalc);
    };
  }, [results.length, logs.length]);

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
        <div className="title">A Few Good Films</div>
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
            {results.length > 0 && (
              <div className="results resultsOverlay" ref={resultsRef}>
                {results.slice(0,10).map(r => {
                  const isGuessed = logs.some(log => log.id === r.tvdbId);
                  return (
                    <button key={r.tvdbId} className="resultBtn" disabled={submitting || isGuessed} onClick={() => applyMovie(r.tvdbId, r.rawTitle)}>
                      {r.thumb && <img src={r.thumb} alt="" />}
                      <span>{r.displayTitle}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="counterPanel">Score: <strong>{score}</strong></div>
        <div className="counterPanel">Guesses Left: <strong>{guessesLeft}</strong></div>
        <button className="howToBtn" onClick={() => setShowHowTo(true)}>HOW TO PLAY</button>
      </div>

      <div className="playArea">
        <div className="boardWrap">
          <div className="grid" ref={gridRef} style={{ ['--cell-size' as any]: `${cellSize}px` }}>
            {cells.map((cell, idx) => {
              const poster = cell.filledBy?.posterUrl;
              const isFilled = !!cell.filledBy;
              const isClearing = !!cell.clearing;
              return (
                <div key={idx} className={`cell ${isClearing ? 'clearing' : ''}`} style={{ width: cellSize, height: cellSize, backgroundImage: poster ? `url(${poster})` : undefined, backgroundSize: poster ? 'cover' : undefined, backgroundPosition: 'center' }}>
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
          {gameState === 'gameOver' && (
            <div className="gameOverOverlay">
              <div className="gameOverContent">
                <h2>Game Over!</h2>
                <p>Your final score is: <strong>{score}</strong></p>
                <button onClick={onCopyShareLink}>{copied ? 'Link Copied!' : 'Copy Share Link'}</button>
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
                onMouseEnter={(e) => {
                  const rowRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const logEl = document.querySelector('.logPanel') as HTMLElement | null;
                  const logLeft = logEl ? logEl.getBoundingClientRect().left : rowRect.left;
                  setHoveredTip({ ...entry, x: rowRect.right, y: rowRect.top, anchorLeft: logLeft });
                }}
                onMouseLeave={() => setHoveredTip(null)}
              >
                <div className="logCard">
                  <div className="logPosterWrap">
                    {entry.posterUrl && <img className="logPoster" src={entry.posterUrl} alt="" />}
                    {entry.score && entry.score > 0 && <div className="logScoreBadge">+{entry.score}</div>}
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
          className="tipFloating"
          style={{
            position: 'fixed',
            left: (() => {
              const w = Math.min(460, window.innerWidth - 24);
              // Align tooltip's right edge with the log's left edge by default
              let lx = hoveredTip.anchorLeft - w;
              // If that would push off the left of the viewport, clamp to padding
              if (lx < 12) lx = 12;
              return lx;
            })(),
            top: (() => {
              const h = 220; // approximate; height grows with content but we clamp below
              let ty = hoveredTip.y;
              if (ty + h > window.innerHeight - 12) ty = window.innerHeight - h - 12;
              if (ty < 12) ty = 12;
              return ty;
            })(),
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

          <div className="tipTitle">{hoveredTip.title}{hoveredTip.year ? ` (${hoveredTip.year})` : ''}</div>
          <div className="tipRow"><span className="tipKey">Genres</span><span className="tipVal">{hoveredTip.genres && hoveredTip.genres.length > 0 ? hoveredTip.genres.join(', ') : 'None'}</span></div>
          <div className="tipRow"><span className="tipKey">Runtime</span><span className="tipVal">{hoveredTip.runtime != null ? `${hoveredTip.runtime} min` : 'None'}</span></div>
          <div className="tipRow"><span className="tipKey">Director</span><span className="tipVal">{hoveredTip.directors && hoveredTip.directors.length > 0 ? hoveredTip.directors.join(', ') : 'None'}</span></div>
          <div className="tipRow"><span className="tipKey">Stars</span><span className="tipVal">{hoveredTip.stars && hoveredTip.stars.length > 0 ? hoveredTip.stars.join(', ') : 'None'}</span></div>
          <div className="tipRow"><span className="tipKey">Language</span><span className="tipVal">{hoveredTip.language ? hoveredTip.language.toUpperCase() : 'N/A'}</span></div>
          <div className="tipRow"><span className="tipKey">Budget</span><span className="tipVal">{hoveredTip.budget && hoveredTip.budget > 0 ? `$${hoveredTip.budget.toLocaleString()}` : 'None'}</span></div>
          <div className="tipRow"><span className="tipKey">Box Office</span><span className="tipVal">{hoveredTip.boxOffice && hoveredTip.boxOffice > 0 ? `$${hoveredTip.boxOffice.toLocaleString()}` : 'None'}</span></div>
          <div className="tipRow"><span className="tipKey">Awards</span><span className="tipVal">{
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
          }</span></div>
        </div>
      )}

      {showHowTo && (
        <div className="overlayModal" role="dialog" aria-modal="true">
          <div className="modalCard">
            <h3>How to Play</h3>
            <p>
              You have ten guesses to check off as many boxes as possible! Checked boxes will be replaced with new prompts. Every box is worth 1 point, and one movie can check multiple boxes.
            </p>
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
