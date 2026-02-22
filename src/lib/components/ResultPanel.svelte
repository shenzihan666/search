<script>
  let { response = '', isLoading = false } = $props();
</script>

<div class="result-panel">
  {#if isLoading && !response}
    <div class="loading">
      <div class="spinner"></div>
      <span>Thinking...</span>
    </div>
  {:else if response}
    <div class="response">
      {response}
      {#if isLoading}
        <span class="cursor">▊</span>
      {/if}
    </div>
  {:else}
    <div class="empty">
      <div class="icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
      <p>Press <kbd>Alt</kbd>+<kbd>Space</kbd> to toggle</p>
      <p class="hint">Press <kbd>Ctrl</kbd>+<kbd>,</kbd> for settings</p>
    </div>
  {/if}
</div>

<style>
  .result-panel {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .loading {
    display: flex;
    align-items: center;
    gap: 12px;
    color: rgba(255, 255, 255, 0.6);
    padding: 20px;
  }
  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .response {
    white-space: pre-wrap;
    line-height: 1.7;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.9);
  }
  .cursor {
    animation: blink 1s infinite;
    color: #6366f1;
  }
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  .empty {
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .icon {
    margin-bottom: 8px;
    opacity: 0.5;
  }
  p {
    margin: 0;
    font-size: 14px;
  }
  .hint {
    font-size: 12px;
    opacity: 0.6;
  }
  kbd {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
  }
</style>
