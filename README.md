<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# The Infinite Bitcoin Text

An infinite, terminal-styled scroll of Bitcoin prose streamed from OpenRouter. Each chunk focuses on a fresh topic from cryptography to energy, balancing technical precision with a gritty cyberpunk tone.

## Features
- Infinite scroll that lazily fetches new fragments as you near the bottom
- Topic rotation to avoid repeats, with headers stamped into every section
- Sticky Bitcoin logo that scrolls back to the top on click
- Custom loading banter and graceful retry UI when calls fail
- Clean paragraphs (no markdown) with Tailwind-inlined styling

## Tech Stack
- React 19 + TypeScript, Vite 6
- Tailwind via CDN (see `index.html`)
- OpenRouter calling `x-ai/grok-4.1-fast` through a proxy endpoint

## Getting Started
Prerequisites: Node.js (latest LTS recommended).

```bash
npm install
```

Create `.env.local` (preferred) or `.env`:
```
VITE_OPENROUTER_API_KEY=your_openrouter_key
# Optional: set if you proxy OpenRouter through another base URL
VITE_API_BASE_URL=https://your-proxy.example.com
```

Run the dev server:
```bash
npm run dev
```

## Build & Preview
```bash
npm run build   # output to dist/
npm run preview # serve the built assets locally
```

## Project Map
- `index.tsx`: Vite entry point
- `App.tsx`: Infinite scroll UI and data flow
- `components/BitcoinLogo.tsx`: Sticky logo + scroll-to-top
- `services/openRouterService.ts`: OpenRouter client and prompt
- `constants.ts`: Bitcoin topic pool
- `types.ts`: Shared interfaces/enums

## Manual QA Checklist
- Initial load renders a topic with multiple paragraphs
- Scrolling near the bottom fetches new chunks without repeats
- Retry button recovers from simulated failures (disconnect network or throttle API)
- Logo click scrolls smoothly to the top
