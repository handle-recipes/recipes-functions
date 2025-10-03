import { onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { Suggestion } from "./types";
import { db, validateGroupId, setAuditFields } from "./utils";

const CreateSuggestionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.enum(["feature", "bug", "improvement", "other"]).default("feature"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  relatedRecipeId: z.string().optional(),
});

const UpdateSuggestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  category: z.enum(["feature", "bug", "improvement", "other"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  relatedRecipeId: z.string().optional(),
  status: z.enum(["submitted", "under-review", "accepted", "rejected", "implemented"]).optional(),
});

const DeleteSuggestionSchema = z.object({
  id: z.string().min(1),
});

const VoteSuggestionSchema = z.object({
  id: z.string().min(1),
});

const ListSuggestionsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  status: z.enum(["submitted", "under-review", "accepted", "rejected", "implemented"]).optional(),
});

export const suggestionsCreate = onRequest(
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
      const data = CreateSuggestionSchema.parse(req.body);

      const docRef = db.collection("suggestions").doc();
      const id = docRef.id;

      const suggestion: Omit<Suggestion, "id"> = {
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        ...(data.relatedRecipeId && { relatedRecipeId: data.relatedRecipeId }),
        status: "submitted",
        votes: 0,
        votedByGroups: [],
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submittedByGroupId: groupId,
        isArchived: false,
      };

      await docRef.set(suggestion);

      res.status(201).json({ id, ...suggestion });
    } catch (error: unknown) {
      console.error("Error creating suggestion:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const suggestionsList = onRequest(
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
      const { limit, offset, status } = ListSuggestionsSchema.parse(req.body || {});

      let query = db
        .collection("suggestions")
        .where("isArchived", "==", false);

      if (status) {
        query = query.where("status", "==", status);
      }

      query = query.orderBy("votes", "desc").orderBy("submittedAt", "desc").limit(limit);

      if (offset > 0) {
        const offsetDoc = await db
          .collection("suggestions")
          .where("isArchived", "==", false)
          .orderBy("votes", "desc")
          .orderBy("submittedAt", "desc")
          .offset(offset)
          .limit(1)
          .get();

        if (!offsetDoc.empty) {
          query = query.startAfter(offsetDoc.docs[0]);
        }
      }

      const snapshot = await query.get();
      const suggestions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({
        suggestions,
        hasMore: snapshot.size === limit,
      });
    } catch (error: unknown) {
      console.error("Error listing suggestions:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const suggestionsVote = onRequest(
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
      const { id } = VoteSuggestionSchema.parse(req.body);

      const docRef = db.collection("suggestions").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: "Suggestion not found" });
        return;
      }

      const existingData = doc.data() as Suggestion;
      if (existingData.isArchived) {
        res.status(404).json({ error: "Suggestion not found" });
        return;
      }

      // Check if group already voted
      const votedByGroups = existingData.votedByGroups || [];
      const hasVoted = votedByGroups.includes(groupId);

      let updates: Partial<Suggestion>;

      if (hasVoted) {
        // Remove vote (toggle)
        updates = {
          votes: Math.max(0, existingData.votes - 1),
          votedByGroups: votedByGroups.filter(g => g !== groupId),
        };
      } else {
        // Add vote
        updates = {
          votes: existingData.votes + 1,
          votedByGroups: [...votedByGroups, groupId],
        };
      }

      setAuditFields(updates, groupId, true);
      await docRef.update(updates);

      const updatedDoc = await docRef.get();
      res.json({
        id,
        ...updatedDoc.data(),
        voted: !hasVoted, // Indicate current vote state
      });
    } catch (error: unknown) {
      console.error("Error voting on suggestion:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const suggestionsUpdate = onRequest(
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
      const { id, ...data } = UpdateSuggestionSchema.parse(req.body);

      const docRef = db.collection("suggestions").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: "Suggestion not found" });
        return;
      }

      const existingData = doc.data() as Suggestion;
      if (existingData.isArchived) {
        res.status(404).json({ error: "Suggestion not found" });
        return;
      }

      const updates: Partial<Suggestion> = { ...data };
      setAuditFields(updates, groupId, true);

      await docRef.update(updates);

      const updatedDoc = await docRef.get();
      res.json({ id, ...updatedDoc.data() });
    } catch (error: unknown) {
      console.error("Error updating suggestion:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

export const suggestionsDelete = onRequest(
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
      const { id } = DeleteSuggestionSchema.parse(req.body);

      const docRef = db.collection("suggestions").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: "Suggestion not found" });
        return;
      }

      const existingData = doc.data() as Suggestion;
      if (existingData.isArchived) {
        res.status(404).json({ error: "Suggestion not found" });
        return;
      }

      const updates = { isArchived: true };
      setAuditFields(updates, groupId, true);

      await docRef.update(updates);

      res.json({ message: "Suggestion deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting suggestion:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);
