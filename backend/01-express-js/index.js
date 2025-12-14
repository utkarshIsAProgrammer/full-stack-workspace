import express from "express";
import developers from "./routes/developers.js";
import managers from "./routes/managers.js";

// instance of express...
const app = express();

app.use("/developers", developers);
app.use("/managers", managers);

// listen to the port...
app.listen("5000", () => {
	console.log("Server started on PORT: 5000");
});
