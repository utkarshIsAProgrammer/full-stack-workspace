import http from "http";

const server = http.createServer((req, res) => {
	res.writeHead(200, { "Content-Type": "text/plain" });
	res.end("I've just build a server in nodeJs!");
});

server.listen(3000, () => {
	console.log("Server is live on http://localhost:3000");
});
