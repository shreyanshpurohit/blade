import { useBrowserStore } from '../../store/browserStore';
import Tab from './Tab';
import { Icon } from '../common/Icon';

export function TabBar() {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const createTab = useBrowserStore((s) => s.createTab);

  const pinnedTabs = tabs.filter((t) => t.pinned);
  const regularTabs = tabs.filter((t) => !t.pinned);

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 flex-1 min-w-0 drag-region overflow-hidden">
      {pinnedTabs.length > 0 && (
        <>
          <div className="flex items-center gap-1 shrink-0 no-drag">
            {pinnedTabs.map((tab) => (
              <Tab key={tab.id} tab={tab} active={tab.id === activeTabId} compact />
            ))}
          </div>
          <div className="w-px h-4 bg-white/10 shrink-0 mx-1" />
        </>
      )}

      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-drag [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {regularTabs.map((tab) => (
          <div
            key={tab.id}
            className="max-w-[200px] min-w-[100px] flex-1 shrink-0 animate-tab-enter overflow-hidden"
          >
            <Tab tab={tab} active={tab.id === activeTabId} />
          </div>
        ))}
        
        <button
          onClick={() => createTab()}
          title="New Tab (Ctrl+T)"
          className="nav-pill no-drag shrink-0 ml-1"
        >
          <Icon name="plus" size={13} />
        </button>
      </div>
    </div>
  );
}
