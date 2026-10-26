# MediCast Frontend

React + TypeScript + Vite, styled with Tailwind CSS.

## Getting started

```bash
npm install
npm run dev
```

## Scripts

| Script            | Description                      |
| ----------------- | -------------------------------- |
| `npm run dev`     | Start the Vite dev server        |
| `npm run build`   | Type-check and build for production |
| `npm run preview` | Preview the production build     |
| `npm run lint`    | Run Oxlint                       |

## Tailwind

Tailwind CSS v4 is enabled through the `@tailwindcss/vite` plugin. Theme
customization (colors, fonts, etc.) lives in `tailwind.config.ts`, which is
loaded from `src/index.css` with the `@config` directive.
