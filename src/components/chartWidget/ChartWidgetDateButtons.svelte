<script>
  export let interval;
  export let handleClick;
</script>

<button class:selected={interval === "d"} on:click={() => (interval = "d")}>Day</button>

<button class:selected={interval === "w"} on:click={() => (interval = "w")}>Week</button>

<button class:selected={interval === "m"} on:click={() => (interval = "m")} on:click={handleClick}>Month</button>

<style>
  .selected {
    background-color: #ff3e00;
    color: white;
  }
</style>
