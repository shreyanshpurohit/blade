import { WebContents } from 'electron';
import { getShieldsConfig } from './shields';

/** Inject fingerprint protection scripts into a webContents. */
export function injectFingerprintProtection(webContents: WebContents) {
  const config = getShieldsConfig();
  if (!config.enabled || config.fingerprintProtection === 'off') return;

  const aggressive = config.fingerprintProtection === 'aggressive';

  // This script runs before any page JS, randomizing canvas/WebGL fingerprinting vectors.
  const script = `
    (function() {
      'use strict';
      // ─── Canvas fingerprint randomization ───
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;

      // Add subtle noise to canvas data
      function addNoise(data) {
        for (let i = 0; i < data.length; i += 4) {
          // Modify only every Nth pixel to be subtle
          if (i % 40 === 0) {
            data[i] = data[i] ^ 1; // tiny R channel flip
          }
        }
        return data;
      }

      CanvasRenderingContext2D.prototype.getImageData = function(...args) {
        const imageData = origGetImageData.apply(this, args);
        addNoise(imageData.data);
        return imageData;
      };

      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        // Create a copy with noise
        const ctx = this.getContext('2d');
        if (ctx) {
          const imageData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
          addNoise(imageData.data);
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = this.width;
          tempCanvas.height = this.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.putImageData(imageData, 0, 0);
            return origToDataURL.apply(tempCanvas, args);
          }
        }
        return origToDataURL.apply(this, args);
      };

      ${aggressive ? `
      // ─── WebGL fingerprint protection ───
      const origGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        // Mask renderer and vendor strings
        if (param === 0x1F00) return 'WebKit'; // VENDOR
        if (param === 0x1F01) return 'WebKit WebGL'; // RENDERER
        if (param === 0x9246) return 'Google Inc. (Generic)'; // UNMASKED_VENDOR_WEBGL
        if (param === 0x9247) return 'ANGLE (Generic, Generic GPU, OpenGL)'; // UNMASKED_RENDERER_WEBGL
        return origGetParameter.call(this, param);
      };

      // Also protect WebGL2
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(param) {
          if (param === 0x1F00) return 'WebKit';
          if (param === 0x1F01) return 'WebKit WebGL';
          if (param === 0x9246) return 'Google Inc. (Generic)';
          if (param === 0x9247) return 'ANGLE (Generic, Generic GPU, OpenGL)';
          return origGetParameter2.call(this, param);
        };
      }

      // ─── AudioContext fingerprint protection ───
      const origGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
      AnalyserNode.prototype.getFloatFrequencyData = function(array) {
        origGetFloatFrequencyData.call(this, array);
        for (let i = 0; i < array.length; i += 10) {
          array[i] = array[i] + (Math.random() * 0.1 - 0.05);
        }
      };

      // ─── Navigator hardening ───
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      Object.defineProperty(navigator, 'platform', { get: () => 'Linux x86_64' });
      ` : ''}
    })();
  `;

  webContents.on('dom-ready', () => {
    webContents.executeJavaScript(script).catch(() => {
      /* page may have CSP that blocks this — that's ok */
    });
  });
}
