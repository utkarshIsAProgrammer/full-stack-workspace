// middleware function...
function userCredentials(req, res, next) {
	console.log(`User: (alex)`);
	console.log(`Email: (alexabc@gmail.com)`);
	console.log(`Password: (1295269)`);
	console.log(`Age: (19)`);
	next();
}

export default userCredentials;
