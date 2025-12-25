import mongoose, { mongo } from "mongoose";

// define schema
const movieSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true,
	},

	ratings: {
		type: Number,
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

// creating model
const MovieModel = mongoose.model("Movie", movieSchema); // "Movie" is converted into "movies" when executed

// creating document
const insertManyDocs = async () => {
	try {
		const m1 = new MovieModel({
			name: "Extraction",
			ratings: 4.5,
			money: 600000,
			genre: ["action", "adventure"],
			isActive: true,
			comments: [{ value: "Amazing..." }],
		});

		const m2 = new MovieModel({
			name: "Endgame",
			ratings: 5,
			money: 1000000,
			genre: ["action", "marvel", "sci-fi"],
			isActive: true,
			comments: [{ value: "Fantastic marvel movie..." }],
		});

		const m3 = new MovieModel({
			name: "IT",
			ratings: 4.2,
			money: 50000,
			genre: ["horror", "adventure", "mystery"],
			isActive: true,
			comments: [{ value: "Best entertaining mystery series..." }],
		});

		const m4 = new MovieModel({
			name: "From",
			ratings: 4.8,
			money: 430000,
			genre: ["mystery", "horror", "adventure", "thriller", "adventure"],
			isActive: true,
			comments: [{ value: "Great story line..." }],
		});

		const result = await MovieModel.insertMany([m1, m2, m3, m4]);
		// console.log(result);
	} catch (err) {
		console.log(err);
	}
};

// retrieving all data
const allDocs = async () => {
	try {
		const result = await MovieModel.find(); // find all data

		// iterate over document
		result.forEach((movie) => {
			console.log(movie.name, movie.ratings);
		});
	} catch (err) {
		console.log(err);
	}
};

// retrieving data using id
const singleDoc = async () => {
	try {
		// const result = await MovieModel.findById("694c640d78c4b5bed16c73c3"); // find data by id
		const result = await MovieModel.findById(
			"694c640d78c4b5bed16c73c3",
			"name"
		); // find data field  by id

		console.log(result);
		// console.log(result.name, result.ratings);
	} catch (err) {
		console.log(err);
	}
};

// update data
const updateDoc = async (id) => {
	try {
		const result = await MovieModel.updateOne(
			{ _id: id },
			{ name: "Attraction" }
		); // update field by id
		console.log(result);
	} catch (err) {
		console.log(err);
	}
};

// update many data
const updateDocs = async () => {
	try {
		const result = await MovieModel.updateMany(
			{ ratings: 4.5 },
			{ ratings: 3.2 }
		); // update field by id
		console.log(result);
	} catch (err) {
		console.log(err);
	}
};

export { insertManyDocs, allDocs, singleDoc, updateDoc, updateDocs };
