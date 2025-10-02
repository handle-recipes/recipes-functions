# Recipe Functions API Documentation

This documentation describes the Cloud Functions v2 API endpoints for managing recipes and ingredients. These functions serve as the only write path to the Firestore database and require IAM authentication.

## Important Notes

- **Authentication**: All endpoints require IAM authentication with Cloud Run Invoker role
- **Group ID**: All requests must include the `x-group-id` header for multi-tenant support
- **Base URL**: `https://europe-west3-bekk-recipes-mcp.cloudfunctions.net`
- **Type References**: Import types from `types.ts` and use `apiTypes.ts` for request/response types

## Authentication Requirements

All endpoints require:
1. **IAM Authentication**: Valid ID token from `mcp-invoker` service account
2. **Group ID Header**: `x-group-id` header containing the group identifier
3. **Private Invoker**: Functions are marked as "Require authentication"

## Making Requests

All endpoints use **POST** method with data sent in the request body. Here's how to structure your requests:

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <ID_TOKEN>
x-group-id: <GROUP_ID>
```

**Request Format**:
```javascript
// Using fetch
const response = await fetch('https://europe-west3-bekk-recipes-mcp.cloudfunctions.net/ingredientsCreate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
    'x-group-id': groupId
  },
  body: JSON.stringify({
    name: 'tomato',
    categories: ['vegetable'],
    allergens: []
  })
});

// Using axios
const response = await axios.post(
  'https://europe-west3-bekk-recipes-mcp.cloudfunctions.net/ingredientsCreate',
  {
    name: 'tomato',
    categories: ['vegetable'], 
    allergens: []
  },
  {
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'x-group-id': groupId
    }
  }
);
```

**Important**: All request data must be sent in the request body as JSON, not as URL parameters or query strings.

## Ingredients API

### Create Ingredient
**Endpoint**: `POST /ingredientsCreate`

Creates a new ingredient with unique ID based on normalized name.

**Request Body**:
```typescript
{
  name: string;           // Required: Primary name (e.g., "egg")
  aliases?: string[];     // Optional: Alternate names/spellings
  categories?: string[];  // Optional: Categories (e.g., "dairy", "protein")
  allergens?: string[];   // Optional: Allergen tags (e.g., "nuts", "gluten")
}
```

**Response**: Created ingredient object with generated `id` and audit fields.

**Features**:
- Generates unique ID from normalized name
- Sets audit fields automatically

### Update Ingredient
**Endpoint**: `POST /ingredientsUpdate`

Updates an existing ingredient by ID.

**Request Body**:
```typescript
{
  id: string;             // Required: Ingredient ID
  name?: string;          // Optional: Primary name
  aliases?: string[];     // Optional: Alternate names/spellings
  categories?: string[];  // Optional: Categories
  allergens?: string[];   // Optional: Allergen tags
}
```
**Response**: Updated ingredient object
**Access Control**: Only creator group can update

### Delete Ingredient
**Endpoint**: `POST /ingredientsDelete`

Soft-deletes an ingredient (sets `isArchived: true`).

**Request Body**:
```typescript
{
  id: string;  // Required: Ingredient ID
}
```
**Response**: Success message
**Access Control**: Only creator group can delete

### Get Ingredient
**Endpoint**: `POST /ingredientsGet`

Retrieves a single ingredient by ID.

**Request Body**:
```typescript
{
  id: string;  // Required: Ingredient ID
}
```
**Response**: Ingredient object or 404 if not found/archived
**Access Control**: Only visible to creator group

### List Ingredients
**Endpoint**: `POST /ingredientsList`

Lists all non-archived ingredients for the group.

**Request Body**:
```typescript
{
  limit?: number;   // Optional: Number of results (default: 50)
  offset?: number;  // Optional: Pagination offset (default: 0)
}
```

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

Creates a new recipe with automatic slug generation.

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

**Response**: Created recipe with generated `id`, `slug`, and audit fields.

**Features**:
- Generates unique kebab-case slug
- Sets audit fields automatically

### Update Recipe
**Endpoint**: `POST /recipesUpdate`

Updates an existing recipe.

**Request Body**:
```typescript
{
  id: string;                      // Required: Recipe ID
  name?: string;                   // Optional: Recipe name
  description?: string;            // Optional: Recipe description
  servings?: number;               // Optional: Number of servings
  ingredients?: RecipeIngredient[]; // Optional: Structured ingredients
  steps?: RecipeStep[];            // Optional: Ordered cooking steps
  tags?: string[];                 // Optional: Free-text tags
  categories?: string[];           // Optional: Categories
  sourceUrl?: string;              // Optional: Source URL
}
```
**Response**: Updated recipe object
**Access Control**: Only creator group can update


### Delete Recipe
**Endpoint**: `POST /recipesDelete`

Soft-deletes a recipe (sets `isArchived: true`).

**Request Body**:
```typescript
{
  id: string;  // Required: Recipe ID
}
```
**Response**: Success message
**Access Control**: Only creator group can delete

### Get Recipe
**Endpoint**: `POST /recipesGet`

Retrieves a single recipe by ID.

**Request Body**:
```typescript
{
  id: string;  // Required: Recipe ID
}
```
**Response**: Recipe object or 404 if not found/archived
**Access Control**: Only visible to creator group

### List Recipes
**Endpoint**: `POST /recipesList`

Lists all non-archived recipes for the group, ordered by `updatedAt` descending.

**Request Body**:
```typescript
{
  limit?: number;   // Optional: Number of results (default: 20)
  offset?: number;  // Optional: Pagination offset (default: 0)
}
```

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
- `Unit`, `UNITS`, `GroupId`

Import request/response types from `apiTypes.ts` for type safety when calling these endpoints.


## Implementation Notes

- All write operations enforce audit trails and soft deletion
- Slugs are kebab-case with numeric suffixes for uniqueness
- Functions have appropriate memory and timeout settings