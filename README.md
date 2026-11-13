# Photo Lelo — Realtime Online Photobooth

**Photo Lelo** is a free, browser-based realtime online photobooth inspired by the core photobooth flow of `getangie.com/photobooth`, rebuilt from the ground up with completely original **Photo Lelo** branding, a warm tactile studio aesthetic, and zero paywalls.

## Why This Stack? (Easy Setup)
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + HTML5 Canvas 2D + Web Audio API
- **Realtime Backend**: Node.js + Express 5 + `ws` (WebSockets)
- **Zero External Infrastructure**: In-memory room state (no database, Redis, or Firebase keys required) and self-hosted `@fontsource` fonts (zero CDN dependencies).

### Quick Start
```bash
npm install
npm run dev
```
Then open `http://localhost:5173`.

To build & run as a single production server:
```bash
npm run build
npm start
```

### Scripts
- `npm run dev` — Runs the API + WebSocket server (`127.0.0.1:3001`) and Vite dev server (`0.0.0.0:5173`) concurrently with `/api` and `/ws` proxied seamlessly.
- `npm run typecheck` — Typechecks both client and server TypeScript projects.
- `npm test` — Runs unit and WebSocket room integration tests via Vitest.
- `npm run build` — Builds the client (`dist/`) and compiles the server (`dist-server/`).

## Features Included
- **Duo (2-Person), Squad (Up to 4), and Solo Modes**: Create a 5-letter room code + invite link or jump directly into a Solo booth.
- **6 Booth Styles**: Classic Studio, Vintage 1930s (sliding crimson velvet curtains), Meme Booth (pose dares + captions), Laundromat Drum, Subway Car, and Karaoke Booth.
- **4 Strip Layouts & 22 Frame Themes**: `1×4` Classic Strip (600×1800 @ 300 DPI), `2×2` Grid Card, `1×3` Tall Strip, and `Polaroid Duo` across Minimal, Patterns, Coquette, Travel, Food & Café, and Cozy packs.
- **Shared Split-Scene Backdrops**: Paris Window, Tokyo Terrace, Midnight Cinema (with shared popcorn tub), Cozy Café, Sunny Picnic, Santorini Dusk, and Starry Rooftop.
- **Live Camera, Virtual Studio Cam & Uploads**: Works with real webcams, photo uploads, or the built-in animated **Studio Virtual Cam** (for testing or camera-free devices).
- **Synced Ready Gate & 6-Shot Capture**: Server-owned countdown waits until all room participants click "I'm Ready", then fires every camera at the same tick.
- **Collaborative Co-Editing**: Live partner cursors, pick 4 favorite cuts out of 6, deterministic pixel-math strip filters, drag/rotate/scale stickers, and freehand crayon doodles.
- **Free Exports & Keepsakes**: Watermark-free 300 DPI PNG strips, 1080×1920 lockscreen wallpapers, WebM booth recap video export, and Fridge Magnet / Acrylic Keychain previews.
