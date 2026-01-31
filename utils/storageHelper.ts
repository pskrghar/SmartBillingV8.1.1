
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`Error reading ${key} from localStorage:`, e);
      return null;
    }
  },
  
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`Error writing ${key} to localStorage:`, e);
    }
  },
  
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Error removing ${key} from localStorage:`, e);
    }
  }
};
