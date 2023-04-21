<script>
    import uPlot from "uplot";
    import axios from "axios";
    import { onMount, afterUpdate } from "svelte";
    import { mainStore } from "../../store";
    import { getChartData } from "./getChartData";
    import { getCandleChartOptions } from "./chart-configs";
    import { widgetNames } from "../../constatns/widgetNames";
    import ChartWidgetWrapper from "./ChartWidgetWrapper.svelte";
    import { convertApiResponseToChartData, getMinMaxData } from "./chart-utils";
    import "./chartWidget.css";
    import "uplot/dist/uPlot.min.css";
    import { mockData1 } from "./mocks";

    export let widgetOptions;
    export let chartElement;

    const chartOptions = {};
    let chart;
    let { chartData, chartDataLoading, chartDataError } = {};

    onMount(() => {
        console.log(">>>widgetOptions", widgetOptions);
        getChartData(chartOptions);
    });

    mainStore.subscribe((store) => {
        chartData = store[widgetNames.CHART_WIDGET].data;
        chartDataLoading = store[widgetNames.CHART_WIDGET].loading;
        chartDataError = store[widgetNames.CHART_WIDGET].error;
    });

    const renderChart = async () => {
        if (!chartElement) return;
        const responce = await axios
            .get(
                "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=1677695844000&limit=100"
            )
            .then((res) => {
                console.log("mock ", mockData1);
                console.log("data before ", res.data);
                let buffer = [[], [], [], [], [], []];
                res.data.forEach((element) => {
                    buffer[0].push(element[0]);
                    buffer[1].push(Number(element[1]));
                    buffer[2].push(Number(element[2]));
                    buffer[3].push(Number(element[3]));
                    buffer[4].push(Number(element[4]));
                    buffer[5].push(Number(element[5]));
                });
                console.log("data after ", buffer);
                return buffer;
            });
        // const serializedChartData = convertApiResponseToChartData(chartData.slice(1,4));
        const { min, max } = getMinMaxData(responce);
        const options = getCandleChartOptions({
            min,
            max,
            chartConfigs: { height: 300, width: 600 },
        });
        console.log(">>> options", options);
        console.log(">>>formalizedChartData", mockData1);
        chart = new uPlot(options, responce, chartElement);
    };

    afterUpdate(async () => {
        await renderChart();
    });
</script>

<div class="chart-widget">
    <h3>Chart widget</h3>
    <ChartWidgetWrapper {chartDataLoading} {chartDataError}>
        <div>Period buttons</div>
        <div>Chart type buttons</div>

        <div bind:this={chartElement} class="chart-widget" id={"chart-widget"} />
    </ChartWidgetWrapper>
</div>

<style>
    .chart-widget {
        width: 100vh;
    }
</style>
