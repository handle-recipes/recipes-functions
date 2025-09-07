import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { z } from "zod";
import { generateEmbedding } from "./embedding";
import { Ingredient } from "./types";
import {
  db,
  slugifyUnique,
  validateGroupId,
  setAuditFields,
  createEmbeddingField,
} from "./utils";

setGlobalOptions({ region: "europe-west1" });

const CreateIngredientSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  allergens: z.array(z.string()).default([]),
});

const UpdateIngredientSchema = z.object({
  name: z.string().min(1).optional(),
  aliases: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  allergens: z.array(z.string()).optional(),
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

      const id = slugifyUnique(data.name, "ingredients", groupId);
      const embeddingValues = await generateEmbedding(data.name);
      const embedding = createEmbeddingField(embeddingValues);

      const ingredient: Omit<Ingredient, "id"> = {
        ...data,
        embedding,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        createdByGroupId: groupId,
        updatedByGroupId: groupId,
        isArchived: false,
      };

      await db
        .collection("ingredients")
        .doc(await id)
        .set(ingredient);

      const resolvedId = await id;
      res.status(201).json({ id: resolvedId, ...ingredient });
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
      if (req.method !== "PUT") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const { id } = req.params;
      const data = UpdateIngredientSchema.parse(req.body);

      const docRef = db.collection("ingredients").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: "Ingredient not found" });
        return;
      }

      const existingData = doc.data() as Ingredient;
      if (existingData.createdByGroupId !== groupId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const updates: Partial<Ingredient> = { ...data };

      if (data.name) {
        const embeddingValues = await generateEmbedding(data.name);
        updates.embedding = createEmbeddingField(embeddingValues);
      }

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
      if (req.method !== "DELETE") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const { id } = req.params;

      const docRef = db.collection("ingredients").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: "Ingredient not found" });
        return;
      }

      const existingData = doc.data() as Ingredient;
      if (existingData.createdByGroupId !== groupId) {
        res.status(403).json({ error: "Access denied" });
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
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const { id } = req.params;

      const doc = await db.collection("ingredients").doc(id).get();

      if (!doc.exists) {
        res.status(404).json({ error: "Ingredient not found" });
        return;
      }

      const data = doc.data() as Ingredient;
      if (data.createdByGroupId !== groupId || data.isArchived) {
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
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const { limit = "50", offset = "0" } = req.query;

      const query = db
        .collection("ingredients")
        .where("createdByGroupId", "==", groupId)
        .where("isArchived", "==", false)
        .orderBy("updatedAt", "desc")
        .limit(parseInt(limit as string));

      if (parseInt(offset as string) > 0) {
        const offsetDoc = await db
          .collection("ingredients")
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
      const ingredients = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({
        ingredients,
        hasMore: snapshot.size === parseInt(limit as string),
      });
    } catch (error: unknown) {
      console.error("Error listing ingredients:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);
