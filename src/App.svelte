<script>
import ChartWidget from "./components/chartWidget/ChartWidget.svelte";

export let widgetName;
export let widgetOptions;
import { widgetNames } from "./constatns/widgetNames";
</script>

{#if widgetName === widgetNames.CHART_WIDGET}
  <ChartWidget widgetOptions = {widgetOptions} />
{/if}
