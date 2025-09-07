import * as admin from "firebase-admin";
import slugify from "slugify";
import {FieldValue} from "@google-cloud/firestore";

export const db = admin.firestore();

export function createEmbeddingField(values: number[]) {
  return FieldValue.vector(values);
}

export async function slugifyUnique(name: string, collection: "ingredients" | "recipes", groupId: string): Promise<string> {
  const baseSlug = slugify(name, {lower: true, strict: true});
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existingDoc = await db.collection(collection)
      .where("slug", "==", slug)
      .where("createdByGroupId", "==", groupId)
      .where("isArchived", "==", false)
      .get();

    if (existingDoc.empty) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export function validateGroupId(req: any): string {
  const groupId = req.headers["x-group-id"];
  if (!groupId) {
    throw new Error("Missing required header: x-group-id");
  }
  return groupId as string;
}

export function setAuditFields(doc: any, groupId: string, isUpdate = false) {
  const now = admin.firestore.Timestamp.now();

  if (!isUpdate) {
    doc.createdAt = now;
    doc.createdByGroupId = groupId;
    doc.isArchived = false;
  }

  doc.updatedAt = now;
  doc.updatedByGroupId = groupId;
}
