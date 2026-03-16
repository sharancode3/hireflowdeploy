import { Link } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";

export function ThemePage() {
  const { theme, setTheme } = useTheme();
  // TODO: Create a theme audit checklist - walk through every page and component in all 3 themes and flag any element that does not correctly reflect the active theme.

  return (
    <div className="grid">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Theme</h2>
            <p className="muted" style={{ margin: 0 }}>
              Switch themes instantly. Your choice is saved.
            </p>
          </div>
          <Link className="btn" to="../settings">
            Open Settings
          </Link>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <label className="badge badge-accent">
            <input type="radio" name="theme" checked={theme === "light"} onChange={() => setTheme("light")} />
            Light
          </label>
          <label className="badge badge-accent">
            <input
              type="radio"
              name="theme"
              checked={theme === "soft-dark"}
              onChange={() => setTheme("soft-dark")}
            />
            Soft dark
          </label>
          <label className="badge badge-accent">
            <input
              type="radio"
              name="theme"
              checked={theme === "high-contrast"}
              onChange={() => setTheme("high-contrast")}
            />
            High contrast
          </label>
        </div>
      </div>
    </div>
  );
}
