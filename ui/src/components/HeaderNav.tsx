import { classNames } from "../utils/classNames";

export type AppSection = "analysis" | "settings";

interface HeaderNavProps {
  active: AppSection;
  onSelect: (section: AppSection) => void;
}

export function HeaderNav({ active, onSelect }: HeaderNavProps): JSX.Element {
  return (
    <nav className="app-navigation" aria-label="App sections">
      <button
        type="button"
        className={classNames("tertiary-button", "app-nav-button", active === "analysis" ? "is-active" : undefined)}
        aria-current={active === "analysis" ? "page" : undefined}
        onClick={() => onSelect("analysis")}
      >
        UX Analysis
      </button>
      <button
        type="button"
        className={classNames("tertiary-button", "app-nav-button", active === "settings" ? "is-active" : undefined)}
        aria-current={active === "settings" ? "page" : undefined}
        onClick={() => onSelect("settings")}
      >
        Settings
      </button>
    </nav>
  );
}

