import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BookmarkNode } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import { api } from '../../lib/api';

interface BookmarksPopupProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
  anchorPos?: { x: number; y: number } | null;
}

export function BookmarksPopup({ isOpen, onClose, anchorRect, anchorPos }: BookmarksPopupProps) {
  const activeTab = useBrowserStore((s) => s.activeTab());
  const activeBookmarked = useBrowserStore((s) => s.activeBookmarked);
  const { toggleBookmarkActive, createTab, navigateActive } = useBrowserStore();

  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('Bookmarks bar');
  const [showAllList, setShowAllList] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [search, setSearch] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(activeTab?.title || '');
    setShowAllList(!activeBookmarked); // if not bookmarked, open edit; if already bookmarked or want all, let user choose
    let active = true;
    void api.bookmarks.list().then((list) => {
      if (active && Array.isArray(list)) {
        setBookmarks(list);
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen, activeTab?.url, activeBookmarked]);

  useEffect(() => {
    if (isOpen && !showAllList) {
      setTimeout(() => nameInputRef.current?.select(), 50);
    }
  }, [isOpen, showAllList]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!activeBookmarked && activeTab?.url) {
      await api.bookmarks.add(title || activeTab.title || 'Untitled', activeTab.url);
      await useBrowserStore.getState().toggleBookmarkActive();
    }
    onClose();
  };

  const handleRemove = async () => {
    if (activeBookmarked) {
      await toggleBookmarkActive();
    }
    onClose();
  };

  const q = search.trim().toLowerCase();
  const filtered = bookmarks.filter(
    (b) => !b.isFolder && (!q || b.title.toLowerCase().includes(q) || (b.url && b.url.toLowerCase().includes(q))),
  );

  const rightPos = anchorPos
    ? Math.max(16, window.innerWidth - anchorPos.x)
    : anchorRect
    ? Math.max(16, window.innerWidth - anchorRect.right)
    : 100;
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
        className="absolute w-[330px] glass-panel border border-white/15 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 animate-menu-in"
        style={{
          right: `${rightPos}px`,
          top: `${topPos}px`,
          background: 'color-mix(in srgb, var(--color-surface-solid, #1e1914) 96%, var(--app-bg))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Chrome-style Bookmark Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--theme-primary-soft)] text-[var(--theme-primary)] flex items-center justify-center">
              <Icon name="star" size={13} strokeWidth={2} />
            </div>
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              {showAllList ? 'Bookmarks' : activeBookmarked ? 'Edit bookmark' : 'Bookmark added'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors"
          >
            <Icon name="x" size={13} strokeWidth={2} />
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex rounded-lg bg-white/[0.05] p-0.5 text-[11px] font-medium border border-white/[0.06]">
          <button
            onClick={() => setShowAllList(false)}
            className={`flex-1 py-1 rounded-md transition-all ${
              !showAllList
                ? 'bg-white/[0.12] text-[var(--color-text-primary)] shadow-sm font-semibold'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            This Tab
          </button>
          <button
            onClick={() => setShowAllList(true)}
            className={`flex-1 py-1 rounded-md transition-all ${
              showAllList
                ? 'bg-white/[0.12] text-[var(--color-text-primary)] shadow-sm font-semibold'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            All Bookmarks ({bookmarks.filter((b) => !b.isFolder).length})
          </button>
        </div>

        {!showAllList ? (
          /* Chrome "Edit Bookmark" Form */
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                Name
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full h-8 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12]
                  border border-white/[0.08] focus:border-[var(--theme-primary)]
                  text-[12px] font-medium outline-none text-[var(--color-text-primary)] transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                Folder
              </label>
              <div className="relative">
                <select
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  className="w-full h-8 px-3 pr-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.09]
                    border border-white/[0.08] text-[12px] font-medium outline-none text-[var(--color-text-primary)]
                    appearance-none cursor-pointer"
                >
                  <option value="Bookmarks bar" className="bg-[var(--color-surface-solid)]">Bookmarks bar</option>
                  <option value="Other bookmarks" className="bg-[var(--color-surface-solid)]">Other bookmarks</option>
                  <option value="Mobile bookmarks" className="bg-[var(--color-surface-solid)]">Mobile bookmarks</option>
                </select>
                <div className="absolute right-2.5 top-2.5 pointer-events-none text-[var(--color-text-secondary)]">
                  <Icon name="chevron-down" size={12} strokeWidth={2} />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.08] mt-1">
              <button
                onClick={handleRemove}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-red-400 hover:bg-red-500/15 transition-colors"
              >
                {activeBookmarked ? 'Remove' : 'Cancel'}
              </button>

              <button
                onClick={handleSave}
                className="px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-[var(--theme-primary)] text-black hover:bg-[var(--theme-primary)]/90 transition-all shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* All Bookmarks Search & List */
          <div className="flex flex-col gap-2 max-h-[300px]">
            <div className="relative flex items-center">
              <div className="absolute left-2.5 text-[var(--color-text-secondary)] pointer-events-none">
                <Icon name="search" size={12} strokeWidth={2} />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bookmarks..."
                className="w-full h-7 pl-7 pr-3 bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12]
                  border border-white/[0.08] focus:border-white/20 rounded-full
                  text-[11.5px] outline-none text-[var(--color-text-primary)] transition-all"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-0.5 max-h-[220px] pr-0.5">
              {filtered.map((b) => (
                <div
                  key={b.id}
                  onClick={() => {
                    if (b.url) {
                      navigateActive(b.url);
                      onClose();
                    }
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1 && b.url) {
                      createTab(b.url);
                      onClose();
                    }
                  }}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-xl cursor-pointer hover:bg-white/[0.07] transition-all"
                >
                  <div className="w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center shrink-0 text-[var(--theme-primary)]">
                    <Icon name="star" size={11} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium leading-snug truncate text-[var(--color-text-primary)]">
                      {b.title || b.url}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-secondary)]/50 truncate">
                      {b.url?.replace(/^https?:\/\//, '')}
                    </div>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await api.bookmarks.remove(b.id);
                      const list = await api.bookmarks.list();
                      if (Array.isArray(list)) setBookmarks(list);
                    }}
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-white/15 text-[var(--color-text-secondary)] transition-all"
                    title="Delete bookmark"
                  >
                    <Icon name="x" size={10} strokeWidth={2} />
                  </button>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="py-6 text-center text-[11px] text-[var(--color-text-secondary)]/60">
                  {search ? 'No matching bookmarks' : 'No bookmarks saved yet'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
