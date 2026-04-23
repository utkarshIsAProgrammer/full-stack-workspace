import "./App.css";
import { useState } from "react";

const Greeting = ({ name, age }) => {
	return (
		<p>
			Hi {name} a {age} years fellow, greetings from React!
		</p>
	);
};

function App() {
	const username = "IndieDev";
	const age = 20;
	const role = getRole();

	const [showGreeting, setShowGreeting] = useState(false); // hook
	const [name, setName] = useState("");

	function toggleGreeting() {
		setShowGreeting(!showGreeting);
	}

	function handleChange(event) {
		const value = event.target.value;
		setName(value);
	}

	return (
		<div>
			<h3>Name: {username}</h3>
			<h3>Age: {age}</h3>
			<h3>Role: {role}</h3>
			<Greeting name="IndieDev" age={20} />

			{showGreeting && <Greeting name="JennyDev" age={25} />}
			<button onClick={toggleGreeting}>Toggle Greeting</button>
			<br />

			{name}
			<br />
			<input type="text" placeholder="Name..." onChange={handleChange} />
		</div>
	);

	function getRole() {
		return "Programmer/Developer";
	}
}

export default App;

// Components
// Props
// State, Event and Conditional Rendering
