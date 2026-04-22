<script lang="ts">
	import { theme } from '$lib/stores/theme';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { auth } from '$lib/stores/auth';
	import { tasks } from '$lib/stores/tasks';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		const token = localStorage.getItem('token');
		if (!token) {
			goto('/');
		}
	});

	function handleLogout() {
		auth.logout();
		tasks.clear();
		goto('/');
	}

	$effect(() => {
		if ($theme === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
		localStorage.setItem('theme', $theme);
	});
</script>

<div class="min-h-screen flex flex-col bg-[var(--bg-primary)]">
	<nav class="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
		<div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
			<a href="/dashboard" class="text-xl font-semibold tracking-tight">betterTasks</a>
			<div class="flex items-center gap-4">
				<ThemeToggle />
				{#if $auth.user}
					<span class="text-sm text-[var(--text-secondary)] hidden sm:inline">{$auth.user.email}</span>
					<button onclick={handleLogout} class="btn-secondary text-sm">Logout</button>
				{/if}
			</div>
		</div>
	</nav>

	<main class="flex-1">
		{@render children()}
	</main>
</div>