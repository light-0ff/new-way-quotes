<script>
  export let interval;
</script>

<button class:selected={interval === "1d"} on:click={() => (interval = "1d")}>Day</button>

<button class:selected={interval === "1w"} on:click={() => (interval = "1w")}>Week</button>

<button class:selected={interval === "1m"} on:click={() => (interval = "1m")}>Month</button>

<style>
  .selected {
    background-color: #ff3e00;
    color: white;
  }
</style>
