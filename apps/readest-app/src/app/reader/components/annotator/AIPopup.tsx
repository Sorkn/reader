'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { generateText } from 'ai';
import { LuSparkles } from 'react-icons/lu';

import Popup from '@/components/Popup';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useNotebookStore } from '@/store/notebookStore';
import { useAIChatStore } from '@/store/aiChatStore';
import { getAIProvider } from '@/services/ai/providers';
import { buildAskPrompt, extractRangeContext } from '@/utils/aiContext';
import { Position, TextSelection } from '@/utils/sel';

interface AIPopupProps {
  bookKey: string;
  selection: TextSelection;
  position: Position;
  trianglePosition: Position;
  popupWidth: number;
  popupHeight: number;
  onDismiss: () => void;
}

const AIPopup: React.FC<AIPopupProps> = ({
  bookKey,
  selection,
  position,
  trianglePosition,
  popupWidth,
  popupHeight,
  onDismiss,
}) => {
  const _ = useTranslation();
  const { settings } = useSettingsStore();
  const getProgress = useReaderStore((s) => s.getProgress);
  const getBookData = useBookDataStore((s) => s.getBookData);
  const setNotebookVisible = useNotebookStore((s) => s.setNotebookVisible);
  const setNotebookActiveTab = useNotebookStore((s) => s.setNotebookActiveTab);
  const { createConversation, addMessage, setActiveConversation } = useAIChatStore();

  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  const bookData = getBookData(bookKey);
  const bookTitle = bookData?.book?.title;
  const bookHash = bookData?.book?.hash;
  const chapterLabel = getProgress(bookKey)?.sectionLabel;

  // The prompt is built once per popup: re-deriving it on every render would
  // re-fire the request through the effect below.
  const promptRef = useRef<string>('');
  if (!promptRef.current) {
    const { before, after } = selection.range
      ? extractRangeContext(selection.range)
      : { before: '', after: '' };
    promptRef.current = buildAskPrompt({
      selectedText: selection.text,
      bookTitle,
      chapterLabel,
      before,
      after,
    });
  }

  useEffect(() => {
    let cancelled = false;
    const ask = async () => {
      const aiSettings = settings?.aiSettings;
      if (!aiSettings?.enabled) {
        setError(_('Enable AI in Settings to use this.'));
        return;
      }
      try {
        const { text } = await generateText({
          model: getAIProvider(aiSettings).getModel(),
          prompt: promptRef.current,
        });
        if (!cancelled) setAnswer(text.trim());
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : _('Could not reach the model.'));
      }
    };
    ask();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hand the answer to the notebook's AI tab as the opening exchange, so the
  // chat starts from what the reader already saw instead of an empty thread.
  const handleOpenChat = useCallback(async () => {
    if (!bookHash || isOpeningChat) return;
    setIsOpeningChat(true);
    try {
      const title = selection.text.slice(0, 60);
      const conversationId = await createConversation(bookHash, title);
      await addMessage({ conversationId, role: 'user', content: promptRef.current });
      await addMessage({ conversationId, role: 'assistant', content: answer });
      await setActiveConversation(conversationId);
      setNotebookActiveTab('ai');
      setNotebookVisible(true);
      onDismiss();
    } finally {
      setIsOpeningChat(false);
    }
  }, [
    bookHash,
    isOpeningChat,
    selection.text,
    answer,
    createConversation,
    addMessage,
    setActiveConversation,
    setNotebookActiveTab,
    setNotebookVisible,
    onDismiss,
  ]);

  return (
    <Popup
      width={popupWidth}
      height={popupHeight}
      position={position}
      trianglePosition={trianglePosition}
      className='select-text'
      onDismiss={onDismiss}
    >
      <div className='flex h-full flex-col gap-2 overflow-hidden rounded-lg p-4'>
        <div className='text-base-content/60 flex items-center gap-1.5 text-xs font-medium'>
          <LuSparkles size={13} />
          <span className='truncate'>{selection.text}</span>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto text-sm leading-relaxed'>
          {error ? (
            <span className='text-error'>{error}</span>
          ) : answer ? (
            answer
          ) : (
            <span className='loading loading-dots loading-sm' aria-label={_('Thinking')} />
          )}
        </div>

        {answer && (
          <button
            className='btn btn-sm btn-contrast eink-bordered w-full'
            onClick={handleOpenChat}
            disabled={isOpeningChat || !bookHash}
          >
            {_('Continue in chat')}
          </button>
        )}
      </div>
    </Popup>
  );
};

export default AIPopup;
