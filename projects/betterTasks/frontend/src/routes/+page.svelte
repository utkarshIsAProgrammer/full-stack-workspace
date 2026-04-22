<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		if ($auth.user) {
			goto('/dashboard');
		}
	});

	let email = $state('');
	let password = $state('');
	let isLogin = $state(true);
	let loading = $state(false);

	async function handleSubmit() {
		loading = true;
		let success: boolean;
		if (isLogin) {
			success = await auth.login(email, password);
		} else {
			success = await auth.signup(email, password);
		}
		loading = false;
		if (success) {
			goto('/dashboard');
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center px-4">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold tracking-tight">betterTasks</h1>
			<p class="text-[var(--text-secondary)] mt-2">Manage your tasks beautifully</p>
		</div>

		<div class="card p-8">
			<h2 class="text-xl font-semibold mb-6">{isLogin ? 'Welcome back' : 'Create account'}</h2>

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
				<div>
					<label class="text-sm text-[var(--text-secondary)]">Email</label>
					<input
						type="email"
						bind:value={email}
						placeholder="you@example.com"
						class="w-full mt-1 px-4 py-2.5 rounded-lg"
						required
					/>
				</div>

				<div>
					<label class="text-sm text-[var(--text-secondary)]">Password</label>
					<input
						type="password"
						bind:value={password}
						placeholder="••••••••"
						class="w-full mt-1 px-4 py-2.5 rounded-lg"
						required
					/>
				</div>

				{#if $auth.error}
					<p class="text-sm text-[var(--danger)]">{$auth.error}</p>
				{/if}

				<button type="submit" disabled={loading} class="btn-primary w-full py-2.5">
					{#if loading}
						<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
					{:else}
						{isLogin ? 'Sign In' : 'Create Account'}
					{/if}
				</button>
			</form>

			<p class="text-center text-sm text-[var(--text-secondary)] mt-6">
				{isLogin ? "Don't have an account?" : 'Already have an account?'}
				<button
					onclick={() => { isLogin = !isLogin; auth.logout(); }}
					class="text-[var(--accent)] hover:underline ml-1"
				>
					{isLogin ? 'Sign up' : 'Sign in'}
				</button>
			</p>
		</div>
	</div>
</div>