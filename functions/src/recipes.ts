import { onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
// import {Storage} from "@google-cloud/storage";
import { Recipe, UNIT } from "./types";
import {
  db,
  slugifyUnique,
  validateGroupId,
  setAuditFields,
  validateOwnership,
  canEdit,
  validateArrayOpConflicts,
  applyStringArrayOps,
} from "./utils";

// const storage = new Storage(); // Unused for now

const RecipeIngredientSchema = z.object({
  ingredientId: z.string(),
  quantity: z.number().optional(),
  unit: z.enum(UNIT),
  quantityText: z.string().optional(),
  note: z.string().optional(),
});

const RecipeStepSchema = z.object({
  text: z.string(),
  imageUrl: z.string().optional(),
  equipment: z.array(z.string()).optional(),
});

const CreateRecipeSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  servings: z.number().min(1),
  ingredients: z.array(RecipeIngredientSchema),
  steps: z.array(RecipeStepSchema),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  sourceUrl: z.string().url().optional(),
});

const UpdateRecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  servings: z.number().min(1).optional(),
  ingredients: z.array(RecipeIngredientSchema).optional(),
  steps: z.array(RecipeStepSchema).optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  sourceUrl: z.string().url().optional(),
  // Array operations
  addTags: z.array(z.string()).optional(),
  removeTags: z.array(z.string()).optional(),
  addCategories: z.array(z.string()).optional(),
  removeCategories: z.array(z.string()).optional(),
  addIngredients: z.array(RecipeIngredientSchema).optional(),
  removeIngredientIds: z.array(z.string()).optional(),
  addSteps: z.array(RecipeStepSchema).optional(),
  removeStepIndexes: z.array(z.number().int().min(0)).optional(),
});

const RECIPE_ARRAY_OP_CONFLICTS = [
  { field: "tags", addField: "addTags", removeField: "removeTags" },
  { field: "categories", addField: "addCategories", removeField: "removeCategories" },
  { field: "ingredients", addField: "addIngredients", removeField: "removeIngredientIds" },
  { field: "steps", addField: "addSteps", removeField: "removeStepIndexes" },
];

const DeleteRecipeSchema = z.object({
  id: z.string().min(1),
});

const GetRecipeSchema = z.object({
  id: z.string().min(1),
});

const ListRecipesSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const DuplicateRecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  servings: z.number().min(1).optional(),
  ingredients: z.array(RecipeIngredientSchema).optional(),
  steps: z.array(RecipeStepSchema).optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  sourceUrl: z.string().url().optional(),
});


export const recipesCreate = onRequest(
  {
    invoker: "public",
    memory: "2GiB",
    timeoutSeconds: 300,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const data = CreateRecipeSchema.parse(req.body);

      // Check if a soft-deleted recipe with the same name exists
      const normalizedName = data.name.toLowerCase().trim();
      const existingQuery = await db
        .collection("recipes")
        .where("isArchived", "==", true)
        .get();
      
      const existingSoftDeleted = existingQuery.docs.find(doc => {
        const docData = doc.data() as Recipe;
        return docData.name.toLowerCase().trim() === normalizedName;
      });

      let id: string;
      let slug: string;
      let recipe: Omit<Recipe, "id">;

      if (existingSoftDeleted) {
        // Resurrect the soft-deleted recipe
        id = existingSoftDeleted.id;
        slug = await slugifyUnique(data.name, "recipes");
        recipe = {
          slug,
          name: data.name,
          description: data.description,
          servings: data.servings,
          ingredients: data.ingredients,
          steps: data.steps,
          tags: data.tags,
          categories: data.categories,
          ...(data.sourceUrl && { sourceUrl: data.sourceUrl }),
          createdAt: new Date().toISOString(), // Reset as new
          updatedAt: new Date().toISOString(),
          createdByGroupId: groupId,
          updatedByGroupId: groupId,
          isArchived: false,
        };

        await db.collection("recipes").doc(id).set(recipe);
      } else {
        // Create new recipe
        const docRef = db.collection("recipes").doc();
        id = docRef.id;
        slug = await slugifyUnique(data.name, "recipes");
        recipe = {
          slug,
          name: data.name,
          description: data.description,
          servings: data.servings,
          ingredients: data.ingredients,
          steps: data.steps,
          tags: data.tags,
          categories: data.categories,
          ...(data.sourceUrl && { sourceUrl: data.sourceUrl }),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdByGroupId: groupId,
          updatedByGroupId: groupId,
          isArchived: false,
        };

        await docRef.set(recipe);
      }

      res.status(201).json({ id, ...recipe });
    } catch (error: unknown) {
      console.error("Error creating recipe:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const recipesUpdate = onRequest(
  {
    invoker: "public",
    memory: "2GiB",
    timeoutSeconds: 300,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed: Only POST requests are accepted" });
        return;
      }

      const groupId = validateGroupId(req);
      const { id, addTags, removeTags, addCategories, removeCategories, addIngredients, removeIngredientIds, addSteps, removeStepIndexes, ...data } = UpdateRecipeSchema.parse(req.body);

      // Validate no conflicts between full replacement and add/remove
      validateArrayOpConflicts(
        req.body as Record<string, unknown>,
        RECIPE_ARRAY_OP_CONFLICTS
      );

      const docRef = db.collection("recipes").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: `Recipe not found: No recipe with ID '${id}' exists` });
        return;
      }

      const existingData = doc.data() as Recipe;
      if (existingData.isArchived) {
        res.status(404).json({ error: `Recipe not found: Recipe '${id}' has been deleted` });
        return;
      }

      // Check ownership
      validateOwnership(existingData, groupId, id, "recipes");

      const updates: Partial<Recipe> = {};

      // Only include defined values to avoid Firestore undefined errors
      if (data.name !== undefined) updates.name = data.name;
      if (data.description !== undefined) updates.description = data.description;
      if (data.servings !== undefined) updates.servings = data.servings;
      if (data.ingredients !== undefined) updates.ingredients = data.ingredients;
      if (data.steps !== undefined) updates.steps = data.steps;
      if (data.tags !== undefined) updates.tags = data.tags;
      if (data.categories !== undefined) updates.categories = data.categories;
      if (data.sourceUrl !== undefined) updates.sourceUrl = data.sourceUrl;

      // Apply array operations for string arrays
      if (addTags !== undefined || removeTags !== undefined) {
        updates.tags = applyStringArrayOps(existingData.tags || [], addTags, removeTags);
      }
      if (addCategories !== undefined || removeCategories !== undefined) {
        updates.categories = applyStringArrayOps(existingData.categories || [], addCategories, removeCategories);
      }

      // Apply ingredient array operations (upsert by ingredientId)
      if (addIngredients !== undefined || removeIngredientIds !== undefined) {
        let currentIngredients = [...(existingData.ingredients || [])];

        if (removeIngredientIds !== undefined) {
          const removeSet = new Set(removeIngredientIds);
          currentIngredients = currentIngredients.filter(
            (ing) => !removeSet.has(ing.ingredientId)
          );
        }

        if (addIngredients !== undefined) {
          for (const newIng of addIngredients) {
            const existingIdx = currentIngredients.findIndex(
              (ing) => ing.ingredientId === newIng.ingredientId
            );
            if (existingIdx >= 0) {
              currentIngredients[existingIdx] = newIng;
            } else {
              currentIngredients.push(newIng);
            }
          }
        }

        updates.ingredients = currentIngredients;
      }

      // Apply step array operations
      if (removeStepIndexes !== undefined || addSteps !== undefined) {
        const currentSteps = [...(existingData.steps || [])];

        if (removeStepIndexes !== undefined) {
          const sortedDesc = [...removeStepIndexes].sort((a, b) => b - a);
          for (const idx of sortedDesc) {
            if (idx >= 0 && idx < currentSteps.length) {
              currentSteps.splice(idx, 1);
            }
          }
        }

        if (addSteps !== undefined) {
          currentSteps.push(...addSteps);
        }

        updates.steps = currentSteps;
      }

      setAuditFields(updates, groupId, true);

      await docRef.update(updates);

      const updatedDoc = await docRef.get();
      res.json({ id, ...updatedDoc.data() });
    } catch (error: unknown) {
      console.error("Error updating recipe:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const recipesDelete = onRequest(
  {
    invoker: "public",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed: Only POST requests are accepted" });
        return;
      }

      const groupId = validateGroupId(req);
      const { id } = DeleteRecipeSchema.parse(req.body);

      const docRef = db.collection("recipes").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: `Recipe not found: No recipe with ID '${id}' exists` });
        return;
      }

      const existingData = doc.data() as Recipe;
      if (existingData.isArchived) {
        res.status(404).json({ error: `Recipe not found: Recipe '${id}' has been deleted` });
        return;
      }

      // Check ownership
      validateOwnership(existingData, groupId, id, "recipes");

      const updates = { isArchived: true };
      setAuditFields(updates, groupId, true);

      await docRef.update(updates);

      res.json({ message: "Recipe deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting recipe:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const recipesGet = onRequest(
  {
    invoker: "public",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed: Only POST requests are accepted" });
        return;
      }

      const groupId = validateGroupId(req);
      const { id } = GetRecipeSchema.parse(req.body);

      const doc = await db.collection("recipes").doc(id).get();

      if (!doc.exists) {
        res.status(404).json({ error: `Recipe not found: No recipe with ID '${id}' exists` });
        return;
      }

      const data = doc.data() as Recipe;
      if (data.isArchived) {
        res.status(404).json({ error: `Recipe not found: Recipe '${id}' has been deleted` });
        return;
      }

      res.json({ ...data, id: doc.id, canBeEditedByYou: canEdit(data, groupId) });
    } catch (error: unknown) {
      console.error("Error getting recipe:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const recipesList = onRequest(
  {
    invoker: "public",
    memory: "1GiB",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed: Only POST requests are accepted" });
        return;
      }

      const groupId = validateGroupId(req);
      const { limit, offset } = ListRecipesSchema.parse(req.body || {});

      let query = db
        .collection("recipes")
        .where("isArchived", "==", false)
        .orderBy("updatedAt", "desc")
        .limit(limit);

      if (offset > 0) {
        const offsetDoc = await db
          .collection("recipes")
          .where("isArchived", "==", false)
          .orderBy("updatedAt", "desc")
          .offset(offset)
          .limit(1)
          .get();

        if (!offsetDoc.empty) {
          query = query.startAfter(offsetDoc.docs[0]);
        }
      }

      const snapshot = await query.get();
      const recipes = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          canBeEditedByYou: canEdit(data, groupId),
        };
      });

      res.json({
        recipes,
        hasMore: snapshot.size === limit,
      });
    } catch (error: unknown) {
      console.error("Error listing recipes:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const recipesDuplicate = onRequest(
  {
    invoker: "public",
    memory: "2GiB",
    timeoutSeconds: 300,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed: Only POST requests are accepted" });
        return;
      }

      const groupId = validateGroupId(req);
      const { id, ...overrides } = DuplicateRecipeSchema.parse(req.body);

      // Fetch the original recipe
      const docRef = db.collection("recipes").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: `Recipe not found: No recipe with ID '${id}' exists` });
        return;
      }

      const originalData = doc.data() as Recipe;
      if (originalData.isArchived) {
        res.status(404).json({ error: `Recipe not found: Recipe '${id}' has been deleted` });
        return;
      }

      // Create duplicate with overrides
      const newName = overrides.name || originalData.name;
      const newDocRef = db.collection("recipes").doc();
      const newId = newDocRef.id;
      const newSlug = await slugifyUnique(newName, "recipes");

      const baseRecipe: Record<string, unknown> = {
        slug: newSlug,
        name: newName,
        description: overrides.description !== undefined ? overrides.description : originalData.description,
        servings: overrides.servings !== undefined ? overrides.servings : originalData.servings,
        ingredients: overrides.ingredients !== undefined ? overrides.ingredients : originalData.ingredients,
        steps: overrides.steps !== undefined ? overrides.steps : originalData.steps,
        tags: overrides.tags !== undefined ? overrides.tags : originalData.tags,
        categories: overrides.categories !== undefined ? overrides.categories : originalData.categories,
        variantOf: id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByGroupId: groupId,
        updatedByGroupId: groupId,
        isArchived: false,
      };

      // Only add sourceUrl if it exists
      const sourceUrl = overrides.sourceUrl !== undefined ? overrides.sourceUrl : originalData.sourceUrl;
      if (sourceUrl !== undefined) baseRecipe.sourceUrl = sourceUrl;

      await newDocRef.set(baseRecipe);

      res.status(201).json({ id: newId, ...baseRecipe });
    } catch (error: unknown) {
      console.error("Error duplicating recipe:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);
