import axios from "axios";
import { updateChartWidget } from "../../store";
import { mockData } from "./mocks";
import { normalizeApiResponse } from "./chart-utils";

const getOptionToServer = ({ period }) => {
  // TODO: Add logic to calculate startTime due to endTime and period
  // for different periods interval should be different, day: 1h (24 candlesticks), week:6h (28), month: 1d (30), year: 1w(52)
  return { startTime: 1681765200000, endTime: new Date().getTime() };
};
export const getChartData = async ({ symbol, interval, limit, period }) => {
  updateChartWidget({ loading: true });

  const { startTime, endTime } = getOptionToServer({ period });

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
