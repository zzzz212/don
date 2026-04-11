export function Disclaimer() {
  return (
    <footer className="border-t border-border bg-surface/50 py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs text-muted">
          Сервис носит информационный характер и не является юридической
          консультацией. Для принятия юридически значимых решений обратитесь к
          квалифицированному юристу. © {new Date().getFullYear()} ЮрИИст
        </p>
      </div>
    </footer>
  );
}
