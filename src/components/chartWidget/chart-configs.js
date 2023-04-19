import uPlot from "uplot";
import { fixEqualMinMax, tzDate, getDateTranslates } from "./chart-utils";
import {
  candlestickPlugin,
  legendAsTooltipPlugin,
  columnHighlightPlugin,
} from "./chart-plugins";
import { xAxesIncrs, xAxesValues } from "./chart-constants";

const defaultCandleChartConfig = {
  width: 0,
  height: 0,
  xAxisSize: 50,
  yAxisSize: 65,
  xAxisFont: "10px Arial",
  yAxisFont: "10px Arial",
  yAxisDecimalsInFloat: 3,
  candleGap: 2,
  candleBearishColor: "#fc3c5f",
  candleBullishColor: "#48b479",
  candleMaxWidth: 20,
  candleShadowWidth: 2,
  candleOutline: 1,
  tooltipDateFormat: "{MM}/{DD}/{YYYY} {HH}:{MM}",
  tooltipDecimalsInFloat: 3,
  heightToWidthRatio: 0.6,
  isResizable: true,
};

export const getCandleChartOptions = ({ min, max, chartConfigs }) => {
  const config = { ...defaultCandleChartConfig, ...chartConfigs };
  const fixedMinMax = fixEqualMinMax({ min, max });
  min = fixedMinMax.min;
  max = fixedMinMax.max;

  const plugins = [
    columnHighlightPlugin(),
    legendAsTooltipPlugin(),
    candlestickPlugin({
      gap: config.candleGap,
      bearishColor: config.candleBearishColor,
      bullishColor: config.candleBullishColor,
      bodyMaxWidth: config.candleMaxWidth,
      shadowWidth: config.candleShadowWidth,
      bodyOutline: config.candleOutline,
    }),
  ];

  // if (config.isResizable) {
  //   plugins.push(resize({ heightToWidthRatio: config.heightToWidthRatio }));
  // }

  return {
    width: config.width,
    height: config.height,
    tzDate,
    // fmtDate: (tpl) => (date) => {
    //   console.log(">>>", date);
    //   return !isNaN(date.getTime())
    //     ? uPlot.fmtDate(tpl, getDateTranslates())(date)
    //     : "";
    // },
    plugins: plugins,
    scales: {
      x: { distr: 2 },
      y: { min, max },
    },
    series: [
      {
        label: "Date",
        value: (u, ts) => console.log("Date", ts) || "",
        // uPlot.fmtDate(config.tooltipDateFormat)(tzDate(ts)),
      },
      {
        label: "Open",
        value: (u, value) =>
          console.log("Open", value, u) ||
          value.toFixed(config.tooltipDecimalsInFloat),
      },
      {
        label: "High",
        value: (u, value) => value.toFixed(config.tooltipDecimalsInFloat),
      },
      {
        label: "Low",
        value: (u, value) => value.toFixed(config.tooltipDecimalsInFloat),
      },
      {
        label: "Close",
        value: (u, value) => value.toFixed(config.tooltipDecimalsInFloat),
      },
      {
        label: "Volume",
        scale: "vol",
      },
    ],
    axes: [
      {
        size: config.xAxisSize,
        font: config.xAxisFont,
        incrs: xAxesIncrs,
        values: xAxesValues,
      },
      {
        side: 1,
        size: config.yAxisSize,
        font: config.yAxisFont,
        values: (self, ticks) =>
          ticks.map((rawValue) =>
            rawValue.toFixed(config.yAxisDecimalsInFloat)
          ),
      },
    ],
  };
};
