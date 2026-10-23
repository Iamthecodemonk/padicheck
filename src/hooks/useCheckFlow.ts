import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { usePersistentState } from './usePersistentState';
import { usePwa } from '../contexts/PwaContext';
import { useUser } from '../contexts/UserContext';
import { demoResultByType } from '../data/results';
import { domainOf, getCheckType, looksLikeUrl, makeId } from '../utils/checks';
import { takeSharedFiles } from '../utils/shareInbox';
import type { InputMode, UploadItem } from '../types/check';

const MODES: InputMode[] = ['link', 'text', 'camera', 'upload'];

export function useCheckFlow() {
  const { type } = useParams<{type: string;}>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { online } = usePwa();
  const { credits, spendCredits, enqueue } = useUser();
  const option = getCheckType(type);

  const requested = params.get('mode') as InputMode | null;
  const initialMode: InputMode =
  requested && MODES.includes(requested) ?
  requested :
  params.get('url') || option.id === 'link' ?
  'link' :
  option.id === 'contract' ?
  'upload' :
  'text';

  const [mode, setMode] = useState<InputMode>(initialMode);
  const [url, setUrl] = usePersistentState(`pc-draft-${option.id}-url`, '');
  const [text, setText] = usePersistentState(`pc-draft-${option.id}-text`, '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>(() =>
  takeSharedFiles().map((file) => ({ id: makeId('f'), file, progress: 100, status: 'ready' as const }))
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const incomingUrl = params.get('url');
    const incomingText = params.get('text');
    if (incomingUrl) setUrl(incomingUrl);
    if (incomingText) setText(incomingText);
    // Apply deep-link / share payload once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readyUploads = uploads.filter((u) => u.status === 'ready');
  const cost = option.credits + (mode === 'upload' ? Math.max(0, readyUploads.length - 1) : 0);

  const ready =
  mode === 'link' ?
  looksLikeUrl(url) :
  mode === 'text' ?
  text.trim().length >= 12 :
  mode === 'camera' ?
  photo !== null :
  readyUploads.length > 0 && !uploads.some((u) => u.status === 'reading');

  const summary =
  mode === 'link' ?
  domainOf(url) :
  mode === 'text' ?
  `“${text.trim().slice(0, 70)}${text.trim().length > 70 ? '…' : ''}”` :
  mode === 'camera' ?
  'Photo from your camera' :
  readyUploads.length === 1 ?
  readyUploads[0].file.name :
  `${readyUploads.length} files`;

  const sizeBytes =
  mode === 'upload' ?
  readyUploads.reduce((sum, u) => sum + u.file.size, 0) :
  mode === 'camera' && photo ?
  Math.round(photo.length * 0.75) :
  undefined;

  const clearDraft = () => {
    setUrl('');
    setText('');
  };

  const confirm = () => {
    setConfirmOpen(false);
    if (!online) {
      enqueue({ type: option.id, mode, label: `${option.longLabel} · ${summary}`, sizeBytes, credits: cost });
      clearDraft();
      toast('Saved to your queue', { description: 'We’ll run this check as soon as you’re back online.' });
      navigate('/history?tab=pending', { replace: true });
      return;
    }
    if (!spendCredits(cost, option.longLabel)) {
      navigate('/credits');
      return;
    }
    setAnalyzing(true);
  };

  const finish = useCallback(() => {
    clearDraft();
    navigate(`/result/${demoResultByType[option.id]}?new=1`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option.id, navigate]);

  return {
    option,
    mode,
    setMode,
    url,
    setUrl,
    text,
    setText,
    photo,
    setPhoto,
    uploads,
    setUploads,
    cost,
    credits,
    online,
    ready,
    summary,
    confirmOpen,
    setConfirmOpen,
    analyzing,
    confirm,
    finish
  };
}