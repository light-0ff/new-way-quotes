<script>
  import uPlot from "uplot";
  import { afterUpdate } from "svelte";
  import { mainStore } from "../../store";
  import { getCandleChartOptions } from "./chart-configs";
  import { widgetNames } from "../../constatns/widgetNames";
  import ChartWidgetWrapper from "./ChartWidgetWrapper.svelte";
  import {
    getMinMaxData,
  } from "./chart-utils";
  import ChartWidgetDateButtons from "./ChartWidgetDateButtons.svelte";
  import "./chartWidget.css";
  import "uplot/dist/uPlot.min.css";
  import { getChartData } from "./getChartData";
  import { defaultChartOptions } from "./chart-constants";

  export let widgetOptions;


  const chartOptions = {...widgetOptions.chartOptions, ...defaultChartOptions};
  let chartElement;
  let chart;
  let { chartData, chartDataLoading, chartDataError } = {};
  let { interval } = chartOptions;

  $:{
    getChartData({...chartOptions, interval});
  }

  mainStore.subscribe((store) => {
    chartData = store[widgetNames.CHART_WIDGET].data;
    chartDataLoading = store[widgetNames.CHART_WIDGET].loading;
    chartDataError = store[widgetNames.CHART_WIDGET].error;
  });

  const renderChart = () => {
    if (!chartElement) return;
    // if chart exist destroy previous
    if (chart) chart.destroy();

    const { min, max } = getMinMaxData(chartData);
    const options = getCandleChartOptions({
      min,
      max,
      chartConfigs: { height: 300, width: 600 },
    });
    chart = new uPlot(options, chartData, chartElement);
  };

  afterUpdate(async () => {
    await renderChart();
  });
</script>

<div class="chart-widget">
  <h3>Chart widget</h3>
   <ChartWidgetDateButtons bind:interval />
  <ChartWidgetWrapper {chartDataLoading} {chartDataError}>
    {#key interval}
      <div bind:this={chartElement} class="chart-widget" id="chart-widget"></div>
    {/key}
   </ChartWidgetWrapper>
</div>

<style>
  .chart-widget {
    width: 100vh;
  }
</style>
