// ------------------------------------------------
// iterate and perform operation on each element
const numbers = [1, 2, 3, 4, 5];
numbers.forEach((elem) => {
	console.log(elem * 2);
});

const skills = ["frontend", "backend", "authentication", "deployment"];
skills.forEach((skill, index, arr) => {
	arr[index] = skill[0].toUpperCase() + skill.substring(1);
});
console.log(skills);
// ------------------------------------------------
