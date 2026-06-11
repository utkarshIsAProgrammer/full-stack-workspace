import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const AuthorTable = pgTable("authors", {
	id: uuid().primaryKey().defaultRandom(),
	name: text().notNull(),
	bday: timestamp({ withTimezone: true }),
	createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
