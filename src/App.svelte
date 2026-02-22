<script>
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
  import { onMount } from 'svelte';
  import Database from '@tauri-apps/plugin-sql';
  import SearchBox from './lib/components/SearchBox.svelte';
  import ResultPanel from './lib/components/ResultPanel.svelte';

  let prompt = $state('');
  let messages = $state([]);
  let isLoading = $state(false);
  let error = $state('');
  let isHiding = $state(false);
  let activeAssistantIndex = $state(-1);

  const DB_URL = 'sqlite:config.db';

  function buildConversationPrompt(userInput) {
    if (messages.length === 0) {
      return userInput;
    }

    const history = messages
      .filter((m) => m.content && m.content.trim())
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    return [
      'Continue this conversation using the full context and answer the latest user message directly.',
      history,
      `User: ${userInput}`,
      'Assistant:'
    ].join('\n\n');
  }

  async function loadAndSetConfig() {
    try {
      const db = await Database.load(DB_URL);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS config (
          id INTEGER PRIMARY KEY,
          data TEXT NOT NULL
        )
      `);

      const result = await db.select('SELECT data FROM config WHERE id = 1');
      if (result && result.length > 0) {
        const config = JSON.parse(result[0].data);
        await invoke('set_config', { config });
        return config;
      }
    } catch (e) {
      console.error('Failed to load config from database:', e);
    }

    return null;
  }

  onMount(async () => {
    await loadAndSetConfig();

    const unlistenChunk = await listen('query:chunk', (event) => {
      const chunk = typeof event.payload === 'string' ? event.payload : String(event.payload ?? '');
      if (activeAssistantIndex >= 0 && messages[activeAssistantIndex]) {
        messages[activeAssistantIndex].content += chunk;
      }
    });

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
    };
  });

  async function handleSubmit() {
    if (!prompt.trim() || isLoading) return;

    const userInput = prompt.trim();
    const fullPrompt = buildConversationPrompt(userInput);

    const nextAssistantIndex = messages.length + 1;
    messages = [
      ...messages,
      { role: 'user', content: userInput },
      { role: 'assistant', content: '' }
    ];

    // Resize window when conversation starts
    if (messages.length > 0) {
      try {
        const win = getCurrentWindow();
        await win.setSize(new LogicalSize(800, 600));
        
        // Re-center horizontally and keep top position
        const monitor = await win.currentMonitor();
        if (monitor) {
          const scaleFactor = monitor.scaleFactor;
          const width = 800 * scaleFactor;
          const x = (monitor.size.width - width) / 2;
          const y = monitor.size.height * 0.2;
          
          await win.setPosition(new PhysicalPosition(x, y));
        }
      } catch (e) {
        console.error('Failed to resize window:', e);
      }
    }

    prompt = '';
    error = '';
    isLoading = true;
    activeAssistantIndex = nextAssistantIndex;

    try {
      await invoke('query_stream', { prompt: fullPrompt });
    } catch (e) {
      error = typeof e === 'string' ? e : 'Failed to get response';

      if (messages[activeAssistantIndex] && !messages[activeAssistantIndex].content) {
        messages = messages.filter((_, idx) => idx !== activeAssistantIndex);
      }
    } finally {
      isLoading = false;
      activeAssistantIndex = -1;
    }
  }

  async function handleKeydown(e) {
    if (e.key === 'Escape' && !isHiding) {
      e.preventDefault();
      e.stopPropagation();
      isHiding = true;

      try {
        const win = getCurrentWindow();
        await win.hide();
        
        // Reset state and window size when hiding
        messages = [];
        prompt = '';
        error = '';
        await win.setSize(new LogicalSize(800, 200));
        
        const monitor = await win.currentMonitor();
        if (monitor) {
          const scaleFactor = monitor.scaleFactor;
          const width = 800 * scaleFactor;
          const x = (monitor.size.width - width) / 2;
          const y = monitor.size.height * 0.2;
          
          await win.setPosition(new PhysicalPosition(x, y));
        }
      } finally {
        setTimeout(() => {
          isHiding = false;
        }, 100);
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class={`app ${messages.length === 0 ? 'initial' : 'chat'}`}>
  {#if messages.length === 0}
    <div class="initial-search">
      <SearchBox
        bind:value={prompt}
        {isLoading}
        placeholder="输入问题，按 Enter 发送"
        onsubmit={handleSubmit}
      />
      {#if error}
        <div class="error">{error}</div>
      {/if}
    </div>
  {:else}
    <ResultPanel {messages} {isLoading} />

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <SearchBox
      bind:value={prompt}
      {isLoading}
      placeholder="继续追问，按 Enter 发送"
      onsubmit={handleSubmit}
    />
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 0;
    gap: 0;
    background: transparent;
    transition: background 0.3s ease;
    overflow: hidden;
  }

  .app.chat {
    padding: 16px;
    gap: 12px;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  @media (prefers-color-scheme: dark) {
    .app.chat {
      background: rgba(20, 20, 20, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
  }

  .app.initial {
    justify-content: center;
    padding: 16px; /* Add padding to prevent shadow clipping */
  }

  .initial-search {
    width: 100%;
    max-width: 700px;
    margin: 0 auto;
  }

  .error {
    margin-top: 8px;
    color: #ef4444;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    font-size: 12px;
  }
</style>
