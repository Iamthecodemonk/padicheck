import React, { useState, type Dispatch, type SetStateAction } from 'react';
import { CloudUploadIcon, FileAudioIcon, FileIcon, FileTextIcon, ImageIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { DATA_SAVER_WARN_BYTES, MAX_UPLOAD_BYTES, detectFileKind, formatBytes, makeId, processorFor, type FileKind } from '../../utils/checks';
import type { UploadItem } from '../../types/check';

interface FileUploadProps {
  items: UploadItem[];
  onChange: Dispatch<SetStateAction<UploadItem[]>>;
  accept: string;
  formats: string;
  dataSaver: boolean;
}

const kindIcons: Record<FileKind, typeof FileIcon> = {
  image: ImageIcon,
  pdf: FileTextIcon,
  document: FileTextIcon,
  text: FileTextIcon,
  audio: FileAudioIcon,
  unsupported: FileIcon
};

export function FileUpload({ items, onChange, accept, formats, dataSaver }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  const update = (id: string, patch: Partial<UploadItem>) => onChange((list) => list.map((i) => i.id === id ? { ...i, ...patch } : i));

  const add = (files: FileList | File[] | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const id = makeId('f');
      const kind = detectFileKind(file);
      if (kind === 'unsupported') {
        onChange((l) => [...l, { id, file, progress: 0, status: 'error', error: 'This file type isn’t supported' }]);
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        onChange((l) => [...l, { id, file, progress: 0, status: 'error', error: 'Larger than 20 MB' }]);
        return;
      }
      onChange((l) => [...l, { id, file, progress: 0, status: 'reading' }]);
      // Files are prepared locally; nothing is uploaded until the check is confirmed.
      const reader = new FileReader();
      reader.onprogress = (e) => e.lengthComputable && update(id, { progress: Math.round(e.loaded / e.total * 100) });
      reader.onload = () => update(id, { progress: 100, status: 'ready' });
      reader.onerror = () => update(id, { status: 'error', error: 'Couldn’t read this file' });
      reader.readAsArrayBuffer(file);
    });
  };

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          add(e.dataTransfer.files);
        }}
        className={`flex min-h-[156px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 text-center transition-colors ${
        dragOver ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-muted/40'}`
        }>
        
        <CloudUploadIcon className="h-8 w-8 text-brand" aria-hidden="true" />
        <span className="mt-3 font-semibold text-ink">Choose files</span>
        <span className="mt-1 text-sm text-muted">
          <span className="hidden lg:inline">or drag them here · </span>
          {formats}
        </span>
        <input type="file" multiple accept={accept} className="sr-only" onChange={(e) => add(e.target.files)} />
      </label>

      {items.length > 0 &&
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
          {items.map((item) => {
          const kind = detectFileKind(item.file);
          const Icon = kindIcons[kind];
          const large = dataSaver && item.file.size > DATA_SAVER_WARN_BYTES;
          return (
            <li key={item.id} className="flex items-center gap-3 py-3 pl-4 pr-2">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.status === 'error' ? 'bg-danger-soft text-danger' : 'bg-canvas text-ink'}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{item.file.name}</p>
                  <p className={`text-sm ${item.status === 'error' ? 'text-danger' : 'text-muted'}`}>
                    {formatBytes(item.file.size)} ·{' '}
                    {item.status === 'error' ? item.error : item.status === 'reading' ? `Preparing ${item.progress}%` : `Ready · ${processorFor(kind)}`}
                  </p>
                  {item.status === 'reading' &&
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Preparing ${item.file.name}`}>
                      <div className="h-full rounded-full bg-brand transition-[width] duration-150" style={{ width: `${item.progress}%` }} />
                    </div>
                }
                  {large && item.status === 'ready' &&
                <p className="mt-1 flex items-center gap-1 text-xs text-caution">
                      <TriangleAlertIcon className="h-3.5 w-3.5" aria-hidden="true" /> Data Saver is on — this upload uses about {formatBytes(item.file.size)}
                    </p>
                }
                </div>
                <button
                type="button"
                onClick={() => onChange((l) => l.filter((i) => i.id !== item.id))}
                aria-label={`Remove ${item.file.name}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-canvas hover:text-ink">
                
                  <XIcon className="h-4 w-4" />
                </button>
              </li>);

        })}
        </ul>
      }
    </div>);

}