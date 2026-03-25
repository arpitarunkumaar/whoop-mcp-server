export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-serif text-lg font-medium text-foreground">
            WHOOP Analytics
          </span>
        </div>
      </div>
    </header>
  )
}
