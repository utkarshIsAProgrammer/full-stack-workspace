import React, { useEffect, useState } from "react";
import Car from "./components/Car.jsx";

const App = () => {
	const [cars, setCars] = useState([]);

	useEffect(() => {
		fetch("/api/cars")
			.then((res) => {
				if (!res.ok) throw new Error("API failed");
				return res.json();
			})
			.then((data) => setCars(data))
			.catch((err) => console.error(err));
	}, []);

	return (
		<div>
			<h1>Welcome to the car store!</h1>

			<ul>
				{cars.map((car, index) => (
					<Car key={index} car={car} />
				))}
			</ul>
		</div>
	);
};

export default App;
