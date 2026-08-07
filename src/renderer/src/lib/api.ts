import type { LumenApi } from '../../../preload';

declare global {
  interface Window {
    lumen: LumenApi;
  }
}

export const api = window.lumen;
