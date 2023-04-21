import axios from 'axios';
import { updateChartWidget } from "../../store";
import { mockData } from "./mocks";

export const getChartData = async (chartOptions) => {
  updateChartWidget({ loading: true });
  try {
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=1677695844000&limit=100')
        )
          .then((res) => {
            let buffer = [[], [], [], [], [], []];
            res.data.forEach((element) => {
              buffer[0].push(element[0]);
              buffer[1].push(Number(element[1]));
              buffer[2].push(Number(element[2]));
              buffer[3].push(Number(element[3]));
              buffer[4].push(Number(element[4]));
              buffer[5].push(Number(element[5]));
            });
            return buffer;
          });
      }, 1000);
    }).then(({ data }) => {
        updateChartWidget({ data });
      });
  } catch (error) {
    updateChartWidget({ error: error });
  }
  updateChartWidget({ loading: false });
};
