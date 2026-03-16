# Hireflow

Hireflow is a role-based hiring platform for job seekers and recruiters with mock-first workflows, analytics dashboards, and an ATS-focused resume builder.

## Tech Stack

![React](https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7.2.4-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2.1-06B6D4?logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2.1-000000?logo=express&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3ECF8E?logo=supabase&logoColor=white)

## Live Deployment

- Frontend (GitHub Pages): https://sharancode3.github.io/Hireflow/

## Major Features

- Role-separated auth and dashboards (Job Seeker / Recruiter)
- Job browsing, applying, saved jobs, and application pipeline tracking
- Recruiter posting, applicant review, interviews, and analytics
- Talent trends visualizations and command palette (`Ctrl+K`)
- Resume Builder with multiple templates and ATS scoring
- Interview Prep and Skill Gap analysis modules

## Run Locally

### Quick Start (Windows)

1. Install Node.js LTS
2. Open the repo in VS Code
3. Run `start-windows.bat`

### Manual Start

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Scripts (Root)

- `npm run dev` — start frontend + backend concurrently
- `npm run typecheck` — type-check frontend + backend
- `npm run lint` — lint frontend
- `npm run build` — production build frontend + backend
- `npm run check` — typecheck + lint + build

## Environment Setup

Use the included examples:

- `.env.example`
- `frontend/.env.example`

Copy them to actual `.env` files and fill values for your environment.

## Supabase Setup

Frontend auth and the active backend routes use Supabase directly.

Required backend environment variables:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Current backend runtime serves health checks plus the active Supabase-backed recruiter API surface.

## Recruiter Approval And Access Flow

- Recruiter accounts are stored in `profiles` with `role = 'RECRUITER'`.
- Admin approval is stored in `profiles.recruiter_approval_status`.
- Recruiters with status `APPROVED` can post jobs, manage applicants, and schedule interviews.
- Recruiters with status `PENDING` are redirected to the pending page until approved.

## New Integrity Migration

Run the migration `supabase/migrations/20260313_role_integrity_and_recruiter_flow.sql`.

It adds:

- Role/status integrity checks for recruiter vs job-seeker profiles.
- Trigger-based relationship checks for `jobs` and `applications`.
- Recruiter visibility into job seeker profiles only for applicants to their jobs.
- Admin visibility policy for job seeker profiles.
- `admin_user_directory` view for cross-role admin monitoring.

## Advanced Data Governance Migration

Run the migration `supabase/migrations/20260313_state_machine_audit_and_rpc_controls.sql`.

It adds:

- Table-level lifecycle state-machine guards for recruiter approvals, applications, and job reviews.
- Structured integrity audit log table for compliance and forensic debugging.
- Admin RPC (`admin_set_recruiter_approval`) for controlled recruiter verification updates.
- Recruiter RPC (`recruiter_update_application_status`) for controlled applicant lifecycle changes.
- Backward-compatible app fallbacks while migration rollout is in progress.

### Integrity Verification Matrix

After applying the two migrations, run:

```bash
cd backend
npm run integrity:matrix
```

Expected result: `"ok": true` with all checks passing.

