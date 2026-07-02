# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Evolutionary Gloria** — a full-stack 2D action platformer web game. Monorepo with a Spring Boot backend and a React + Phaser frontend. The signature gameplay gimmick is duo browser-tab play: one shared character mirrored across two tabs, each tab hosting one of two bosses (Sirius / Orion) with shared health. Deployed to a DigitalOcean droplet at `ssc-gameproject.dranon-todolist.me`.

The full project plan (milestones M0–M7) lives in the approved plan; SOLID principles are a graded criterion — keep single-purpose classes, attack patterns as `AttackPattern` implementations, and depend on interfaces (`SyncTransport`, `ResetTokenSender`, `InputSource`).

## Layout

- `backend/` — Spring Boot 3.5 (Java 21), Maven. Packages under `io.muzoo.ic.gloria`: `config`, `auth`, `user`, `match`, `shop`, `leaderboard`, `common`. Flyway migrations in `src/main/resources/db/migration/` (SQL kept compatible with PostgreSQL and H2-in-PostgreSQL-mode).
- `frontend/` — Vite + React 19 + TypeScript + Phaser 3. `src/app/` (router), `src/pages/`, `src/game/` (core, sync, player, bosses, scenes), `src/lib/`.
- `deploy/` — nginx config, production compose, droplet setup.
- `.github/workflows/ci.yml` — backend `mvn verify`, frontend test+build, Semgrep (`--error`), Trivy fs scan (fails on HIGH/CRITICAL).
- `docker-compose.yml` — local PostgreSQL 16 only.

## Commands

- Backend build & test: `cd backend && mvn -B verify`
- Backend run (needs local postgres via `docker compose up -d`): `cd backend && mvn spring-boot:run`
- Backend run without Docker (H2 in-memory): `cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=dev`
- Frontend dev server (proxies `/api` to `:8080`): `cd frontend && npm run dev`
- Frontend test: `cd frontend && npm test` (Vitest)
- Frontend build: `cd frontend && npm run build`

## Environment notes

- Node is installed via nvm; if `node` is not found in a shell, `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"` first.
- Local JDK is newer than 21; the build targets 21 via `java.version` — CI and Docker images use Temurin 21.
- Docker is NOT available locally (no sudo); use the H2 `dev` profile for local runs and rely on CI/droplet for container work.

## Conventions

- REST API under `/api/...`; auth via JWT in httpOnly cookies (never localStorage).
- Server is authoritative for points/wins/potions — clients never submit their own totals.
- DB schema changes only via new Flyway migrations (`V2__...`, never edit applied ones).
- Backend tests use the `test` profile (H2). Test sources ARE tracked — do not re-add `/src/test/` to `.gitignore`.
