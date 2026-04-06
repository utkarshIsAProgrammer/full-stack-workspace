<script>
	// IMPORTING COMPONENTS
	import Navigation from "./components/Navigation.svelte";
	import Sidebar from "./components/Sidebar.svelte";
	import Header from "./components/Header.svelte";
	import Footer from "./components/Footer.svelte";
	import FirstProp from "./components/FirstProp.svelte";
	import SecondProp from "./components/SecondProp.svelte";
	import ThirdProp from "./components/ThirdProp.svelte";

	// TEXT INTERPOLATION
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

	// EACH LOOP
	let items = ["biscuits", "chocolate", "coffee", "noodles"];

	// CONDITIONAL RENDERING
	let isVisible = $state(true);
	let visible = () => (isVisible = !isVisible);

	let score = $state(0);
	let increase = () => (score += 5);
	let decrease = () => (score -= 5);

	// SNIPPETS
	const users = [
		{ name: "Alice", age: 19, role: "student" },
		{ name: "Kevin", age: 36, role: "teacher" },
		{ name: "James", age: 22, role: "tester" },
	];

	// EFFECTS
	let countVal = $state(0);
	$effect(() => {
		console.log(`----- COUNT: ${countVal}`);
	});

	let theUser = $state("Guest");
	$effect(() => {
		document.title = `Welcome ${theUser}!`;
	});
</script>

<!-- * USING COMPONENTS -->
<Navigation />
<Sidebar />
<Header />
<Footer />
<hr />

<!-- * TEXT INTERPOLATION -->
<h1>My name is: {name}</h1>
<h1>My age is: {age}</h1>
<h1>My role is: {role}</h1>

<p>{@html simpleHTML}</p>
<hr />

<!-- * PROPS -->
<FirstProp name="Child" age={20} hobby="coding" />
<SecondProp
	language="Javascript/Typescript"
	stack="MERN/PERN/T3"
	company="Google"
/>
<hr />

<!-- * STATE -->
<p>Count: {count}</p>
<button onclick={increment}>+</button>
<button onclick={decrement}>-</button>

<p>Username: {username}</p>
<input type="text" bind:value={username} />

<!-- * DERIVED -->
<p>FullName: {fullName}</p>
<input type="text" bind:value={fname} />
<input type="text" bind:value={lname} />
<hr />

<!-- * CHILD "ThirdProp.svelte"-->
<ThirdProp>
	<h1>Hello Child!</h1>
	<ul>
		<li>Home</li>
		<li>About</li>
		<li>Section</li>
	</ul>
</ThirdProp>
<hr />

<!-- EACH LOOP-->
<ul>
	{#each items as item}
		<li>{item}</li>
	{/each}
</ul>
<hr />

<!-- CONDITIONAL RENDERING -->
<p>Visibility: {isVisible}</p>
<button onclick={visible}>visibility</button>

{#if isVisible}
	<p>This message is visible!</p>
{/if}

<p>Score: {score}</p>
<button onclick={increase}>Increase</button>
<button onclick={decrease}>Decrease</button>

{#if score < 0}
	<p>Negative Score!</p>
{:else if score <= 40}
	<p>You are failed!</p>
{:else if score > 40 && score < 75}
	<p>You are passed!</p>
{:else if score >= 75}
	<p>Excellent Score!</p>
{:else}
	<p>Invalid Score!</p>
{/if}

<!-- SNIPPETS -->
{#snippet userCard(user)}
	<section>
		<ul>
			<li>
				<h3>Name: {user.name}</h3>
				<p>Age: {user.age}</p>
				<p>Role: {user.role}</p>
			</li>
		</ul>
	</section>
{/snippet}

{#each users as user}
	{@render userCard(user)}
{/each}

<!-- EFFECTS -->
<section>
	<h3>Count: {countVal}</h3>
	<button onclick={() => countVal++}>Increase Count</button>

	<h3>See the titlebar in your browser: {theUser}</h3>
	<input type="text" bind:value={theUser} />
</section>
