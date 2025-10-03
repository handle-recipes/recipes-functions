import * as admin from "firebase-admin";
import slugify from "slugify";
import { Request } from "firebase-functions/v2/https";

export const db = admin.firestore();


/**
 * Creates a unique slug for a document in the specified collection.
 * @param {string} name - The name to slugify
 * @param {"ingredients" | "recipes"} collection - The collection type
 * @return {Promise<string>} A unique slug
 */
export async function slugifyUnique(
  name: string,
  collection: "ingredients" | "recipes"
): Promise<string> {
  const baseSlug = slugify(name, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existingDoc = await db
      .collection(collection)
      .where("slug", "==", slug)
      .where("isArchived", "==", false)
      .get();

    if (existingDoc.empty) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Validates and extracts group ID from request headers.
 * @param {Request} req - The request object
 * @return {string} The validated group ID
 * @throws {Error} When group ID is missing
 */
export function validateGroupId(req: Request): string {
  const groupId = req.headers["x-group-id"];
  if (!groupId) {
    throw new Error("Missing required header: x-group-id");
  }
  return groupId as string;
}

/**
 * Sets audit fields on a document.
 * @param {Record<string, unknown>} doc - The document to update
 * @param {string} groupId - The group ID
 * @param {boolean} isUpdate - Whether this is an update operation
 */
export function setAuditFields(
  doc: Record<string, unknown>,
  groupId: string,
  isUpdate = false
) {
  const now = new Date().toISOString();

  if (!isUpdate) {
    doc.createdAt = now;
    doc.createdByGroupId = groupId;
    doc.isArchived = false;
  }

  doc.updatedAt = now;
  doc.updatedByGroupId = groupId;
}

/**
 * Checks if the requesting group can edit a document.
 * @param {any} doc - The document data
 * @param {string} groupId - The requesting group ID
 * @return {boolean} True if the group can edit the document
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canEdit(doc: any, groupId: string): boolean {
  return doc.createdByGroupId === groupId;
}

/**
 * Validates ownership and throws an error if the group cannot edit.
 * @param {any} doc - The document data
 * @param {string} groupId - The requesting group ID
 * @param {string} id - The document ID
 * @param {string} collection - The collection name
 * @throws {Error} When the group doesn't own the document
 */
export function validateOwnership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  groupId: string,
  id: string,
  collection: string
): void {
  if (!canEdit(doc, groupId)) {
    throw new Error(
      `Access denied: ${collection} '${id}' is owned by group '${doc.createdByGroupId}'. ` +
      `Your group '${groupId}' cannot modify it. To make changes, create a duplicate ` +
      `using the ${collection}Duplicate endpoint.`
    );
  }
}
