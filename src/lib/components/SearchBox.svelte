<script>
  let {
    value = $bindable(''),
    isLoading = false,
    placeholder = 'Ask anything... (Enter to send)',
    onsubmit
  } = $props();

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
    placeholder={placeholder}
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
      <span class="loading">...</span>
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
    gap: 12px;
    width: 100%;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    padding: 8px;
  }

  @media (prefers-color-scheme: dark) {
    .search-box {
      background: rgba(20, 20, 20, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
  }

  .input {
    flex: 1;
    padding: 16px 24px;
    border: none;
    border-radius: 16px;
    background: transparent;
    color: #1a1a1a;
    font-size: 16px;
    outline: none;
    transition: all 0.2s ease;
  }

  @media (prefers-color-scheme: dark) {
    .input {
      color: #ffffff;
    }
  }

  .input:focus {
    background: rgba(255, 255, 255, 0.3);
  }

  @media (prefers-color-scheme: dark) {
    .input:focus {
      background: rgba(0, 0, 0, 0.2);
    }
  }

  .input::placeholder {
    color: rgba(0, 0, 0, 0.4);
  }

  @media (prefers-color-scheme: dark) {
    .input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }
  }

  .input:disabled {
    opacity: 0.7;
  }

  .btn {
    padding: 16px 20px;
    border: none;
    border-radius: 16px;
    background: #1a1a1a;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (prefers-color-scheme: dark) {
    .btn {
      background: #ffffff;
      color: #1a1a1a;
    }
  }

  .btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .btn:active:not(:disabled) {
    transform: translateY(1px);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .loading {
    font-size: 12px;
    animation: pulse 1s infinite;
    letter-spacing: 2px;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }

    50% {
      opacity: 0.3;
    }
  }
</style>
