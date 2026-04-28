import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-20">
      <div className="text-center max-w-md">
        <FileQuestion className="h-12 w-12 text-muted mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">
          Страница не найдена
        </h2>
        <p className="text-sm text-muted mb-6">
          Такой страницы не существует или она была перемещена.
        </p>
        <Link
          href="/"
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
