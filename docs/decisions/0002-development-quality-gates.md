# ADR 0002: Use one local and CI quality gate

Status: accepted for the second implementation increment

## Context

The project needs fast local feedback and a reliable pull-request gate before
Foundry-specific implementation begins. Separate commands are useful during
development, but CI must not use a different validation path from contributors.

## Decision

Use pnpm on Node.js 24. Vite builds the browser ESM bundle, ESLint checks code
quality with type-aware TypeScript rules, Prettier owns formatting, TypeScript
performs strict static checking, and Vitest runs unit tests and coverage.

`pnpm quality` is the canonical validation command. It runs formatting checks,
linting, type checking, and tests. GitHub Actions runs that command followed by
`pnpm build` for pull requests, merge queues, and updates to `main`.

The `main` branch requires pull requests and the `Quality and build` status
check. Direct pushes and force pushes are disallowed, including for repository
administrators, so the workflow itself is part of the protected delivery path.

## Consequences

- Contributors can reproduce CI failures locally.
- The generated bundle is tested on every proposed merge.
- Dependency and GitHub Actions updates are proposed weekly by Dependabot.
- Tooling upgrades remain visible, reviewable pull requests.
