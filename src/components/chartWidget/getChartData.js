import axios from "axios";
import { updateChartWidget } from "../../store";
import { mockData } from "./mocks";
import { normalizeApiResponse } from "./chart-utils";

const getOptionToServer = ({ interval }) => {
  // TODO: Add logic to calculate 'startTime' due to interval and new Date().getTime();
  return { startTime: 1681765200000, endTime: new Date().getTime() };
};
export const getChartData = async ({ symbol, interval, limit }) => {
  updateChartWidget({ loading: true });

  const { startTime, endTime } = getOptionToServer({ interval });

  try {
    await axios
      .get(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=${limit}`
      )
      .then((res) => {
        const data = normalizeApiResponse(res);
        updateChartWidget({ data });
      });
  } catch (error) {
    updateChartWidget({ error: error });
  }
  updateChartWidget({ loading: false });
};
