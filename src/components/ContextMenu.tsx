import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { Edit, Copy, Archive, Trash2, Eye, Download, CreditCard } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose?: () => void;
  children: React.ReactNode;
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  variant?: 'default' | 'danger';
  separator?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, children }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: x, top: y });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const { offsetWidth: menuWidth, offsetHeight: menuHeight } = menu;
    const { innerWidth: viewWidth, innerHeight: viewHeight } = window;
    const padding = 10;

    let left = x;
    let top = y;

    if (x + menuWidth > viewWidth - padding) {
      left = x - menuWidth;
    }
    if (y + menuHeight > viewHeight - padding) {
      top = y - menuHeight;
    }
    if (left < padding) left = padding;
    if (top < padding) top = padding;

    setPosition({ left, top });
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="context-menu animate-scale-in fixed z-50"
      style={position}
    >
      {children}
    </div>
  );
};

// Context menu presets
export const praticaContextMenu = (
  onEdit: () => void,
  onDuplicate: () => void,
  onArchive: () => void,
  onDelete: () => void
): ContextMenuItem[] => [
  { id: 'edit', label: 'Modifica', icon: Edit, action: onEdit },
  { id: 'duplicate', label: 'Duplica', icon: Copy, action: onDuplicate },
  { id: 'separator', label: '', icon: Edit, action: () => {}, separator: true },
  { id: 'archive', label: 'Archivia', icon: Archive, action: onArchive },
  { id: 'delete', label: 'Elimina', icon: Trash2, action: onDelete, variant: 'danger' }
];

export const contattoContextMenu = (
  onCall: () => void,
  onEmail: () => void,
  onEdit: () => void,
  onDelete: () => void
): ContextMenuItem[] => [
  { id: 'call', label: 'Chiama', icon: CreditCard, action: onCall },
  { id: 'email', label: 'Invia email', icon: Edit, action: onEmail },
  { id: 'edit', label: 'Modifica', icon: Edit, action: onEdit },
  { id: 'separator', label: '', icon: Edit, action: () => {}, separator: true },
  { id: 'delete', label: 'Elimina', icon: Trash2, action: onDelete, variant: 'danger' }
];

export const fatturaContextMenu = (
  onView: () => void,
  onDownload: () => void,
  onRegisterPayment: () => void,
  onDelete: () => void
): ContextMenuItem[] => [
  { id: 'view', label: 'Visualizza', icon: Eye, action: onView },
  { id: 'download', label: 'Scarica PDF', icon: Download, action: onDownload },
  { id: 'payment', label: 'Registra pagamento', icon: CreditCard, action: onRegisterPayment },
  { id: 'separator', label: '', icon: Edit, action: () => {}, separator: true },
  { id: 'delete', label: 'Elimina', icon: Trash2, action: onDelete, variant: 'danger' }
];

// Hook for context menu
export const useContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  const showContextMenu = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items
    });
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu
  };
};
