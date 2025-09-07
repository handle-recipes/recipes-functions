import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { generateEmbedding } from './embedding';
import { Storage } from '@google-cloud/storage';
import { Recipe } from './types';
import { db, slugifyUnique, validateGroupId, setAuditFields, createEmbeddingField } from './utils';

setGlobalOptions({ region: 'europe-west1' });

const storage = new Storage();

const RecipeIngredientSchema = z.object({
  ingredientId: z.string(),
  quantity: z.number().optional(),
  unit: z.enum(['g', 'kg', 'ml', 'l', 'piece', 'free_text']),
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


async function generateImage(prompt: string, recipeId: string): Promise<string> {
  try {
    // Note: Image generation requires a different approach with current Gemini API
    // For now, return empty string as placeholder until proper image generation is set up
    console.log('Image generation requested for:', prompt);
    return '';
  } catch (error) {
    console.error('Error generating image:', error);
    return '';
  }
}

export const recipesCreate = onRequest(
  { 
    invoker: 'private',
    memory: '2GiB',
    timeoutSeconds: 300 
  },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const groupId = validateGroupId(req);
      const data = CreateRecipeSchema.parse(req.body);

      const docRef = db.collection('recipes').doc();
      const id = docRef.id;
      const slug = await slugifyUnique(data.name, 'recipes', groupId);
      
      const embeddingText = `${data.name} ${data.description}`;
      const embeddingValues = await generateEmbedding(embeddingText);
      const embedding = createEmbeddingField(embeddingValues);

      let imageUrl = data.generateImage 
        ? await generateImage(`${data.name}: ${data.description}`, id)
        : undefined;

      const recipe: Omit<Recipe, 'id'> = {
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
    } catch (error: any) {
      console.error('Error creating recipe:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

export const recipesUpdate = onRequest(
  { 
    invoker: 'private',
    memory: '2GiB',
    timeoutSeconds: 300 
  },
  async (req, res) => {
    try {
      if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const groupId = validateGroupId(req);
      const { id } = req.params;
      const data = UpdateRecipeSchema.parse(req.body);

      const docRef = db.collection('recipes').doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      const existingData = doc.data() as Recipe;
      if (existingData.createdByGroupId !== groupId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updates: Partial<Recipe> = { ...data };
      
      if (data.name || data.description) {
        const embeddingText = `${data.name || existingData.name} ${data.description || existingData.description}`;
        const embeddingValues = await generateEmbedding(embeddingText);
        updates.embedding = createEmbeddingField(embeddingValues);
      }

      if (data.generateImage && data.name) {
        updates.imageUrl = await generateImage(`${data.name}: ${data.description || existingData.description}`, id);
      }

      setAuditFields(updates, groupId, true);

      await docRef.update(updates);

      const updatedDoc = await docRef.get();
      res.json({ id, ...updatedDoc.data() });
    } catch (error: any) {
      console.error('Error updating recipe:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

export const recipesDelete = onRequest(
  { 
    invoker: 'private',
    memory: '512MiB',
    timeoutSeconds: 30 
  },
  async (req, res) => {
    try {
      if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const groupId = validateGroupId(req);
      const { id } = req.params;

      const docRef = db.collection('recipes').doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      const existingData = doc.data() as Recipe;
      if (existingData.createdByGroupId !== groupId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updates = { isArchived: true };
      setAuditFields(updates, groupId, true);

      await docRef.update(updates);

      res.json({ message: 'Recipe deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting recipe:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

export const recipesGet = onRequest(
  { 
    invoker: 'private',
    memory: '512MiB',
    timeoutSeconds: 30 
  },
  async (req, res) => {
    try {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const groupId = validateGroupId(req);
      const { id } = req.params;

      const doc = await db.collection('recipes').doc(id).get();

      if (!doc.exists) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      const data = doc.data() as Recipe;
      if (data.createdByGroupId !== groupId || data.isArchived) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      res.json({ id: doc.id, ...data });
    } catch (error: any) {
      console.error('Error getting recipe:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

export const recipesList = onRequest(
  { 
    invoker: 'private',
    memory: '1GiB',
    timeoutSeconds: 60 
  },
  async (req, res) => {
    try {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const groupId = validateGroupId(req);
      const { limit = '20', offset = '0' } = req.query;

      const query = db.collection('recipes')
        .where('createdByGroupId', '==', groupId)
        .where('isArchived', '==', false)
        .orderBy('updatedAt', 'desc')
        .limit(parseInt(limit as string));

      if (parseInt(offset as string) > 0) {
        const offsetDoc = await db.collection('recipes')
          .where('createdByGroupId', '==', groupId)
          .where('isArchived', '==', false)
          .orderBy('updatedAt', 'desc')
          .offset(parseInt(offset as string))
          .limit(1)
          .get();

        if (!offsetDoc.empty) {
          query.startAfter(offsetDoc.docs[0]);
        }
      }

      const snapshot = await query.get();
      const recipes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json({
        recipes,
        hasMore: snapshot.size === parseInt(limit as string)
      });
    } catch (error: any) {
      console.error('Error listing recipes:', error);
      res.status(400).json({ error: error.message });
    }
  }
);