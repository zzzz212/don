"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import {
  Search,
  Loader2,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  ArrowRight,
} from "lucide-react";

interface LegalArticle {
  id: string;
  code: string;
  type: string;
  title: string;
  shortTitle: string;
  fullText?: string;
  commentary?: string;
  practiceNotes?: string;
  relatedCodes?: string[];
  tags?: string[];
}

export default function LegalReferencePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LegalArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<LegalArticle | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"search" | "bookmarks">(
    "search"
  );

  // Load user's bookmarks on mount
  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      const response = await fetch("/api/legal/references");
      if (response.ok) {
        const data = await response.json();
        const bookmarkedIds = new Set<string>(
          data.references.map((ref: { knownId: string }) => ref.knownId)
        );
        setBookmarked(bookmarkedIds);
      }
    } catch (error) {
      console.error("Error loading bookmarks:", error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/legal/search?q=${encodeURIComponent(query)}&limit=20`
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectArticle = async (article: LegalArticle) => {
    try {
      const response = await fetch(`/api/legal/${article.code}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedArticle(data.knowledge);
      }
    } catch (error) {
      console.error("Error loading article:", error);
    }
  };

  const handleToggleBookmark = async (articleId: string) => {
    try {
      if (bookmarked.has(articleId)) {
        // Delete bookmark
        const response = await fetch(
          `/api/legal/references?knownId=${articleId}`,
          { method: "DELETE" }
        );
        if (response.ok) {
          const newBookmarked = new Set(bookmarked);
          newBookmarked.delete(articleId);
          setBookmarked(newBookmarked);
        }
      } else {
        // Add bookmark
        const response = await fetch("/api/legal/references", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ knownId: articleId }),
        });
        if (response.ok) {
          setBookmarked(new Set([...bookmarked, articleId]));
        }
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <BookOpen className="h-8 w-8" />
              Справочник российского права
            </h1>
            <p className="text-muted">
              Полная база знаний Гражданского кодекса, Трудового кодекса и других законов РФ
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-border">
            <button
              onClick={() => setActiveTab("search")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "search"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              🔍 Поиск
            </button>
            <button
              onClick={() => setActiveTab("bookmarks")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "bookmarks"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              🔖 Закладки
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Search panel */}
            <div className={`lg:col-span-${selectedArticle ? "1" : "3"}`}>
              <div className="bg-white rounded-lg border border-border p-6">
                <form onSubmit={handleSearch} className="mb-6">
                  <div className="relative">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Искать статьи, коды, ключевые слова..."
                      className="w-full rounded-lg border border-border bg-white px-4 py-3 pr-12 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="absolute right-3 top-3 text-muted hover:text-foreground"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Search className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </form>

                {/* Results */}
                <div className="space-y-2">
                  {results.length === 0 && !loading && query && (
                    <p className="text-sm text-muted py-8 text-center">
                      Результатов не найдено
                    </p>
                  )}

                  {results.map((article) => (
                    <button
                      key={article.id}
                      onClick={() => handleSelectArticle(article)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedArticle?.id === article.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary hover:bg-surface"
                      }`}
                    >
                      <p className="font-semibold text-sm text-foreground">
                        {article.shortTitle}
                      </p>
                      <p className="text-xs text-muted line-clamp-2">
                        {article.title}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Article preview */}
            {selectedArticle && (
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg border border-border p-6 space-y-6 max-h-96 overflow-y-auto">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-foreground mb-1">
                        {selectedArticle.title}
                      </h2>
                      <p className="text-sm text-muted">
                        Код: {selectedArticle.code}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleToggleBookmark(selectedArticle.id)
                      }
                      className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                    >
                      {bookmarked.has(selectedArticle.id) ? (
                        <>
                          <BookmarkCheck className="h-4 w-4 inline mr-2 text-primary" />
                          Сохранено
                        </>
                      ) : (
                        <>
                          <Bookmark className="h-4 w-4 inline mr-2" />
                          Сохранить
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      Текст статьи
                    </h3>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {selectedArticle.fullText}
                    </p>
                  </div>

                  {selectedArticle.commentary && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">
                        💡 Пояснения
                      </h3>
                      <p className="text-sm text-foreground">
                        {selectedArticle.commentary}
                      </p>
                    </div>
                  )}

                  {selectedArticle.practiceNotes && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">
                        ⚖️ Судебная практика
                      </h3>
                      <p className="text-sm text-foreground">
                        {selectedArticle.practiceNotes}
                      </p>
                    </div>
                  )}

                  {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">
                        🏷️ Теги
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedArticle.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Empty state */}
          {!selectedArticle && activeTab === "search" && !loading && (
            <div className="text-center py-16">
              <BookOpen className="h-16 w-16 text-muted mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Справочник российского права
              </h3>
              <p className="text-muted max-w-md mx-auto">
                Начните поиск, введя ключевые слова, номер статьи или кодекс
              </p>
            </div>
          )}
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
