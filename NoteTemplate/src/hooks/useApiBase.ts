import { useEffect, useState } from 'react';
import {
  getApiBase,
  loadApiBase,
  saveApiBase,
  subscribeApiBase,
} from '../apiBase';

export function useApiBase() {
  const [apiBase, setApiBase] = useState(getApiBase);

  useEffect(() => {
    void loadApiBase().then(setApiBase);
    return subscribeApiBase(setApiBase);
  }, []);

  return { apiBase, saveApiBase };
}
