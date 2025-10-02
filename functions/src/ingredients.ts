import { onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { Ingredient } from "./types";
import { db, slugifyUnique, validateGroupId, setAuditFields } from "./utils";

const CreateIngredientSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  allergens: z.array(z.string()).default([]),
});

const UpdateIngredientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  aliases: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  allergens: z.array(z.string()).optional(),
});

const DeleteIngredientSchema = z.object({
  id: z.string().min(1),
});

const GetIngredientSchema = z.object({
  id: z.string().min(1),
});

const ListIngredientsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const ingredientsCreate = onRequest(
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
      const data = CreateIngredientSchema.parse(req.body);

      // Check if a soft-deleted ingredient with the same name exists
      const normalizedName = data.name.toLowerCase().trim();
      const existingQuery = await db
        .collection("ingredients")
        .where("isArchived", "==", true)
        .get();
      
      const existingSoftDeleted = existingQuery.docs.find(doc => {
        const docData = doc.data() as Ingredient;
        return docData.name.toLowerCase().trim() === normalizedName;
      });

      let id: string;
      let ingredient: Omit<Ingredient, "id">;

      if (existingSoftDeleted) {
        // Resurrect the soft-deleted ingredient
        id = existingSoftDeleted.id;
        ingredient = {
          ...data,
          createdAt: new Date().toISOString(), // Reset as new
          updatedAt: new Date().toISOString(),
          createdByGroupId: groupId,
          updatedByGroupId: groupId,
          isArchived: false,
        };

        await db.collection("ingredients").doc(id).set(ingredient);
      } else {
        // Create new ingredient
        id = await slugifyUnique(data.name, "ingredients");
        ingredient = {
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdByGroupId: groupId,
          updatedByGroupId: groupId,
          isArchived: false,
        };

        await db.collection("ingredients").doc(id).set(ingredient);
      }

      res.status(201).json({ id, ...ingredient });
    } catch (error: unknown) {
      console.error("Error creating ingredient:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const ingredientsUpdate = onRequest(
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
      const { id, ...data } = UpdateIngredientSchema.parse(req.body);

      const docRef = db.collection("ingredients").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: "Ingredient not found" });
        return;
      }

      const existingData = doc.data() as Ingredient;
      if (existingData.isArchived) {
        res.status(404).json({ error: "Ingredient not found" });
        return;
      }

      const updates: Partial<Ingredient> = { ...data };

      setAuditFields(updates, groupId, true);

      await docRef.update(updates);

      const updatedDoc = await docRef.get();
      res.json({ id, ...updatedDoc.data() });
    } catch (error: unknown) {
      console.error("Error updating ingredient:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const ingredientsDelete = onRequest(
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
      const { id } = DeleteIngredientSchema.parse(req.body);

      const docRef = db.collection("ingredients").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: "Ingredient not found" });
        return;
      }

      const existingData = doc.data() as Ingredient;
      if (existingData.isArchived) {
        res.status(404).json({ error: "Ingredient not found" });
        return;
      }

      const updates = { isArchived: true };
      setAuditFields(updates, groupId, true);

      await docRef.update(updates);

      res.json({ message: "Ingredient deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting ingredient:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const ingredientsGet = onRequest(
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

      validateGroupId(req);
      const { id } = GetIngredientSchema.parse(req.body);

      const doc = await db.collection("ingredients").doc(id).get();

      if (!doc.exists) {
        res.status(404).json({ error: "Ingredient not found" });
        return;
      }

      const data = doc.data() as Ingredient;
      if (data.isArchived) {
        res.status(404).json({ error: "Ingredient not found" });
        return;
      }

      res.json({ ...data, id: doc.id });
    } catch (error: unknown) {
      console.error("Error getting ingredient:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const ingredientsList = onRequest(
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

      validateGroupId(req);
      const { limit, offset } = ListIngredientsSchema.parse(req.body || {});

      const query = db
        .collection("ingredients")
        .where("isArchived", "==", false)
        .orderBy("updatedAt", "desc")
        .limit(limit);

      if (offset > 0) {
        const offsetDoc = await db
          .collection("ingredients")
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
      const ingredients = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({
        ingredients,
        hasMore: snapshot.size === limit,
      });
    } catch (error: unknown) {
      console.error("Error listing ingredients:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);
