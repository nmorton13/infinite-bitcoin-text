# The Infinite Bitcoin Text

An infinite, terminal-styled scroll of streamed Bitcoin prose. Each chunk focuses on a fresh topic from cryptography to energy, balancing technical precision with a gritty cyberpunk tone.

**[Live Demo →](https://infinitebitcointext.com)**

## Features
- Infinite scroll that lazily fetches new fragments as you near the bottom
- Topic rotation to avoid repeats, with headers stamped into every section
- Sticky Bitcoin logo that scrolls back to the top on click
- Custom loading banter and graceful retry UI when calls fail
- Clean paragraphs (no markdown) with Tailwind-inlined styling

## Tech Stack
- React 19 + TypeScript, Vite 6
- Tailwind via CDN (see `index.html`)
- OpenRouter calling `google/gemini-2.5-flash-lite-preview-09-2025`

## Running Locally
Prereqs: Node.js (latest LTS). Install `wrangler` globally or use `npx` for the Cloudflare flow below.

The app expects to call `/openrouter`, which is provided by the Cloudflare Pages function in `functions/openrouter.ts`. Pick the flow that matches how you want to test.

### Vite + local Cloudflare function (prod-like)
1) Install deps: `npm install`
2) Copy `.env.example` to `.env.local` (or `.env`) and set:
```
VITE_API_BASE_URL=http://127.0.0.1:8788
```
3) Copy `.dev.vars.example` to `.dev.vars` for the function runtime:
```
OPENROUTER_API_KEY=your_openrouter_key
```
4) Terminal 1: `npx wrangler pages dev . --port 8788 --local`
5) Terminal 2: `npm run dev` (open http://localhost:5173)

Vite points to the locally running Pages function at `/openrouter`, keeping your key server-side.

## Project Map
- `index.tsx`: Vite entry point
- `App.tsx`: Infinite scroll UI and data flow
- `components/BitcoinLogo.tsx`: Sticky logo + scroll-to-top
- `services/openRouterService.ts`: OpenRouter client and prompt
- `constants.ts`: Bitcoin topic pool
- `types.ts`: Shared interfaces/enums

## Deploying to Cloudflare Pages
- Build command: `npm run build`; Output directory: `dist`; Functions auto-detected from `functions/`
- Env: set secret `OPENROUTER_API_KEY` in the Pages project
- Optional env: `CORS_ALLOW_ORIGIN=https://your-domain.example` for a specific production origin (local dev stays `*`)
- Optional env: leave `VITE_API_BASE_URL` empty so the app calls same-origin `/openrouter` in production; set it only if you proxy through a different host
- Deploy flow: if you want to host on Cloudflare Pages, create a project pointing at **your** fork/clone of this repo, apply the settings above, and deploy so the bundled `/openrouter` function runs with same-origin fetches.

## Standalone Version (BYOK)
Prefer to self-host with your own API key? Grab `standalone/index.html` — a single-file, zero-dependency version that runs anywhere.

- No build step, no backend, no Cloudflare
- Uses your OpenRouter API key stored in localStorage
- Same UI and functionality as the main app
- Host it on GitHub Pages, Netlify, or open it locally in a browser

Just open the file or drop it on any static host. On first load it will prompt for your API key.

## Contributing
Want to add a topic? Edit the `BITCOIN_TOPICS` array in `constants.ts` and open a PR.

## License
MIT — see [LICENSE](LICENSE).
