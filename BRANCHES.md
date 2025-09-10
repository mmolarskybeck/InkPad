# Branches in this repository

Generated: 2025-09-10

This file documents the branches that exist on the remote and a short explanation of their purpose and how they differ from `main` (current local branch: `main`, commit: `32f60ffddfe53f3a8746832f6e14bd555cc80dc3`).

Summary
- Current branch: `main` — local `main` matches `origin/main` (up to date).
- Remote branches inspected: `origin/archive-main`, `origin/serverless`, `origin/stackblitz-backup`.

Per-branch notes

- origin/archive-main
  - Purpose / theme: Backend and deployment integration branch. Contains server code and deployment config intended to add a server-side component and hardened deployment setup.
  - Recent notable commits: "Final backend deployment preparations", "Complete Phase 1-3: Backend hardening, frontend enhancements, and deployment configuration".
  - Key file changes vs `main` (examples):
    - Adds `server/` directory and many server files: `server/index.ts`, `server/routes.ts`, `server/package.json`, `server/Dockerfile`, `server/storage.ts`, etc.
    - Adds CI / deploy files: `.github/workflows/deploy.yml`, `render.yaml`, `drizzle.config.ts`, `render.yaml`, `replit.md`.
    - Adds attached assets in `attached_assets/` and workflow support files.
    - Removes or moves some client helper files (e.g., `client/src/workers/ink-compiler.worker.ts`, `client/src/utils/ink-monarch.ts` marked deleted in that diff).
  - Meaning: This branch will add a server component and many infra artefacts — merging requires review of server surface, environment files, and CI/CD.

- origin/serverless
  - Purpose / theme: Serverless deployment and shared types / worker contract work.
  - Recent notable commits: "Created shared TypeScript interfaces in types/worker-messages.ts", "refactoring for serverless setup".
  - Key file changes vs `main` (examples):
    - Adds `types/worker-messages.ts` (shared types for main-thread <-> worker comms).
    - Adds `client/src/devnotes.md`, `shared/schema.ts`, small editor/component edits and serverless-related refactors.
  - Meaning: Focused on making the app work in serverless environments and stabilizing the worker communication contract — generally lighter-weight than `archive-main`, but still changes important shared types and runtime behaviour.

- origin/stackblitz-backup
  - Purpose / theme: Backup / experiment branch for StackBlitz / router and deployment experiments.
  - Recent notable commits: "Reworked for Router deployment", various Dockerfile/Vite tweaks.
  - Key file changes vs `main` (examples):
    - Adds `Dockerfile`, modifies `vite.config.ts` and other deployment configs.
    - Adds/edits `shared/schema.*` and several server/deploy files in some variants.
  - Meaning: Overlaps with deployment and infra changes found in `archive-main`; likely an experiment or backup branch for alternate deployment targets.

Is `main` up to date?
- Yes: local `main` matches `origin/main` at commit `32f60ffddfe53f3a8746832f6e14bd555cc80dc3`.

Recommended review steps (safe, repeatable)
1. Create a local branch that tracks a remote branch for inspection:

```bash
# review archive-main locally
git fetch origin
git checkout -b review/archive-main origin/archive-main
```

2. See commits `main` doesn't have, and file-level changes:

```bash
git log --oneline main..origin/archive-main
git diff --name-status main..origin/archive-main
```

3. If you want to test-merge and build without touching `main`:

```bash
# create an ephemeral merge branch and run the build
git checkout -b merge-test/archive-main main
git merge --no-ff --no-commit origin/archive-main
# run your build / tests here (for example: npm install && npm run build)
```

4. Audit items before merging into `main`:
  - Server branches: check environment files (`.env*`), secrets, Dockerfile and CI workflows.
  - Types/shared interfaces: ensure worker/main contract is compatible with existing code.
  - Client changes: run the dev server and smoke-test the editor and compilation flows.

Checklist (requirements coverage for this document)
- [x] Explain the branch list and current branch status. (Done)
- [x] Confirm whether `main` is up to date with remote. (Done)
- [x] Summarize differences for each remote branch. (Done)
- [x] Provide commands to inspect and test-merge safely. (Done)

Next steps you can ask me to perform
- I can create review branches locally and run the build/tests for a given branch and report failures.
- I can prepare a draft PR summary for merging any branch into `main`, listing risks and files to review.

If you'd like, tell me which branch to inspect first and I will create a local review branch and run the project's build to surface issues.
