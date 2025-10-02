# Project Goal
Cloud Functions v2 (Node 20 + TS) that are the ONLY write path to Firestore.  
- **Require IAM authentication** (Cloud Run Invoker).  
- Generate **embeddings** with `gemini-embedding-001`.  
- Generate **hero images** with `gemini-2.5-flash-image-preview` into Firebase Storage.  
- Implement CRUD for recipes & ingredients + simple search + semantic search (KNN on `recipes.embedding`).

# Important Note
This repo didn’t run `firebase init firestore` / `storage` (that happened in seed-scripts). That’s fine: use `firebase-admin` in Functions and `admin.initializeApp()` (no direct emulator config here).

# Data Model (shared)
Copy `src/types.ts` in this repo. Fields as agreed (see viewer CLAUDE.md).

# Endpoints (HTTPS v2, auth required)
- Ingredients:
  - `POST /ingredients.create` → `IngredientCreate` (id = normalized name), set audit, `isArchived=false`, embed `name`.
  - `POST /ingredients.update` → by `id`; update fields; re-embed if `name` changed.
  - `POST /ingredients.delete` → soft-delete.
  - `GET  /ingredients.get?id=...`
  - `GET  /ingredients.list` (filter `isArchived=false`)
- Recipes:
  - `POST /recipes.create` → `RecipeCreate` sans id/slug/audit; generate unique slug; embed `(name + description)`; **generate hero image** via Gemini and save to Storage; set `imageUrl`; audit; `isArchived=false`.
  - `POST /recipes.update` → re-embed if `name/description` changed; regenerate image only if `imageUrl` missing.
  - `POST /recipes.delete` → soft-delete.
  - `GET  /recipes.get?id=...`
  - `GET  /recipes.list` (filter `isArchived=false`, order by `updatedAt desc`)
  - `GET  /recipes.search?q=...` → keyword contains/prefix on name/description/tags/categories (small dataset OK).
  - `POST /recipes.semanticSearch` → `{ query, topK? }`; embed query; **KNN vector search** on `recipes.embedding` (cosine); default `topK=8`.

# Auth & Provenance
- All **writes require** header `x-group-id` (string); Functions set `createdByGroupId/updatedByGroupId` and ISO timestamps.
- Functions are **not** public: mark as “Require authentication” and grant **Cloud Run Invoker** to the `mcp-invoker` service account only.
- Viewer reads Firestore directly under public-read rules; MCP servers call these endpoints with ID tokens minted from `mcp-invoker`.

# Implementation Notes
- Use `@google/genai`:
  - Embeddings: `gemini-embedding-001`, `taskType: 'SEMANTIC_SIMILARITY'`.
  - Images: `gemini-2.5-flash-image-preview`; save PNG to `recipes/<recipeId>.png` in Storage; store `imageUrl` (signed URL or download URL).
- KNN: expect Firestore vector index on `recipes.embedding` (cosine). Wrap this as a helper so we can swap impl if needed.
- Validation via `zod`.
- `slugifyUnique`: kebab-case, suffix `-2`, `-3`, … on collision.

# File Layout
- `src/index.ts` (export all HTTPS handlers)
- `src/types.ts` (shared models)
- `src/lib/slug.ts`, `src/lib/ids.ts`
- `src/lib/ai.ts` (embedText, genRecipeImage)
- `src/lib/firestore.ts` (DML helpers)
- `src/lib/validators.ts`

# Scripts
- `build`, `serve`, `deploy`

# Acceptance
- Writes only via these functions; audit & slug & embedding rules enforced.
- Image generated on create; re-embedding on relevant updates.
- Endpoints reject requests without `x-group-id`.
- Functions require IAM auth; anonymous calls are 403.
- Refer to https://ai.google.dev/gemini-api/docs/embeddings on how to use embeddings. Only use gemini-embedding-001.