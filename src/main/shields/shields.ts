import { session, WebContents } from 'electron';
import { getSetting, setSetting } from '../store/database';

// ──── Comprehensive Ad & Tracker Domain Blocklist ────
const AD_DOMAINS = new Set([
  // Google Ad Systems
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'pagead2.googlesyndication.com', 'adservice.google.com', '2mdn.net',
  'googleads.g.doubleclick.net', 'securepubads.g.doubleclick.net', 'adkmob.com',
  // Amazon Ads
  'amazon-adsystem.com', 'aax.amazon-adsystem.com', 'aax-us-east.amazon-adsystem.com',
  // Major Ad Networks & DSPs
  'adsrvr.org', 'adnxs.com', 'advertising.com', 'moatads.com',
  'taboola.com', 'outbrain.com', 'mgid.com', 'criteo.com', 'criteo.net',
  'pubmatic.com', 'rubiconproject.com', 'openx.net', 'casalemedia.com',
  'indexexchange.com', 'sharethrough.com', 'spotxchange.com', 'bidswitch.net',
  'mathtag.com', 'thetradedesk.com', 'media.net', 'adzerk.net',
  'carbonads.net', 'buysellads.com', 'revcontent.com', 'sovrn.com',
  'contextweb.com', 'smartadserver.com', 'yieldmo.com', 'triplelift.com',
  'gumgum.com', 'undertone.com', 'inmobi.com', 'applovin.com',
  'unityads.unity3d.com', 'vungle.com', 'ironsrc.com', 'chartboost.com',
  'adcolony.com', 'adskeeper.co.uk', 'adskeeper.com', 'popads.net',
  'propellerads.com', 'popcash.net', 'adroll.com', 'adsterra.com',
  'yllix.com', 'ad-maven.com', 'exponential.com', 'tribalfusion.com',
  'zedo.com', 'trafficjunky.com', 'exoclick.com', 'juicyads.com',
  // Social ad networks
  'ads.linkedin.com', 'ads.twitter.com', 'ads.reddit.com', 'ads.pinterest.com',
  'ads.tiktok.com', 'business-api.tiktok.com',
]);

const TRACKER_DOMAINS = new Set([
  // Analytics & Tracking
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'analytics.google.com', 'ssl.google-analytics.com',
  'connect.facebook.net', 'pixel.facebook.com', 'an.facebook.com',
  'analytics.twitter.com', 't.co', 'bat.bing.com',
  'hotjar.com', 'fullstory.com', 'mouseflow.com', 'crazyegg.com',
  'mixpanel.com', 'segment.io', 'segment.com', 'amplitude.com',
  'heapanalytics.com', 'newrelic.com', 'nr-data.net',
  'sentry.io', 'bugsnag.com', 'logrocket.com', 'datadoghq-browser-agent.com',
  'scorecardresearch.com', 'quantserve.com', 'quantcount.com',
  'chartbeat.com', 'chartbeat.net', 'parsely.com',
  'optimizely.com', 'branch.io', 'appsflyer.com', 'adjust.com', 'singular.net',
  'mc.yandex.ru', 'metrika.yandex.ru',
  // DMP & Audience tracking
  'demdex.net', 'bluekai.com', 'krxd.net', 'exelator.com',
  'rlcdn.com', 'pippio.com', 'eyeota.net', 'agkn.com',
  // Fingerprinting scripts
  'fingerprintjs.com', 'fpjs.io', 'fpcdn.io', 'client.perimeterx.net',
]);

// URL patterns & paths for common ad/tracking scripts
const AD_URL_PATTERNS = [
  /\/ads?\.(?:js|json)/i,
  /\/pagead\//i,
  /\/gtag\/js/i,
  /\/analytics\.js/i,
  /\/fbevents\.js/i,
  /\/tag\/js\/gpt\.js/i,
  /\/prebid(?:\.min)?\.js/i,
  /\/adservice\//i,
  /\/gampad\//i,
  /\/advertisement/i,
  /\/ad-banner/i,
  /\/adserver\//i,
];

const AD_KEYWORDS = ['ad', 'ads', 'pagead', 'gtag', 'analytics', 'fbevents', 'prebid', 'adservice', 'gampad', 'banner', 'track'];

export const COSMETIC_AD_BLOCK_CSS = `
  .ad, .ads, .ad-banner, .ad-container, .adsbygoogle, ins.adsbygoogle,
  [id^="google_ads_"], [id^="div-gpt-ad"], [id*="ScriptRoot"],
  .taboola-container, .outbrain-container, #taboola-below-article-thumbnails,
  .sponsored-post, [data-ad-unit], [data-ad-slot], .native-ad {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    min-height: 0 !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
`;

export interface ShieldsConfig {
  enabled: boolean;
  adBlockEnabled: boolean;
  trackerBlockEnabled: boolean;
  httpsUpgrade: boolean;
  fingerprintProtection: 'off' | 'standard' | 'aggressive';
  cookieControl: 'all' | 'cross-site' | 'blocked';
}

export interface ShieldsStats {
  adsBlocked: number;
  trackersBlocked: number;
  httpsUpgrades: number;
  fingerprintsBlocked: number;
  scriptsBlocked: number;
}

// Per-origin stats (domain → counts for current session)
const perOriginStats = new Map<string, ShieldsStats>();
// Global lifetime stats
let globalStats: ShieldsStats = { adsBlocked: 0, trackersBlocked: 0, httpsUpgrades: 0, fingerprintsBlocked: 0, scriptsBlocked: 0 };
let cachedConfig: ShieldsConfig | null = null;

function emptyStats(): ShieldsStats {
  return { adsBlocked: 0, trackersBlocked: 0, httpsUpgrades: 0, fingerprintsBlocked: 0, scriptsBlocked: 0 };
}

export function originOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Fast O(k) subdomain check against domain set (k = number of domain parts) */
function isDomainMatch(hostname: string, domainSet: Set<string>): boolean {
  if (domainSet.has(hostname)) return true;
  let idx = hostname.indexOf('.');
  while (idx !== -1) {
    const parent = hostname.slice(idx + 1);
    if (domainSet.has(parent)) return true;
    idx = hostname.indexOf('.', idx + 1);
  }
  return false;
}

function isAdOrTracker(url: string): 'ad' | 'tracker' | null {
  const hostname = originOf(url);
  if (!hostname) return null;

  if (isDomainMatch(hostname, AD_DOMAINS)) {
    return 'ad';
  }
  if (isDomainMatch(hostname, TRACKER_DOMAINS)) {
    return 'tracker';
  }

  // Fast keyword pre-check before executing regex tests
  const lowerUrl = url.toLowerCase();
  let hasKeyword = false;
  for (let i = 0; i < AD_KEYWORDS.length; i++) {
    if (lowerUrl.includes(AD_KEYWORDS[i])) {
      hasKeyword = true;
      break;
    }
  }

  if (hasKeyword) {
    for (let i = 0; i < AD_URL_PATTERNS.length; i++) {
      if (AD_URL_PATTERNS[i].test(url)) {
        return 'ad';
      }
    }
  }

  return null;
}

export function getShieldsConfig(): ShieldsConfig {
  if (cachedConfig) return cachedConfig;
  cachedConfig = {
    enabled: getSetting('shields_enabled', 'true') === 'true',
    adBlockEnabled: getSetting('shields_adBlock', 'true') === 'true',
    trackerBlockEnabled: getSetting('shields_trackerBlock', 'true') === 'true',
    httpsUpgrade: getSetting('shields_httpsUpgrade', 'true') === 'true',
    fingerprintProtection: getSetting('shields_fingerprint', 'standard') as ShieldsConfig['fingerprintProtection'],
    cookieControl: getSetting('shields_cookies', 'cross-site') as ShieldsConfig['cookieControl'],
  };
  return cachedConfig;
}

export function setShieldsConfig(key: string, value: string) {
  cachedConfig = null;
  setSetting(`shields_${key}`, value);
}

export function getShieldsStats(origin?: string): ShieldsStats {
  if (origin) {
    return perOriginStats.get(origin) ?? emptyStats();
  }
  return { ...globalStats };
}

export function getShieldsStatsForTab(webContents: WebContents): ShieldsStats {
  try {
    const origin = originOf(webContents.getURL());
    return perOriginStats.get(origin) ?? emptyStats();
  } catch {
    return emptyStats();
  }
}

export function bumpStat(origin: string, field: keyof ShieldsStats) {
  if (origin) {
    if (!perOriginStats.has(origin)) {
      perOriginStats.set(origin, emptyStats());
    }
    perOriginStats.get(origin)![field]++;
  }
  globalStats[field]++;
}

const installedSessions = new WeakSet<Electron.Session>();

/** Install webRequest interceptors on the given session. */
export function installShieldsOnSession(ses: Electron.Session) {
  if (installedSessions.has(ses)) return;
  installedSessions.add(ses);

  const config = getShieldsConfig;

  // ─── Single unified onBeforeRequest handler ───
  ses.webRequest.onBeforeRequest((details, callback) => {
    const cfg = config();
    if (!cfg.enabled) {
      return callback({});
    }

    // 1. Check Ad / Tracker blocking
    const type = isAdOrTracker(details.url);
    if (type === 'ad' && cfg.adBlockEnabled) {
      const origin = details.referrer ? originOf(details.referrer) : originOf(details.url);
      bumpStat(origin, 'adsBlocked');
      return callback({ cancel: true });
    }
    if (type === 'tracker' && cfg.trackerBlockEnabled) {
      const origin = details.referrer ? originOf(details.referrer) : originOf(details.url);
      bumpStat(origin, 'trackersBlocked');
      return callback({ cancel: true });
    }

    // 2. Check HTTPS upgrade
    if (cfg.httpsUpgrade && details.url.startsWith('http://')) {
      const hostname = originOf(details.url);
      const isLocal = hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.endsWith('.local');

      if (!isLocal) {
        const upgraded = details.url.replace(/^http:/, 'https:');
        const origin = originOf(details.url);
        bumpStat(origin, 'httpsUpgrades');
        return callback({ redirectURL: upgraded });
      }
    }

    callback({});
  });

  // ─── Cookie control (block 3rd-party cookies) ───
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const cfg = config();
    if (!cfg.enabled) return callback({ requestHeaders: details.requestHeaders });

    const requestHeaders = { ...details.requestHeaders };

    if (cfg.cookieControl === 'blocked') {
      delete requestHeaders['Cookie'];
      delete requestHeaders['cookie'];
    } else if (cfg.cookieControl === 'cross-site') {
      // Block cookies on cross-origin requests
      const requestOrigin = originOf(details.url);
      const pageOrigin = details.referrer ? originOf(details.referrer) : '';
      if (pageOrigin && requestOrigin !== pageOrigin && !requestOrigin.endsWith('.' + pageOrigin)) {
        delete requestHeaders['Cookie'];
        delete requestHeaders['cookie'];
      }
    }

    callback({ requestHeaders });
  });

  // ─── Block Set-Cookie for cross-site in cross-site mode ───
  ses.webRequest.onHeadersReceived((details, callback) => {
    const cfg = config();
    if (!cfg.enabled) return callback({});

    const responseHeaders = { ...details.responseHeaders };

    if (cfg.cookieControl === 'blocked') {
      delete responseHeaders['set-cookie'];
      delete responseHeaders['Set-Cookie'];
    } else if (cfg.cookieControl === 'cross-site') {
      const requestOrigin = originOf(details.url);
      const pageOrigin = details.referrer ? originOf(details.referrer) : '';
      if (pageOrigin && requestOrigin !== pageOrigin && !requestOrigin.endsWith('.' + pageOrigin)) {
        delete responseHeaders['set-cookie'];
        delete responseHeaders['Set-Cookie'];
      }
    }

    callback({ responseHeaders });
  });
}

/** Reset per-origin stats (e.g., on navigation). */
export function resetStatsForOrigin(origin: string) {
  perOriginStats.delete(origin);
}

/** Reset all stats. */
export function resetAllStats() {
  perOriginStats.clear();
  globalStats = emptyStats();
}
