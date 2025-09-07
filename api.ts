// api.ts
// Type definitions for Recipe Functions API requests and responses
// Import this file alongside types.ts for complete type coverage

import {
  Ingredient,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  Unit,
  GroupId,
  FirestoreTimestamp,
} from "./functions/src/types";

// ----------------------
// Common API Types
// ----------------------

export interface ApiError {
  error: string;
}

export interface PaginationParams {
  limit?: string;
  offset?: string;
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
}

export interface CreateIngredientResponse extends Ingredient {
  id: string;
}

export interface UpdateIngredientRequest {
  name?: string;
  aliases?: string[];
  categories?: string[];
  allergens?: string[];
}

export interface UpdateIngredientResponse extends Ingredient {
  id: string;
}

export interface GetIngredientResponse extends Ingredient {
  id: string;
}

export interface ListIngredientsResponse {
  ingredients: (Ingredient & { id: string })[];
  hasMore: boolean;
}

export interface DeleteIngredientResponse {
  message: string;
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
  generateImage?: boolean;
}

export interface CreateRecipeResponse extends Recipe {
  id: string;
}

export interface UpdateRecipeRequest {
  name?: string;
  description?: string;
  servings?: number;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  tags?: string[];
  categories?: string[];
  sourceUrl?: string;
  generateImage?: boolean;
}

export interface UpdateRecipeResponse extends Recipe {
  id: string;
}

export interface GetRecipeResponse extends Recipe {
  id: string;
}

export interface ListRecipesResponse {
  recipes: (Recipe & { id: string })[];
  hasMore: boolean;
}

export interface DeleteRecipeResponse {
  message: string;
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

export interface SemanticSearchRequest {
  query: string;
  topK?: number;
}

export interface SemanticSearchResponse {
  recipes: (Recipe & { id: string })[];
  query: string;
  topK: number;
}

// ----------------------
// API Client Types
// ----------------------

export interface ApiHeaders {
  "x-group-id": GroupId;
  "Authorization"?: string;
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
  "ingredients.create": {
    method: "POST";
    path: "/ingredients.create";
    request: CreateIngredientRequest;
    response: CreateIngredientResponse;
  };
  "ingredients.update": {
    method: "PUT";
    path: "/ingredients.update/{id}";
    params: { id: string };
    request: UpdateIngredientRequest;
    response: UpdateIngredientResponse;
  };
  "ingredients.delete": {
    method: "DELETE";
    path: "/ingredients.delete/{id}";
    params: { id: string };
    response: DeleteIngredientResponse;
  };
  "ingredients.get": {
    method: "GET";
    path: "/ingredients.get/{id}";
    params: { id: string };
    response: GetIngredientResponse;
  };
  "ingredients.list": {
    method: "GET";
    path: "/ingredients.list";
    query?: PaginationParams;
    response: ListIngredientsResponse;
  };

  // Recipes
  "recipes.create": {
    method: "POST";
    path: "/recipes.create";
    request: CreateRecipeRequest;
    response: CreateRecipeResponse;
  };
  "recipes.update": {
    method: "PUT";
    path: "/recipes.update/{id}";
    params: { id: string };
    request: UpdateRecipeRequest;
    response: UpdateRecipeResponse;
  };
  "recipes.delete": {
    method: "DELETE";
    path: "/recipes.delete/{id}";
    params: { id: string };
    response: DeleteRecipeResponse;
  };
  "recipes.get": {
    method: "GET";
    path: "/recipes.get/{id}";
    params: { id: string };
    response: GetRecipeResponse;
  };
  "recipes.list": {
    method: "GET";
    path: "/recipes.list";
    query?: PaginationParams;
    response: ListRecipesResponse;
  };

  // Search
  "recipes.search": {
    method: "POST";
    path: "/recipes.search";
    request: SearchRecipesRequest;
    response: SearchRecipesResponse;
  };
  "recipes.semanticSearch": {
    method: "POST";
    path: "/recipes.semanticSearch";
    request: SemanticSearchRequest;
    response: SemanticSearchResponse;
  };
}

// ----------------------
// Utility Types
// ----------------------

export type EndpointName = keyof ApiEndpoints;

export type EndpointMethod<T extends EndpointName> = ApiEndpoints[T]["method"];

export type EndpointPath<T extends EndpointName> = ApiEndpoints[T]["path"];

export type EndpointRequest<T extends EndpointName> = 
  "request" extends keyof ApiEndpoints[T] 
    ? ApiEndpoints[T]["request"]
    : never;

export type EndpointResponse<T extends EndpointName> = ApiEndpoints[T]["response"];

export type EndpointParams<T extends EndpointName> = 
  "params" extends keyof ApiEndpoints[T] 
    ? ApiEndpoints[T]["params"]
    : never;

export type EndpointQuery<T extends EndpointName> = 
  "query" extends keyof ApiEndpoints[T] 
    ? ApiEndpoints[T]["query"]
    : never;

// ----------------------
// Type Guards
// ----------------------

export function isApiError(obj: unknown): obj is ApiError {
  return typeof obj === "object" && obj !== null && "error" in obj;
}

export function hasRequestBody<T extends EndpointName>(
  endpoint: T
): endpoint is T & { request: EndpointRequest<T> } {
  const ep = endpoint as string;
  return !ep.includes("get") && !ep.includes("list") && !ep.includes("delete");
}

export function hasUrlParams<T extends EndpointName>(
  endpoint: T
): endpoint is T & { params: EndpointParams<T> } {
  const ep = endpoint as string;
  return ep.includes("update") || ep.includes("delete") || ep.includes("get");
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
 *   // Implementation here
 * }
 * 
 * // Usage:
 * const ingredient = await callApi('ingredients.create', {
 *   name: 'Tomato',
 *   categories: ['vegetable'],
 *   allergens: []
 * });
 * ```
 */