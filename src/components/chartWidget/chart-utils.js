import uPlot from "uplot";

const fixEqualMinMax = ({ min, max }) => {
  if (min == max) {
    min = Math.floor(min);
    max = Math.ceil(max);

    if (min == max) {
      max = max + 1;
    }
  }
  return { min, max };
};

const getMinMaxData = (data) => {
  // Date, Open, High, Low, Close, Volume
  const max = Math.max(...(data[2] || []));
  const min = Math.min(...(data[3] || []));
  return { max, min };
};

const convertApiResponseToChartData = (response) => {
  const date = [];
  const open = [];
  const high = [];
  const low = [];
  const close = [];
  const volume = [];

  response.forEach((quote) => {
    date.push(quote.period);
    open.push(quote.open);
    high.push(quote.high);
    low.push(quote.low);
    close.push(quote.close);
    volume.push(quote.volume);
  });

  return [date, open, high, low, close, volume];
};

const tzDate = (ts) => uPlot.tzDate(new Date(ts * 1e3), "Etc/UTC");

const capitalizeFirstLetter = (string) =>
  string.charAt(0).toUpperCase() + string.slice(1);

const getDateTranslates = () => {
  const { jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec } = {
    jan: "jan",
    feb: "feb",
    mar: "mar",
    apr: "apr",
    may: "may",
    jun: "jun",
    jul: "jul",
    aug: "aug",
    sep: "sep",
    oct: "oct",
    nov: "nov",
    dec: "dec",
  };
  const MMM = [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec].map(
    (i) => capitalizeFirstLetter(i)
  );
  return { MMM, MMMM: [""], WWWW: [""], WWW: [""] };
};

const normalizeApiResponse = (response) => {
  const date = [];
  const open = [];
  const high = [];
  const low = [];
  const close = [];
  const volume = [];

  response.data.forEach((element) => {
    date.push(element[0]);
    open.push(Number(element[1]));
    high.push(Number(element[2]));
    low.push(Number(element[3]));
    close.push(Number(element[4]));
    volume.push(Number(element[5]));
  });
  return [date, open, high, low, close, volume];
};

export {
  tzDate,
  getMinMaxData,
  fixEqualMinMax,
  getDateTranslates,
  capitalizeFirstLetter,
  convertApiResponseToChartData,
  normalizeApiResponse,
};
