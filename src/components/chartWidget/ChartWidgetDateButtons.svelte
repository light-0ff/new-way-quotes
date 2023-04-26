<script>
  export let period;
</script>


<!--TODO: Create periods object ex: {name: 'day', interval: '1h'}-->
<!--TODO: refactor using https://svelte.dev/docs#template-syntax-each -->
<!--TODO: Add year period -->



<button class:selected={period === "d"} on:click={() => (period = "d")}>Day</button>

<button class:selected={period === "w"} on:click={() => (period = "w")}>Week</button>

<button class:selected={period === "m"} on:click={() => (period = "m")}>Month</button>

<style>
  .selected {
    background-color: #ff3e00;
    color: white;
  }
</style>
