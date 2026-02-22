<script>
  let { value = $bindable(''), isLoading = false, onsubmit } = $props();

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onsubmit?.();
    }
  }
</script>

<div class="search-box">
  <input
    type="text"
    bind:value
    onkeydown={handleKeydown}
    placeholder="Ask anything... (Enter to send)"
    disabled={isLoading}
    class="input"
  />
  <button
    type="button"
    onclick={() => onsubmit?.()}
    disabled={isLoading || !value.trim()}
    class="btn"
  >
    {#if isLoading}
      <span class="loading">●●●</span>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    {/if}
  </button>
</div>

<style>
  .search-box {
    display: flex;
    gap: 8px;
  }
  .input {
    flex: 1;
    padding: 14px 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    color: white;
    font-size: 15px;
    outline: none;
    transition: border-color 0.2s, background 0.2s;
  }
  .input:focus {
    border-color: rgba(99, 102, 241, 0.5);
    background: rgba(255, 255, 255, 0.08);
  }
  .input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  .input:disabled {
    opacity: 0.7;
  }
  .btn {
    padding: 14px 18px;
    border: none;
    border-radius: 12px;
    background: #6366f1;
    color: white;
    cursor: pointer;
    transition: background 0.2s, opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .btn:hover:not(:disabled) {
    background: #4f46e5;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .loading {
    font-size: 12px;
    animation: pulse 1s infinite;
    letter-spacing: 2px;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
</style>
