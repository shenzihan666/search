<script>
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import SearchBox from './lib/components/SearchBox.svelte';
  import ResultPanel from './lib/components/ResultPanel.svelte';
  import ConfigModal from './lib/components/ConfigModal.svelte';

  let prompt = $state('');
  let response = $state('');
  let isLoading = $state(false);
  let error = $state('');
  let showConfig = $state(false);
  let hasApiKey = $state(false);
  let isHiding = $state(false);

  onMount(async () => {
    // Listen for streaming chunks
    const unlistenChunk = await listen('query:chunk', (event) => {
      response += event.payload;
    });

    // Listen for completion
    const unlistenComplete = await listen('query:complete', () => {
      isLoading = false;
    });

    // Check if API key is configured
    try {
      const config = await invoke('get_config');
      hasApiKey = !!config.api_key;
      if (!hasApiKey) {
        showConfig = true;
      }
    } catch (e) {
      console.error('Failed to get config:', e);
    }

    return () => {
      unlistenChunk();
      unlistenComplete();
    };
  });

  async function handleSubmit() {
    if (!prompt.trim() || isLoading) return;

    isLoading = true;
    error = '';
    response = '';

    try {
      await invoke('query_stream', { prompt: prompt.trim() });
    } catch (e) {
      error = typeof e === 'string' ? e : 'Failed to get response';
      isLoading = false;
    }
  }

  async function handleKeydown(e) {
    if (e.key === 'Escape' && !isHiding) {
      e.preventDefault();
      e.stopPropagation();
      isHiding = true;
      try {
        await getCurrentWindow().hide();
      } finally {
        // Reset after a short delay to prevent immediate re-trigger
        setTimeout(() => {
          isHiding = false;
        }, 100);
      }
      return;
    }
    // Ctrl+, to open config
    if (e.key === ',' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      showConfig = true;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="app">
  <header class="header">
    <h1>AI Quick Search</h1>
    <button
      class="config-btn"
      onclick={() => showConfig = true}
      title="Settings (Ctrl+,)"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
  </header>

  <SearchBox
    bind:value={prompt}
    {isLoading}
    onsubmit={handleSubmit}
  />

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <ResultPanel {response} {isLoading} />
</div>

{#if showConfig}
  <ConfigModal
    onclose={() => showConfig = false}
    onsaved={() => hasApiKey = true}
  />
{/if}

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 16px;
    gap: 12px;
    background: rgba(15, 15, 15, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 12px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header h1 {
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }
  .config-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: background 0.2s, color 0.2s;
  }
  .config-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }
  .error {
    color: #ef4444;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    font-size: 14px;
  }
</style>
