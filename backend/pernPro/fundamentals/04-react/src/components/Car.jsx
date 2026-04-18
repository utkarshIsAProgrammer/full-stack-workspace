import React from "react";

const Car = ({ car }) => {
	return (
		<div>
			<ul>
				<li>Make: {car.make}</li>
				<li>Model: {car.model}</li>
				<li>Year: {car.year}</li>
				<li>Price: {car.price}</li>
			</ul>
		</div>
	);
};

export default Car;
