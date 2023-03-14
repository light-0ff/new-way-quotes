import { writable } from "svelte/store";

const storeState = {
  options: {},
};
const mainStore = writable(storeState);

const { update } = mainStore;

const updateOptions = (options) => {
  update((store) => ({ ...store, options }));
};

export { mainStore, updateOptions };
