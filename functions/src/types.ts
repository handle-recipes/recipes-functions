// types.ts
// Shared models for recipes + ingredients across viewer / functions / MCP
// servers.

// ----------------------
// Common / utility types
// ----------------------

// Injected into MCP servers via ENV and forwarded in requests
export type GroupId = string;

export const UNIT = [
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
export type Unit = (typeof UNIT)[number];

export const SUGGESTION_CATEGORY = [
  "feature",
  "bug",
  "improvement",
  "other"
] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORY)[number];

export const SUGGESTION_PRIORITY = [
  "low",
  "medium",
  "high"
] as const;
export type SuggestionPriority = (typeof SUGGESTION_PRIORITY)[number];

export const SUGGESTION_STATUS = [
  "submitted",
  "under-review",
  "accepted",
  "rejected",
  "implemented"
] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUS)[number];

// ----------------------
// Ingredient
// ----------------------

/** Unit conversion for ingredient */
export interface UnitConversion {
  /** Source unit */
  from: Unit;
  /** Target unit */
  to: Unit;
  /** Conversion factor (from * factor = to) */
  factor: number;
}

/** Core nutritional values per 100g/100ml */
export interface NutritionalInfo {
  /** Calories in kcal */
  calories?: number;
  /** Protein in grams */
  protein?: number;
  /** Carbohydrates in grams */
  carbohydrates?: number;
  /** Fat in grams */
  fat?: number;
  /** Fiber in grams */
  fiber?: number;
}

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

  /** Optional: Core nutritional values per 100g/100ml */
  nutrition?: NutritionalInfo;

  /** Optional: Additional nutritional metadata (e.g., "saturatedFat": "2.5", "sodium": "150") */
  metadata?: Record<string, string>;

  /** Optional: Supported unit types for this ingredient */
  supportedUnits?: Unit[];

  /** Optional: Unit conversion rates */
  unitConversions?: UnitConversion[];

  /** Optional: ID of the original ingredient if this is a variant/duplicate */
  variantOf?: string;

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

  /** Optional: ID of the original recipe if this is a variant/duplicate */
  variantOf?: string;

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
  category: SuggestionCategory;

  /** Priority level */
  priority: SuggestionPriority;

  /** Optional: related recipe ID */
  relatedRecipeId?: string;

  /** Current status */
  status: SuggestionStatus;

  /** Vote count */
  votes: number;

  /** Groups that have voted */
  votedByGroups: string[];

  /** Optional: ID of the original suggestion if this is a variant/duplicate */
  variantOf?: string;

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
  (UNIT as readonly string[]).includes(u);

export const isSuggestionCategory = (c: string): c is SuggestionCategory =>
  (SUGGESTION_CATEGORY as readonly string[]).includes(c);

export const isSuggestionPriority = (p: string): p is SuggestionPriority =>
  (SUGGESTION_PRIORITY as readonly string[]).includes(p);

export const isSuggestionStatus = (s: string): s is SuggestionStatus =>
  (SUGGESTION_STATUS as readonly string[]).includes(s);
