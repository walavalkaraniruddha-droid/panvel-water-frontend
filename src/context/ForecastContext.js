/**
 * ForecastContext — shared forecast state across Dashboard ↔ Analytics
 * When user predicts on Dashboard, Analytics page reads the same data.
 */
import { createContext, useContext, useState } from "react";

const ForecastContext = createContext(null);

export function ForecastProvider({ children }) {
  const [cityForecast, setCityForecast] = useState(null); // array of prediction rows
  const [forecastDays, setForecastDays] = useState(null); // number of days selected
  const [forecastedAt, setForecastedAt] = useState(null); // timestamp of last predict

  const updateForecast = (data, days) => {
    setCityForecast(data);
    setForecastDays(days);
    setForecastedAt(new Date());
  };

  const clearForecast = () => {
    setCityForecast(null);
    setForecastDays(null);
    setForecastedAt(null);
  };

  return (
    <ForecastContext.Provider value={{
      cityForecast, forecastDays, forecastedAt,
      updateForecast, clearForecast
    }}>
      {children}
    </ForecastContext.Provider>
  );
}

export const useForecast = () => useContext(ForecastContext);
