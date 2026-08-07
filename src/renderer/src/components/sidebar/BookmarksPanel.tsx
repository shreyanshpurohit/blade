import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { BookmarkNode } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';

export function BookmarksPanel() {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const navigateActive = useBrowserStore((s) => s.navigateActive);

  const refresh = () => {
    void api.bookmarks.list().then((b) => setBookmarks(b as BookmarkNode[]));
  };
  useEffect(refresh, []);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-ui-heading">Bookmarks</span>
        <div className="flex gap-1">
          <SmallAction label="Import" onClick={() => void api.bookmarks.import().then(refresh)} />
          <SmallAction label="Export" onClick={() => void api.bookmarks.export()} />
        </div>
      </div>
      {bookmarks.length === 0 && (
        <p className="text-ui-body px-2 py-6 text-center opacity-60">
          No bookmarks yet. Use the bookmark button in the address bar to add one.
        </p>
      )}
      {bookmarks.map((b) => (
        <div key={b.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-glass-sm hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors duration-150">
          <button className="flex-1 min-w-0 text-left" onClick={() => navigateActive(b.url!)}>
            <div className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{b.title}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)] truncate">{b.url}</div>
          </button>
          <button
            onClick={() => void api.bookmarks.remove(b.id).then(refresh)}
            className="opacity-0 group-hover:opacity-100 text-[var(--color-text-secondary)] hover:text-red-500 transition-opacity"
          >
            <Icon name="x" size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}

function SmallAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] px-2 py-1 rounded-md text-[var(--color-text-secondary)] hover:bg-black/[0.06] dark:hover:bg-white/10">
      {label}
    </button>
  );
}
