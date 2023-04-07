<style>
    .chart-widget{
        width: 100vh;
    }
</style>

<script>
    import uPlot from "uplot";
    import {onMount, afterUpdate} from "svelte";
    import {mainStore} from "../../store";
    import {getChartData} from "./getChartData";
    import {getCandleChartOptions} from "./chart-configs";
    import {widgetNames} from "../../constatns/widgetNames";
    import ChartWidgetWrapper from "./ChartWidgetWrapper.svelte";
    import {convertApiResponseToChartData, getMinMaxData} from "./chart-utils";
    import './chartWidget.css';
    import 'uplot/dist/uPlot.min.css';
    import {mockData1} from "./mocks";

    export let widgetOptions;
    export let chartElement;

    const chartOptions = {};
    let chart;
    let {
        chartData,
        chartDataLoading,
        chartDataError,
    } = {};

    onMount(() => {
        console.log('>>>widgetOptions', widgetOptions);
       getChartData(chartOptions)
    });



    mainStore.subscribe((store) => {
        chartData = store[widgetNames.CHART_WIDGET].data;
        chartDataLoading = store[widgetNames.CHART_WIDGET].loading;
        chartDataError = store[widgetNames.CHART_WIDGET].error;
    });


    const renderChart = () =>{
        if(!chartElement) return;
        // const serializedChartData = convertApiResponseToChartData(chartData.slice(1,4));
        const {min, max} = getMinMaxData(mockData1)
        const options = getCandleChartOptions({min,  max, chartConfigs: {height: 300, width : 600}});
        console.log('>>> options', options);
        console.log('>>>formalizedChartData', mockData1);
        chart = new uPlot(options, mockData1, chartElement);
    }

    afterUpdate(async () => {
        await renderChart();
    });

</script>

<div class="chart-widget">
    <h3>Chart widget</h3>
    <ChartWidgetWrapper chartDataLoading={chartDataLoading} chartDataError={chartDataError}>
        <div>Period buttons</div>
        <div>Chart type buttons</div>

        <div bind:this={chartElement} class="chart-widget" id={'chart-widget'}></div>
    </ChartWidgetWrapper>

</div>

