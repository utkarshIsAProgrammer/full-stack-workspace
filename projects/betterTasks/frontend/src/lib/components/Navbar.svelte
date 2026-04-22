<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { tasks } from '$lib/stores/tasks';
	import { goto } from '$app/navigation';

	function handleLogout() {
		auth.logout();
		tasks.clear();
		goto('/');
	}
</script>

<nav class="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
	<div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
		<h1 class="text-xl font-semibold tracking-tight">betterTasks</h1>
		{#if $auth.user}
			<div class="flex items-center gap-4">
				<span class="text-sm text-[var(--text-secondary)]">{$auth.user.email}</span>
				<button onclick={handleLogout} class="btn-secondary text-sm">Logout</button>
			</div>
		{/if}
	</div>
</nav>