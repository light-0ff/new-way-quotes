import App from "./App.svelte";
import { setOptionsToStore } from "./services/store.services";

const getApp = ({ elementId, widgetName, widgetOptions }) => {
  if (!elementId) {
    console.warn("Element id is not specified");
  }
  if (!widgetName) {
    console.warn("Name of chart is not specified");
  }

  return new App({
    target: document.getElementById(elementId),
    props: {
      widgetName,
      widgetOptions,
    },
  });
};

window.getApp = getApp;

window.setWidgetOptions = setOptionsToStore;
