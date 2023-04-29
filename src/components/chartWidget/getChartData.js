import axios from "axios";
import { updateChartWidget } from "../../store";
import { normalizeApiResponse } from "./chart-utils";
import { periodOptions } from "./chart-constants";

const getOptionToServer = ({ period }) => {
  let ago = new Date();
  let startTime;
  let endTime = ago.getTime();
  let interval;
  switch (period) {
    case periodOptions[0].id:
      ago.setDate(ago.getDate() - 1);
      startTime = ago.getTime();
      interval = "1h";
      break;
    case periodOptions[1].id:
      ago.setDate(ago.getDate() - 7);
      startTime = ago.getTime();
      interval = "6h";
      break;
    case periodOptions[2].id:
      ago.setDate(ago.getDate() - 30);
      startTime = ago.getTime();
      interval = "1d";
      break;
    case periodOptions[3].id:
      ago.setDate(ago.getDate() - 365);
      startTime = ago.getTime();
      interval = "1w";
      break;
    default:
      startTime = 1681765200000;
      interval = "1h";
      break;
  }
  return { startTime: startTime, endTime: endTime, interval };
};
export const getChartData = async ({ symbol, limit, period }) => {
  updateChartWidget({ loading: true });

  const { startTime, endTime, interval } = getOptionToServer({ period });
  console.log(startTime, interval, endTime);
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
