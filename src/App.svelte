<script>
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import SearchBox from './lib/components/SearchBox.svelte';
  import ResultPanel from './lib/components/ResultPanel.svelte';

  let prompt = $state('');
  let response = $state('');
  let isLoading = $state(false);
  let error = $state('');
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
      if (!config.api_key) {
        error = 'Please configure API key from system tray';
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
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="app">
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

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 12px;
    gap: 8px;
    background: rgba(15, 15, 15, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 12px;
  }
  .error {
    color: #ef4444;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    font-size: 12px;
  }
</style>
