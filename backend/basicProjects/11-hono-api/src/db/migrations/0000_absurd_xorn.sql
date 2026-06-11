CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"bday" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
