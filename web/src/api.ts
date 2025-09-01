import type { Prompt } from "./prompts";
import type { TvdbMovieDetails, TvdbSearchItem as TvdbMovie } from "./types";

const API_BASE = '/api';

export async function searchMovies(query: string): Promise<TvdbMovie[]> {
  const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error('Failed to search movies');
  }
  return response.json();
}

export async function getMovieDetails(id: string): Promise<TvdbMovieDetails> {
  const response = await fetch(`${API_BASE}/movie/${id}`);
  if (!response.ok) {
    throw new Error('Failed to get movie details');
  }
  return response.json();
}

export async function getDailyPrompts(): Promise<{seed: string, prompts: Prompt[]}> {
  const response = await fetch(`${API_BASE}/daily-prompts`);
  if (!response.ok) {
    throw new Error('Failed to fetch daily prompts');
  }
  return response.json();
}


