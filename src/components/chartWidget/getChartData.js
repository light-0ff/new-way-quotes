import { updateChartWidget } from "../../store";
import { mockData } from "./mocks";

export const getChartData = async (chartOptions) => {
  updateChartWidget({ loading: true });
  try {
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockData);
      }, 1000);
    }).then(({ data }) => {
      updateChartWidget({ data });
    });
  } catch (error) {
    updateChartWidget({ error: error });
  }
  updateChartWidget({ loading: false });
};
