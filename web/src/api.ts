import type { Prompt } from "./prompts";
import type { TvdbMovieDetails, TvdbSearchItem as TvdbMovie } from "./types";

const API_BASE = '/api';

export async function searchMovies(query: string): Promise<TvdbMovie[]> {
  const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) return [];
  const data = await response.json();
  if (!data || !Array.isArray(data.items)) return [];
  
  return data.items.map((m: any) => {
    const rawTitle = m.name || m.translations?.eng || '';
    return {
      tvdbId: String(m.tvdb_id),
      rawTitle: rawTitle,
      displayTitle: `${rawTitle}`.trim(),
      year: m.year,
      thumb: m.image_url,
    };
  });
}

export async function getMovieDetails(tvdbId: string): Promise<TvdbMovieDetails | null> {
  const res = await fetch(`${API_BASE}/movie/${encodeURIComponent(tvdbId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  // Normalize genres to string[] even if API returns objects
  const rawGenres = data.genres;
  let genres: string[] = [];
  if (Array.isArray(rawGenres)) {
    if (rawGenres.length > 0 && typeof rawGenres[0] === 'string') {
      genres = rawGenres as string[];
    } else if (rawGenres.length > 0 && typeof rawGenres[0] === 'object') {
      genres = (rawGenres as Array<{ name?: string }>).map((g) => g?.name || '').filter(Boolean);
    }
  }
  // Extract release date string and year from TVDB fields
  let releaseDate: string | undefined;
  // extended payload may have first_release as { country, date }
  const fr = data.first_release;
  if (fr && typeof fr === 'object' && typeof fr.date === 'string') {
    releaseDate = fr.date; // YYYY-MM-DD
  } else if (typeof data.first_air_time === 'string') {
    releaseDate = data.first_air_time;
  } else if (typeof data.releaseDate === 'string') {
    releaseDate = data.releaseDate;
  }
  const year = typeof data.year === 'string' || typeof data.year === 'number'
    ? data.year
    : (releaseDate && /^(\d{4})/.test(releaseDate) ? releaseDate.slice(0,4) : undefined);

  const details: TvdbMovieDetails = {
    id: data.id,
    name: data.name || data.translations?.eng || '',
    slug: data.slug,
    releaseDate,
    year,
    runtime: (typeof data.runtime === 'string' || typeof data.runtime === 'number') ? Number(data.runtime) : undefined,
    genres,
    translations: typeof data.translations === 'object' ? data.translations : undefined,
    people: Array.isArray(data.people) ? data.people : [],
    posterUrl: typeof data.image === 'string' ? data.image : (typeof data.image_url === 'string' ? data.image_url : data.posterUrl),
    
    // Pass through the new fields
    originalLanguage: data.originalLanguage,
    budget: data.budget,
    boxOffice: data.boxOffice,
    awards: data.awards,
  };
  return details;
}

export async function getDailyPrompts(): Promise<{seed: string, prompts: Prompt[]}> {
  const response = await fetch(`${API_BASE}/daily-prompts`);
  if (!response.ok) {
    throw new Error('Failed to fetch daily prompts');
  }
  return response.json();
}

export type PersonLookup = { name: string; imageUrl: string | null; id: number | string | null };

export async function getPersonByName(name: string): Promise<PersonLookup | null> {
  const q = name.trim();
  if (!q) return null;
  try {
    const res = await fetch(`${API_BASE}/person?name=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data as PersonLookup;
  } catch {
    return null;
  }
}


