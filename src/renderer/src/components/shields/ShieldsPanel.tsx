import { useEffect, useState, useRef } from 'react';
import { api } from '../../lib/api';
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

interface ShieldsPanelProps {
  url: string;
  onClose: () => void;
}

export function ShieldsPanel({ url, onClose }: ShieldsPanelProps) {
  const [config, setConfig] = useState<ShieldsConfig | null>(null);
  const [stats, setStats] = useState<ShieldsStats | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.shields.getConfig().then((c) => setConfig(c as ShieldsConfig));
    void api.shields.getStatsForTab().then((s) => setStats(s as ShieldsStats));
  }, []);

  // Poll stats every 2 seconds for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      void api.shields.getStatsForTab().then((s) => setStats(s as ShieldsStats));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const hostname = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  const updateConfig = (key: string, value: string) => {
    void api.shields.setConfig(key, value);
    // Optimistically update local state
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
      <div ref={panelRef} className="absolute right-0 top-full mt-2 z-50 glass-panel rounded-glass p-6 w-[340px] animate-menu-in">
        <div className="text-[13px] text-neutral-500 text-center py-4">Loading shields…</div>
      </div>
    );
  }

  const totalBlocked = stats.adsBlocked + stats.trackersBlocked + stats.fingerprintsBlocked;

  // Compute protection level for visual feedback
  const activeFeatures = [
    config.adBlockEnabled,
    config.trackerBlockEnabled,
    config.httpsUpgrade,
    config.fingerprintProtection !== 'off',
  ].filter(Boolean).length;

  const protectionLevel = !config.enabled ? 'off'
    : activeFeatures >= 3 ? 'high'
    : activeFeatures >= 1 ? 'medium'
    : 'off';

  return (
    <div ref={panelRef} className="absolute right-0 top-full mt-2 z-50 glass-panel rounded-glass w-[340px] animate-menu-in overflow-hidden">
      {/* ── Header with gradient accent ── */}
      <div className={`px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.06]
        ${config.enabled
          ? 'bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/5 dark:from-emerald-500/15 dark:to-teal-500/10'
          : 'bg-gradient-to-br from-red-500/10 via-transparent to-orange-500/5 dark:from-red-500/15 dark:to-orange-500/10'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 grid place-items-center rounded-xl transition-colors duration-300
              ${config.enabled
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/20 text-red-500 dark:text-red-400'
              }`}
            >
              <Icon name={config.enabled ? 'shield-check' : 'shield-x'} size={18} strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-neutral-800 dark:text-white">Lumen Shields</div>
              <div className="text-[11px] text-neutral-500 truncate max-w-[180px]">{hostname}</div>
            </div>
          </div>
          {/* Master toggle */}
          <button
            onClick={toggleShields}
            className={`w-11 h-[24px] rounded-full transition-colors duration-300 relative shrink-0
              ${config.enabled ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}
          >
            <div className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-300
              ${config.enabled ? 'translate-x-[23px]' : 'translate-x-[3px]'}`}
            />
          </button>
        </div>

        {/* Blocked counter */}
        {config.enabled && (
          <div className="flex items-baseline gap-1.5">
            <span className={`text-[28px] font-bold tracking-tight ${
              protectionLevel === 'high' ? 'text-emerald-600 dark:text-emerald-400'
              : protectionLevel === 'medium' ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'
            }`}>
              {totalBlocked}
            </span>
            <span className="text-[12px] text-neutral-500 font-medium">blocked on this site</span>
          </div>
        )}
      </div>

      {/* ── Stats grid ── */}
      {config.enabled && (
        <div className="grid grid-cols-2 gap-2 p-4">
          <StatCard label="Ads blocked" value={stats.adsBlocked} icon="shield" color="blue" />
          <StatCard label="Trackers blocked" value={stats.trackersBlocked} icon="eye-slash" color="purple" />
          <StatCard label="HTTPS upgrades" value={stats.httpsUpgrades} icon="lock" color="emerald" />
          <StatCard label="Fingerprints" value={stats.fingerprintsBlocked} icon="fingerprint" color="amber" />
        </div>
      )}

      {/* ── Controls ── */}
      {config.enabled && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          <div className="h-[1px] w-full bg-black/[0.06] dark:bg-white/[0.06] mb-1" />

          <ShieldToggle
            label="Block ads & trackers"
            enabled={config.adBlockEnabled && config.trackerBlockEnabled}
            onChange={(v) => {
              updateConfig('adBlock', String(v));
              updateConfig('trackerBlock', String(v));
            }}
          />
          <ShieldToggle
            label="HTTPS Everywhere"
            enabled={config.httpsUpgrade}
            onChange={(v) => updateConfig('httpsUpgrade', String(v))}
          />

          <ShieldSelect
            label="Fingerprint protection"
            value={config.fingerprintProtection}
            options={[
              { id: 'off', label: 'Off' },
              { id: 'standard', label: 'Standard' },
              { id: 'aggressive', label: 'Aggressive' },
            ]}
            onChange={(v) => updateConfig('fingerprint', v)}
          />
          <ShieldSelect
            label="Cookie control"
            value={config.cookieControl}
            options={[
              { id: 'all', label: 'Allow all' },
              { id: 'cross-site', label: 'Cross-site' },
              { id: 'blocked', label: 'Block all' },
            ]}
            onChange={(v) => updateConfig('cookies', v)}
          />
        </div>
      )}

      {/* ── Disabled state ── */}
      {!config.enabled && (
        <div className="p-5 text-center">
          <div className="text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Shields are <span className="font-semibold text-red-500">down</span> for this site.
            <br />Toggle above to re-enable protection.
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.04]">
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
          protectionLevel === 'high'
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : protectionLevel === 'medium'
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : 'bg-red-500/15 text-red-600 dark:text-red-400'
        }`}>
          {protectionLevel === 'high' ? 'Maximum protection'
            : protectionLevel === 'medium' ? 'Partial protection'
            : 'Shields down'
          }
        </span>
        <span className="text-[10px] text-neutral-400">Lumen Browser</span>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-500 dark:text-blue-400',
    purple: 'text-purple-500 dark:text-purple-400',
    emerald: 'text-emerald-500 dark:text-emerald-400',
    amber: 'text-amber-500 dark:text-amber-400',
  };

  return (
    <div className="glass-control rounded-xl px-3 py-2.5 flex items-center gap-2.5">
      <span className={`${colorClasses[color] ?? colorClasses.blue} shrink-0`}>
        <Icon name={icon as IconName} size={14} />
      </span>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-neutral-800 dark:text-white">{value}</div>
        <div className="text-[10px] text-neutral-500 truncate">{label}</div>
      </div>
    </div>
  );
}

function ShieldToggle({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-1">
      <span className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      <button
        onClick={() => onChange(!enabled)}
        className={`w-9 h-[20px] rounded-full transition-colors duration-200 relative shrink-0
          ${enabled ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}
      >
        <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200
          ${enabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}
        />
      </button>
    </div>
  );
}

function ShieldSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 px-1">
      <span className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      <div className="flex glass-control p-0.5 gap-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-200
              ${value === o.id
                ? 'bg-white/80 dark:bg-white/20 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
