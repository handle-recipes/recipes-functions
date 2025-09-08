import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { z } from "zod";
// import {Storage} from "@google-cloud/storage";
import { Recipe } from "./types";
import {
  db,
  slugifyUnique,
  validateGroupId,
  setAuditFields,
} from "./utils";

// const storage = new Storage(); // Unused for now

const RecipeIngredientSchema = z.object({
  ingredientId: z.string(),
  quantity: z.number().optional(),
  unit: z.enum(["g", "kg", "ml", "l", "piece", "free_text"]),
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
});

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


export const recipesCreate = onRequest(
  {
    invoker: "private",
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

      const docRef = db.collection("recipes").doc();
      const id = docRef.id;
      const slug = await slugifyUnique(data.name, "recipes", groupId);


      const recipe: Omit<Recipe, "id"> = {
        slug,
        name: data.name,
        description: data.description,
        servings: data.servings,
        ingredients: data.ingredients,
        steps: data.steps,
        tags: data.tags,
        categories: data.categories,
        ...(data.sourceUrl && { sourceUrl: data.sourceUrl }),
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        createdByGroupId: groupId,
        updatedByGroupId: groupId,
        isArchived: false,
      };

      await docRef.set(recipe);

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
    invoker: "private",
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
      const { id, ...data } = UpdateRecipeSchema.parse(req.body);

      const docRef = db.collection("recipes").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: "Recipe not found" });
        return;
      }

      const existingData = doc.data() as Recipe;
      if (existingData.createdByGroupId !== groupId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

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
    invoker: "private",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const { id } = DeleteRecipeSchema.parse(req.body);

      const docRef = db.collection("recipes").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: "Recipe not found" });
        return;
      }

      const existingData = doc.data() as Recipe;
      if (existingData.createdByGroupId !== groupId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

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
    invoker: "private",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const { id } = GetRecipeSchema.parse(req.body);

      const doc = await db.collection("recipes").doc(id).get();

      if (!doc.exists) {
        res.status(404).json({ error: "Recipe not found" });
        return;
      }

      const data = doc.data() as Recipe;
      if (data.createdByGroupId !== groupId || data.isArchived) {
        res.status(404).json({ error: "Recipe not found" });
        return;
      }

      res.json({ ...data, id: doc.id });
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
    invoker: "private",
    memory: "1GiB",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const { limit, offset } = ListRecipesSchema.parse(req.body || {});

      const query = db
        .collection("recipes")
        .where("createdByGroupId", "==", groupId)
        .where("isArchived", "==", false)
        .orderBy("updatedAt", "desc")
        .limit(limit);

      if (offset > 0) {
        const offsetDoc = await db
          .collection("recipes")
          .where("createdByGroupId", "==", groupId)
          .where("isArchived", "==", false)
          .orderBy("updatedAt", "desc")
          .offset(offset)
          .limit(1)
          .get();

        if (!offsetDoc.empty) {
          query.startAfter(offsetDoc.docs[0]);
        }
      }

      const snapshot = await query.get();
      const recipes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

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
