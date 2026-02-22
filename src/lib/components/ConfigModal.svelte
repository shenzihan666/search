<script>
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';

  let { onclose, onsaved } = $props();

  let providerType = $state('openai');
  let apiKey = $state('');
  let model = $state('gpt-4o-mini');
  let isSaving = $state(false);
  let error = $state('');

  const openaiModels = [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast, Cheap)' },
    { value: 'gpt-4o', label: 'GPT-4o (Best)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ];

  const geminiModels = [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Fast)' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ];

  let models = $derived(providerType === 'gemini' ? geminiModels : openaiModels);

  onMount(async () => {
    try {
      const config = await invoke('get_config');
      apiKey = config.api_key || '';
      providerType = config.provider_type || 'openai';
      model = config.model || (providerType === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini');
    } catch (e) {
      console.error('Failed to load config:', e);
    }
  });

  function onProviderChange() {
    // Reset model when provider changes
    model = providerType === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini';
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      error = 'API key is required';
      return;
    }

    isSaving = true;
    error = '';

    try {
      await invoke('set_config', {
        config: {
          api_key: apiKey.trim(),
          model: model,
          provider_type: providerType,
        }
      });
      onsaved?.();
      onclose?.();
    } catch (e) {
      error = typeof e === 'string' ? e : 'Failed to save';
    } finally {
      isSaving = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      onclose?.();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="overlay" onclick={() => onclose?.()}>
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <h2>Settings</h2>

    <div class="field">
      <label for="provider">Provider</label>
      <select id="provider" bind:value={providerType} onchange={onProviderChange}>
        <option value="openai">OpenAI</option>
        <option value="gemini">Google Gemini</option>
      </select>
    </div>

    <div class="field">
      <label for="api-key">
        {#if providerType === 'gemini'}
          Gemini API Key
        {:else}
          OpenAI API Key
        {/if}
      </label>
      <input
        id="api-key"
        type="password"
        bind:value={apiKey}
        placeholder={providerType === 'gemini' ? 'AIza...' : 'sk-...'}
      />
      {#if providerType === 'gemini'}
        <a href="https://aistudio.google.com/app/apikey" target="_blank" class="hint">Get your Gemini API key</a>
      {/if}
    </div>

    <div class="field">
      <label for="model">Model</label>
      <select id="model" bind:value={model}>
        {#each models as m}
          <option value={m.value}>{m.label}</option>
        {/each}
      </select>
    </div>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <div class="actions">
      <button class="secondary" onclick={() => onclose?.()}>Cancel</button>
      <button onclick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: #1a1a1a;
    padding: 24px;
    border-radius: 16px;
    width: 100%;
    max-width: 400px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  h2 {
    margin: 0 0 20px;
    font-size: 18px;
    font-weight: 600;
  }
  .field {
    margin-bottom: 16px;
  }
  label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
  }
  input, select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    color: white;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }
  input:focus, select:focus {
    border-color: rgba(99, 102, 241, 0.5);
  }
  .hint {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: rgba(99, 102, 241, 0.8);
    text-decoration: none;
  }
  .hint:hover {
    color: #6366f1;
  }
  .error {
    color: #ef4444;
    font-size: 14px;
    margin-bottom: 16px;
  }
  .actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }
  button {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }
  button:not(.secondary) {
    background: #6366f1;
    color: white;
  }
  button:not(.secondary):hover:not(:disabled) {
    background: #4f46e5;
  }
  button.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  button.secondary:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
