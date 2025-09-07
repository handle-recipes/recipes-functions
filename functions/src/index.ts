import * as admin from "firebase-admin";

admin.initializeApp();

export {
  ingredientsCreate,
  ingredientsUpdate,
  ingredientsDelete,
  ingredientsGet,
  ingredientsList,
} from "./ingredients";

export {
  recipesCreate,
  recipesUpdate,
  recipesDelete,
  recipesGet,
  recipesList,
} from "./recipes";

export { recipesSearch, recipesSemanticSearch } from "./search";
