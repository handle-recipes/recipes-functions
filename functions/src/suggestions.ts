import { onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { Suggestion, SUGGESTION_CATEGORY, SUGGESTION_PRIORITY, SUGGESTION_STATUS } from "./types";
import { db, validateGroupId, setAuditFields, validateOwnership, canEdit } from "./utils";

const CreateSuggestionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.enum(SUGGESTION_CATEGORY).default("feature"),
  priority: z.enum(SUGGESTION_PRIORITY).default("medium"),
  relatedRecipeId: z.string().optional(),
});

const UpdateSuggestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  category: z.enum(SUGGESTION_CATEGORY).optional(),
  priority: z.enum(SUGGESTION_PRIORITY).optional(),
  relatedRecipeId: z.string().optional(),
  status: z.enum(SUGGESTION_STATUS).optional(),
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
  status: z.enum(SUGGESTION_STATUS).optional(),
});

const DuplicateSuggestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  category: z.enum(SUGGESTION_CATEGORY).optional(),
  priority: z.enum(SUGGESTION_PRIORITY).optional(),
  relatedRecipeId: z.string().optional(),
});

export const suggestionsCreate = onRequest(
  {
    invoker: "public",
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
        createdByGroupId: groupId,
        updatedByGroupId: groupId,
        createdAt: new Date().toISOString(),
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
      const suggestions = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          canBeEditedByYou: canEdit(data, groupId),
        };
      });

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
    invoker: "public",
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
      const { id, ...data } = UpdateSuggestionSchema.parse(req.body);

      const docRef = db.collection("suggestions").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: `Suggestion not found: No suggestion with ID '${id}' exists` });
        return;
      }

      const existingData = doc.data() as Suggestion;
      if (existingData.isArchived) {
        res.status(404).json({ error: `Suggestion not found: Suggestion '${id}' has been deleted` });
        return;
      }

      // Check ownership
      validateOwnership(existingData, groupId, id, "suggestions");

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
      const { id } = DeleteSuggestionSchema.parse(req.body);

      const docRef = db.collection("suggestions").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: `Suggestion not found: No suggestion with ID '${id}' exists` });
        return;
      }

      const existingData = doc.data() as Suggestion;
      if (existingData.isArchived) {
        res.status(404).json({ error: `Suggestion not found: Suggestion '${id}' has been deleted` });
        return;
      }

      // Check ownership
      validateOwnership(existingData, groupId, id, "suggestions");

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

export const suggestionsDuplicate = onRequest(
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
      const { id, ...overrides } = DuplicateSuggestionSchema.parse(req.body);

      // Fetch the original suggestion
      const docRef = db.collection("suggestions").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: `Suggestion not found: No suggestion with ID '${id}' exists` });
        return;
      }

      const originalData = doc.data() as Suggestion;
      if (originalData.isArchived) {
        res.status(404).json({ error: `Suggestion not found: Suggestion '${id}' has been deleted` });
        return;
      }

      // Create duplicate with overrides
      const newDocRef = db.collection("suggestions").doc();
      const newId = newDocRef.id;

      const duplicateSuggestion: Omit<Suggestion, "id"> = {
        title: overrides.title || originalData.title,
        description: overrides.description || originalData.description,
        category: overrides.category || originalData.category,
        priority: overrides.priority || originalData.priority,
        ...(overrides.relatedRecipeId !== undefined ? { relatedRecipeId: overrides.relatedRecipeId } : originalData.relatedRecipeId ? { relatedRecipeId: originalData.relatedRecipeId } : {}),
        status: "submitted",
        votes: 0,
        votedByGroups: [],
        variantOf: id,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submittedByGroupId: groupId,
        createdByGroupId: groupId,
        updatedByGroupId: groupId,
        createdAt: new Date().toISOString(),
        isArchived: false,
      };

      await newDocRef.set(duplicateSuggestion);

      res.status(201).json({ id: newId, ...duplicateSuggestion });
    } catch (error: unknown) {
      console.error("Error duplicating suggestion:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);
