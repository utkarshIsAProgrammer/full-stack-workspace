import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const userTable = pgTable("users", {
  id:uuid().primaryKey().defaultRandom(),
  email:varchar({ length: 256 }).unique().notNull(),
  passwordHash:varchar({ length: 500}).notNull(),
  age:integer(),
  createdAt: timestamp({withTimezone:true}).defaultNow(),
  updatedAt: timestamp({withTimezone:true}).defaultNow()
}, (table) => [
  check("age_check1", sql`${table.age} <= 120`),
  check("age_check2", sql`${table.age} >= 0`)
])



export const todosTable = pgTable("todos", {
  id:uuid().primaryKey().defaultRandom(),
  userId: uuid().references(() => userTable.id, { onDelete: "cascade" }).notNull(),
  title: varchar({length:500}).notNull(),
  description: varchar({length:1000}),
  completed:boolean().default(false),
  createdAt:timestamp({withTimezone:true}).defaultNow(),
  updatedAt:timestamp({withTimezone:true}).defaultNow(),
})  