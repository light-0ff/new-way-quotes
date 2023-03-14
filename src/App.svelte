<script>
import SymbolsTableWidget from "./components/symbolsTableWidget/SymbolsTableWidget.svelte";
export let widgetName;
export let options;
import { widgetNames } from "./constatns/widgetNames";
import AssetGroupWidget from "./components/assetGroupsWidget/AssetsGroupWidget.svelte";
</script>

{#if widgetName === widgetNames.ASSET_GROUPS_WIDGET}
  <AssetGroupWidget options="{options}" />
{/if}
{#if widgetName === widgetNames.SYMBOLS_TABLE_WIDGET}
  <SymbolsTableWidget options="{options}" />
{/if}
{#if widgetName === widgetNames.CHART_WIDGET}
  <h3>Chart widget</h3>
{/if}
{#if widgetName === widgetNames.QUOTES_SYMBOLS_WIDGET}
  <h3>Quotes Symbols widget</h3>
{/if}
{#if widgetName === widgetNames.SYMBOLS_CAROUSEL_WIDGET}
  <h3>Symbols Carousel widget</h3>
{/if}
