import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useBrowserStore } from '../../store/browserStore';
import { Icon, IconName } from '../common/Icon';

interface ShieldsConfig {
  enabled: boolean;
  adBlockEnabled: boolean;
  trackerBlockEnabled: boolean;
  httpsUpgrade: boolean;
  fingerprintProtection: 'off' | 'standard' | 'aggressive';
  cookieControl: 'all' | 'cross-site' | 'blocked';
}

interface ShieldsStats {
  adsBlocked: number;
  trackersBlocked: number;
  httpsUpgrades: number;
  fingerprintsBlocked: number;
  scriptsBlocked: number;
}

export function ShieldsSidebarPanel() {
  const [config, setConfig] = useState<ShieldsConfig | null>(null);
  const [stats, setStats] = useState<ShieldsStats | null>(null);
  const activeTab = useBrowserStore((s) => s.activeTab());
  const openSettings = useBrowserStore((s) => s.openSettings);
  const accentColor = useBrowserStore((s) => s.accentColor);

  const refresh = () => {
    void api.shields.getConfig().then((c) => setConfig(c as ShieldsConfig));
    void api.shields.getStatsForTab().then((s) => setStats(s as ShieldsStats));
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [activeTab?.url]);

  const hostname = (() => {
    try {
      return new URL(activeTab?.url ?? '').hostname || 'current site';
    } catch {
      return 'current site';
    }
  })();

  const updateConfig = (key: string, value: string) => {
    void api.shields.setConfig(key, value);
    setConfig((prev) => {
      if (!prev) return prev;
      const mapping: Record<string, string> = {
        enabled: 'enabled',
        adBlock: 'adBlockEnabled',
        trackerBlock: 'trackerBlockEnabled',
        httpsUpgrade: 'httpsUpgrade',
        fingerprint: 'fingerprintProtection',
        cookies: 'cookieControl',
      };
      const stateKey = mapping[key] ?? key;
      const boolKeys = ['enabled', 'adBlockEnabled', 'trackerBlockEnabled', 'httpsUpgrade'];
      const newValue = boolKeys.includes(stateKey) ? value === 'true' : value;
      return { ...prev, [stateKey]: newValue } as ShieldsConfig;
    });
  };

  const toggleShields = () => {
    if (!config) return;
    updateConfig('enabled', String(!config.enabled));
  };

  if (!config || !stats) {
    return (
      <div className="p-6 text-center text-xs text-white/50 animate-pulse">
        Loading Lumen Shields…
      </div>
    );
  }

  const totalBlocked = stats.adsBlocked + stats.trackersBlocked + stats.fingerprintsBlocked;
  const isEnabled = config.enabled;

  return (
    <div className="flex flex-col gap-3 py-1 animate-tab-enter text-white">
      {/* ── Status Hero Card ── */}
      <div
        className={`p-4 rounded-2xl border transition-all duration-200 ${
          isEnabled
            ? 'shadow-lg'
            : 'bg-red-500/10 border-red-400/30'
        }`}
        style={
          isEnabled
            ? {
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}40`,
              }
            : undefined
        }
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl grid place-items-center border transition-colors duration-200 ${
                isEnabled
                  ? 'border-transparent'
                  : 'bg-red-500/20 border-red-500/40 text-red-300'
              }`}
              style={
                isEnabled
                  ? {
                      backgroundColor: `${accentColor}25`,
                      borderColor: `${accentColor}50`,
                      color: accentColor,
                    }
                  : undefined
              }
            >
              <Icon name={isEnabled ? 'shield-check' : 'shield-x'} size={18} strokeWidth={2} />
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide">
                {isEnabled ? 'Shields Active' : 'Protection Paused'}
              </div>
              <div className="text-[11px] text-white/50 truncate max-w-[140px]">
                {hostname}
              </div>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            onClick={toggleShields}
            className="w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-out shrink-0"
            style={{
              backgroundColor: isEnabled ? accentColor : 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-out ${
                isEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {isEnabled ? (
          <div className="flex items-baseline gap-2 pt-2.5 border-t border-white/10">
            <span className="text-2xl font-bold tracking-tight" style={{ color: accentColor }}>
              {totalBlocked}
            </span>
            <span className="text-[11px] text-white/60">
              threats blocked on this page
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-red-300/80 pt-2 border-t border-red-500/20">
            Protection paused. Trackers and fingerprinting may run.
          </p>
        )}
      </div>

      {/* ── Live Stats ── */}
      {isEnabled && (
        <div className="grid grid-cols-2 gap-2">
          <StatBox label="Ads Blocked" value={stats.adsBlocked} icon="shield" accentColor={accentColor} />
          <StatBox label="Trackers" value={stats.trackersBlocked} icon="eye-slash" accentColor={accentColor} />
          <StatBox label="HTTPS Upgrades" value={stats.httpsUpgrades} icon="lock" accentColor={accentColor} />
          <StatBox label="Fingerprints" value={stats.fingerprintsBlocked} icon="fingerprint" accentColor={accentColor} />
        </div>
      )}

      {/* ── Controls Section ── */}
      <div className="glass-panel p-3.5 rounded-2xl border border-white/10 flex flex-col gap-2.5">
        <div className="text-[11px] font-semibold text-white/50 px-1 uppercase tracking-wider">
          Protections
        </div>

        <ToggleRow
          label="Ad & Tracker Blocking"
          desc="Blocks display ads and beacons"
          enabled={config.adBlockEnabled}
          accentColor={accentColor}
          onChange={(v) => {
            updateConfig('adBlock', String(v));
            updateConfig('trackerBlock', String(v));
          }}
        />

        <ToggleRow
          label="HTTPS Everywhere"
          desc="Auto-upgrade unencrypted HTTP"
          enabled={config.httpsUpgrade}
          accentColor={accentColor}
          onChange={(v) => updateConfig('httpsUpgrade', String(v))}
        />

        <div className="flex items-center justify-between py-1.5 px-1 border-t border-white/10">
          <div>
            <div className="text-xs font-medium text-white">
              Fingerprint Defense
            </div>
            <div className="text-[10px] text-white/50">Canvas & Audio spoofing</div>
          </div>
          <div className="flex rounded-lg bg-white/10 p-0.5 gap-0.5 border border-white/10">
            {(['off', 'standard', 'aggressive'] as const).map((m) => {
              const active = config.fingerprintProtection === m;
              return (
                <button
                  key={m}
                  onClick={() => updateConfig('fingerprint', m)}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md capitalize transition-all"
                  style={
                    active
                      ? {
                          backgroundColor: accentColor,
                          color: '#000000',
                          fontWeight: 600,
                        }
                      : { color: 'rgba(255, 255, 255, 0.6)' }
                  }
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between py-1.5 px-1 border-t border-white/10">
          <div>
            <div className="text-xs font-medium text-white">
              Cookie Control
            </div>
            <div className="text-[10px] text-white/50">Cross-site tracking cookies</div>
          </div>
          <div className="flex rounded-lg bg-white/10 p-0.5 gap-0.5 border border-white/10">
            {(['all', 'cross-site', 'blocked'] as const).map((c) => {
              const active = config.cookieControl === c;
              return (
                <button
                  key={c}
                  onClick={() => updateConfig('cookies', c)}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md transition-all"
                  style={
                    active
                      ? {
                          backgroundColor: accentColor,
                          color: '#000000',
                          fontWeight: 600,
                        }
                      : { color: 'rgba(255, 255, 255, 0.6)' }
                  }
                >
                  {c === 'all' ? 'All' : c === 'cross-site' ? '3rd-party' : 'Block'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Global Settings Link ── */}
      <button
        onClick={() => openSettings('shields')}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium text-white/80 hover:text-white transition-colors"
      >
        <Icon name="sliders" size={13} />
        Open Full Shield Settings
      </button>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon,
  accentColor,
}: {
  label: string;
  value: number;
  icon: string;
  accentColor: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3">
      <span className="shrink-0" style={{ color: accentColor }}>
        <Icon name={icon as IconName} size={15} />
      </span>
      <div className="min-w-0">
        <div className="text-base font-bold text-white leading-tight">
          {value}
        </div>
        <div className="text-[10px] text-white/50 truncate uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  enabled,
  accentColor,
  onChange,
}: {
  label: string;
  desc: string;
  enabled: boolean;
  accentColor: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1 px-1">
      <div>
        <div className="text-xs font-medium text-white">{label}</div>
        <div className="text-[10px] text-white/50">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className="w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-out shrink-0"
        style={{
          backgroundColor: enabled ? accentColor : 'rgba(255, 255, 255, 0.2)',
        }}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-out ${
            enabled ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
