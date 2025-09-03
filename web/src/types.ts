import type { Prompt } from './prompts';

export interface TvdbSearchItem {
  tvdbId: string;
  rawTitle: string;
  displayTitle: string;
  year?: string;
  thumb?: string;
}

export interface TvdbPerson {
  id: number;
  name: string;
  type?: string;
  peopleType?: string; // "Actor", "Director", "Writer" etc. This is what our server normalizes to.
  role?: string;
  sort?: number;
  is_featured?: boolean;
  image?: string;
}

export interface TvdbMovieDetails {
  id?: number;
  name: string;
  slug?: string;
  releaseDate?: string; // YYYY-MM-DD
  year?: string | number; // release year convenience
  runtime?: number; // minutes
  genres?: string[];
  translations?: Record<string, string>;
  posterUrl?: string;
  people?: TvdbPerson[];
  originalLanguage?: string;
  budget?: string;
  boxOffice?: string;
  awards?: { name: string; category: string; isWinner: boolean }[];
}

export type Cell = {
  prompt: Prompt;
  filledBy?: { id: string; title: string; posterUrl?: string; };
  clearing?: boolean;
};

export type LogEntry = {
  id: string;
  title: string;
  year?: number | string;
  runtime?: number;
  genres?: string[];
  directors?: string[];
  writers?: string[];
  stars?: string[];
  posterUrl?: string;
  timestamp: number;
  language?: string;
  budget?: number;
  boxOffice?: number;
  awards?: { id: string; name: string; isWinner: boolean }[];
  clearedPrompts?: string[];
  score?: number;
  highlight?: {
    actors?: string[];
    directors?: string[];
    writers?: string[];
    genres?: string[];
    title?: boolean;
    runtimeShort?: boolean;
    runtimeEpic?: boolean;
    budgetUnder1m?: boolean;
    budgetOver100m?: boolean;
    boxOffice10x?: boolean;
    boxOfficeFlop?: boolean;
    languageNonEnglish?: boolean;
    awards?: boolean;
    decade?: number; // e.g. 1990 for 1990s
    yearBefore?: number; // highlight year when before
    yearAfter?: number;  // highlight year when after
  };
};


