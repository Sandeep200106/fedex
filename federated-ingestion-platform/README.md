# Pipeline Builder UI

## Requirements
- [Node.js](https://nodejs.org/) 18 or later installed

## First-time setup
Copy `.env.local.example` to `.env.local` and fill in a real LLM API key
(ask the project owner for one, or use your own Groq key):
```
VITE_LLM_API_KEY=your-api-key-here
```
Without this, the app runs but LLM-powered features won't work.

## How to run

**Windows:** double-click `start.bat`
**Mac/Linux:** open a terminal here and run `./start.sh` (first time: `chmod +x start.sh`)

The script installs dependencies (first run only) and opens the app at
http://localhost:5173/

To stop the app, close the terminal window it opened, or press `Ctrl+C` in it.

## Manual start (if the script doesn't work)
```
npm install
npm run dev
```
Then open http://localhost:5173/ in your browser.
