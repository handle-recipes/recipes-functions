# Recipe Functions API Documentation

This documentation describes the Cloud Functions v2 API endpoints for managing recipes and ingredients. These functions serve as the only write path to the Firestore database and require IAM authentication.

## Important Notes

- **Authentication**: All endpoints require IAM authentication with Cloud Run Invoker role
- **Group ID**: All requests must include the `x-group-id` header for multi-tenant support
- **Base URL**: `https://europe-west3-bekk-flyt-recipes.cloudfunctions.net`
- **Type References**: Import types from `types.ts` and use `apiTypes.ts` for request/response types

## Authentication Requirements

All endpoints require:
1. **IAM Authentication**: Valid ID token from `mcp-invoker` service account
2. **Group ID Header**: `x-group-id` header containing the group identifier
3. **Private Invoker**: Functions are marked as "Require authentication"

## Ingredients API

### Create Ingredient
**Endpoint**: `POST /ingredientsCreate`

Creates a new ingredient with automatic embedding generation and unique ID based on normalized name.

**Request Body**:
```typescript
{
  name: string;           // Required: Primary name (e.g., "egg")
  aliases?: string[];     // Optional: Alternate names/spellings
  categories?: string[];  // Optional: Categories (e.g., "dairy", "protein")
  allergens?: string[];   // Optional: Allergen tags (e.g., "nuts", "gluten")
}
```

**Response**: Created ingredient object with generated `id`, `embedding`, and audit fields.

**Features**:
- Generates unique ID from normalized name
- Creates embedding for semantic search
- Sets audit fields automatically

### Update Ingredient
**Endpoint**: `PUT /ingredientsUpdate/{id}`

Updates an existing ingredient by ID. Re-generates embedding if name changes.

**Request Body**: Same as create, but all fields optional
**Response**: Updated ingredient object
**Access Control**: Only creator group can update

### Delete Ingredient
**Endpoint**: `DELETE /ingredientsDelete/{id}`

Soft-deletes an ingredient (sets `isArchived: true`).

**Response**: Success message
**Access Control**: Only creator group can delete

### Get Ingredient
**Endpoint**: `GET /ingredientsGet/{id}`

Retrieves a single ingredient by ID.

**Response**: Ingredient object or 404 if not found/archived
**Access Control**: Only visible to creator group

### List Ingredients
**Endpoint**: `GET /ingredientsList`

Lists all non-archived ingredients for the group.

**Query Parameters**:
- `limit` (default: 50): Number of results
- `offset` (default: 0): Pagination offset

**Response**:
```typescript
{
  ingredients: Ingredient[];
  hasMore: boolean;
}
```

## Recipes API

### Create Recipe
**Endpoint**: `POST /recipesCreate`

Creates a new recipe with automatic slug generation, embedding, and optional hero image generation.

**Request Body**:
```typescript
{
  name: string;                    // Required: Recipe name
  description: string;             // Required: Recipe description
  servings: number;                // Required: Number of servings (min: 1)
  ingredients: RecipeIngredient[]; // Required: Structured ingredients
  steps: RecipeStep[];             // Required: Ordered cooking steps
  tags?: string[];                 // Optional: Free-text tags
  categories?: string[];           // Optional: Categories
  sourceUrl?: string;              // Optional: Source URL
  generateImage?: boolean;         // Optional: Generate hero image (default: false)
}
```

**RecipeIngredient Structure**:
```typescript
{
  ingredientId: string;    // ID of ingredient from ingredients collection
  quantity?: number;       // Amount (undefined for free_text unit)
  unit: "g" | "kg" | "ml" | "l" | "piece" | "free_text";
  quantityText?: string;   // Used when unit is "free_text"
  note?: string;           // Additional notes (e.g., "finely chopped")
}
```

**RecipeStep Structure**:
```typescript
{
  text: string;           // Instruction text
  imageUrl?: string;      // Optional step image
  equipment?: string[];   // Optional equipment needed
}
```

**Response**: Created recipe with generated `id`, `slug`, `embedding`, and optional `imageUrl`.

**Features**:
- Generates unique kebab-case slug
- Creates embedding from name + description
- Optional AI-generated hero image
- Sets audit fields automatically

### Update Recipe
**Endpoint**: `PUT /recipesUpdate/{id}`

Updates an existing recipe. Re-generates embedding if name/description changes.

**Request Body**: Same as create, but all fields optional
**Response**: Updated recipe object
**Access Control**: Only creator group can update

**Special Behavior**:
- Re-embeds if `name` or `description` changes
- Generates new image only if `generateImage: true` and `name` provided

### Delete Recipe
**Endpoint**: `DELETE /recipesDelete/{id}`

Soft-deletes a recipe (sets `isArchived: true`).

**Response**: Success message
**Access Control**: Only creator group can delete

### Get Recipe
**Endpoint**: `GET /recipesGet/{id}`

Retrieves a single recipe by ID.

**Response**: Recipe object or 404 if not found/archived
**Access Control**: Only visible to creator group

### List Recipes
**Endpoint**: `GET /recipesList`

Lists all non-archived recipes for the group, ordered by `updatedAt` descending.

**Query Parameters**:
- `limit` (default: 20): Number of results
- `offset` (default: 0): Pagination offset

**Response**:
```typescript
{
  recipes: Recipe[];
  hasMore: boolean;
}
```

## Search API

### Keyword Search
**Endpoint**: `POST /recipesSearch`

Performs keyword-based search on recipes with optional filtering.

**Request Body**:
```typescript
{
  query: string;           // Required: Search terms
  ingredients?: string[];  // Optional: Filter by ingredient IDs
  tags?: string[];         // Optional: Filter by tags
  categories?: string[];   // Optional: Filter by categories
  limit?: number;          // Optional: Max results (1-50, default: 20)
}
```

**Response**:
```typescript
{
  recipes: Recipe[];
  totalFound: number;
  query: string;
}
```

**Search Behavior**:
- Searches in recipe name and description
- Supports multiple search terms (OR logic)
- Additional filtering by ingredients, tags, categories
- Results sorted by relevance score

### Semantic Search
**Endpoint**: `POST /recipesSemanticSearch`

Performs vector-based semantic search using AI embeddings.

**Request Body**:
```typescript
{
  query: string;      // Required: Natural language search query
  topK?: number;      // Optional: Max results (1-50, default: 8)
}
```

**Response**:
```typescript
{
  recipes: Recipe[];
  query: string;
  topK: number;
}
```

**Features**:
- Uses `gemini-embedding-001` for query embedding
- Cosine similarity search against recipe embeddings
- Requires Firestore vector index on `recipes.embedding`

## Error Handling

All endpoints return consistent error responses:

```typescript
{
  error: string;  // Error message
}
```

**Common HTTP Status Codes**:
- `201`: Created (for create operations)
- `200`: Success
- `400`: Bad Request (validation errors)
- `403`: Access Denied (wrong group)
- `404`: Not Found
- `405`: Method Not Allowed

## Data Types

Import the following types from `types.ts`:
- `Ingredient`, `IngredientCreate`
- `Recipe`, `RecipeCreate`, `RecipeIngredient`, `RecipeStep`
- `Unit`, `UNITS`
- `FirestoreTimestamp`, `GroupId`

Import request/response types from `apiTypes.ts` for type safety when calling these endpoints.

## Embedding and AI Features

- **Embeddings**: Generated using `gemini-embedding-001` with `taskType: 'SEMANTIC_SIMILARITY'`
- **Images**: Generated using `gemini-2.5-flash-image-preview` (currently placeholder)
- **Storage**: Hero images saved to Firebase Storage as `recipes/{recipeId}.png`

## Implementation Notes

- All write operations enforce audit trails and soft deletion
- Slugs are kebab-case with numeric suffixes for uniqueness
- Vector search requires proper Firestore index configuration
- Functions have appropriate memory and timeout settings for AI operations