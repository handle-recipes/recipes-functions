# Recipe Functions API Documentation

This documentation describes the Cloud Functions v2 API endpoints for managing recipes and ingredients. These functions serve as the only write path to the Firestore database and require IAM authentication.

## Important Notes

- **Authentication**: All endpoints require IAM authentication with Cloud Run Invoker role
- **Group ID**: All requests must include the `x-group-id` header for multi-tenant support
- **Base URL**: `https://europe-west3-bekk-recipes-mcp.cloudfunctions.net`
- **Type References**: Import types from `types.ts` and use `apiTypes.ts` for request/response types
- **Ownership**: Groups can only edit/delete items they created. Other groups' items are read-only. Use duplicate endpoints to create editable copies.
- **canBeEditedByYou**: All list and get endpoints return this boolean field indicating if the requesting group can modify the item.

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

**Supported Units**: The `supportedUnits` field accepts the following values:
- Metric weight: `g`, `kg`
- Metric volume: `ml`, `l`
- Imperial/US weight: `oz`, `lb`
- Imperial/US volume: `tsp`, `tbsp`, `fl oz`, `cup`, `pint`, `quart`, `gallon`
- Count: `piece`
- Free text: `free_text`

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

**Access Control**: Only the group that created the ingredient can update it. Attempts to update another group's ingredient will fail with an error message suggesting to use the duplicate endpoint.

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

**Access Control**: Only the group that created the ingredient can delete it. Attempts to delete another group's ingredient will fail with an error message suggesting to use the duplicate endpoint.

### Get Ingredient
**Endpoint**: `POST /ingredientsGet`

Retrieves a single ingredient by ID.

**Request Body**:
```typescript
{
  id: string;  // Required: Ingredient ID
}
```
**Response**: Ingredient object with `canBeEditedByYou` boolean field, or 404 if not found/archived

**Access Control**: All groups can view all ingredients. The `canBeEditedByYou` field indicates if the requesting group can modify the item.

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
  ingredients: (Ingredient & { canBeEditedByYou: boolean })[];
  hasMore: boolean;
}
```

**Note**: All ingredients include the `canBeEditedByYou` field indicating if the requesting group can modify them.

### Duplicate Ingredient
**Endpoint**: `POST /ingredientsDuplicate`

Creates a duplicate of an existing ingredient owned by the requesting group. This allows groups to create editable copies of ingredients created by other groups.

**Request Body**:
```typescript
{
  id: string;             // Required: Original ingredient ID
  name?: string;          // Optional: Override name
  aliases?: string[];     // Optional: Override alternate names
  categories?: string[];  // Optional: Override categories
  allergens?: string[];   // Optional: Override allergen tags
  nutrition?: NutritionalInfo;  // Optional: Override nutrition info
  metadata?: Record<string, string>;  // Optional: Override metadata
  supportedUnits?: Unit[];  // Optional: Override supported units
  unitConversions?: UnitConversion[];  // Optional: Override conversions
}
```

**Response**: New ingredient object with:
- New unique ID
- Requesting group as owner
- `variantOf` field pointing to original ingredient ID
- All fields from original ingredient (unless overridden in request)

**Note**: This is the recommended way to "edit" another group's ingredient. The duplicate will be owned by your group and fully editable.

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
  unit: Unit;              // One of: g, kg, ml, l, oz, lb, tsp, tbsp, fl oz, cup, pint, quart, gallon, piece, free_text
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

**Access Control**: Only the group that created the recipe can update it. Attempts to update another group's recipe will fail with an error message suggesting to use the duplicate endpoint.


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

**Access Control**: Only the group that created the recipe can delete it. Attempts to delete another group's recipe will fail with an error message suggesting to use the duplicate endpoint.

### Get Recipe
**Endpoint**: `POST /recipesGet`

Retrieves a single recipe by ID.

**Request Body**:
```typescript
{
  id: string;  // Required: Recipe ID
}
```
**Response**: Recipe object with `canBeEditedByYou` boolean field, or 404 if not found/archived

**Access Control**: All groups can view all recipes. The `canBeEditedByYou` field indicates if the requesting group can modify the item.

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
  recipes: (Recipe & { canBeEditedByYou: boolean })[];
  hasMore: boolean;
}
```

**Note**: All recipes include the `canBeEditedByYou` field indicating if the requesting group can modify them.

### Duplicate Recipe
**Endpoint**: `POST /recipesDuplicate`

Creates a duplicate of an existing recipe owned by the requesting group. This allows groups to create editable copies of recipes created by other groups.

**Request Body**:
```typescript
{
  id: string;                      // Required: Original recipe ID
  name?: string;                   // Optional: Override recipe name
  description?: string;            // Optional: Override description
  servings?: number;               // Optional: Override servings
  ingredients?: RecipeIngredient[]; // Optional: Override ingredients
  steps?: RecipeStep[];            // Optional: Override steps
  tags?: string[];                 // Optional: Override tags
  categories?: string[];           // Optional: Override categories
  sourceUrl?: string;              // Optional: Override source URL
}
```

**Response**: New recipe object with:
- New unique ID and slug
- Requesting group as owner
- `variantOf` field pointing to original recipe ID
- All fields from original recipe (unless overridden in request)

**Note**: This is the recommended way to "edit" another group's recipe. The duplicate will be owned by your group and fully editable.

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

## Suggestions API

### Create Suggestion
**Endpoint**: `POST /suggestionsCreate`

Creates a new suggestion for features, bugs, or improvements.

**Request Body**:
```typescript
{
  title: string;                   // Required: Brief title (max 200 chars)
  description: string;             // Required: Detailed description
  category?: "feature" | "bug" | "improvement" | "other";  // Optional: Default "feature"
  priority?: "low" | "medium" | "high";  // Optional: Default "medium"
  relatedRecipeId?: string;        // Optional: Related recipe ID
}
```

**Response**: Created suggestion with `id`, `status: "submitted"`, `votes: 0`, and audit fields.

### List Suggestions
**Endpoint**: `POST /suggestionsList`

Lists all non-archived suggestions, ordered by votes (desc) then submission date (desc).

**Request Body**:
```typescript
{
  limit?: number;   // Optional: Number of results (default: 50)
  offset?: number;  // Optional: Pagination offset (default: 0)
  status?: "submitted" | "under-review" | "accepted" | "rejected" | "implemented";  // Optional: Filter by status
}
```

**Response**:
```typescript
{
  suggestions: (Suggestion & { canBeEditedByYou: boolean })[];
  hasMore: boolean;
}
```

**Note**: All suggestions include the `canBeEditedByYou` field indicating if the requesting group can modify them.

### Vote on Suggestion
**Endpoint**: `POST /suggestionsVote`

Toggles a vote on a suggestion. If the group has already voted, removes the vote; otherwise adds a vote.

**Request Body**:
```typescript
{
  id: string;  // Required: Suggestion ID
}
```

**Response**: Updated suggestion with `voted: boolean` indicating if vote was added (true) or removed (false).

**Note**: Voting does not require ownership. Any group can vote on any suggestion.

### Update Suggestion
**Endpoint**: `POST /suggestionsUpdate`

Updates an existing suggestion.

**Request Body**:
```typescript
{
  id: string;                      // Required: Suggestion ID
  title?: string;                  // Optional: Brief title
  description?: string;            // Optional: Detailed description
  category?: "feature" | "bug" | "improvement" | "other";  // Optional
  priority?: "low" | "medium" | "high";  // Optional
  relatedRecipeId?: string;        // Optional
  status?: "submitted" | "under-review" | "accepted" | "rejected" | "implemented";  // Optional
}
```

**Response**: Updated suggestion object

**Access Control**: Only the group that created the suggestion can update it. Attempts to update another group's suggestion will fail with an error message suggesting to use the duplicate endpoint.

### Delete Suggestion
**Endpoint**: `POST /suggestionsDelete`

Soft-deletes a suggestion (sets `isArchived: true`).

**Request Body**:
```typescript
{
  id: string;  // Required: Suggestion ID
}
```

**Response**: Success message

**Access Control**: Only the group that created the suggestion can delete it. Attempts to delete another group's suggestion will fail with an error message suggesting to use the duplicate endpoint.

### Duplicate Suggestion
**Endpoint**: `POST /suggestionsDuplicate`

Creates a duplicate of an existing suggestion owned by the requesting group. This allows groups to create editable copies of suggestions created by other groups.

**Request Body**:
```typescript
{
  id: string;                      // Required: Original suggestion ID
  title?: string;                  // Optional: Override title
  description?: string;            // Optional: Override description
  category?: "feature" | "bug" | "improvement" | "other";  // Optional: Override category
  priority?: "low" | "medium" | "high";  // Optional: Override priority
  relatedRecipeId?: string;        // Optional: Override related recipe
}
```

**Response**: New suggestion object with:
- New unique ID
- Requesting group as owner
- `variantOf` field pointing to original suggestion ID
- `status: "submitted"`, `votes: 0`, `votedByGroups: []`
- All other fields from original suggestion (unless overridden in request)

**Note**: This is the recommended way to "edit" another group's suggestion. The duplicate will be owned by your group and fully editable.


## Error Handling

All endpoints return consistent error responses:

```typescript
{
  error: string;  // Error message
}
```

**Common HTTP Status Codes**:
- `201`: Created (for create and duplicate operations)
- `200`: Success
- `400`: Bad Request (validation errors, ownership violations)
- `403`: Access Denied (authentication failure)
- `404`: Not Found
- `405`: Method Not Allowed

**Error Message Format**:
All error messages are clear and actionable, explicitly explaining:
- What went wrong
- Why it failed (e.g., "owned by group 'X'")
- What to do instead (e.g., "use the ingredientsDuplicate endpoint")

## Data Types

Import the following types from `types.ts`:
- `Ingredient`, `IngredientCreate`
- `Recipe`, `RecipeCreate`, `RecipeIngredient`, `RecipeStep`
- `Suggestion`, `SuggestionCategory`, `SuggestionPriority`, `SuggestionStatus`
- `Unit`, `UNIT` (the constant array)
- `GroupId`, `NutritionalInfo`, `UnitConversion`
- Enums: `UNIT`, `SUGGESTION_CATEGORY`, `SUGGESTION_PRIORITY`, `SUGGESTION_STATUS`

Import request/response types from `apiTypes.ts` for type safety when calling these endpoints.

**New Fields**:
- `variantOf?: string` - Added to Ingredient, Recipe, and Suggestion. Points to the original item's ID if this is a duplicate.
- `canBeEditedByYou: boolean` - Returned by all get/list endpoints. Indicates if the requesting group can modify the item.

## Implementation Notes

- All write operations enforce audit trails and soft deletion
- Slugs are kebab-case with numeric suffixes for uniqueness
- Functions have appropriate memory and timeout settings
- Ownership is enforced: only the creating group can update/delete items
- Duplicate endpoints allow groups to create editable copies of other groups' items
- All items are visible to all groups (read access), but only editable by the owner