import { useEffect, useRef, useState } from 'react';
import { useBrowserStore } from '../../store/browserStore';
import Tab from './Tab';
import { Icon } from '../common/Icon';

export function TabBar() {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const createTab = useBrowserStore((s) => s.createTab);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const pinnedTabs = tabs.filter((t) => t.pinned);
  const regularTabs = tabs.filter((t) => !t.pinned);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const syncScrollState = () => {
      setCanScrollLeft(element.scrollLeft > 2);
      setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    };

    syncScrollState();
    element.addEventListener('scroll', syncScrollState, { passive: true });
    const observer = new ResizeObserver(syncScrollState);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', syncScrollState);
      observer.disconnect();
    };
  }, [regularTabs.length, pinnedTabs.length]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !activeTabId) return;
    const active = element.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    window.setTimeout(() => {
      setCanScrollLeft(element.scrollLeft > 2);
      setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    }, 220);
  }, [activeTabId]);

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

      <div className="flex items-center gap-1 flex-1 min-w-0 no-drag">
        {canScrollLeft && (
          <button
            type="button"
            title="Scroll tabs left"
            aria-label="Scroll tabs left"
            onClick={() => scrollRef.current?.scrollBy({ left: -240, behavior: 'smooth' })}
            className="nav-pill no-drag shrink-0 w-7 h-7"
          >
            <Icon name="chevron-left" size={13} />
          </button>
        )}

        <div ref={scrollRef} className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {regularTabs.map((tab) => (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              className="max-w-[200px] min-w-[100px] flex-1 shrink-0 animate-tab-enter overflow-hidden"
            >
              <Tab tab={tab} active={tab.id === activeTabId} />
            </div>
          ))}
        </div>

        {canScrollRight && (
          <button
            type="button"
            title="Scroll tabs right"
            aria-label="Scroll tabs right"
            onClick={() => scrollRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
            className="nav-pill no-drag shrink-0 w-7 h-7"
          >
            <Icon name="chevron-right" size={13} />
          </button>
        )}

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
