// types.ts
// Shared models for recipes + ingredients across viewer / functions / MCP
// servers.

// ----------------------
// Common / utility types
// ----------------------

// Injected into MCP servers via ENV and forwarded in requests
export type GroupId = string;

export const UNITS = [
  // Metric weight
  "g", "kg",
  // Metric volume
  "ml", "l",
  // Imperial/US weight
  "oz", "lb",
  // Imperial/US volume
  "tsp", "tbsp", "fl oz", "cup", "pint", "quart", "gallon",
  // Count
  "piece",
  // Free form
  "free_text"
] as const;
/**
 * Units:
 * - Metric: g, kg, ml, l
 * - Imperial/US: oz, lb, tsp, tbsp, fl oz, cup, pint, quart, gallon
 * - Count: piece
 * - "free_text" = quantity is expressed in text (quantityText) and unit
 *   is visually omitted.
 */
export type Unit = (typeof UNITS)[number];

// ----------------------
// Ingredient
// ----------------------
export interface Ingredient {
  /** Document ID (string based on normalized name; not autoId) */
  id: string;

  /** Primary name, e.g., "egg" */
  name: string;

  /** Alternate names, spellings, languages */
  aliases: string[];

  /** Free-text categories (e.g., "dairy", "protein", "herb") */
  categories: string[];

  /** Allergen tags (e.g., "nuts", "gluten", "milk") */
  allergens: string[];


  /** Provenance / audit */
  createdAt: string;
  updatedAt: string;
  createdByGroupId: GroupId;
  updatedByGroupId: GroupId;

  /** Soft delete */
  isArchived: boolean;
}

// ----------------------
// Recipe ↔ Ingredient link
// ----------------------
export interface RecipeIngredient {
  /** String ID of the ingredient document (not a DocumentReference) */
  ingredientId: string;

  /**
   * For standard units, set quantity (e.g., 200 g, 500 ml, 2 piece).
   * If unit === "free_text", leave quantity undefined and use quantityText.
   */
  quantity?: number;

  /** Unit enum; "free_text" hides unit and uses quantityText instead */
  unit: Unit;

  // eslint-disable-next-line max-len
  /** Only used when unit === "free_text", e.g., "a pinch", "to taste", "1 large" */
  quantityText?: string;

  /** Free-form note, e.g., "finely chopped" */
  note?: string;
}

// ----------------------
// Recipe steps
// ----------------------
export interface RecipeStep {
  /** Instruction text */
  text: string;

  /** Optional fixed-size image (viewer enforces display size) */
  imageUrl?: string;

  /** Optional equipment suggested/required for this step */
  equipment?: string[];
}

// ----------------------
// Recipe
// ----------------------
export interface Recipe {
  /** Document ID (autoId) */
  id: string;

  /** Kebab-case slug, unique (e.g., "chocolate-cake" or "chocolate-cake-2") */
  slug: string;

  name: string;

  /** Recipe description */
  description: string;

  /** Number of servings (viewer can scale UI; no auto conversions) */
  servings: number;

  /** Structured ingredients */
  ingredients: RecipeIngredient[];

  /** Ordered steps (implicit order by array index) */
  steps: RecipeStep[];

  /** Free-text tags, e.g., ["vegan", "spicy"] */
  tags: string[];

  /** Free-text categories, e.g., ["dessert", "norwegian"] */
  categories: string[];


  /** Optional source attribution URL */
  sourceUrl?: string;


  /** Provenance / audit */
  createdAt: string;
  updatedAt: string;
  createdByGroupId: GroupId;
  updatedByGroupId: GroupId;

  /** Soft delete */
  isArchived: boolean;
}

// ----------------------
// Helpers (optional, lightweight)
// ----------------------
export type RecipeCreate = Omit<
  Recipe,
  | "id"
  | "slug"
  | "createdAt"
  | "updatedAt"
  | "createdByGroupId"
  | "updatedByGroupId"
  | "isArchived"
> & {
  // allow omitting some fields at creation time
  tags?: string[];
  categories?: string[];
};

export type IngredientCreate = Omit<
  Ingredient,
  | "createdAt"
  | "updatedAt"
  | "createdByGroupId"
  | "updatedByGroupId"
  | "isArchived"
>;

// ----------------------
// Suggestion
// ----------------------
export interface Suggestion {
  /** Document ID (autoId) */
  id: string;

  /** Brief title */
  title: string;

  /** Detailed description */
  description: string;

  /** Category of suggestion */
  category: "feature" | "bug" | "improvement" | "other";

  /** Priority level */
  priority: "low" | "medium" | "high";

  /** Optional: related recipe ID */
  relatedRecipeId?: string;

  /** Current status */
  status: "submitted" | "under-review" | "accepted" | "rejected" | "implemented";

  /** Vote count */
  votes: number;

  /** Groups that have voted */
  votedByGroups: string[];

  /** Provenance / audit */
  submittedAt: string;
  updatedAt: string;
  submittedByGroupId: GroupId;

  /** Soft delete */
  isArchived: boolean;
}

// ----------------------
// Helpers (optional, lightweight)
// ----------------------
// Minimal guards you can use in Functions if desired
export const isUnit = (u: string): u is Unit =>
  (UNITS as readonly string[]).includes(u);
