import express from "express";

// controllers
export const getAllStudents = (req, res) => {
	res.send("Get all students.");
};

export const addNewStudent = (req, res) => {
	res.send("Add student.");
};

export const updateStudent = (req, res) => {
	res.send("Update student.");
};

export const deleteStudent = (req, res) => {
	res.send("Delete student.");
};
