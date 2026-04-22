<script lang="ts">
	import { tasks } from '$lib/stores/tasks';

	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	let title = $state('');
	let description = $state('');
	let status = $state<'todo' | 'in progress' | 'done'>('todo');
	let priority = $state<'low' | 'medium' | 'high'>('medium');
	let dueDate = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit() {
		if (!title.trim()) {
			error = 'Title is required';
			return;
		}

		loading = true;
		const result = await tasks.create({
			title,
			description,
			status,
			priority,
			dueDate: dueDate ? new Date(dueDate).toISOString() : new Date().toISOString()
		});

		loading = false;
		if (result) {
			onclose();
		} else {
			error = 'Failed to create task';
		}
	}
</script>

<div class="card p-6 mb-6">
	<h3 class="text-lg font-medium mb-4">New Task</h3>
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
		<div>
			<label class="text-sm text-[var(--text-secondary)]">Title</label>
			<input
				type="text"
				bind:value={title}
				placeholder="Enter task title"
				class="w-full mt-1 px-4 py-2 rounded-lg"
			/>
		</div>

		<div>
			<label class="text-sm text-[var(--text-secondary)]">Description</label>
			<textarea
				bind:value={description}
				placeholder="Optional description"
				rows="2"
				class="w-full mt-1 px-4 py-2 rounded-lg resize-none"
			></textarea>
		</div>

		<div class="grid grid-cols-3 gap-4">
			<div>
				<label class="text-sm text-[var(--text-secondary)]">Status</label>
				<select bind:value={status} class="w-full mt-1 px-4 py-2 rounded-lg">
					<option value="todo">To Do</option>
					<option value="in progress">In Progress</option>
					<option value="done">Done</option>
				</select>
			</div>

			<div>
				<label class="text-sm text-[var(--text-secondary)]">Priority</label>
				<select bind:value={priority} class="w-full mt-1 px-4 py-2 rounded-lg">
					<option value="low">Low</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
				</select>
			</div>

			<div>
				<label class="text-sm text-[var(--text-secondary)]">Due Date</label>
				<input
					type="date"
					bind:value={dueDate}
					class="w-full mt-1 px-4 py-2 rounded-lg"
				/>
			</div>
		</div>

		{#if error}
			<p class="text-sm text-[var(--danger)]">{error}</p>
		{/if}

		<div class="flex gap-3 pt-2">
			<button type="submit" disabled={loading} class="btn-primary">
				{#if loading}
					<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
				{:else}
					Create Task
				{/if}
			</button>
			<button type="button" onclick={onclose} class="btn-secondary">Cancel</button>
		</div>
	</form>
</div>