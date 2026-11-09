import { useEffect, useState } from 'react';
import { ThemeContext } from './theme-context';

const THEME_PREFERENCE_VERSION = '2';

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Older RoomSync builds persisted the operating system theme as though it
    // were a user choice. Normalize that legacy value to light once; after this
    // migration, explicit choices made with the toggle are preserved.
    const preferenceVersion = localStorage.getItem('roomsync-theme-preference-version');
    const savedTheme = localStorage.getItem('theme');
    return preferenceVersion === THEME_PREFERENCE_VERSION && savedTheme === 'dark'
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
    localStorage.setItem('roomsync-theme-preference-version', THEME_PREFERENCE_VERSION);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((previous) => previous === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
