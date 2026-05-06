"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2, Plus } from "lucide-react";
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

  const openPicker = () => inputRef.current?.click();
  const hasImages = images.length > 0;

  return (
    <div className="space-y-3">
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

      {/* 큰 정사각형 박스 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
        onClick={!hasImages ? openPicker : undefined}
        tabIndex={0}
        className={`relative aspect-square w-full max-w-md rounded-lg overflow-hidden border-2 transition-colors ${
          hasImages
            ? "border-border-default"
            : `border-dashed cursor-pointer ${
                dragOver ? "border-accent bg-accent/5" : "border-border-default bg-surface hover:bg-black/[0.03]"
              }`
        }`}
      >
        {hasImages ? (
          <ImageGrid images={images} onRemove={removeImage} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-foreground/60">
            {uploading ? (
              <>
                <Loader2 size={28} className="animate-spin" />
                <span className="text-sm">업로드 중...</span>
              </>
            ) : (
              <>
                <Upload size={28} strokeWidth={1.5} />
                <div className="text-center">
                  <div className="text-sm font-medium text-foreground/80 mb-1">사진 첨부</div>
                  <div className="text-xs text-foreground/50">
                    클릭 · 드래그 · Ctrl+V로 붙여넣기
                  </div>
                  <div className="text-[10px] text-foreground/40 mt-1">
                    이미지 5MB 이하
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 박스 안에 업로드 진행 인디케이터 (이미지가 있을 때) */}
        {hasImages && uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
            <Loader2 size={24} className="animate-spin" />
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 px-3 py-2 rounded-md bg-red-50 border border-red-200">
          {error}
        </div>
      )}

      {/* 추가 버튼 */}
      {hasImages && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-default text-sm text-foreground/70 hover:bg-surface transition-colors disabled:opacity-50"
          >
            <Plus size={14} strokeWidth={1.75} />
            사진 추가
          </button>
          <span className="text-xs text-foreground/40">
            {images.length}장 첨부됨
          </span>
        </div>
      )}
    </div>
  );
}

function ImageGrid({
  images,
  onRemove,
}: {
  images: string[];
  onRemove: (idx: number) => void;
}) {
  const n = images.length;

  // 1장: 통째로
  if (n === 1) {
    return <Tile url={images[0]} onRemove={() => onRemove(0)} />;
  }

  // 2장: 좌우 분할
  if (n === 2) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        <Tile url={images[0]} onRemove={() => onRemove(0)} />
        <Tile url={images[1]} onRemove={() => onRemove(1)} />
      </div>
    );
  }

  // 3장: 큰 1 + 작은 2
  if (n === 3) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        <Tile url={images[0]} onRemove={() => onRemove(0)} />
        <div className="grid grid-rows-2 gap-0.5">
          <Tile url={images[1]} onRemove={() => onRemove(1)} />
          <Tile url={images[2]} onRemove={() => onRemove(2)} />
        </div>
      </div>
    );
  }

  // 4장 이상: 2x2 그리드 (5장째부터 +N)
  return (
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
      {images.slice(0, 4).map((url, i) => (
        <div key={url} className="relative">
          <Tile url={url} onRemove={() => onRemove(i)} />
          {i === 3 && n > 4 && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-xl font-semibold pointer-events-none">
              +{n - 4}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Tile({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div className="relative w-full h-full bg-surface group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="w-full h-full object-cover" />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        title="삭제"
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  );
}
