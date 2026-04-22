import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface User {
	id: string;
	email: string;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<{
		user: User | null;
		loading: boolean;
		error: string | null;
	}>({
		user: null,
		loading: false,
		error: null
	});

	return {
		subscribe,
		async init() {
			const token = browser ? localStorage.getItem('token') : null;
			if (token) {
				try {
					const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
						headers: { Authorization: `Bearer ${token}` },
						credentials: 'include'
					});
					if (res.ok) {
						const data = await res.json();
						set({ user: data.user, loading: false, error: null });
					} else {
						browser && localStorage.removeItem('token');
						set({ user: null, loading: false, error: null });
					}
				} catch {
					set({ user: null, loading: false, error: null });
				}
			}
		},
		async login(email: string, password: string) {
			update((s) => ({ ...s, loading: true, error: null }));
			try {
				const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ email, password })
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Login failed');
				browser && localStorage.setItem('token', data.token);
				set({ user: { id: data._id, email: data.email }, loading: false, error: null });
				return true;
			} catch (e: any) {
				update((s) => ({ ...s, loading: false, error: e.message }));
				return false;
			}
		},
		async signup(email: string, password: string) {
			update((s) => ({ ...s, loading: true, error: null }));
			try {
				const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/signup`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ email, password })
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Signup failed');
				browser && localStorage.setItem('token', data.token);
				set({ user: { id: data._id, email: data.email }, loading: false, error: null });
				return true;
			} catch (e: any) {
				update((s) => ({ ...s, loading: false, error: e.message }));
				return false;
			}
		},
		logout() {
			browser && localStorage.removeItem('token');
			set({ user: null, loading: false, error: null });
		}
	};
}

export const auth = createAuthStore();