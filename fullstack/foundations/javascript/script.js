alert("Hello World!");

console.log("Hello World!");
console.log(100);
console.log("Hello", 20, "Bucks");

const x = 100;
console.log(x);

console.error("This is a console error message!");
console.warn("This is a console warning message!");

console.table({
	name: "IndieDev",
	email: "utkarshprogrammer@gmail.com",
	role: "Full stack software developer",
});

console.group("Backend Technologies");
console.log("Node");
console.log("Deno");
console.log("Express");
console.log("Elysia");
console.log("Django");
console.log("Flask");
console.log("FastAPI");
console.groupEnd();

const styles =
	"padding: 20px; background-color: #fff; color:green; font-size: 16px;";
console.log("%cStyled JS Console", styles);
