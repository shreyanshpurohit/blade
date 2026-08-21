import { useEffect, useState, useRef } from 'react';
import { api } from '../../lib/api';
import type { BookmarkNode } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';

export function BookmarksBar() {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const navigateActive = useBrowserStore((s) => s.navigateActive);
  const activeBookmarked = useBrowserStore((s) => s.activeBookmarked);
  const createTab = useBrowserStore((s) => s.createTab);

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(1000);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const { bookmarksBarVisible } = useBrowserStore();
  
  const loadBookmarks = () => {
    void api.bookmarks.list().then((b) => {
      setBookmarks(b as BookmarkNode[]);
    });
  };

  useEffect(() => {
    loadBookmarks();
  }, [activeBookmarked]);

  const topLevel = bookmarks.filter((n) => n.parentId === null);

  useEffect(() => {
    const measure = () => {
      if (!measureRef.current || !containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      if (containerWidth === 0) return;
      
      const children = Array.from(measureRef.current.children) as HTMLElement[];
      let count = 0;
      let width = 0;
      for (const child of children) {
        width += child.offsetWidth + 4; // gap-1 is 4px
        if (width <= containerWidth - 40) { // 40px reserved for the overflow » button
          count++;
        } else {
          break;
        }
      }
      if (count < children.length) {
        setVisibleCount(Math.max(0, count));
        setIsOverflowing(true);
      } else {
        setVisibleCount(children.length);
        setIsOverflowing(false);
      }
    };

    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    
    // Initial measure
    setTimeout(measure, 0);
    
    return () => observer.disconnect();
  }, [topLevel.length, bookmarks]);

  const handleContextMenu = async (e: React.MouseEvent, bookmark: BookmarkNode) => {
    e.preventDefault();
    e.stopPropagation();
    await api.app.showBookmarkContextMenu(bookmark.id, bookmark.url ?? undefined);
    loadBookmarks(); // refresh after the menu is closed in case they deleted it
  };

  const handleDelete = async (id: number) => {
    await api.bookmarks.remove(id);
    loadBookmarks();
  };

  const visibleItems = topLevel.slice(0, visibleCount);
  const overflowItems = topLevel.slice(visibleCount);

  if (topLevel.length === 0) return null;

  return (
    <div className="relative w-full h-8 flex items-center bg-transparent">
      {/* Invisible measuring container */}
      <div 
        ref={measureRef} 
        className="absolute top-0 left-0 h-8 flex items-center gap-1 px-3 invisible pointer-events-none whitespace-nowrap text-[12px]"
      >
        {topLevel.map((b) => (
          <div key={`measure-${b.id}`} className="flex items-center gap-1.5 px-2.5 py-1 shrink-0">
            {b.isFolder ? <Icon name="folder" size={14} /> : <Favicon url={b.url ?? ''} />}
            <span className="truncate max-w-[140px] font-medium">{b.title}</span>
            {b.isFolder && <Icon name="chevron-down" size={12} />}
          </div>
        ))}
      </div>

      <div 
        ref={containerRef}
        className="h-full flex-1 flex items-center gap-1 px-3 overflow-hidden text-[12px]"
      >
        {topLevel.length === 0 && (
          <span className="text-[var(--color-text-secondary)]/50 text-[12px]">No bookmarks yet</span>
        )}
        
        {visibleItems.map((b) => (
          b.isFolder ? (
            <BookmarkFolder 
              key={b.id} 
              folder={b} 
              allBookmarks={bookmarks} 
              onContextMenu={handleContextMenu} 
            />
          ) : (
            <button
              key={b.id}
              onClick={() => b.url && navigateActive(b.url)}
              onContextMenu={(e) => handleContextMenu(e, b)}
              title={b.url ?? ''}
              className="flex items-center gap-1.5 px-2.5 py-1 shrink-0 rounded-md
                text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06] transition-all duration-200"
            >
              <Favicon url={b.url ?? ''} />
              <span className="truncate max-w-[140px] font-medium">{b.title}</span>
            </button>
          )
        ))}

        {isOverflowing && (
          <OverflowMenu overflowItems={overflowItems} allBookmarks={bookmarks} onContextMenu={handleContextMenu} />
        )}
      </div>
    </div>
  );
}

function BookmarkFolder({ folder, allBookmarks, onContextMenu }: { folder: BookmarkNode, allBookmarks: BookmarkNode[], onContextMenu: (e: React.MouseEvent, b: BookmarkNode) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const children = allBookmarks.filter((b) => b.parentId === folder.id);
  const navigateActive = useBrowserStore((s) => s.navigateActive);

  useEffect(() => {
    if (!isOpen) return;
    const hide = () => setIsOpen(false);
    document.addEventListener('click', hide);
    return () => document.removeEventListener('click', hide);
  }, [isOpen]);

  return (
    <div className="relative shrink-0">
      <button 
        onContextMenu={(e) => onContextMenu(e, folder)}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all duration-200
          ${isOpen ? 'bg-white/[0.08] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06]'}`}
      >
        <Icon name="folder" size={14} />
        <span className="truncate max-w-[140px] font-medium">{folder.title}</span>
        <Icon name="chevron-down" size={12} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[160px] glass-panel border border-white/10 shadow-xl py-1 z-50 flex flex-col max-h-[400px] overflow-y-auto [scrollbar-width:none]">
          {children.length === 0 && (
            <span className="px-3 py-2 text-[var(--color-text-secondary)]/50">Empty</span>
          )}
          {children.map((child) => (
            <button
              key={child.id}
              onContextMenu={(e) => onContextMenu(e, child)}
              onClick={(e) => {
                e.stopPropagation();
                if (child.url) navigateActive(child.url);
                setIsOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-left text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06] transition-colors"
            >
              {child.isFolder ? <Icon name="folder" size={14} /> : <Favicon url={child.url ?? ''} />}
              <span className="truncate flex-1 font-medium">{child.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OverflowMenu({ overflowItems, allBookmarks, onContextMenu }: { overflowItems: BookmarkNode[], allBookmarks: BookmarkNode[], onContextMenu: (e: React.MouseEvent, b: BookmarkNode) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigateActive = useBrowserStore((s) => s.navigateActive);

  useEffect(() => {
    if (!isOpen) return;
    const hide = () => setIsOpen(false);
    document.addEventListener('click', hide);
    return () => document.removeEventListener('click', hide);
  }, [isOpen]);

  return (
    <div className="relative shrink-0">
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200
          ${isOpen ? 'bg-white/[0.08] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06]'}`}
      >
        <span className="text-[14px] leading-none mb-[2px]">»</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 min-w-[160px] glass-panel border border-white/10 shadow-xl py-1 z-50 flex flex-col max-h-[400px] overflow-y-auto [scrollbar-width:none]">
          {overflowItems.map((b) => (
            b.isFolder ? (
              <div key={b.id} className="px-1">
                <BookmarkFolder folder={b} allBookmarks={allBookmarks} onContextMenu={onContextMenu} />
              </div>
            ) : (
              <button
                key={b.id}
                onContextMenu={(e) => onContextMenu(e, b)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (b.url) navigateActive(b.url);
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-left text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06] transition-colors"
              >
                <Favicon url={b.url ?? ''} />
                <span className="truncate flex-1 font-medium">{b.title}</span>
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function Favicon({ url }: { url: string }) {
  const [err, setErr] = useState(false);
  
  if (err || !url) return <Icon name="globe" size={12} className="text-[var(--color-text-secondary)]" />;
  
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
    if (!hostname) throw new Error('No hostname');
  } catch {
    return <Icon name="globe" size={12} className="text-[var(--color-text-secondary)]" />;
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
      alt=""
      className="w-3.5 h-3.5 rounded-sm"
      onError={() => setErr(true)}
    />
  );
}
