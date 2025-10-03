# Project Goal
Cloud Functions v2 (Node 20 + TS) that are the ONLY write path to Firestore.
- **Require IAM authentication** (Cloud Run Invoker).
- Implement CRUD for recipes, ingredients, and suggestions with keyword search.
- **Multi-tenant support** via group ownership with read-all, write-own model.
- **Duplicate functionality** allowing groups to create editable copies of other groups' items.

# Important Note
This repo didn't run `firebase init firestore` / `storage` (that happened in seed-scripts). That's fine: use `firebase-admin` in Functions and `admin.initializeApp()` (no direct emulator config here).

# Data Model (shared)
Core types defined in `src/types.ts`. All collections support:
- Audit fields: `createdAt`, `updatedAt`, `createdByGroupId`, `updatedByGroupId`
- Soft deletion: `isArchived` boolean
- Variants: `variantOf` optional field pointing to original item ID

# Endpoints (HTTPS v2, auth required)
All endpoints use POST method with request body (no query params).

## Ingredients
- `POST /ingredientsCreate` → Creates ingredient with unique ID from normalized name
- `POST /ingredientsUpdate` → Updates ingredient (ownership required)
- `POST /ingredientsDelete` → Soft-deletes ingredient (ownership required)
- `POST /ingredientsGet` → Retrieves single ingredient with `canBeEditedByYou` field
- `POST /ingredientsList` → Lists all non-archived ingredients with `canBeEditedByYou` field
- `POST /ingredientsDuplicate` → Creates editable copy of ingredient with optional field overrides

## Recipes
- `POST /recipesCreate` → Creates recipe with auto-generated ID and unique slug
- `POST /recipesUpdate` → Updates recipe (ownership required)
- `POST /recipesDelete` → Soft-deletes recipe (ownership required)
- `POST /recipesGet` → Retrieves single recipe with `canBeEditedByYou` field
- `POST /recipesList` → Lists all non-archived recipes with `canBeEditedByYou` field
- `POST /recipesDuplicate` → Creates editable copy of recipe with optional field overrides
- `POST /recipesSearch` → Keyword search on name/description/tags/categories with optional filters

## Suggestions
- `POST /suggestionsCreate` → Creates suggestion for features/bugs/improvements
- `POST /suggestionsList` → Lists all suggestions with `canBeEditedByYou` field, ordered by votes
- `POST /suggestionsVote` → Toggles vote on suggestion (no ownership required)
- `POST /suggestionsUpdate` → Updates suggestion (ownership required)
- `POST /suggestionsDelete` → Soft-deletes suggestion (ownership required)
- `POST /suggestionsDuplicate` → Creates editable copy of suggestion with optional field overrides

# Auth & Provenance
- All **writes require** header `x-group-id` (string); Functions set `createdByGroupId/updatedByGroupId` and ISO timestamps.
- Functions are **public** (allowing unauthenticated calls) due to consistent issues with IAM authentication. Security is enforced via `x-group-id` validation.
- **Ownership model**: Groups can only update/delete items they created. All groups can read all items.
- **canBeEditedByYou**: All get/list endpoints return this boolean indicating if requesting group can modify the item.
- **Duplicate for editing**: When ownership check fails, error messages suggest using duplicate endpoints to create editable copies.

# Implementation Notes
- **Validation**: All schemas use `zod` with enums from `types.ts` (no string repetition)
- **Enums**: `UNIT`, `SUGGESTION_CATEGORY`, `SUGGESTION_PRIORITY`, `SUGGESTION_STATUS`
- **Slugs**: `slugifyUnique` creates kebab-case slugs with numeric suffixes (`-2`, `-3`, etc.) on collision
- **Error messages**: Clear, actionable messages explaining what failed and what to do instead
- **Type safety**: Shared types in `types.ts` and API types in `apiTypes.ts` for client usage

# File Layout
- `src/index.ts` - Export all HTTPS handlers
- `src/types.ts` - Shared models (export to other projects)
- `src/apiTypes.ts` - API request/response types (export to other projects)
- `src/ingredients.ts` - Ingredient CRUD + duplicate
- `src/recipes.ts` - Recipe CRUD + duplicate
- `src/suggestions.ts` - Suggestion CRUD + duplicate + voting
- `src/search.ts` - Recipe keyword search
- `src/utils.ts` - Shared utilities (slugify, validation, ownership checks)

# Scripts
- `build` - Compile TypeScript
- `serve` - Run emulator
- `deploy` - Deploy to Firebase

# Acceptance Criteria
- ✅ Writes only via these functions with audit trails enforced
- ✅ Ownership checks prevent groups from modifying others' items
- ✅ Duplicate endpoints allow creating editable copies with `variantOf` reference
- ✅ All write endpoints reject requests without `x-group-id` header
- ✅ Functions are public (no IAM auth) for reliable access
- ✅ Clear error messages guide users to correct actions
- ✅ All enums centralized in types.ts (no string repetition)
- ✅ `canBeEditedByYou` field on all get/list responses
