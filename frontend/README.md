# Hireflow Frontend

Premium dark SaaS UI for the dual-role Hireflow platform (Job Seeker + Recruiter).

## Stack

- React + Vite + TypeScript
- TailwindCSS (design tokens in `src/index.css`)
- React Router (role-based routing)

## Design System

- Dark-first palette with CSS variables in `src/index.css`
- Typography: Inter (primary) + JetBrains Mono (data)
- Motion: `fade-in-up`, `float-up`, `shimmer`, `scale-in`, `shake`

## Dev

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

## UI Components

Reusable UI primitives live in `src/components/ui` (Button, Input, Card, Badge, Modal, Drawer, Skeleton).
