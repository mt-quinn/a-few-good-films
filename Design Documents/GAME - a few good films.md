# 🎬 A Few Good Films: Game Design Document

## Overview
**A Few Good Films** is a daily movie puzzle game where the challenge is to complete a 5×5 grid of film prompts in the **fewest possible movies**. Unlike other daily movie games that require deep trivia knowledge, this one is **approachable**: any correct movie works, as long as it objectively satisfies the prompt. The game is about **optimization, creativity, and efficiency**.

---

## Core Loop
1. **Daily Board:** All players see the same 5×5 grid of prompts (e.g., “a movie with a car chase,” “black-and-white,” “runtime < 90 min”).  
2. **Submission:** Players enter known films by selecting from a database-powered autocomplete.  
3. **Validation:** The system checks the film against the objective prompts (database fields like runtime, release year, genre, etc.).  
4. **Progress:** Each submitted film fills all squares it qualifies for simultaneously.  
5. **Goal:** Achieve **five in a row** (Bingo) in as few films as possible.  
6. **Sharing:** Players share results like “I solved today’s in 3 films 🎬🎬🎬.”  

---

## Scoring
- **Primary Metric:** Fewest unique films used to achieve Bingo.  
- **Secondary Challenges:**  
  - *Full Card Mode:* Cover all 25 squares in the fewest films.  
  - *Streaks:* Track consecutive daily completions.  
  - *Speed Mode (optional):* Solve within a time limit.  

---

## Prompt Categories
All prompts are **objective and resolvable via movie databases** (e.g., TMDb, OMDb, IMDb).  

### 🎯 Examples
- **Title-Based:** Title contains a color, a number, one word only, starts with “The.”  
- **Year/Runtime/Language:** Released in the 1980s, runtime < 90 min, non-English.  
- **Genres:** Animated, Documentary, Horror, Musical.  
- **Credits:** Directed by Steven Spielberg, Written & Directed by the same person, Directed by a woman.  
- **Awards/Recognition:** Won Best Picture, Won any Oscar, Cannes winner.  
- **Technical:** Black-and-white, IMAX release, Animated film from Japan.  
- **Franchise/Sequel:** Has a sequel, Part of a franchise, Is a remake.  

### Balance
- Each board mixes:  
  - **5 Easy prompts** (broad, approachable).  
  - **15 Medium prompts** (require thought, overlap opportunities).  
  - **5 Hard prompts** (specific or narrow).  

---

## Community & Social Layer
- **Global Board:** Same prompts for everyone daily.  
- **Result Sharing:** Exportable results with film emoji rows (e.g., 🎬🎬🎬).  
- **Leaderboards:**  
  - Local friend groups.  
  - Highlighted “Optimal Solution” (minimum films possible for that day’s card).  
- **Conversation:** Prompts fuel discussion (“I solved with *Titanic*—it covered boat + Oscar + long runtime!”).  

---

## Daily Rhythm
- **Reset:** New card at midnight UTC.  
- **Check-Back:** At day’s end, reveal the optimal minimum films possible.  
- **Retention:** Streaks and shareable results encourage daily play.  

---

## Tone & Branding
- **Title:** *A Few Good Films* — a playful nod to *A Few Good Men*.  
- **Tone:** Accessible, fun, lightly cinephile but not gatekeep-y.  
- **Visuals:** Film strip / clapperboard grid UI. Prompts in each cell; solved cells filled with movie posters or reels.  

---

## Edge Cases & UX
- **Autocomplete Search:** Prevents typos and obscure entries; encourages mainstream film usage.  
- **Validation:** Uses metadata queries, no subjective prompts (avoids spoilers/debates).  
- **Caching:** Results for (movie, prompt) pairs stored to speed up repeat validations.  
- **Disputes:** If an error occurs, community report system flags issues for correction.  

---

## Why It Works
- **Approachability:** No deep trivia required—use the films you know.  
- **Optimization Challenge:** Clever players can “solve the board” with minimal films.  
- **Social Stickiness:** People compare paths, not just answers.  
- **Daily Ritual:** One new board per day → consistent, snackable habit.  

---

## Future Extensions
- **Theme Days:** Horror in October, musicals on Broadway anniversaries, etc.  
- **Alternate Modes:** Full card completion, speed runs, or consensus mode (community-voted validation).  
- **Events:** Weekly “double grid” challenges.  

---
