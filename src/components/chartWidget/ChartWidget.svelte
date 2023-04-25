<script>
  import uPlot from "uplot";
  import axios from "axios";
  import { onMount, afterUpdate } from "svelte";
  import { mainStore } from "../../store";
  import { getCandleChartOptions } from "./chart-configs";
  import { widgetNames } from "../../constatns/widgetNames";
  import ChartWidgetWrapper from "./ChartWidgetWrapper.svelte";
  import {
    convertApiResponseToChartData,
    getMinMaxData,
    normalizeApiResponse,
  } from "./chart-utils";
  import ChartWidgetDateButtons from "./ChartWidgetDateButtons.svelte";
  import "./chartWidget.css";
  import "uplot/dist/uPlot.min.css";

  export let widgetOptions;
  export let chartElement;

  const chartOptions = {};
  let chart;
  let { chartData, chartDataLoading, chartDataError } = {};
  let symbol = "BTC";
  let interval = "1d";
  let limit = "100";

  onMount(() => {
    console.log(">>>widgetOptions", widgetOptions);
  });

  mainStore.subscribe((store) => {
    chartData = store[widgetNames.CHART_WIDGET].data;
    chartDataLoading = store[widgetNames.CHART_WIDGET].loading;
    chartDataError = store[widgetNames.CHART_WIDGET].error;
  });

  const renderChart = async () => {
    if (!chartElement) return;
    console.log(interval)
    const responce = await axios
      .get(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&startTime=1677695844000&limit=${limit}`
      )
      .then((res) => {
        return normalizeApiResponse(res);
      });
    // const serializedChartData = convertApiResponseToChartData(chartData.slice(1,4));
    const { min, max } = getMinMaxData(responce);
    const options = getCandleChartOptions({
      min,
      max,
      chartConfigs: { height: 300, width: 600 },
    });
    chart = new uPlot(options, responce, chartElement);
  };

  afterUpdate(async () => {
    await renderChart();
  });
</script>

<div class="chart-widget">
  <h3>Chart widget</h3>
  <!-- <ChartWidgetWrapper {chartDataLoading} {chartDataError}> -->
  <div>Period buttons</div>
  <ChartWidgetDateButtons bind:interval />
  <div>Chart type buttons</div>
  {#key interval}
    <div bind:this={chartElement} class="chart-widget" id={"chart-widget"} />
  {/key}
  <!-- </ChartWidgetWrapper> -->
</div>

<style>
  .chart-widget {
    width: 100vh;
  }
</style>
