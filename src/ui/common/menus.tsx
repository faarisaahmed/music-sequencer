import { ChevronLeft, ChevronRight } from 'lucide-react';
import { heldRecently, isPhone } from '../mobile/device';
import { Sheet, SheetItem } from '../mobile/Sheet';
import { shortcutLabel } from '../keys/keymap';
// Context menus and the GarageBand-style pill edit menu, driven by a tiny global store.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { create } from 'zustand';

export interface MenuItem {
  label?: string;
  shortcut?: string;
  /** Keymap command: its current shortcut is shown (and stays right if you change it). */
  cmd?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  separator?: boolean;
  title?: string;
  submenu?: MenuItem[];
}

interface MenuState {
  menu: { x: number; y: number; items: MenuItem[] } | null;
  pill: { x: number; y: number; items: MenuItem[] } | null;
}

const useMenus = create<MenuState>(() => ({ menu: null, pill: null }));

export function showContextMenu(e: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void }, items: MenuItem[]): void {
  e.preventDefault?.();
  e.stopPropagation?.();
  useMenus.setState({ menu: { x: e.clientX, y: e.clientY, items }, pill: null });
}

/** Floating horizontal "Cut | Copy | Delete | …" menu centred above (x, y). */
export function showPillMenu(x: number, y: number, items: MenuItem[]): void {
  if (heldRecently()) return; // a press-and-hold already opened the full menu
  useMenus.setState({ pill: { x, y, items }, menu: null });
}

export function closeMenus(): void {
  useMenus.setState({ menu: null, pill: null });
}

function MenuList({ items, x, y, onClose }: { items: MenuItem[]; x: number; y: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [sub, setSub] = useState<{ idx: number; x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.min(x, window.innerWidth - r.width - 6),
      y: Math.min(y, window.innerHeight - r.height - 6),
    });
  }, [x, y]);
  return (
    <>
      <div ref={ref} className="menu" style={{ left: pos.x, top: pos.y }} onPointerDown={(e) => e.stopPropagation()}>
        {items.map((it, i) =>
          it.separator ? (
            <div key={i} className="menu-sep" />
          ) : it.title ? (
            <div key={i} className="menu-title">
              {it.title}
            </div>
          ) : (
            <div
              key={i}
              className={'menu-item' + (it.disabled ? ' disabled' : '')}
              onMouseEnter={(e) => {
                if (it.submenu) {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setSub({ idx: i, x: r.right - 4, y: r.top - 5 });
                } else setSub(null);
              }}
              onClick={() => {
                if (it.submenu) return;
                onClose();
                it.onClick?.();
              }}
            >
              {it.icon && <span style={{ display: 'flex', width: 16, opacity: 0.85 }}>{it.icon}</span>}
              <span>{it.label}</span>
              {(it.cmd ? shortcutLabel(it.cmd) : it.shortcut) && <span className="shortcut">{it.cmd ? shortcutLabel(it.cmd) : it.shortcut}</span>}
              {it.submenu && <span className="shortcut"><ChevronRight size={13} /></span>}
            </div>
          ),
        )}
      </div>
      {sub && items[sub.idx]?.submenu && <MenuList items={items[sub.idx].submenu!} x={sub.x} y={sub.y} onClose={onClose} />}
    </>
  );
}

/** Phones: menus open as a bottom sheet with big rows; submenus slide in with a Back row. */
function PhoneMenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const [stack, setStack] = useState<{ title?: string; items: MenuItem[] }[]>([]);
  const cur = stack.length ? stack[stack.length - 1] : { title: items.find((i) => i.title)?.title, items };
  return (
    <Sheet title={cur.title} onClose={onClose}>
      {stack.length > 0 && <SheetItem icon={<ChevronLeft size={18} />} label="Back" onClick={() => setStack(stack.slice(0, -1))} />}
      {cur.items.map((it, i) =>
        it.separator ? (
          <div key={i} className="m-sheet-sep" />
        ) : it.title ? null : (
          <SheetItem
            key={i}
            icon={it.icon}
            label={it.label}
            disabled={it.disabled}
            danger={/^(Delete|Remove)/.test(it.label ?? '')}
            more={!!it.submenu}
            onClick={() => {
              if (it.submenu) setStack([...stack, { title: it.label, items: it.submenu }]);
              else {
                onClose();
                it.onClick?.();
              }
            }}
          />
        ),
      )}
    </Sheet>
  );
}

export function MenuHost() {
  const { menu, pill } = useMenus();
  const pillRef = useRef<HTMLDivElement>(null);
  const [pillX, setPillX] = useState(0);
  useEffect(() => {
    if ((!menu && !pill) || (menu && isPhone())) return;
    const close = () => closeMenus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const t = setTimeout(() => {
      window.addEventListener('pointerdown', close);
      window.addEventListener('wheel', close, { passive: true });
      window.addEventListener('keydown', onKey);
      window.addEventListener('blur', close);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('wheel', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', close);
    };
  }, [menu, pill]);
  useLayoutEffect(() => {
    if (pill && pillRef.current) {
      const w = pillRef.current.getBoundingClientRect().width;
      setPillX(Math.max(6, Math.min(window.innerWidth - w - 6, pill.x - w / 2)));
    }
  }, [pill]);
  return (
    <>
      {menu && (isPhone() ? <PhoneMenu items={menu.items} onClose={closeMenus} /> : <MenuList items={menu.items} x={menu.x} y={menu.y} onClose={closeMenus} />)}
      {pill && (
        <div ref={pillRef} className="pill-menu" style={{ left: pillX, top: Math.max(6, pill.y - 46) }} onPointerDown={(e) => e.stopPropagation()}>
          {pill.items
            .filter((i) => !i.separator && !i.disabled)
            .map((it, i) => (
              <button
                key={i}
                onClick={() => {
                  closeMenus();
                  it.onClick?.();
                }}
              >
                {it.label}
              </button>
            ))}
        </div>
      )}
    </>
  );
}
