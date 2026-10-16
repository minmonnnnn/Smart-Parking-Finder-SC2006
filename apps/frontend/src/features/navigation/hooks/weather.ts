import { useEffect, useState } from 'react';
import type { WeatherInfo } from '@smart-parking/shared-types';

interface UseWeatherProps {
  lat?: number;
  lng?: number;
}
export function useWeather({ lat, lng }: UseWeatherProps) {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let isMounted = true;
    const fetchWeather = async () => {
      setIsLoading(true);
      try {
        const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
        const url = baseUrl.endsWith('/api')
          ? `${baseUrl}/weather?lat=${lat}&lng=${lng}`
          : `${baseUrl}/api/weather?lat=${lat}&lng=${lng}`;

        const res = await fetch(url);
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          const data: WeatherInfo = await res.json();
          if (isMounted) {
            setWeather(data);
          }
        }
      } catch (err) {
        console.warn('[useWeather] Weather endpoint unavailable:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    fetchWeather();
    return () => {
      isMounted = false;
    };
  }, [lat, lng]);
  return { weather, isLoading };
}