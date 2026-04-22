<script lang="ts">
	import { tasks, type Task } from '$lib/stores/tasks';
	import { auth } from '$lib/stores/auth';
	import TaskCard from './TaskCard.svelte';
	import TaskForm from './TaskForm.svelte';
	import { onMount } from 'svelte';

	let showForm = $state(false);

	onMount(() => {
		if ($auth.user) {
			tasks.fetch();
		}
	});

	$effect(() => {
		if ($auth.user) {
			tasks.fetch();
		}
	});

	let todoTasks = $derived($tasks.tasks.filter((t) => t.status === 'todo' && !t.isDeleted));
	let inProgressTasks = $derived(
		$tasks.tasks.filter((t) => t.status === 'in progress' && !t.isDeleted)
	);
	let doneTasks = $derived($tasks.tasks.filter((t) => t.status === 'done' && !t.isDeleted));
</script>

<div class="max-w-6xl mx-auto px-4 py-8">
	<div class="flex items-center justify-between mb-8">
		<h2 class="text-2xl font-semibold">My Tasks</h2>
		{#if $auth.user}
			<button onclick={() => (showForm = true)} class="btn-primary">
				+ New Task
			</button>
		{/if}
	</div>

	{#if showForm}
		<TaskForm onclose={() => (showForm = false)} />
	{/if}

	{#if $tasks.loading}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
			<div class="card p-4">
				<div class="flex items-center gap-2 mb-4">
					<div class="w-2 h-2 rounded-full bg-[var(--text-tertiary)]"></div>
					<h3 class="font-medium">To Do</h3>
					<span class="text-sm text-[var(--text-tertiary)]">({todoTasks.length})</span>
				</div>
				<div class="space-y-3">
					{#each todoTasks as task (task._id)}
						<TaskCard {task} />
					{/each}
					{#if todoTasks.length === 0}
						<p class="text-sm text-[var(--text-tertiary)] text-center py-8">No tasks yet</p>
					{/if}
				</div>
			</div>

			<div class="card p-4">
				<div class="flex items-center gap-2 mb-4">
					<div class="w-2 h-2 rounded-full bg-[var(--warning)]"></div>
					<h3 class="font-medium">In Progress</h3>
					<span class="text-sm text-[var(--text-tertiary)]">({inProgressTasks.length})</span>
				</div>
				<div class="space-y-3">
					{#each inProgressTasks as task (task._id)}
						<TaskCard {task} />
					{/each}
					{#if inProgressTasks.length === 0}
						<p class="text-sm text-[var(--text-tertiary)] text-center py-8">No tasks yet</p>
					{/if}
				</div>
			</div>

			<div class="card p-4">
				<div class="flex items-center gap-2 mb-4">
					<div class="w-2 h-2 rounded-full bg-[var(--success)]"></div>
					<h3 class="font-medium">Done</h3>
					<span class="text-sm text-[var(--text-tertiary)]">({doneTasks.length})</span>
				</div>
				<div class="space-y-3">
					{#each doneTasks as task (task._id)}
						<TaskCard {task} />
					{/each}
					{#if doneTasks.length === 0}
						<p class="text-sm text-[var(--text-tertiary)] text-center py-8">No tasks yet</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>