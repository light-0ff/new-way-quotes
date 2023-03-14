import App from "./App.svelte";
import { setOptionsToStore } from "./services/store.services";

const getApp = ({ elementId, widgetName }) => {
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
    },
  });
};

window.getApp = getApp;

window.setWidgetOptions = setOptionsToStore;
