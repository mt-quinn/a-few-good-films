# A Few Good Films

A daily movie guessing game.

## How to Play

- You have 10 guesses to fill a 4x4 grid of prompts.
- Each movie you guess will be checked against all prompts on the board.
- If a movie satisfies one or more prompts, those cells will be filled.
- The more prompts a single movie satisfies, the higher your score.

## Local Development

### Prerequisites

- Node.js (v18 or higher)
- An API key from [TheTVDB](https://www.thetvdb.com/subscribe).

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/mt-quinn/a-few-good-films.git
    cd a-few-good-films
    ```
2.  **Install dependencies:**
    ```bash
    # From the root directory
    npm install
    cd server && npm install
    cd ../web && npm install
    ```
3.  **Set up your TVDB API key:**
    - Create a file at `server/src/etl/api key.txt` and paste your TVDB API key into it.
4.  **Run the ETL script to build the local database:**
    - From the `server` directory, run:
      ```bash
      node src/etl/import.js
      ```
5.  **Start the development servers:**
    - In one terminal, from the `server` directory, run:
      ```bash
      npm start
      ```
    - In another terminal, from the `web` directory, run:
      ```bash
      npm run dev
      ```
6.  Open your browser to `http://localhost:5173`.

## Technologies Used

- **Frontend:** React, Vite, TypeScript
- **Backend:** Node.js, Express, better-sqlite3
- **Deployment:** Vercel
