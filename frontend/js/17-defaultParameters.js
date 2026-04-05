// ------------------------------------------------------------------------
// default parameter (object method)
function user({ name = "User", role }) {
	console.log(`${name} is a ${role}!`);
}
user({ role: "Software Engineer" });

// default parameter (undefined method)
function user(name = "User", role) {
	console.log(`${name} is a ${role}!`);
}
user(undefined, (role = "Software Engineer"));

// NOTE: default parameter is only passed when the argument is undefined.
// ------------------------------------------------------------------------
