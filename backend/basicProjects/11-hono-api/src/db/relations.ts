import * as schema from "./schema/authors";
import * as users from "./schema/users";

export const relations = { ...schema, ...users };
