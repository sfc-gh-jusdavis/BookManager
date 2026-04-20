# Plan: GitHub Repo Init + Playground-to-Project Migration

## Context

BookManager lives at `~/.snowflake/cortex/playground/workspace/BookManager` (the Playground). There is no Git repo. The goal is to:
1. Push to a private GitHub repo (from the existing plan)
2. Migrate all accumulated Cortex Code context so future sessions in the new project directory retain full knowledge

### What needs to migrate

| Artifact | Location | Count | Strategy |
|----------|----------|-------|----------|
| Plan files | `playground/workspace/.snowflake/cortex/plans/*.plan.md` | 48 | Copy into project `.snowflake/cortex/plans/` (git-tracked for reference, or keep local-only) |
| Memory files | `/memories/bookmanager-*.md` (6 files) | ~6 | Distill into `AGENTS.md` at project root |
| AGENTS.md | `BookManager/AGENTS.md`, `BookManager/bkmng-next/AGENTS.md` | 2 | Already in project -- enrich with memory content |
| Docs | `BookManager/docs/` | 10 | Already in project -- committed as-is |
| Conversations | `~/.snowflake/cortex/conversations/` | ~118 | Global store -- no migration needed. All sessions have `working_directory: /Users/jusdavis` (not playground-specific), so `/resume` works from anywhere |

### Key finding: Conversations are already portable

All 118 conversations store `working_directory: /Users/jusdavis` (your home dir), not the Playground path. This means `/resume` will work from any directory -- the session picker is global. No conversation migration is needed.

---

## Task 1: Create .gitignore and Scan for Secrets

Create `BookManager/.gitignore`:

```
# Dependencies
node_modules/
bkmng-next/.next/
backend/__pycache__/
backend/.venv/
*.pyc

# Environment / secrets
.env
backend/.env
*.pem
*.key

# Docker overrides
docker-compose.override.yml

# OS
.DS_Store
Thumbs.db

# Build artifacts
dist/
build/
*.egg-info/

# IDE
.vscode/
.idea/

# Snowflake connections (NEVER commit)
connections.toml

# Cortex Code local state (plans are optional -- see Task 3)
.snowflake/
```

Then scan for secrets:
```bash
grep -rn "PAT\|password\|secret\|private_key" --include="*.py" --include="*.ts" --include="*.tsx" --include="*.yaml" BookManager/
```

Review `bkmng-spec-demo.yaml` for any inline secret values (it references Snowflake secrets by name, which is fine).

---

## Task 2: Initialize Git Repo and Push to GitHub

```bash
cd BookManager/
git init
git add .
git commit -m "Initial commit: BookManager full-stack app (Next.js + FastAPI)"
gh repo create bookmanager --private --source=. --push
```

---

## Task 3: Migrate Playground Plans into the Project

The 48 `.plan.md` files in `playground/workspace/.snowflake/cortex/plans/` are valuable design documents. Two options:

**Option A (Recommended):** Copy them into `BookManager/docs/plans/` and commit them as project documentation. This makes them available to anyone who clones the repo and to any Cortex Code session working in the project.

```bash
mkdir -p BookManager/docs/plans
cp playground/workspace/.snowflake/cortex/plans/*.plan.md BookManager/docs/plans/
```

**Option B:** Copy them into `BookManager/.snowflake/cortex/plans/` (the project-local Cortex Code plans directory). This keeps them as Cortex Code artifacts rather than general docs. Add `.snowflake/` to `.gitignore` if you don't want them in the repo.

---

## Task 4: Consolidate Memory into Project AGENTS.md

The file `/memories/bookmanager-project.md` is ~500 lines of accumulated project knowledge. New Cortex Code sessions won't automatically read memory files -- they read them only if the memory tool is available and the agent checks. But `AGENTS.md` at the project root is **always** loaded automatically.

**Action:** Distill the memory file into a structured `AGENTS.md` that covers:

1. **Project overview** -- what BookManager is, tech stack, directory layout
2. **Snowflake infrastructure** -- tables, SPs, tasks, connections, schemas
3. **SPCS deployment** -- service name, compute pool, image registry, URLs
4. **Key patterns** -- Cortex COMPLETE syntax, EXECUTE AS CALLER requirement, CONCAT_WS null bug, Python 3.9 constraints
5. **Architecture decisions** -- signals framework, A360 integration, hybrid chat pipeline
6. **Development workflow** -- how to start locally, environment setup, testing

The existing `BookManager/AGENTS.md` and `BookManager/bkmng-next/AGENTS.md` already exist and should be reviewed/merged with this content.

---

## Task 5: Create Project Context Rules

Set up `.cortex/` in the project root for project-specific Cortex Code configuration:

```
BookManager/.cortex/
  commands/
    deploy.md      -- "Build and push to SPCS" workflow
    refresh.md     -- "Run all Snowflake refresh SPs" workflow
```

These become available as `/deploy` and `/refresh` slash commands when working in the project directory.

Also consider a `CONTEXT.md` or context rules file if there are project-specific constraints (e.g., "always use SE_XS_WH", "never write outside TEMP.JUSDAVIS").

---

## Task 6: Clone Repo to a Real Project Directory

```bash
mkdir -p ~/Projects
cd ~/Projects
gh repo clone bookmanager
```

Then start Cortex Code from there:
```bash
cd ~/Projects/bookmanager
cortex
```

Or: `cortex -w ~/Projects/bookmanager`

The Playground copy can remain as-is (it won't interfere).

---

## Task 7: Verify Session Resume from New Directory

From the new project directory, run:
```bash
cortex resume
```

Pick a BookManager-related session. Confirm:
- Conversation history loads correctly
- File references in the conversation still work (may show old playground paths in history -- this is expected and harmless)
- AGENTS.md context is picked up from the new project root
- `/diff`, `!git status`, etc. now operate on the git repo

---

## Summary: What Stays Global vs. What Migrates

```
GLOBAL (no migration needed)          PROJECT (migrate/create)
---------------------------------------  ----------------------------------
~/.snowflake/cortex/                    ~/Projects/bookmanager/
  conversations/  (all sessions)          AGENTS.md  (from memory files)
  settings.json                           .cortex/commands/  (new)
  skills/                                 docs/plans/  (from playground plans)
  mcp.json                                .gitignore  (new)
  hooks.json                              
/memories/  (global memory)             
```
