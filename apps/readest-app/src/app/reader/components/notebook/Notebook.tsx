import clsx from 'clsx';
import React, { useCallback, useEffect, useState } from 'react';

import { useSettingsStore } from '@/store/settingsStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useNotebookStore } from '@/store/notebookStore';
import { useAIChatStore } from '@/store/aiChatStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useThemeStore } from '@/store/themeStore';
import { useEnv } from '@/context/EnvContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { usePanelResize } from '@/hooks/usePanelResize';
import { resolveNotebookDock } from '@/app/reader/utils/mobileLayout';
import { eventDispatcher } from '@/utils/event';
import { BookNote } from '@/types/book';
import { getBookDirFromLanguage } from '@/utils/book';
import { getPanelTopInset } from '@/utils/insets';
import { Overlay } from '@/components/Overlay';
import { saveSysSettings } from '@/helpers/settings';
import useShortcuts from '@/hooks/useShortcuts';
import {
  flushNotebookDocument,
  useNotebookDocumentCoordinator,
} from '../../hooks/useNotebookDocumentCoordinator';
import AIAssistant from './AIAssistant';
import NotebookHeader from './Header';
import NotebookEditor from './NotebookEditor';
import NotebookTabNavigation from './NotebookTabNavigation';

const MIN_NOTEBOOK_WIDTH = 0.15;
const MAX_NOTEBOOK_WIDTH = 0.45;

const Notebook: React.FC = () => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { settings } = useSettingsStore();
  const { updateAppTheme, safeAreaInsets, systemUIVisible, statusBarHeight } = useThemeStore();
  const { sideBarBookKey, setSideBarVisible, setSearchBarVisible, clearBooknotesNav } =
    useSidebarStore();
  const {
    notebookWidth,
    notebookHeight: dockedNotebookHeight,
    isNotebookVisible,
    isNotebookPinned,
    notebookActiveTab,
    getNotebookWidth,
    setNotebookWidth,
    setNotebookHeight,
    getNotebookHeight,
    setNotebookVisible,
    setNotebookPin,
    toggleNotebookPin,
    setNotebookActiveTab,
  } = useNotebookStore();
  const { getBookData, getConfig, setConfig, updateBooknotes, saveConfig } = useBookDataStore();
  const { getViewSettings } = useReaderStore();
  const { activeConversationId } = useAIChatStore();

  useNotebookDocumentCoordinator(sideBarBookKey);

  const isMobile =
    appService?.isMobile === true || window.innerWidth < 640 || window.innerHeight < 640;
  // A real bottom dock, distinct from the mobile full-screen sheet above: the
  // panel takes the lower slice of the window and the book keeps the rest.
  const dockBottom =
    !isMobile &&
    resolveNotebookDock(settings.globalReadSettings.notebookPosition, appService?.isMobile) ===
      'bottom';
  const [isFullHeightInMobile, setIsFullHeightInMobile] = useState(isMobile);

  const hideNotebook = useCallback(() => {
    if (sideBarBookKey) void flushNotebookDocument(sideBarBookKey);
    setNotebookVisible(false);
    setIsFullHeightInMobile(isMobile);
  }, [isMobile, setNotebookVisible, sideBarBookKey]);

  const {
    panelRef: notebookRef,
    overlayRef,
    panelHeight: notebookHeight,
    handleVerticalDragStart,
  } = useSwipeToDismiss(hideNotebook, (data) => setIsFullHeightInMobile(data.clientY < 44));

  const handleHideNotebookShortcut = useCallback(() => {
    if (!isNotebookVisible || isNotebookPinned) return false;
    hideNotebook();
    return true;
  }, [hideNotebook, isNotebookPinned, isNotebookVisible]);

  useShortcuts({ onEscape: handleHideNotebookShortcut }, [handleHideNotebookShortcut]);

  useEffect(() => {
    if (isNotebookVisible) {
      updateAppTheme('base-200');
      overlayRef.current = document.querySelector('.overlay') as HTMLDivElement | null;
    } else {
      updateAppTheme('base-100');
      overlayRef.current = null;
    }
  }, [isNotebookVisible, overlayRef, updateAppTheme]);

  useEffect(() => {
    setNotebookWidth(settings.globalReadSettings.notebookWidth);
    setNotebookHeight(settings.globalReadSettings.notebookHeight);
    setNotebookPin(settings.globalReadSettings.isNotebookPinned);
    setNotebookVisible(settings.globalReadSettings.isNotebookPinned);
    if (settings.globalReadSettings.notebookActiveTab) {
      setNotebookActiveTab(settings.globalReadSettings.notebookActiveTab);
    }
    // The settings store only hydrates the Notebook store when this panel mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onNavigate = () => {
      if (!useNotebookStore.getState().isNotebookPinned) hideNotebook();
    };
    eventDispatcher.on('navigate', onNavigate);
    return () => eventDispatcher.off('navigate', onNavigate);
  }, [hideNotebook]);

  const handleNotebookResize = (newWidth: string) => {
    setNotebookWidth(newWidth);
    settings.globalReadSettings.notebookWidth = newWidth;
  };

  const handleNotebookHeightResize = (newHeight: string) => {
    setNotebookHeight(newHeight);
    settings.globalReadSettings.notebookHeight = newHeight;
  };

  const handleTogglePin = () => {
    toggleNotebookPin();
    const globalReadSettings = settings.globalReadSettings;
    saveSysSettings(envConfig, 'globalReadSettings', {
      ...globalReadSettings,
      isNotebookPinned: !isNotebookPinned,
    });
  };

  const handleTabChange = (tab: 'notes' | 'ai') => {
    setNotebookActiveTab(tab);
    saveSysSettings(envConfig, 'globalReadSettings', {
      ...settings.globalReadSettings,
      notebookActiveTab: tab,
    });
  };

  const handleOpenAnnotations = () => {
    if (!sideBarBookKey) return;
    setSearchBarVisible(false);
    clearBooknotesNav(sideBarBookKey);
    const config = getConfig(sideBarBookKey);
    if (config) {
      setConfig(sideBarBookKey, {
        viewSettings: { ...config.viewSettings, sideBarTab: 'annotations' },
      });
    }
    setSideBarVisible(true);
    if (isMobile) hideNotebook();
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-annotations-heading]')?.focus();
    });
  };

  const handleDeleteExcerpt = (excerpt: BookNote) => {
    if (!sideBarBookKey) return;
    const config = getConfig(sideBarBookKey);
    if (!config?.booknotes) return;
    const booknotes = config.booknotes.map((note) =>
      note.id === excerpt.id && note.type === 'excerpt' ? { ...note, deletedAt: Date.now() } : note,
    );
    const updatedConfig = updateBooknotes(sideBarBookKey, booknotes);
    if (updatedConfig) void saveConfig(envConfig, sideBarBookKey, updatedConfig, settings);
  };

  const { handleResizeStart: handleDragStart, handleResizeKeyDown: handleDragKeyDown } =
    usePanelResize({
      side: 'end',
      minWidth: MIN_NOTEBOOK_WIDTH,
      maxWidth: MAX_NOTEBOOK_WIDTH,
      getWidth: getNotebookWidth,
      onResize: handleNotebookResize,
    });

  const { handleResizeStart: handleHeightDragStart, handleResizeKeyDown: handleHeightDragKeyDown } =
    usePanelResize({
      side: 'bottom',
      minWidth: MIN_NOTEBOOK_WIDTH,
      maxWidth: MAX_NOTEBOOK_WIDTH,
      getWidth: getNotebookHeight,
      onResize: handleNotebookHeightResize,
    });

  if (!sideBarBookKey) return null;
  const bookData = getBookData(sideBarBookKey);
  const excerptNotes = (getConfig(sideBarBookKey)?.booknotes ?? [])
    .filter((note) => note.type === 'excerpt' && note.text && !note.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt);
  const viewSettings = getViewSettings(sideBarBookKey);
  if (!bookData?.bookDoc) return null;
  const languageDir = getBookDirFromLanguage(bookData.bookDoc.metadata.language);

  return isNotebookVisible ? (
    <>
      {!isNotebookPinned && (
        <Overlay
          className={clsx('z-[45]', viewSettings?.isEink ? '' : 'bg-black/50 sm:bg-black/20')}
          onDismiss={hideNotebook}
        />
      )}
      <div
        ref={notebookRef}
        className={clsx(
          'notebook-container flex min-w-60 select-none flex-col',
          'font-sans text-base font-normal transition-[padding-top] duration-300 sm:text-sm',
          dockBottom ? 'inset-x-0 bottom-0' : 'right-0 full-height',
          viewSettings?.isEink ? 'bg-base-100' : 'bg-base-200',
          appService?.hasRoundedWindow && 'rounded-window-top-right rounded-window-bottom-right',
          isNotebookPinned ? 'z-20' : 'z-[45] shadow-2xl',
          !isNotebookPinned && viewSettings?.isEink && 'border-base-content border-s',
        )}
        role='group'
        aria-label={_('Notebook')}
        dir={viewSettings?.rtl && languageDir === 'rtl' ? 'rtl' : 'ltr'}
        style={{
          width: isMobile || dockBottom ? '100%' : notebookWidth,
          maxWidth: isMobile || dockBottom ? '100%' : `${MAX_NOTEBOOK_WIDTH * 100}%`,
          height: dockBottom ? dockedNotebookHeight : undefined,
          maxHeight: dockBottom ? `${MAX_NOTEBOOK_WIDTH * 100}%` : undefined,
          // A bottom dock overlays the lower slice of the reader. It cannot be
          // `relative` while pinned: reader-content is a flex ROW, so the panel
          // would take a column on the right instead of the bottom. Reflowing
          // the book above it needs that container split into a column first.
          position: isMobile
            ? 'fixed'
            : dockBottom
              ? 'absolute'
              : isNotebookPinned
                ? 'relative'
                : 'absolute',
          paddingTop: `${getPanelTopInset({
            isMobile,
            isFullHeightInMobile,
            systemUIVisible,
            statusBarHeight,
            safeAreaInsets,
          })}px`,
        }}
      >
        <style jsx>{`
          @media (max-width: 640px) {
            .notebook-container {
              border-top-left-radius: 16px;
              border-top-right-radius: 16px;
            }
          }
        `}</style>
        <div
          className={clsx(
            'drag-bar absolute -left-2 top-0 h-full w-0.5 cursor-col-resize bg-transparent p-2',
            (isMobile || dockBottom) && 'hidden',
          )}
          role='slider'
          tabIndex={0}
          aria-label={_('Resize Notebook')}
          aria-orientation='horizontal'
          aria-valuenow={parseFloat(notebookWidth)}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onKeyDown={handleDragKeyDown}
        />
        <div className='shrink-0'>
          {dockBottom && (
            <div
              className='drag-bar absolute -top-2 left-0 h-0.5 w-full cursor-row-resize bg-transparent p-2'
              role='slider'
              tabIndex={0}
              aria-label={_('Resize Notebook')}
              aria-orientation='vertical'
              aria-valuenow={parseFloat(dockedNotebookHeight)}
              onMouseDown={handleHeightDragStart}
              onTouchStart={handleHeightDragStart}
              onKeyDown={handleHeightDragKeyDown}
            />
          )}
          {isMobile && (
            <div
              role='slider'
              tabIndex={0}
              aria-label={_('Resize Notebook')}
              aria-orientation='vertical'
              aria-valuenow={notebookHeight.current}
              className='drag-handle flex h-6 max-h-6 min-h-6 w-full cursor-row-resize items-center justify-center'
              onMouseDown={handleVerticalDragStart}
              onTouchStart={handleVerticalDragStart}
            >
              <div className='bg-base-content/50 h-1 w-10 rounded-full' />
            </div>
          )}
          <NotebookHeader
            isPinned={isNotebookPinned}
            handleClose={hideNotebook}
            handleTogglePin={handleTogglePin}
          />
        </div>
        {notebookActiveTab === 'ai' ? (
          <div className='flex min-h-0 flex-1 flex-col'>
            <AIAssistant key={activeConversationId ?? 'new'} bookKey={sideBarBookKey} />
          </div>
        ) : (
          <NotebookEditor
            bookKey={sideBarBookKey}
            handleOpenAnnotations={handleOpenAnnotations}
            excerpts={excerptNotes}
            onDeleteExcerpt={handleDeleteExcerpt}
          />
        )}
        <div
          className='shrink-0'
          style={{ paddingBottom: `${(safeAreaInsets?.bottom || 0) / 2}px` }}
        >
          <NotebookTabNavigation activeTab={notebookActiveTab} onTabChange={handleTabChange} />
        </div>
      </div>
    </>
  ) : null;
};

export default Notebook;
