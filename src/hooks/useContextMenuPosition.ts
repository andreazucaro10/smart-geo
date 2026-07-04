import { useRef, useLayoutEffect, useState } from 'react';

interface Position {
  left: number;
  top: number;
}

export function useContextMenuPosition(x: number, y: number) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const { offsetWidth: menuWidth, offsetHeight: menuHeight } = menu;
    const { innerWidth: viewWidth, innerHeight: viewHeight } = window;

    let left = x;
    let top = y;

    if (x + menuWidth > viewWidth) {
      left = x - menuWidth;
    }
    if (y + menuHeight > viewHeight) {
      top = y - menuHeight;
    }
    if (left < 0) left = 0;
    if (top < 0) top = 0;

    setPosition({ left, top });
  }, [x, y]);

  return { menuRef, position };
}
