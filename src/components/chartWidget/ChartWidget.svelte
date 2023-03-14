<script>
    import {onMount} from "svelte";
    import {mainStore} from "../../store";
    import {getChartData} from "./getChartData";
    import {widgetNames} from "../../constatns/widgetNames";
    import './chartWidget.css';

    export let widgetOptions;

    const chartOptions = {};

    let {
       chartData,
    } = {};

    onMount(() => {
       getChartData(chartOptions)
    });

    mainStore.subscribe((store) => {
        chartData = store[widgetNames.CHART_WIDGET].data;
        console.log('>>>chartData', store[widgetNames.CHART_WIDGET]);
    });

</script>

<div>
    <h3>Chart widget5</h3>
</div>
