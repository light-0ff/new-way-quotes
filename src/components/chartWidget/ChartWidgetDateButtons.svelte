<script>
  export let period;
  import { periodOptions } from "./chart-constants";
</script>

{#each periodOptions as { id, name }}
  <button class:selected={period === id} on:click={() => (period = id)}>{name}</button>
{/each}

<style>
  .selected {
    background-color: #ff3e00;
    color: white;
  }
</style>
