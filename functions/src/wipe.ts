import { onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { db, validateGroupId } from "./utils";

const WipeSchema = z.object({
  confirm: z.literal(true),
});

export const wipe = onRequest(
  {
    invoker: "public",
    memory: "2GiB",
    timeoutSeconds: 540, // 9 minutes - close to max for deletions
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed: Only POST requests are accepted" });
        return;
      }

      const groupId = validateGroupId(req);

      const { confirm } = WipeSchema.parse(req.body);

      if (!confirm) {
        res.status(400).json({ error: "Confirmation required: Set 'confirm: true' to wipe the database" });
        return;
      }

      // Soft-delete documents based on group:
      // - "seed" group wipes everything
      // - Other groups wipe only their own items
      const isSeedGroup = groupId === "seed";
      const collections = ["ingredients", "recipes", "suggestions"];
      const results: Record<string, number> = {};
      const now = new Date().toISOString();

      for (const collectionName of collections) {
        let archivedCount = 0;
        const batchSize = 500; // Firestore batch limit

        // eslint-disable-next-line no-constant-condition
        while (true) {
          let query = db
            .collection(collectionName)
            .where("isArchived", "==", false);

          // Non-seed groups can only wipe their own items
          if (!isSeedGroup) {
            query = query.where("createdByGroupId", "==", groupId);
          }

          const snapshot = await query.limit(batchSize).get();

          if (snapshot.empty) {
            break;
          }

          const batch = db.batch();
          snapshot.docs.forEach((doc) => {
            batch.update(doc.ref, {
              isArchived: true,
              updatedAt: now,
              updatedByGroupId: groupId,
            });
          });

          await batch.commit();
          archivedCount += snapshot.size;

          // If we got fewer than batchSize, we're done
          if (snapshot.size < batchSize) {
            break;
          }
        }

        results[collectionName] = archivedCount;
      }

      const totalArchived = Object.values(results).reduce((sum, count) => sum + count, 0);
      const message = isSeedGroup
        ? "Database wiped successfully (all items archived)"
        : `Your group's items wiped successfully (${totalArchived} items archived)`;

      res.json({
        message,
        archivedCounts: results,
        totalArchived,
      });
    } catch (error: unknown) {
      console.error("Error wiping database:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);
