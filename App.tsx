import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateBitcoinText } from './services/openRouterService';
import { TextChunk, LoadingState } from './types';
import { BitcoinLogo } from './components/BitcoinLogo';

const LOADING_MESSAGES = [
  "Syncing to the latest timechain fragment... [|==>     ]",
  "Negotiating mempool fees for fresh prose... [fee/byte -> fair]",
  "Hashing a new block of words... [0000abcd...]",
  "Broadcasting a signed packet of thoughts... [node@127.0.0.1 -> net]",
  "Waiting for miners to confirm this paragraph... [pow nonce rolling]"
];

const getRandomLoadingMessage = () => {
  const index = Math.floor(Math.random() * LOADING_MESSAGES.length);
  return LOADING_MESSAGES[index];
};

const App: React.FC = () => {
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [loadingMessage, setLoadingMessage] = useState<string>(getRandomLoadingMessage());
  const observerTarget = useRef<HTMLDivElement>(null);

  // Generate a unique ID for React keys
  const generateId = () => `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const fetchMoreContent = useCallback(async () => {
    if (loadingState === LoadingState.LOADING) return;

    setLoadingMessage(getRandomLoadingMessage());
    setLoadingState(LoadingState.LOADING);
    
    // Slight delay to simulate "processing" or "receiving transmission" feel if API is too fast
    // and to prevent hammering the API instantly if user scrolls fast.
    const minDelay = new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      const recentTopics = chunks.slice(-10).map(chunk => chunk.topic);
      const { text, topic } = await generateBitcoinText(recentTopics);
      
      await minDelay;

      const newChunk: TextChunk = {
        id: generateId(),
        content: text,
        topic: topic
      };

      setChunks(prev => [...prev, newChunk]);
      setLoadingState(LoadingState.IDLE);
    } catch (error) {
      console.error("Failed to fetch content", error);
      setLoadingState(LoadingState.ERROR);
    }
  }, [loadingState]);

  // Initial load
  useEffect(() => {
    if (chunks.length === 0) {
      fetchMoreContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          fetchMoreContent();
        }
      },
      { threshold: 0.1, rootMargin: '400px' } // Trigger 400px before bottom
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [fetchMoreContent]);

  return (
    <div className="min-h-screen bg-black text-gray-300 font-mono selection:bg-orange-500 selection:text-black p-4 sm:p-6 md:p-12 relative overflow-hidden pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)]">
      
      {/* Background Noise/Scanline Effect Overlay (Optional for aesthetics) */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015] sm:opacity-[0.03] z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 invert"></div>

      <BitcoinLogo />

      <main className="max-w-3xl mx-auto relative z-10">
        <header className="mb-10 sm:mb-16 mt-12 opacity-80">
           <h1 className="text-sm md:text-base text-orange-500 mb-2 tracking-widest uppercase">
             // The Infinite Bitcoin Text
           </h1>
        </header>

        <div className="space-y-8 sm:space-y-12">
          {loadingState === LoadingState.LOADING && chunks.length === 0 && (
            <div className="text-center text-orange-400 opacity-80 text-xs sm:text-sm">
              <span className="inline-block px-3 py-1 border border-orange-500/30 rounded-full">
              {loadingMessage}
              </span>
            </div>
          )}
          {chunks.map((chunk) => (
            <article key={chunk.id} className="animate-fade-in transition-opacity duration-1000">
               {/* Topic Header - Moved to top of section */}
              <div className="mb-8 flex items-center gap-4 opacity-40 text-sm">
                <span className="h-px bg-gray-600 flex-grow"></span>
                <span className="tracking-widest text-orange-500/80">{'// ' + chunk.topic.toUpperCase()}</span>
                <span className="h-px bg-gray-600 flex-grow"></span>
              </div>

               {/* Split by double newline to handle paragraphs correctly */}
              {chunk.content.split('\n').map((paragraph, idx) => {
                if (!paragraph.trim()) return null;
                return (
                  <p key={`${chunk.id}-p-${idx}`} className="mb-6 leading-relaxed text-base sm:text-lg md:text-xl text-left sm:text-justify opacity-90 hover:opacity-100 transition-opacity">
                    {paragraph}
                  </p>
                );
              })}
            </article>
          ))}
        </div>

        {/* Observer Target / Loader */}
        <div ref={observerTarget} className="py-12 flex flex-col items-center justify-center min-h-[120px] sm:min-h-[200px]">
          {loadingState === LoadingState.ERROR && (
            <div className="text-center">
              <p className="text-red-500 mb-4">Connection interrupted.</p>
              <button 
                onClick={() => {
                  setLoadingState(LoadingState.IDLE);
                  fetchMoreContent();
                }}
                className="px-4 py-2 border border-gray-700 hover:border-orange-500 hover:text-orange-500 transition-colors text-sm"
              >
                RETRY_CONNECTION
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Sticky Cursor Effect at bottom right just for fun */}
      <div className="fixed bottom-6 right-6 text-xs text-gray-800 pointer-events-none hidden md:block">
        READ_ONLY_MODE
      </div>
    </div>
  );
};

export default App;
