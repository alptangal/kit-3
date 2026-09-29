<script lang="ts">
  import { RadioGroupRoot, RadioGroupLabel, RadioGroupItem } from '$lib/components/form/radiogroup';

  let size = $state<string | null>(null);
  let color = $state<string | null>(null);
  let orientation = $state<'vertical' | 'horizontal'>('vertical');

  function handleReset() {
    size = null;
    color = null;
  }
</script>

<div class="demo-container">
  <h1>RadioGroup Component</h1>

  <section class="demo-section">
    <h2>Single Select - Size</h2>
    <p class="description">Select a shirt size using vertical layout:</p>

    <RadioGroupRoot bind:value={size}>
      <RadioGroupLabel for="radiogroup-size">Shirt Size</RadioGroupLabel>
      <fieldset class="radio-group-vertical">
        <RadioGroupItem id="size-xs" label="Extra Small (XS)" />
        <RadioGroupItem id="size-sm" label="Small (S)" />
        <RadioGroupItem id="size-md" label="Medium (M)" />
        <RadioGroupItem id="size-lg" label="Large (L)" />
        <RadioGroupItem id="size-xl" label="Extra Large (XL)" />
      </fieldset>
    </RadioGroupRoot>

    <div class="state-display">
      <p>Selected: <strong>{size || 'None'}</strong></p>
    </div>
  </section>

  <section class="demo-section">
    <h2>Horizontal Layout - Color</h2>
    <p class="description">Select a color using horizontal layout:</p>

    <RadioGroupRoot bind:value={color} orientation="horizontal">
      <RadioGroupLabel for="radiogroup-color">Favorite Color</RadioGroupLabel>
      <fieldset class="radio-group-horizontal">
        <RadioGroupItem id="color-red" label="Red" />
        <RadioGroupItem id="color-blue" label="Blue" />
        <RadioGroupItem id="color-green" label="Green" />
        <RadioGroupItem id="color-purple" label="Purple" />
      </fieldset>
    </RadioGroupRoot>

    <div class="state-display">
      <p>Selected: <strong>{color || 'None'}</strong></p>
    </div>
  </section>

  <section class="demo-section">
    <h2>Disabled Items</h2>
    <p class="description">Some options can be disabled:</p>

    <RadioGroupRoot bind:value={size}>
      <fieldset class="radio-group-vertical">
        <RadioGroupItem id="disabled-xs" label="Extra Small (XS)" />
        <RadioGroupItem id="disabled-sm" label="Small (S) - Out of Stock" disabled />
        <RadioGroupItem id="disabled-md" label="Medium (M)" />
        <RadioGroupItem id="disabled-lg" label="Large (L) - Out of Stock" disabled />
        <RadioGroupItem id="disabled-xl" label="Extra Large (XL)" />
      </fieldset>
    </RadioGroupRoot>
  </section>

  <section class="demo-section">
    <h2>Keyboard Navigation Guide</h2>
    <div class="keyboard-guide">
      <ul>
        <li><kbd>Tab</kbd> - Move to next radio button</li>
        <li><kbd>Shift + Tab</kbd> - Move to previous radio button</li>
        <li><kbd>Arrow Right / Down</kbd> - Move to next option (horizontal/vertical)</li>
        <li><kbd>Arrow Left / Up</kbd> - Move to previous option</li>
        <li><kbd>Space</kbd> - Select focused option</li>
        <li><kbd>Home</kbd> - Jump to first option</li>
        <li><kbd>End</kbd> - Jump to last option</li>
      </ul>
    </div>
  </section>

  <section class="demo-section">
    <h2>Manual Test Checklist</h2>
    <div class="checklist">
      <label>
        <input type="checkbox" disabled />
        Select option with mouse click
      </label>
      <label>
        <input type="checkbox" disabled />
        Arrow key navigation updates focus
      </label>
      <label>
        <input type="checkbox" disabled />
        Space key selects focused option
      </label>
      <label>
        <input type="checkbox" disabled />
        Disabled options cannot be selected
      </label>
      <label>
        <input type="checkbox" disabled />
        Tab focuses first radio button
      </label>
      <label>
        <input type="checkbox" disabled />
        Horizontal layout displays inline
      </label>
      <label>
        <input type="checkbox" disabled />
        Selected option visually highlighted
      </label>
      <label>
        <input type="checkbox" disabled />
        Supports screen reader (radio role)
      </label>
    </div>
  </section>

  <section class="demo-section">
    <button onclick={handleReset} class="reset-button">Reset All</button>
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

  .radio-group-vertical {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
    border: none;
    padding: 0;
  }

  .radio-group-horizontal {
    display: flex;
    flex-direction: row;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
    border: none;
    padding: 0;
  }

  .state-display {
    padding: 1rem;
    background-color: var(--color-surface-accent);
    border-radius: 6px;
    border-top: 2px solid var(--color-primary);
  }

  .state-display p {
    margin: 0;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.9rem;
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
    min-width: 80px;
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

  .reset-button {
    padding: 0.75rem 1.5rem;
    background-color: var(--color-primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 100ms ease;
  }

  .reset-button:hover {
    background-color: var(--color-primary-hover);
  }

  .reset-button:active {
    transform: scale(0.98);
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
      --color-primary-hover: #0284c7;
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
      --color-primary-hover: #2563eb;
      --color-info: #0ea5e9;
    }
  }
</style>
