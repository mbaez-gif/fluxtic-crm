'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import styles from './Topbar.module.css';
import NotificationsBell from './NotificationsBell';

// WMO weather code → emoji + label
function weatherInfo(code: number): { icon: string; label: string } {
  if (code === 0)                          return { icon: '☀️', label: 'Despejado' };
  if (code === 1)                          return { icon: '🌤️', label: 'Mayormente despejado' };
  if (code === 2)                          return { icon: '⛅', label: 'Parcialmente nublado' };
  if (code === 3)                          return { icon: '☁️', label: 'Nublado' };
  if (code >= 45 && code <= 48)           return { icon: '🌫️', label: 'Niebla' };
  if (code >= 51 && code <= 67)           return { icon: '🌧️', label: 'Lluvia' };
  if (code >= 71 && code <= 77)           return { icon: '❄️', label: 'Nieve' };
  if (code >= 80 && code <= 82)           return { icon: '🌦️', label: 'Lluvias' };
  if (code >= 95 && code <= 99)           return { icon: '⛈️', label: 'Tormenta' };
  return { icon: '🌡️', label: '' };
}

interface WeatherData { temp: number; icon: string; label: string }

interface Props {
  pathname: string;
  onMenuToggle: () => void;
}

export default function Topbar({ pathname, onMenuToggle }: Props) {
  const { data: session } = useSession();
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Greeting based on time of day
  const hora = new Date().getHours();
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

  // First name only
  const nombreCompleto = session?.user?.name ?? '';
  const nombre = nombreCompleto.split(' ')[0] || 'Delfina';

  // Full date
  const hoy = new Date();
  const DIAS   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MESES  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const fechaStr = `${DIAS[hoy.getDay()]} ${hoy.getDate()} de ${MESES[hoy.getMonth()]}`;

  // Fetch weather — Santa Fe, Argentina (no API key required)
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=-31.6333&longitude=-60.7&current_weather=true&timezone=America/Argentina/Buenos_Aires')
      .then(r => r.json())
      .then(d => {
        const cw = d.current_weather;
        if (!cw) return;
        const { icon, label } = weatherInfo(cw.weathercode);
        setWeather({ temp: Math.round(cw.temperature), icon, label });
      })
      .catch(() => {/* falla silenciosamente */});
  }, []);

  return (
    <header className={styles.topbar}>
      {/* Hamburger — solo mobile */}
      <button className={styles.hamburger} onClick={onMenuToggle} aria-label="Menú">
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="3" y1="6"  x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Greeting */}
      <div className={styles.greeting}>
        <span className={styles.greetingText}>{saludo}, <em>{nombre}</em></span>
      </div>

      {/* Right side: notificaciones + date + weather */}
      <div className={styles.actions}>
        <NotificationsBell />
        <div className={styles.dateBlock}>
          <span className={styles.dateStr}>{fechaStr}</span>
          {weather && (
            <span className={styles.weather} title={weather.label}>
              {weather.icon} {weather.temp}°C
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
