// api.ts
// Type definitions for Recipe Functions API requests and responses
// Import this file alongside apiTypes.ts for complete type coverage

import {
  Ingredient,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  Suggestion,
  GroupId,
  NutritionalInfo,
  UnitConversion,
  Unit,
  SuggestionCategory,
  SuggestionPriority,
  SuggestionStatus,
} from "./types";

// ----------------------
// Common API Types
// ----------------------

export interface ApiError {
  error: string;
}

export interface PaginatedResponse<T> {
  hasMore: boolean;
  data: T[];
}

// ----------------------
// Ingredient API Types
// ----------------------

export interface CreateIngredientRequest {
  name: string;
  aliases?: string[];
  categories?: string[];
  allergens?: string[];
  nutrition?: NutritionalInfo;
  metadata?: Record<string, string>;
  supportedUnits?: Unit[];
  unitConversions?: UnitConversion[];
}

export interface CreateIngredientResponse extends Ingredient {
  id: string;
}

export interface UpdateIngredientRequest {
  id: string;
  name?: string;
  aliases?: string[];
  categories?: string[];
  allergens?: string[];
  nutrition?: NutritionalInfo;
  metadata?: Record<string, string>;
  supportedUnits?: Unit[];
  unitConversions?: UnitConversion[];
}

export interface UpdateIngredientResponse extends Ingredient {
  id: string;
}

export interface GetIngredientRequest {
  id: string;
}

export interface GetIngredientResponse extends Ingredient {
  id: string;
}

export interface ListIngredientsRequest {
  limit?: number;
  offset?: number;
}

export interface ListIngredientsResponse {
  ingredients: (Ingredient & { id: string })[];
  hasMore: boolean;
}

export interface DeleteIngredientRequest {
  id: string;
}

export interface DeleteIngredientResponse {
  message: string;
}

export interface DuplicateIngredientRequest {
  id: string;
  name?: string;
  aliases?: string[];
  categories?: string[];
  allergens?: string[];
  nutrition?: NutritionalInfo;
  metadata?: Record<string, string>;
  supportedUnits?: Unit[];
  unitConversions?: UnitConversion[];
}

export interface DuplicateIngredientResponse extends Ingredient {
  id: string;
}

// ----------------------
// Recipe API Types
// ----------------------

export interface CreateRecipeRequest {
  name: string;
  description: string;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags?: string[];
  categories?: string[];
  sourceUrl?: string;
}

export interface CreateRecipeResponse extends Recipe {
  id: string;
}

export interface UpdateRecipeRequest {
  id: string;
  name?: string;
  description?: string;
  servings?: number;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  tags?: string[];
  categories?: string[];
  sourceUrl?: string;
}

export interface UpdateRecipeResponse extends Recipe {
  id: string;
}

export interface GetRecipeRequest {
  id: string;
}

export interface GetRecipeResponse extends Recipe {
  id: string;
}

export interface ListRecipesRequest {
  limit?: number;
  offset?: number;
}

export interface ListRecipesResponse {
  recipes: (Recipe & { id: string })[];
  hasMore: boolean;
}

export interface DeleteRecipeRequest {
  id: string;
}

export interface DeleteRecipeResponse {
  message: string;
}

export interface DuplicateRecipeRequest {
  id: string;
  name?: string;
  description?: string;
  servings?: number;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  tags?: string[];
  categories?: string[];
  sourceUrl?: string;
}

export interface DuplicateRecipeResponse extends Recipe {
  id: string;
}

// ----------------------
// Search API Types
// ----------------------

export interface SearchRecipesRequest {
  query: string;
  ingredients?: string[];
  tags?: string[];
  categories?: string[];
  limit?: number;
}

export interface SearchRecipesResponse {
  recipes: (Recipe & { id: string })[];
  totalFound: number;
  query: string;
}

// ----------------------
// Suggestion API Types
// ----------------------

export interface CreateSuggestionRequest {
  title: string;
  description: string;
  category?: SuggestionCategory;
  priority?: SuggestionPriority;
  relatedRecipeId?: string;
}

export interface CreateSuggestionResponse extends Suggestion {
  id: string;
}

export interface ListSuggestionsRequest {
  limit?: number;
  offset?: number;
  status?: SuggestionStatus;
}

export interface ListSuggestionsResponse {
  suggestions: (Suggestion & { id: string })[];
  hasMore: boolean;
}

export interface VoteSuggestionRequest {
  id: string;
}

export interface VoteSuggestionResponse extends Suggestion {
  id: string;
  voted: boolean; // true if vote was added, false if removed
}

export interface UpdateSuggestionRequest {
  id: string;
  title?: string;
  description?: string;
  category?: SuggestionCategory;
  priority?: SuggestionPriority;
  relatedRecipeId?: string;
  status?: SuggestionStatus;
}

export interface DeleteSuggestionRequest {
  id: string;
}

export interface DeleteSuggestionResponse {
  message: string;
}

export interface UpdateSuggestionResponse extends Suggestion {
  id: string;
}

export interface DuplicateSuggestionRequest {
  id: string;
  title?: string;
  description?: string;
  category?: SuggestionCategory;
  priority?: SuggestionPriority;
  relatedRecipeId?: string;
}

export interface DuplicateSuggestionResponse extends Suggestion {
  id: string;
}

// ----------------------
// API Client Types
// ----------------------

export interface ApiHeaders {
  "x-group-id": GroupId;
  Authorization?: string;
  "Content-Type"?: string;
}

export interface ApiConfig {
  baseUrl: string;
  headers: ApiHeaders;
}

// ----------------------
// Endpoint Definitions
// ----------------------

export interface ApiEndpoints {
  // Ingredients
  ingredientsCreate: {
    method: "POST";
    path: "/ingredientsCreate";
    request: CreateIngredientRequest;
    response: CreateIngredientResponse;
  };
  ingredientsUpdate: {
    method: "POST";
    path: "/ingredientsUpdate";
    request: UpdateIngredientRequest;
    response: UpdateIngredientResponse;
  };
  ingredientsDelete: {
    method: "POST";
    path: "/ingredientsDelete";
    request: DeleteIngredientRequest;
    response: DeleteIngredientResponse;
  };
  ingredientsGet: {
    method: "POST";
    path: "/ingredientsGet";
    request: GetIngredientRequest;
    response: GetIngredientResponse;
  };
  ingredientsList: {
    method: "POST";
    path: "/ingredientsList";
    request?: ListIngredientsRequest;
    response: ListIngredientsResponse;
  };
  ingredientsDuplicate: {
    method: "POST";
    path: "/ingredientsDuplicate";
    request: DuplicateIngredientRequest;
    response: DuplicateIngredientResponse;
  };

  // Recipes
  recipesCreate: {
    method: "POST";
    path: "/recipesCreate";
    request: CreateRecipeRequest;
    response: CreateRecipeResponse;
  };
  recipesUpdate: {
    method: "POST";
    path: "/recipesUpdate";
    request: UpdateRecipeRequest;
    response: UpdateRecipeResponse;
  };
  recipesDelete: {
    method: "POST";
    path: "/recipesDelete";
    request: DeleteRecipeRequest;
    response: DeleteRecipeResponse;
  };
  recipesGet: {
    method: "POST";
    path: "/recipesGet";
    request: GetRecipeRequest;
    response: GetRecipeResponse;
  };
  recipesList: {
    method: "POST";
    path: "/recipesList";
    request?: ListRecipesRequest;
    response: ListRecipesResponse;
  };
  recipesDuplicate: {
    method: "POST";
    path: "/recipesDuplicate";
    request: DuplicateRecipeRequest;
    response: DuplicateRecipeResponse;
  };

  // Search
  recipesSearch: {
    method: "POST";
    path: "/recipesSearch";
    request: SearchRecipesRequest;
    response: SearchRecipesResponse;
  };

  // Suggestions
  suggestionsCreate: {
    method: "POST";
    path: "/suggestionsCreate";
    request: CreateSuggestionRequest;
    response: CreateSuggestionResponse;
  };
  suggestionsList: {
    method: "POST";
    path: "/suggestionsList";
    request?: ListSuggestionsRequest;
    response: ListSuggestionsResponse;
  };
  suggestionsVote: {
    method: "POST";
    path: "/suggestionsVote";
    request: VoteSuggestionRequest;
    response: VoteSuggestionResponse;
  };
  suggestionsUpdate: {
    method: "POST";
    path: "/suggestionsUpdate";
    request: UpdateSuggestionRequest;
    response: UpdateSuggestionResponse;
  };
  suggestionsDelete: {
    method: "POST";
    path: "/suggestionsDelete";
    request: DeleteSuggestionRequest;
    response: DeleteSuggestionResponse;
  };
  suggestionsDuplicate: {
    method: "POST";
    path: "/suggestionsDuplicate";
    request: DuplicateSuggestionRequest;
    response: DuplicateSuggestionResponse;
  };
}

// ----------------------
// Utility Types
// ----------------------

export type EndpointName = keyof ApiEndpoints;

export type EndpointMethod<T extends EndpointName> = ApiEndpoints[T]["method"];

export type EndpointPath<T extends EndpointName> = ApiEndpoints[T]["path"];

export type EndpointRequest<T extends EndpointName> =
  "request" extends keyof ApiEndpoints[T] ? ApiEndpoints[T]["request"] : never;

export type EndpointResponse<T extends EndpointName> =
  ApiEndpoints[T]["response"];

export type EndpointParams<T extends EndpointName> =
  "params" extends keyof ApiEndpoints[T] ? ApiEndpoints[T]["params"] : never;

export type EndpointQuery<T extends EndpointName> =
  "query" extends keyof ApiEndpoints[T] ? ApiEndpoints[T]["query"] : never;

// ----------------------
// Type Guards
// ----------------------

export function isApiError(obj: unknown): obj is ApiError {
  return typeof obj === "object" && obj !== null && "error" in obj;
}

export function hasRequestBody<T extends EndpointName>(
  endpoint: T
): endpoint is T & { request: EndpointRequest<T> } {
  // All endpoints now use POST with request bodies
  return true;
}

export function hasUrlParams<T extends EndpointName>(
  endpoint: T
): endpoint is T & { params: EndpointParams<T> } {
  // No endpoints use URL params anymore - all data is in request body
  return false;
}

// ----------------------
// Example Usage Types
// ----------------------

/**
 * Example of how to use these types in a client implementation:
 *
 * ```typescript
 * import { ApiEndpoints, EndpointRequest, EndpointResponse } from './api';
 *
 * async function callApi<T extends keyof ApiEndpoints>(
 *   endpoint: T,
 *   request: EndpointRequest<T>
 * ): Promise<EndpointResponse<T>> {
 *   const response = await fetch(`${baseUrl}/${endpoint}`, {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       'Authorization': `Bearer ${idToken}`,
 *       'x-group-id': groupId
 *     },
 *     body: JSON.stringify(request)
 *   });
 *   return response.json();
 * }
 *
 * // Usage:
 * const ingredient = await callApi('ingredientsCreate', {
 *   name: 'Tomato',
 *   categories: ['vegetable'],
 *   allergens: []
 * });
 *
 * const recipe = await callApi('recipesGet', {
 *   id: 'recipe-123'
 * });
 *
 * const updatedIngredient = await callApi('ingredientsUpdate', {
 *   id: 'ingredient-456',
 *   name: 'Roma Tomato'
 * });
 * ```
 */
