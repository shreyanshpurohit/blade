import { api } from '../../lib/api';
import { Icon } from '../common/Icon';

const isMac = navigator.userAgent.includes('Mac');

/** Reserves space at the left of the tab strip for macOS native traffic lights. */
export function TrafficLightsSpacer() {
  if (!isMac) return null;
  return <div className="w-[72px] shrink-0 drag-region" />;
}

/**
 * Window controls — glassmorphic style.
 * On macOS the native traffic lights handle this; on Linux/Windows we draw a close button.
 */
export function TrafficLights() {
  if (isMac) return null;
  return (
    <div className="flex items-center no-drag">
      <button
        onClick={() => api.app.windowControl('close')}
        title="Close"
        className="nav-pill w-7 h-7 hover:!bg-[var(--color-destructive)] hover:!text-white"
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}
