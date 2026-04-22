<script lang="ts">
	import { tasks, type Task } from '$lib/stores/tasks';

	interface Props {
		task: Task;
	}

	let { task }: Props = $props();

	let editing = $state(false);
	let title = $state(task.title);
	let description = $state(task.description || '');

	function formatDate(date: string) {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}

	function priorityColor(p: string) {
		switch (p) {
			case 'high':
				return 'text-[var(--danger)]';
			case 'medium':
				return 'text-[var(--warning)]';
			default:
				return 'text-[var(--text-tertiary)]';
		}
	}

	async function handleUpdate() {
		await tasks.update(task._id, { title, description });
		editing = false;
	}

	async function handleStatusChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		await tasks.update(task._id, { status: target.value as any });
	}

	async function handleDelete() {
		if (confirm('Delete this task?')) {
			await tasks.delete(task._id);
		}
	}
</script>

<div class="card p-4 space-y-3 group hover:border-[var(--accent)] transition-colors">
	{#if editing}
		<div class="space-y-3">
			<input
				type="text"
				bind:value={title}
				class="w-full px-3 py-2 rounded-lg text-sm"
			/>
			<textarea
				bind:value={description}
				class="w-full px-3 py-2 rounded-lg text-sm resize-none"
				rows="2"
			></textarea>
			<div class="flex gap-2">
				<button onclick={handleUpdate} class="btn-primary text-sm py-1">Save</button>
				<button onclick={() => (editing = false)} class="btn-secondary text-sm py-1">Cancel</button>
			</div>
		</div>
	{:else}
		<div class="flex items-start justify-between">
			<button onclick={() => (editing = true)} class="text-left">
				<h4 class="font-medium text-sm">{task.title}</h4>
				{#if task.description}
					<p class="text-xs text-[var(--text-secondary)] mt-1">{task.description}</p>
				{/if}
			</button>
			<button onclick={handleDelete} class="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-all">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="flex items-center justify-between text-xs">
			<div class="flex items-center gap-2">
				<span class={priorityColor(task.priority)}>{task.priority}</span>
				<span class="text-[var(--text-tertiary)]">{formatDate(task.dueDate)}</span>
			</div>
			<select
				value={task.status}
				onchange={handleStatusChange}
				class="text-xs bg-transparent border border-[var(--border)] rounded px-2 py-1"
			>
				<option value="todo">To Do</option>
				<option value="in progress">In Progress</option>
				<option value="done">Done</option>
			</select>
		</div>
	{/if}
</div>