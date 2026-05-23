"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Upload, FileText, X } from "lucide-react";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  className?: string;
}

export function UploadZone({
  onFileSelect,
  accept = ".pdf,.docx,.doc,.txt",
  className,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        setSelectedFile(files[0]);
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        setSelectedFile(files[0]);
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  const clearFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  if (selectedFile) {
    return (
      <div
        className={cn(
          "rounded-2xl border-2 border-primary bg-primary-light/30 p-8",
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {selectedFile.name}
              </p>
              <p className="text-sm text-muted">
                {formatSize(selectedFile.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearFile}
            aria-label="Удалить выбранный файл"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={cn(
        "group relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all",
        isDragging
          ? "border-primary bg-primary-light/30 scale-[1.02]"
          : "border-border hover:border-primary/50 hover:bg-surface/50",
        className
      )}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileInput}
        aria-label="Выбрать файл для загрузки"
        className="absolute inset-0 cursor-pointer opacity-0"
      />
      <div className="flex flex-col items-center gap-3">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl transition-colors",
            isDragging ? "bg-primary/10" : "bg-surface group-hover:bg-primary/5"
          )}
        >
          <Upload
            className={cn(
              "h-8 w-8 transition-colors",
              isDragging ? "text-primary" : "text-muted group-hover:text-primary"
            )}
          />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            Перетащите файл или нажмите для выбора
          </p>
          <p className="mt-1 text-sm text-muted">PDF, DOCX, DOC, TXT — до 10 МБ</p>
        </div>
      </div>
    </div>
  );
}
