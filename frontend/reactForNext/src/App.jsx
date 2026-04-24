import User from "./components/User";
import Card from "./components/Card";
import Form from "./components/Form";
import Dropdown from "./components/Dropdown";

const App = () => {
	const name = "IndieDev";
	const users = ["Alice", "Marie", "Jane", "Maria"];
	const isMarried = false;
	const isLoading = true;
	const data = "abc@gmail.com";

	return (
		<div>
			<div className="App">
				<button>Click Me</button>
				<h1>Hello {name}</h1>

				<User name={"Jane"} age={22} role={"Frontend Dev."} />
				<User name={"John"} age={25} role={"Backend Dev."} />
				<User name={"Jen"} age={35} role={"DevOps Eng."} />

				<Card>
					<h1>Indie!</h1>
				</Card>
				<Card>
					<button>Click Indie!</button>
				</Card>

				<Form />

				<ul>
					{users.map((user, index) => {
						return <li key={index}>{user}</li>;
					})}
				</ul>

				{isMarried ? (
					<p>The user is married!</p>
				) : (
					<p>The user is not married!</p>
				)}
			</div>

			{isLoading ? <p>Loading...</p> : <p>User email is: {data}</p>}

			<Dropdown />
		</div>
	);
};

export default App;
