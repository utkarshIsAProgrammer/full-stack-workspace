import mongoose, { mongo } from "mongoose";

// define schema
const movieSchema = new mongoose.Schema({
	name: {
		type: string,
		required: true,
		trim: true,
	},

	ratings: {
		type: number,
		required: true,
		trim: true,
		min: 1,
		max: 5,
	},

	money: {
		type: mongoose.Decimal128,
		required: true,
	},

	genre: {
		type: Array,
	},

	isActive: {
		type: Boolean,
	},

	comments: [
		{
			value: { type: String },
			publish: { type: Date, default: Date.now },
		},
	],
});
