import express from "express";
import developers from "./routes/developers.js";
import managers from "./routes/managers.js";

// express instance...
const app = express();

// using routes...
app.use("/developers", developers);
app.use("/managers", managers);

// listen to the port...
app.listen("5000", () => {
	console.log("Server started on PORT: 5000");
});
