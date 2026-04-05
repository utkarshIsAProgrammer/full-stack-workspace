// ------------------------------------------------------------------------
function person(name, age, work) {
	return {
		name,
		age,
		work,
		doWork() {
			console.log(`${this.name} written some lines of code.....`);
		},
	};
}

const employee = person("IndieDev", 20, "Software Developer");
console.log(employee);
employee.doWork();
// ------------------------------------------------------------------------
