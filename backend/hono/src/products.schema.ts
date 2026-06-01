import { z } from "zod";

export const productQuerySchema = z
	.object({
		minPrice: z.coerce.number().optional().default(0),
		maxPrice: z.coerce.number().optional().default(1000),
	})
	.refine((data) => data.minPrice <= data.maxPrice, {
		message: "minPrice must be less than or equal to maxPrice",
	});

export type ProductQuery = z.infer<typeof productQuerySchema>;
