<script>
	// IMPORTING COMPONENTS
	import Navigation from "./components/Navigation.svelte";
	import Sidebar from "./components/Sidebar.svelte";
	import Header from "./components/Header.svelte";
	import Footer from "./components/Footer.svelte";
	import FirstProp from "./components/FirstProp.svelte";
	import SecondProp from "./components/SecondProp.svelte";
	import ThirdProp from "./components/ThirdProp.svelte";

	let name = "Develooper";
	let age = 20;
	let role = "SDE";

	let simpleHTML = "<p>This is a <b>simple</b> paragraph!</p>";

	// STATE
	let count = $state(0);
	let increment = () => (count += 1);
	let decrement = () => (count -= 1);

	let username = $state("IndieDev");

	// DERIVED
	let fname = $state("Indie");
	let lname = $state("Dev");
	let fullName = $derived(`${fname} ${lname}`);
</script>

<!-- USING COMPONENTS -->
<Navigation />
<Sidebar />
<Header />
<Footer />
<hr />

<!-- TEXT INTERPOLATION -->
<h1>My name is: {name}</h1>
<h1>My age is: {age}</h1>
<h1>My role is: {role}</h1>

<p>{@html simpleHTML}</p>
<hr />

<!-- PROPS -->
<FirstProp name="Child" age={20} hobby="coding" />
<SecondProp
	language="Javascript/Typescript"
	stack="MERN/PERN/T3"
	company="Google"
/>
<hr />

<!-- STATE -->
<p>Count: {count}</p>
<button onclick={increment}>+</button>
<button onclick={decrement}>-</button>

<p>Username: {username}</p>
<input type="text" bind:value={username} />

<!-- DERIVED -->
<p>FullName: {fullName}</p>
<input type="text" bind:value={fname} />
<input type="text" bind:value={lname} />
<hr />

<!-- CHILD -->
<ThirdProp>
	<h1>Hello Child!</h1>
	<ul>
		<li>Home</li>
		<li>About</li>
		<li>Section</li>
	</ul>
</ThirdProp>
<hr />
