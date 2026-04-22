<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { theme } from '$lib/stores/theme';
	import { auth } from '$lib/stores/auth';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		theme.subscribe((t) => {
			if (t === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
			localStorage.setItem('theme', t);
		});
		
		auth.init();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
	<title>betterTasks</title>
</svelte:head>

<div class="min-h-screen bg-[var(--bg-primary)]">
	{@render children()}
</div>