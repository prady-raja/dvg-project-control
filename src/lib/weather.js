// Weather for the site diary from Open-Meteo (no key). Returns null when it cannot be read; the diary then takes the weather by hand.

const CODES = [
  [[0], 'Clear'], [[1, 2], 'Partly cloudy'], [[3], 'Overcast'], [[45, 48], 'Fog'],
  [[51, 53, 55, 56, 57], 'Drizzle'], [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain'], [[71, 73, 75, 77, 85, 86], 'Snow'], [[95, 96, 99], 'Thunderstorm'],
];
export const describeWeatherCode = (code) => CODES.find(([list]) => list.includes(Number(code)))?.[1] || 'Unknown';

export async function fetchSiteWeather({ lat, lng, date }) {
  if (lat === null || lat === undefined || lng === null || lng === undefined || !date) return null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,precipitation_sum&timezone=Asia%2FKolkata&start_date=${date}&end_date=${date}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.daily;
    if (!d?.time?.length) return null;
    return {
      weather_summary: describeWeatherCode(d.weather_code?.[0]),
      temperature_c: d.temperature_2m_max?.[0] ?? null,
      rain_mm: d.precipitation_sum?.[0] ?? null,
      weather_source: 'Open-Meteo',
    };
  } catch {
    return null;
  }
}
