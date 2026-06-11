import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";

export const UserTable = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	email: varchar("email").notNull().unique(),
	password: varchar("password").notNull(),
});
