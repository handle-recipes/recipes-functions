import {onRequest} from "firebase-functions/v2/https";
import {setGlobalOptions} from "firebase-functions/v2";
import {z} from "zod";
import {generateEmbedding} from "./embedding";
import {Recipe} from "./types";
import {db, validateGroupId} from "./utils";

setGlobalOptions({region: "europe-west1"});


const SearchRecipesSchema = z.object({
  query: z.string().min(1),
  ingredients: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).default(20),
});

const SemanticSearchSchema = z.object({
  query: z.string().min(1),
  topK: z.number().min(1).max(50).default(8),
});


export const recipesSearch = onRequest(
  {
    invoker: "private",
    memory: "1GiB",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({error: "Method not allowed"});
      }

      const groupId = validateGroupId(req);
      const data = SearchRecipesSchema.parse(req.body);

      const query = db.collection("recipes")
        .where("createdByGroupId", "==", groupId)
        .where("isArchived", "==", false);

      // Text search on name and description
      const searchTerms = data.query.toLowerCase().split(" ");

      const snapshot = await query.get();
      let recipes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as (Recipe & { id: string })[];

      // Filter by text search
      recipes = recipes.filter((recipe) => {
        const searchText = `${recipe.name} ${recipe.description}`.toLowerCase();
        return searchTerms.some((term) => searchText.includes(term));
      });

      // Filter by ingredients if provided
      if (data.ingredients && data.ingredients.length > 0) {
        recipes = recipes.filter((recipe) =>
          data.ingredients!.some((ingredientId) =>
            recipe.ingredients.some((ri) => ri.ingredientId === ingredientId)
          )
        );
      }

      // Filter by tags if provided
      if (data.tags && data.tags.length > 0) {
        recipes = recipes.filter((recipe) =>
          data.tags!.some((tag) =>
            recipe.tags.some((recipeTag) => recipeTag.toLowerCase().includes(tag.toLowerCase()))
          )
        );
      }

      // Filter by categories if provided
      if (data.categories && data.categories.length > 0) {
        recipes = recipes.filter((recipe) =>
          data.categories!.some((category) =>
            recipe.categories.some((recipeCategory) =>
              recipeCategory.toLowerCase().includes(category.toLowerCase())
            )
          )
        );
      }

      // Sort by relevance (simple text matching score)
      recipes = recipes.sort((a, b) => {
        const aScore = searchTerms.reduce((score, term) => {
          const aText = `${a.name} ${a.description}`.toLowerCase();
          return score + (aText.split(term).length - 1);
        }, 0);
        const bScore = searchTerms.reduce((score, term) => {
          const bText = `${b.name} ${b.description}`.toLowerCase();
          return score + (bText.split(term).length - 1);
        }, 0);
        return bScore - aScore;
      });

      // Limit results
      recipes = recipes.slice(0, data.limit);

      res.json({
        recipes,
        totalFound: recipes.length,
        query: data.query,
      });
    } catch (error: any) {
      console.error("Error searching recipes:", error);
      res.status(400).json({error: error.message});
    }
  }
);

export const recipesSemanticSearch = onRequest(
  {
    invoker: "private",
    memory: "2GiB",
    timeoutSeconds: 120,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({error: "Method not allowed"});
      }

      const groupId = validateGroupId(req);
      const data = SemanticSearchSchema.parse(req.body);

      // Generate embedding for the search query
      const queryEmbedding = await generateEmbedding(data.query);

      // Use Firestore vector search for semantic similarity
      // Note: This requires setting up vector index in Firestore
      const vectorQuery = db.collection("recipes")
        .where("createdByGroupId", "==", groupId)
        .where("isArchived", "==", false)
        .findNearest({
          vectorField: "embedding",
          queryVector: queryEmbedding,
          limit: data.topK,
          distanceMeasure: "COSINE",
        });

      const snapshot = await vectorQuery.get();
      const recipes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as (Recipe & { id: string })[];

      res.json({
        recipes,
        query: data.query,
        topK: data.topK,
      });
    } catch (error: any) {
      console.error("Error in semantic search:", error);
      res.status(400).json({error: error.message});
    }
  }
);
