"use client"

import { useState } from "react"

export function Header() {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="font-serif text-xl font-medium text-foreground">
            WHOOP Analytics
          </span>
          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#"
              className="text-sm font-medium text-teal transition-colors hover:text-teal-light"
            >
              Dashboard
            </a>
            <a
              href="#"
              className="text-sm text-foreground-muted transition-colors hover:text-foreground"
            >
              History
            </a>
            <a
              href="#"
              className="text-sm text-foreground-muted transition-colors hover:text-foreground"
            >
              Insights
            </a>
            <a
              href="#"
              className="text-sm text-foreground-muted transition-colors hover:text-foreground"
            >
              Settings
            </a>
          </nav>
        </div>
        <button
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="rounded-full p-2 text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          aria-label="Toggle theme"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </button>
      </div>
    </header>
  )
}
