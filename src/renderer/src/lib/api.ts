import type { BladeApi, LumenApi } from '../../../preload';

declare global {
  interface Window {
    blade: BladeApi;
    lumen: LumenApi;
  }
}

export const api = window.blade || window.lumen;
