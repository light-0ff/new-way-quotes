<script>
    export let chartDataLoading;
    export let chartDataError;
</script>

<div class="chart-wrapper">
    {#if !chartDataLoading && chartDataError.length === 0 }
        <slot></slot>
    {/if}
    {#if chartDataLoading}
        <div class="chart-wrapper__loading">Loading....</div>
    {/if}
    {#if chartDataError.length > 0}
        <div class="chart-wrapper__error">Error: {chartDataError}</div>
    {/if}
</div>
