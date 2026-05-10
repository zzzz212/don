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
  Sparkles,
  Type,
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
  /** Present only on vector-search results: cosine similarity in [0, 1]. */
  similarity?: number;
}

type SearchMode = "keyword" | "vector";

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
  const [searchMode, setSearchMode] = useState<SearchMode>("keyword");
  const [searchNote, setSearchNote] = useState<string | null>(null);

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
    setSearchNote(null);
    try {
      const response = await fetch(
        `/api/legal/search?q=${encodeURIComponent(query)}&limit=20&mode=${searchMode}`
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.results ?? []);
        if (data.note) setSearchNote(data.note);
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
                {/* Mode toggle: keyword vs semantic */}
                <div className="mb-3 inline-flex rounded-lg border border-border bg-surface p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSearchMode("keyword")}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                      searchMode === "keyword"
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                    title="Точное совпадение по словам, кодам, заголовкам"
                  >
                    <Type className="h-3.5 w-3.5" />
                    По словам
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchMode("vector")}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                      searchMode === "vector"
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                    title="Семантический поиск по смыслу через embeddings"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    По смыслу
                  </button>
                </div>

                <form onSubmit={handleSearch} className="mb-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={
                        searchMode === "vector"
                          ? "Опишите ситуацию своими словами..."
                          : "Искать статьи, коды, ключевые слова..."
                      }
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

                {searchNote && (
                  <p className="mb-3 text-xs text-muted bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    {searchNote}
                  </p>
                )}

                {/* Results */}
                <div className="space-y-2">
                  {results.length === 0 && !loading && query && !searchNote && (
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
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-foreground flex-1">
                          {article.shortTitle}
                        </p>
                        {typeof article.similarity === "number" && (
                          <span
                            className="shrink-0 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700"
                            title={`Косинусная близость: ${article.similarity.toFixed(3)}`}
                          >
                            {Math.round(article.similarity * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted line-clamp-2 mt-0.5">
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
