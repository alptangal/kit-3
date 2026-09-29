<script lang="ts">
  import { Toggle, ToggleLabel } from '$lib/components/form/toggle';

  let notifications = $state(false);
  let darkMode = $state(false);
  let experimentalFeatures = $state(false);
  let isLoading = $state(false);

  async function handleNotificationsChange(checked: boolean) {
    isLoading = true;
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    notifications = checked;
    isLoading = false;
  }
</script>

<div class="demo-container">
  <h1>Toggle Component</h1>

  <section class="demo-section">
    <h2>Basic Toggle</h2>
    <p class="description">Simple on/off switch:</p>

    <div class="toggle-example">
      <Toggle bind:checked={darkMode}>
        <ToggleLabel>Dark Mode</ToggleLabel>
      </Toggle>
      <span class="state-indicator">{darkMode ? 'On' : 'Off'}</span>
    </div>
  </section>

  <section class="demo-section">
    <h2>Multiple Toggles</h2>
    <p class="description">Control multiple options:</p>

    <div class="toggle-list">
      <div class="toggle-item">
        <Toggle bind:checked={notifications}>
          <ToggleLabel>Email Notifications</ToggleLabel>
        </Toggle>
        <span class="state-text">{notifications ? 'Enabled' : 'Disabled'}</span>
      </div>

      <div class="toggle-item">
        <Toggle bind:checked={darkMode}>
          <ToggleLabel>Dark Theme</ToggleLabel>
        </Toggle>
        <span class="state-text">{darkMode ? 'Enabled' : 'Disabled'}</span>
      </div>

      <div class="toggle-item">
        <Toggle bind:checked={experimentalFeatures}>
          <ToggleLabel>Experimental Features</ToggleLabel>
        </Toggle>
        <span class="state-text">{experimentalFeatures ? 'Enabled' : 'Disabled'}</span>
      </div>
    </div>
  </section>

  <section class="demo-section">
    <h2>Disabled Toggle</h2>
    <p class="description">Toggle that cannot be changed:</p>

    <div class="toggle-example">
      <Toggle checked={true} disabled={true}>
        <ToggleLabel>Locked Feature</ToggleLabel>
      </Toggle>
      <span class="info-text">(Disabled - cannot toggle)</span>
    </div>
  </section>

  <section class="demo-section">
    <h2>Loading State</h2>
    <p class="description">Toggle with async operation:</p>

    <div class="toggle-example">
      <Toggle
        checked={notifications}
        loading={isLoading}
        onchange={handleNotificationsChange}
      >
        <ToggleLabel>
          {isLoading ? 'Saving...' : 'Push Notifications'}
        </ToggleLabel>
      </Toggle>
      <span class="state-text">{notifications ? 'Enabled' : 'Disabled'}</span>
    </div>
  </section>

  <section class="demo-section">
    <h2>Keyboard Navigation Guide</h2>
    <div class="keyboard-guide">
      <ul>
        <li><kbd>Tab</kbd> - Focus toggle button</li>
        <li><kbd>Space</kbd> - Toggle on/off</li>
        <li><kbd>Enter</kbd> - Toggle on/off</li>
      </ul>
    </div>
  </section>

  <section class="demo-section">
    <h2>Manual Test Checklist</h2>
    <div class="checklist">
      <label>
        <input type="checkbox" disabled />
        Click toggle to turn on/off
      </label>
      <label>
        <input type="checkbox" disabled />
        Space key toggles when focused
      </label>
      <label>
        <input type="checkbox" disabled />
        Tab navigates to toggle
      </label>
      <label>
        <input type="checkbox" disabled />
        Disabled toggle cannot be toggled
      </label>
      <label>
        <input type="checkbox" disabled />
        Toggle displays checked state visually
      </label>
      <label>
        <input type="checkbox" disabled />
        Supports screen reader (role=switch)
      </label>
      <label>
        <input type="checkbox" disabled />
        Loading state shows disabled appearance
      </label>
      <label>
        <input type="checkbox" disabled />
        Label text is clickable with toggle
      </label>
    </div>
  </section>
</div>

<style>
  .demo-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
      Arial, sans-serif;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 1.5rem;
    color: var(--color-text);
  }

  h2 {
    font-size: 1.5rem;
    margin-top: 2rem;
    margin-bottom: 1rem;
    color: var(--color-text);
  }

  .demo-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    border-radius: 8px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .description {
    margin: 0 0 1rem 0;
    color: var(--color-text-secondary);
    font-size: 0.95rem;
  }

  .toggle-example {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1rem;
    background-color: var(--color-surface-accent);
    border-radius: 6px;
  }

  .toggle-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .toggle-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: var(--color-surface-accent);
    border-radius: 6px;
  }

  .state-indicator,
  .state-text {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .info-text {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .keyboard-guide {
    background-color: var(--color-surface-accent);
    padding: 1rem;
    border-radius: 6px;
    border-top: 2px solid var(--color-info);
  }

  .keyboard-guide ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .keyboard-guide li {
    padding: 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  kbd {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.85rem;
    font-weight: 500;
    min-width: 60px;
    text-align: center;
  }

  .checklist {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .checklist label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    transition: background-color 100ms ease;
  }

  .checklist label:hover {
    background-color: var(--color-surface-hover);
  }

  .checklist input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--color-primary);
  }

  @media (prefers-color-scheme: dark) {
    :global(body) {
      --color-surface: #1e1e1e;
      --color-surface-hover: #2d2d2d;
      --color-surface-accent: #252525;
      --color-text: #e4e4e4;
      --color-text-secondary: #a0a0a0;
      --color-border: #3a3a3a;
      --color-primary: #0ea5e9;
      --color-info: #0ea5e9;
    }
  }

  @media (prefers-color-scheme: light) {
    :global(body) {
      --color-surface: #ffffff;
      --color-surface-hover: #f5f5f5;
      --color-surface-accent: #f9f9f9;
      --color-text: #1f2937;
      --color-text-secondary: #6b7280;
      --color-border: #e5e7eb;
      --color-primary: #3b82f6;
      --color-info: #0ea5e9;
    }
  }
</style>
