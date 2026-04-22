import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface Task {
	_id: string;
	title: string;
	description?: string;
	status: 'todo' | 'in progress' | 'done';
	priority: 'low' | 'medium' | 'high';
	dueDate: string;
	isDeleted: boolean;
	createdAt: string;
	updatedAt: string;
}

function getToken() {
	let token = '';
	if (browser) {
		token = localStorage.getItem('token') || '';
	}
	return token;
}

function createTaskStore() {
	const { subscribe, set, update } = writable<{
		tasks: Task[];
		loading: boolean;
		error: string | null;
	}>({
		tasks: [],
		loading: false,
		error: null
	});

	return {
		subscribe,
		async fetch() {
			update((s) => ({ ...s, loading: true, error: null }));
			try {
				const res = await fetch(`${import.meta.env.VITE_API_URL}/api/tasks`, {
					headers: { Authorization: `Bearer ${getToken()}` },
					credentials: 'include'
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Failed to fetch tasks');
				update((s) => ({ ...s, tasks: data.tasks || [], loading: false }));
			} catch (e: any) {
				update((s) => ({ ...s, loading: false, error: e.message }));
			}
		},
		async create(task: Partial<Task>) {
			update((s) => ({ ...s, loading: true }));
			try {
				const res = await fetch(`${import.meta.env.VITE_API_URL}/api/tasks`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${getToken()}`
					},
					credentials: 'include',
					body: JSON.stringify(task)
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Failed to create task');
				update((s) => ({ ...s, tasks: [...s.tasks, data.task], loading: false }));
				return data.task;
			} catch (e: any) {
				update((s) => ({ ...s, loading: false, error: e.message }));
				return null;
			}
		},
		async update(id: string, updates: Partial<Task>) {
			update((s) => ({ ...s, loading: true }));
			try {
				const res = await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/${id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${getToken()}`
					},
					credentials: 'include',
					body: JSON.stringify(updates)
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Failed to update task');
				update((s) => ({
					...s,
					tasks: s.tasks.map((t) => (t._id === id ? data.task : t)),
					loading: false
				}));
			} catch (e: any) {
				update((s) => ({ ...s, loading: false, error: e.message }));
			}
		},
		async delete(id: string) {
			update((s) => ({ ...s, loading: true }));
			try {
				const res = await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/${id}`, {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${getToken()}` },
					credentials: 'include'
				});
				if (!res.ok) {
					const data = await res.json();
					throw new Error(data.error || 'Failed to delete task');
				}
				update((s) => ({
					...s,
					tasks: s.tasks.filter((t) => t._id !== id),
					loading: false
				}));
			} catch (e: any) {
				update((s) => ({ ...s, loading: false, error: e.message }));
			}
		},
		clear() {
			set({ tasks: [], loading: false, error: null });
		}
	};
}

export const tasks = createTaskStore();