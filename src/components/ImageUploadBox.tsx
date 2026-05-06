"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MAX_SIZE_MB = 5;

export default function ImageUploadBox({
  images,
  onChange,
  userId,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  userId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: File[]) => {
    setError(null);
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (valid.length === 0) return;

    const oversize = valid.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversize) {
      setError(`파일이 너무 큽니다 (${MAX_SIZE_MB}MB 이하만 허용)`);
      return;
    }

    setUploading(true);
    const supabase = createSupabaseBrowserClient();
    const uploaded: string[] = [];

    for (const file of valid) {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("report-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setError("업로드 실패: " + upErr.message);
        continue;
      }
      const { data } = supabase.storage.from("report-images").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }

    onChange([...images, ...uploaded]);
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) uploadFiles(files);
  };

  const removeImage = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {/* 업로드 박스 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
        onClick={() => inputRef.current?.click()}
        tabIndex={0}
        className={`relative cursor-pointer rounded-lg border-2 border-dashed transition-colors p-8 text-center ${
          dragOver
            ? "border-accent bg-accent/5"
            : "border-border-default bg-surface hover:bg-black/[0.03]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            uploadFiles(files);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-foreground/60">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-xs">업로드 중...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-foreground/60">
            <Upload size={20} strokeWidth={1.75} />
            <div className="text-xs">
              <span className="font-medium text-foreground/80">클릭</span>하거나{" "}
              <span className="font-medium text-foreground/80">드래그</span>해서
              사진 첨부
            </div>
            <div className="text-[10px] text-foreground/40">
              복사 + Ctrl+V도 가능 · 5MB 이하
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 px-3 py-2 rounded-md bg-red-50 border border-red-200">
          {error}
        </div>
      )}

      {/* 미리보기 그리드 */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, idx) => (
            <div key={url} className="relative group aspect-video bg-surface rounded-md overflow-hidden border border-border-default">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="삭제"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
