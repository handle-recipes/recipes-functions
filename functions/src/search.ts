import { onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { Recipe } from "./types";
import { db, validateGroupId } from "./utils";

const SearchRecipesSchema = z.object({
  query: z.string().min(1),
  ingredients: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).default(20),
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
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const groupId = validateGroupId(req);
      const data = SearchRecipesSchema.parse(req.body);

      const query = db
        .collection("recipes")
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
          data.ingredients?.some((ingredientId) =>
            recipe.ingredients.some((ri) => ri.ingredientId === ingredientId)
          )
        );
      }

      // Filter by tags if provided
      if (data.tags && data.tags.length > 0) {
        recipes = recipes.filter((recipe) =>
          data.tags?.some((tag) =>
            recipe.tags.some((recipeTag) =>
              recipeTag.toLowerCase().includes(tag.toLowerCase())
            )
          )
        );
      }

      // Filter by categories if provided
      if (data.categories && data.categories.length > 0) {
        recipes = recipes.filter((recipe) =>
          data.categories?.some((category) =>
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
    } catch (error: unknown) {
      console.error("Error searching recipes:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  }
);

