<script>
  let { messages = [], isLoading = false } = $props();
  let panelEl = $state(null);

  $effect(() => {
    messages.length;
    isLoading;
    if (panelEl) {
      panelEl.scrollTop = panelEl.scrollHeight;
    }
  });
</script>

<div class="result-panel" bind:this={panelEl}>
  {#if messages.length === 0}
    <div class="empty">Start typing to begin</div>
  {:else}
    {#each messages as message, idx}
      <div class={`message ${message.role}`}>
        <div class="bubble">
          {message.content}
          {#if isLoading && message.role === 'assistant' && idx === messages.length - 1}
            <span class="cursor">|</span>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .result-panel {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    background: rgba(255, 255, 255, 0.4);
    border-radius: 16px;
    border: 1px solid rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.02);
  }

  @media (prefers-color-scheme: dark) {
    .result-panel {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.2);
    }
  }

  .message {
    display: flex;
    animation: slideIn 0.3s ease-out forwards;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .message.user {
    justify-content: flex-end;
  }

  .message.assistant {
    justify-content: flex-start;
  }

  .bubble {
    max-width: 85%;
    padding: 14px 18px;
    border-radius: 16px;
    white-space: pre-wrap;
    line-height: 1.6;
    font-size: 15px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .message.user .bubble {
    background: #1a1a1a;
    color: #ffffff;
    border-bottom-right-radius: 4px;
  }

  @media (prefers-color-scheme: dark) {
    .message.user .bubble {
      background: #ffffff;
      color: #1a1a1a;
    }
  }

  .message.assistant .bubble {
    background: rgba(255, 255, 255, 0.8);
    color: #1a1a1a;
    border-bottom-left-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }

  @media (prefers-color-scheme: dark) {
    .message.assistant .bubble {
      background: rgba(30, 30, 30, 0.8);
      color: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
  }

  .empty {
    margin: auto;
    color: rgba(0, 0, 0, 0.4);
    font-size: 14px;
    font-weight: 500;
  }

  @media (prefers-color-scheme: dark) {
    .empty {
      color: rgba(255, 255, 255, 0.4);
    }
  }

  .cursor {
    margin-left: 2px;
    color: #1a1a1a;
    animation: blink 1s infinite;
  }

  @media (prefers-color-scheme: dark) {
    .cursor {
      color: #ffffff;
    }
  }

  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }

    51%,
    100% {
      opacity: 0;
    }
  }
</style>
