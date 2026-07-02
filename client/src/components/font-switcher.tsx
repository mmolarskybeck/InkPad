import { useState, useEffect } from "react";

const FONTS = [
  { name: "Inter", value: "Inter" },
  { name: "Outfit", value: "Outfit" },
  { name: "Geist", value: "'Geist Sans', sans-serif" },
  { name: "Plus Jakarta Sans", value: "'Plus Jakarta Sans'" },
  { name: "Lato", value: "Lato" },
];

export function FontSwitcher() {
  const [activeFont, setActiveFont] = useState(FONTS[0].value);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-sans', activeFont);
  }, [activeFont]);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] bg-panel-bg border border-border-color p-2 rounded-md shadow-lg flex flex-col gap-2 opacity-30 hover:opacity-100 transition-opacity">
      <div className="text-[0.75rem] text-text-secondary font-mono px-1">Font Test</div>
      <select 
        value={activeFont}
        onChange={(e) => setActiveFont(e.target.value)}
        className="bg-editor-bg text-text-primary text-[0.875rem] p-1.5 rounded border border-border-color outline-none focus:border-accent-blue"
      >
        {FONTS.map(f => (
          <option key={f.name} value={f.value}>{f.name}</option>
        ))}
      </select>
    </div>
  );
}
