import React from 'react';
import { useContextMenuPosition } from '../hooks/useContextMenuPosition';

interface ContextMenuProps {
  x: number;
  y: number;
  children: React.ReactNode;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, children }) => {
  const { menuRef, position } = useContextMenuPosition(x, y);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[200px]"
      style={{ left: position.left, top: position.top }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
};
