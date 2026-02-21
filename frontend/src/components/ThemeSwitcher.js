import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, THEMES } from '@/contexts/ThemeContext';
import { Check } from 'lucide-react';

export const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = THEMES.find(t => t.id === theme) || THEMES[0];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative" data-testid="theme-switcher">
      {/* Trigger pill */}
      <button
        onClick={() => setOpen(v => !v)}
        data-testid="theme-switcher-trigger"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border theme-pill-btn transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ minWidth: 120 }}
      >
        {/* Swatch row */}
        <span className="flex gap-0.5">
          {current.swatches.map((c, i) => (
            <span
              key={i}
              className="w-3 h-3 rounded-full block"
              style={{ background: c }}
            />
          ))}
        </span>
        <span className="text-xs font-medium leading-none truncate theme-pill-text">
          {current.emoji} {current.name}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-auto text-[10px] leading-none opacity-60"
        >
          ▾
        </motion.span>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 z-[200] rounded-2xl shadow-2xl overflow-hidden theme-dropdown"
            style={{ width: 220 }}
            data-testid="theme-dropdown"
          >
            <div className="p-2 space-y-1">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  data-testid={`theme-option-${t.id}`}
                  onClick={() => { setTheme(t.id); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group theme-dropdown-item ${
                    theme === t.id ? 'theme-dropdown-item-active' : ''
                  }`}
                >
                  {/* Swatch strip */}
                  <span className="flex gap-0.5 flex-shrink-0">
                    {t.swatches.map((c, i) => (
                      <span
                        key={i}
                        className="w-4 h-4 rounded-full shadow-sm"
                        style={{ background: c }}
                      />
                    ))}
                  </span>

                  <span className="flex-1 text-left">
                    <span className="block text-sm font-semibold leading-tight theme-dropdown-label">
                      {t.emoji} {t.name}
                    </span>
                    <span className="block text-[11px] leading-tight theme-dropdown-desc mt-0.5">
                      {t.desc}
                    </span>
                  </span>

                  {theme === t.id && (
                    <Check className="w-4 h-4 flex-shrink-0 theme-check-icon" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
