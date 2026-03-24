import Expense from "../models/expense.model.js";

export const getAllExpenses = async (req, res) => {
	const user = req.user?._id;

	try {
		if (!user) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized user",
			});
		}

		// ✅ filter by user
		const expenses = await Expense.find({ user }).sort({ createdAt: -1 });

		res.status(200).json({
			success: true,
			message: "All expenses fetched successfully!",
			expenses,
		});
	} catch (err) {
		console.log(`Error in the getAllExpenses controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};

export const addExpense = async (req, res) => {
	const user = req.user?._id;
	const { title, amount, category, type, date } = req.body;

	try {
		if (!user) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized user",
			});
		}

		if (!title || !amount || !category || !type) {
			return res.status(400).json({
				success: false,
				message: "All fields must be provided!",
			});
		}

		if (typeof amount !== "number" || amount <= 0) {
			return res.status(400).json({
				success: false,
				message: "Amount must be a positive number!",
			});
		}

		if (!["credit", "debit"].includes(type)) {
			return res.status(400).json({
				success: false,
				message: "Invalid transaction type",
			});
		}

		const expense = await Expense.create({
			user,
			title,
			amount,
			category,
			type,
			date,
		});

		res.status(201).json({
			success: true,
			message: "Expense added successfully!",
			data: expense,
		});
	} catch (err) {
		console.log(`Error in the addExpense controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};

export const updateExpense = async (req, res) => {
	const user = req.user?._id;
	const { id } = req.params;

	try {
		if (!user) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized user",
			});
		}

		const expense = await Expense.findOne({ _id: id, user });
		if (!expense) {
			return res.status(404).json({
				success: false,
				message: "Expense not found or unauthorized!",
			});
		}

		const updates = req.body;
		Object.assign(expense, updates);
		await expense.save();

		res.json({
			success: true,
			message: "Expense updated successfully!",
			data: expense,
		});
	} catch (err) {
		console.log(`Error in the updateExpense controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};

export const deleteExpense = async (req, res) => {
	const user = req.user?._id;
	const { id } = req.params;

	try {
		if (!user) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized user",
			});
		}

		const expense = await Expense.findOneAndDelete({ _id: id, user });

		if (!expense) {
			return res.status(404).json({
				success: false,
				message: "Expense not found or unauthorized!",
			});
		}

		res.json({
			success: true,
			message: "Expense deleted successfully!",
		});
	} catch (err) {
		console.log(`Error in the deleteExpense controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};
