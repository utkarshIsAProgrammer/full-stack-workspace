import React from "react";
import Car from "./components/Car.jsx";
import { useEffect, useState } from "react";

const App = () => {
	const [cars, setCars] = useState([]);
	useEffect(() => {}, []);

	return (
		<div>
			<h1>Welcome to the car store!</h1>

			<ul>
				<Car />
			</ul>
		</div>
	);
};

export default App;
