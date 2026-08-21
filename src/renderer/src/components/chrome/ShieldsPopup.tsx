import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBrowserStore } from '../../store/browserStore';
import { api } from '../../lib/api';
import { Icon } from '../common/Icon';

interface ShieldsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
  anchorPos?: { x: number; y: number } | null;
}

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

export function ShieldsPopup({ isOpen, onClose, anchorRect, anchorPos }: ShieldsPopupProps) {
  const activeTab = useBrowserStore((s) => s.activeTab());
  const openSettings = useBrowserStore((s) => s.openSettings);
  const [config, setConfig] = useState<ShieldsConfig | null>(null);
  const [stats, setStats] = useState<ShieldsStats | null>(null);
  const [expanded, setExpanded] = useState(false);

  const refresh = () => {
    void api.shields.getConfig().then((c) => setConfig(c as ShieldsConfig));
    void api.shields.getStatsForTab().then((s) => setStats(s as ShieldsStats));
  };

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    const interval = setInterval(refresh, 1500);
    return () => clearInterval(interval);
  }, [isOpen, activeTab?.url]);

  if (!isOpen) return null;

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

  const isEnabled = config?.enabled ?? true;
  const totalBlocked = (stats?.adsBlocked ?? 0) + (stats?.trackersBlocked ?? 0) + (stats?.fingerprintsBlocked ?? 0);

  const rightPos = anchorPos
    ? Math.max(16, window.innerWidth - anchorPos.x)
    : anchorRect
    ? Math.max(16, window.innerWidth - anchorRect.right)
    : 20;
  const topPos = anchorPos ? anchorPos.y + 8 : anchorRect ? anchorRect.bottom + 8 : 56;

  return createPortal(
    <div
      className="fixed inset-0 z-50 select-none pointer-events-auto"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="absolute w-[320px] max-h-[580px] glass-panel border border-white/15 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 animate-menu-in"
        style={{
          right: `${rightPos}px`,
          top: `${topPos}px`,
          background: 'color-mix(in srgb, var(--color-surface-solid, #1e1914) 96%, var(--app-bg))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
              isEnabled ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-white/10 text-white/40 border-white/10'
            }`}>
              <Icon name="shield" size={17} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white truncate">{hostname}</div>
              <div className="text-[10px] text-white/50">Blade Shields</div>
            </div>
          </div>

          {/* Master Toggle */}
          <button
            onClick={() => updateConfig('enabled', String(!isEnabled))}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
              isEnabled ? 'bg-orange-500' : 'bg-white/20'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                isEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* ── Status Banner ── */}
        <div className={`p-3 rounded-xl border flex items-center justify-between ${
          isEnabled ? 'bg-orange-500/10 border-orange-500/20' : 'bg-white/5 border-white/10'
        }`}>
          <div>
            <div className="text-[12px] font-medium text-white">
              {isEnabled ? 'Shields are UP for this site' : 'Shields are DOWN'}
            </div>
            <div className="text-[10px] text-white/50">
              {isEnabled ? `${totalBlocked} items blocked` : 'Site is unprotected'}
            </div>
          </div>
          {isEnabled && (
            <span className="text-[18px] font-bold text-orange-400 font-mono">
              {totalBlocked}
            </span>
          )}
        </div>

        {/* ── Blocked Stats Breakdown ── */}
        {isEnabled && (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] flex flex-col">
              <span className="text-white/50 text-[10px]">Trackers & ads</span>
              <span className="text-[14px] font-semibold text-white mt-0.5">
                {(stats?.adsBlocked ?? 0) + (stats?.trackersBlocked ?? 0)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] flex flex-col">
              <span className="text-white/50 text-[10px]">Fingerprints</span>
              <span className="text-[14px] font-semibold text-white mt-0.5">
                {stats?.fingerprintsBlocked ?? 0}
              </span>
            </div>
          </div>
        )}

        {/* ── Advanced Controls (Expandable) ── */}
        <div className="space-y-1.5 pt-1 border-t border-white/[0.08]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between py-1 text-[11px] font-medium text-white/60 hover:text-white transition-colors"
          >
            <span>Advanced Controls</span>
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={12} />
          </button>

          {expanded && (
            <div className="space-y-1.5 pt-1">
              <ShieldToggleItem
                label="Block trackers & ads"
                enabled={config?.trackerBlockEnabled ?? true}
                onToggle={() => updateConfig('trackerBlock', String(!(config?.trackerBlockEnabled ?? true)))}
              />
              <ShieldToggleItem
                label="Upgrade to HTTPS"
                enabled={config?.httpsUpgrade ?? true}
                onToggle={() => updateConfig('httpsUpgrade', String(!(config?.httpsUpgrade ?? true)))}
              />
              <ShieldToggleItem
                label="Fingerprint protection"
                enabled={config?.fingerprintProtection !== 'off'}
                onToggle={() =>
                  updateConfig('fingerprint', config?.fingerprintProtection === 'off' ? 'standard' : 'off')
                }
              />
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px]">
          <button
            onClick={() => {
              openSettings('privacy');
              onClose();
            }}
            className="text-[var(--theme-primary)] hover:underline flex items-center gap-1 font-medium"
          >
            <Icon name="gear" size={11} />
            <span>Global Shields settings</span>
          </button>
          <button
            onClick={() => {
              window.alert('Site reported. Thanks for helping make Blade Shields better!');
              onClose();
            }}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            Report broken site
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ShieldToggleItem({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-white/[0.03] text-[11.5px]">
      <span className="text-white/80">{label}</span>
      <button
        onClick={onToggle}
        className={`w-7 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
          enabled ? 'bg-orange-500' : 'bg-white/20'
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform ${
            enabled ? 'translate-x-3' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
