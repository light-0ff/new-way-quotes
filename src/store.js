import { writable } from "svelte/store";
import { widgetNames } from "./constatns/widgetNames";

const storeState = {
  options: {},
  [widgetNames.CHART_WIDGET]: {
    loading: false,
    data: [],
    error: [],
  },
};
const mainStore = writable(storeState);

const { update } = mainStore;

const updateOptions = (options) => {
  update((store) => ({ ...store, options }));
};

const updateChartWidget = (chartWidget) => {
  update((store) => ({
    ...store,
    [widgetNames.CHART_WIDGET]: {
      ...store[widgetNames.CHART_WIDGET],
      ...chartWidget,
    },
  }));
};

export { mainStore, updateOptions, updateChartWidget };
