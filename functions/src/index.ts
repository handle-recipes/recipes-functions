import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";

admin.initializeApp();
setGlobalOptions({ region: "europe-west3" });

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
