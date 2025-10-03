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
  ingredientsDuplicate,
} from "./ingredients";

export {
  recipesCreate,
  recipesUpdate,
  recipesDelete,
  recipesGet,
  recipesList,
  recipesDuplicate,
} from "./recipes";

export { recipesSearch } from "./search";

export {
  suggestionsCreate,
  suggestionsList,
  suggestionsVote,
  suggestionsUpdate,
  suggestionsDelete,
  suggestionsDuplicate,
} from "./suggestions";
