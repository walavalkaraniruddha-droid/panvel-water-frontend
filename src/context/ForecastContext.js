import { createContext, useContext, useState, useCallback } from "react";

const ForecastContext = createContext(null);

export function ForecastProvider({ children }) {
  const [forecastData, setForecastData] = useState([]);
  const [forecastDays, setForecastDays] = useState(null);

  const updateForecast = useCallback((data, days) => {
    setForecastData(data);
    setForecastDays(days);
  }, []);

  return (
    <ForecastContext.Provider value={{ forecastData, forecastDays, updateForecast }}>
      {children}
    </ForecastContext.Provider>
  );
}

export function useForecast() {
  return useContext(ForecastContext);
}

export default ForecastContext;
