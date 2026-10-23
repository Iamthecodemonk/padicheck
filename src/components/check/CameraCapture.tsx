import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CameraIcon, CameraOffIcon, ImageIcon, RotateCcwIcon } from 'lucide-react';

interface CameraCaptureProps {
  photo: string | null;
  onChange: (photo: string | null) => void;
  onUse: () => void;
  dataSaver: boolean;
}

type CameraState = 'starting' | 'live' | 'blocked';

export function CameraCapture({ photo, onChange, onUse, dataSaver }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('starting');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('blocked');
      return;
    }
    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: dataSaver ? 1280 : 1920 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState('live');
    } catch {
      setState('blocked');
    }
  }, [dataSaver]);

  useEffect(() => {
    if (!photo) void start();
    return stop;
    // Only start on mount; retake restarts explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = dataSaver ? Math.min(1, 1280 / video.videoWidth) : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL('image/jpeg', dataSaver ? 0.6 : 0.85));
    stop();
  };

  const retake = () => {
    onChange(null);
    void start();
  };

  const fromFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };

  if (photo) {
    return (
      <div>
        <div className="overflow-hidden rounded-3xl bg-ink">
          <img src={photo} alt="Your capture" className="mx-auto max-h-[56dvh] w-full object-contain" />
        </div>
        <p className="mt-3 text-sm text-muted">Make sure the text is readable and nothing important is cut off.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={retake} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface font-semibold text-ink transition-colors hover:bg-canvas">
            <RotateCcwIcon className="h-4 w-4" aria-hidden="true" /> Retake
          </button>
          <button type="button" onClick={onUse} className="h-12 rounded-2xl bg-ink font-semibold text-white transition-colors hover:bg-ink-soft">
            Use photo
          </button>
        </div>
      </div>);

  }

  return (
    <div>
      <div className="relative aspect-[3/4] max-h-[60dvh] w-full overflow-hidden rounded-3xl bg-ink sm:aspect-[4/3]">
        <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${state === 'live' ? '' : 'invisible'}`} />
        {state === 'live' &&
        <div aria-hidden="true" className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/60" />
        }
        {state === 'starting' && <p className="absolute inset-0 grid place-items-center text-sm text-navy-text">Opening camera…</p>}
        {state === 'blocked' &&
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <CameraOffIcon className="h-8 w-8 text-navy-text" aria-hidden="true" />
            <p className="font-semibold text-white">Camera isn’t available here</p>
            <p className="text-sm text-navy-text">Allow camera access in your settings, or use your phone’s camera app instead.</p>
          </div>
        }
      </div>

      {state === 'live' ?
      <div className="mt-5 flex items-center justify-center">
          <button
          type="button"
          onClick={capture}
          aria-label="Take photo"
          className="grid h-[72px] w-[72px] place-items-center rounded-full border-4 border-ink bg-surface transition-transform duration-150 ease-out active:scale-[0.94]">
          
            <span className="h-14 w-14 rounded-full bg-ink" />
          </button>
        </div> :

      <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-ink font-semibold text-white transition-colors hover:bg-ink-soft">
            <CameraIcon className="h-4 w-4" aria-hidden="true" /> Camera app
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => fromFile(e.target.files?.[0])} />
          </label>
          <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-line bg-surface font-semibold text-ink transition-colors hover:bg-canvas">
            <ImageIcon className="h-4 w-4" aria-hidden="true" /> Gallery
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => fromFile(e.target.files?.[0])} />
          </label>
        </div>
      }
      <p className="mt-3 text-center text-sm text-muted">Fit the listing, label or document inside the frame.</p>
    </div>);

}