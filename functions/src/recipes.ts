import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { z } from "zod";
import { generateEmbedding } from "./embedding";
// import {Storage} from "@google-cloud/storage";
import { Recipe } from "./types";
import {
  db,
  slugifyUnique,
  validateGroupId,
  setAuditFields,
  createEmbeddingField,
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
  generateImage: z.boolean().default(false),
});

const UpdateRecipeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  servings: z.number().min(1).optional(),
  ingredients: z.array(RecipeIngredientSchema).optional(),
  steps: z.array(RecipeStepSchema).optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  sourceUrl: z.string().url().optional(),
  generateImage: z.boolean().default(false),
});

/**
 * Generates an image for a recipe (placeholder implementation).
 * @param {string} prompt - The image generation prompt
 * @param {string} _recipeId - The recipe ID (unused)
 * @return {Promise<string>} Empty string placeholder
 */
async function generateImage(
  prompt: string,
  _recipeId: string
): Promise<string> {
  try {
    // Note: Image generation requires a different approach with current
    // Gemini API
    // For now, return empty string as placeholder until proper image
    // generation is set up
    console.log("Image generation requested for:", prompt);
    return "";
  } catch (error) {
    console.error("Error generating image:", error);
    return "";
  }
}

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

      const embeddingText = `${data.name} ${data.description}`;
      const embeddingValues = await generateEmbedding(embeddingText);
      const embedding = createEmbeddingField(embeddingValues);

      const imageUrl = data.generateImage
        ? await generateImage(`${data.name}: ${data.description}`, id)
        : undefined;

      const recipe: Omit<Recipe, "id"> = {
        slug,
        name: data.name,
        description: data.description,
        servings: data.servings,
        ingredients: data.ingredients,
        steps: data.steps,
        tags: data.tags,
        categories: data.categories,
        sourceUrl: data.sourceUrl,
        imageUrl,
        embedding,
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
      if (req.method !== "PUT") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const { id } = req.params;
      const data = UpdateRecipeSchema.parse(req.body);

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

      const updates: Partial<Recipe> = { ...data };

      if (data.name || data.description) {
        const embeddingText = `${data.name || existingData.name} ${
          data.description || existingData.description
        }`;
        const embeddingValues = await generateEmbedding(embeddingText);
        updates.embedding = createEmbeddingField(embeddingValues);
      }

      if (data.generateImage && data.name) {
        const imagePrompt = `${data.name}: ${
          data.description || existingData.description
        }`;
        updates.imageUrl = await generateImage(imagePrompt, id);
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
    invoker: "private",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    try {
      if (req.method !== "DELETE") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const { id } = req.params;

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
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const { id } = req.params;

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
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const { limit = "20", offset = "0" } = req.query;

      const query = db
        .collection("recipes")
        .where("createdByGroupId", "==", groupId)
        .where("isArchived", "==", false)
        .orderBy("updatedAt", "desc")
        .limit(parseInt(limit as string));

      if (parseInt(offset as string) > 0) {
        const offsetDoc = await db
          .collection("recipes")
          .where("createdByGroupId", "==", groupId)
          .where("isArchived", "==", false)
          .orderBy("updatedAt", "desc")
          .offset(parseInt(offset as string))
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
        hasMore: snapshot.size === parseInt(limit as string),
      });
    } catch (error: unknown) {
      console.error("Error listing recipes:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);
