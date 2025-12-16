import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateBitcoinText, generateConceptTree } from './services/openRouterService';
import { TextChunk, LoadingState, ConceptNode } from './types';
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
  const [conceptTrees, setConceptTrees] = useState<Record<string, {
    nodes: ConceptNode[];
    loading: boolean;
    error: string | null;
    expanded: boolean;
    selectedNodeId?: string;
    actionLoading?: boolean;
    actionError?: string | null;
  }>>({});

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

  const loadConceptTree = useCallback(async (chunkId: string, topic: string) => {
    setConceptTrees(prev => ({
      ...prev,
      [chunkId]: {
        nodes: prev[chunkId]?.nodes || [],
        loading: true,
        error: null,
        expanded: true,
        selectedNodeId: prev[chunkId]?.selectedNodeId,
        actionLoading: false,
        actionError: null
      }
    }));

    try {
      const nodes = await generateConceptTree(topic);
      const rootId = nodes.find(node => node.parentId === null)?.id || nodes[0]?.id;
      setConceptTrees(prev => ({
        ...prev,
        [chunkId]: {
        nodes,
        loading: false,
        error: null,
        expanded: true,
        selectedNodeId: rootId,
        actionLoading: false,
        actionError: null
      }
    }));
    } catch (error) {
      console.error("Failed to load concept tree", error);
      setConceptTrees(prev => ({
        ...prev,
        [chunkId]: {
        nodes: prev[chunkId]?.nodes || [],
        loading: false,
        error: "Transmission jammed. Try again.",
        expanded: true,
        selectedNodeId: prev[chunkId]?.selectedNodeId,
        actionLoading: false,
        actionError: null
      }
    }));
  }
  }, []);

  const toggleConceptTree = (chunkId: string, topic: string) => {
    const current = conceptTrees[chunkId];
    if (current?.expanded) {
      setConceptTrees(prev => ({
        ...prev,
        [chunkId]: { ...current, expanded: false }
      }));
      return;
    }

    if (current?.nodes?.length) {
      setConceptTrees(prev => ({
        ...prev,
        [chunkId]: { ...current, expanded: true, error: null }
      }));
      return;
    }

    loadConceptTree(chunkId, topic);
  };

  const selectConceptNode = (chunkId: string, nodeId: string) => {
    setConceptTrees(prev => {
      const current = prev[chunkId];
      if (!current) return prev;
      return {
        ...prev,
        [chunkId]: { ...current, selectedNodeId: nodeId, actionError: null }
      };
    });
  };

  const expandConceptNode = async (chunkId: string) => {
    const treeState = conceptTrees[chunkId];
    if (!treeState || !treeState.selectedNodeId) return;
    const selected = treeState.nodes.find(node => node.id === treeState.selectedNodeId);
    if (!selected) return;

    setConceptTrees(prev => ({
      ...prev,
      [chunkId]: { ...treeState, actionLoading: true, actionError: null }
    }));

    try {
      const recentTopics = chunks.slice(-10).map(chunk => chunk.topic);
      const { text } = await generateBitcoinText(recentTopics, selected.label);
      const newChunk: TextChunk = {
        id: generateId(),
        content: text,
        topic: selected.label
      };
      setChunks(prev => [...prev, newChunk]);
      setConceptTrees(prev => ({
        ...prev,
        [chunkId]: { ...prev[chunkId], actionLoading: false }
      }));
    } catch (error) {
      console.error("Failed to expand concept into section", error);
      setConceptTrees(prev => ({
        ...prev,
        [chunkId]: { ...prev[chunkId], actionLoading: false, actionError: "Expansion failed. Try again." }
      }));
    }
  };

  const renderConceptTree = (chunkId: string, topic: string) => {
    const treeState = conceptTrees[chunkId];

    if (!treeState?.expanded) return null;

    const rootNode: ConceptNode = treeState.nodes.find(node => node.parentId === null) || {
      id: `${chunkId}-root`,
      label: topic,
      parentId: null,
      summary: `Exploring ${topic} through Bitcoin's lens.`
    };

    const getChildren = (parentLabel: string | null) => {
      return treeState.nodes.filter(node => {
        if (parentLabel === null) return node.parentId === null;
        return node.parentId === parentLabel || (parentLabel === rootNode.label && node.parentId === topic);
      });
    };

    const firstLayer = getChildren(rootNode.label);

    const selectedNode = treeState.nodes.find(node => node.id === treeState.selectedNodeId) || rootNode;

    return (
      <div className="mt-4 border border-orange-500/20 bg-gradient-to-r from-orange-500/5 via-gray-900/60 to-black rounded-lg p-4 sm:p-5">
        {treeState.loading && (
          <div className="text-xs text-orange-400 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse"></span>
            <span>Mapping related Bitcoin concepts...</span>
          </div>
        )}

        {treeState.error && (
          <div className="text-xs text-red-400 flex items-center justify-between">
            <span>{treeState.error}</span>
            <button
              onClick={() => loadConceptTree(chunkId, topic)}
              className="px-2 py-1 border border-red-500/50 hover:border-orange-500 text-red-200 hover:text-orange-200 transition-colors"
            >
              RETRY
            </button>
          </div>
        )}

        {!treeState.loading && !treeState.error && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-orange-300/80 uppercase tracking-widest">
              <span className="h-px flex-grow bg-gradient-to-r from-orange-600/40 via-orange-400/60 to-transparent"></span>
              <button
                onClick={() => selectConceptNode(chunkId, rootNode.id)}
                className={`px-3 py-1 border rounded-full transition-colors ${
                  selectedNode.id === rootNode.id
                    ? "border-orange-500 text-orange-200"
                    : "border-orange-500/30 text-orange-300 hover:border-orange-500/60"
                }`}
              >
                {rootNode.label}
              </button>
              <span className="h-px flex-grow bg-gradient-to-l from-orange-600/40 via-orange-400/60 to-transparent"></span>
            </div>

            <div className="space-y-3">
              {firstLayer.map(branch => {
                const offshoots = getChildren(branch.label);
                return (
                  <div key={branch.id} className="p-3 border border-orange-500/15 rounded-md bg-black/30">
                    <button
                      onClick={() => selectConceptNode(chunkId, branch.id)}
                      className={`text-sm sm:text-base font-semibold tracking-tight transition-colors ${
                        selectedNode.id === branch.id
                          ? "text-orange-200"
                          : "text-orange-300/80 hover:text-orange-200"
                      }`}
                    >
                      {branch.label}
                    </button>
                    {offshoots.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {offshoots.map(node => (
                          <button
                            key={node.id}
                            onClick={() => selectConceptNode(chunkId, node.id)}
                            className={`text-xs sm:text-sm px-2 py-1 rounded-full border transition-colors ${
                              selectedNode.id === node.id
                                ? "border-orange-500 text-orange-200 bg-orange-500/10"
                                : "border-orange-500/20 text-gray-300 hover:text-orange-200 hover:border-orange-500/50"
                            }`}
                          >
                            {node.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-xs sm:text-sm text-gray-300/90 bg-orange-500/5 border border-orange-500/20 rounded-md p-3 leading-relaxed flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{selectedNode.summary}</span>
              <div className="flex items-center gap-3">
                {treeState.actionError && (
                  <span className="text-red-400 text-[11px] sm:text-xs">{treeState.actionError}</span>
                )}
                <button
                  onClick={() => expandConceptNode(chunkId)}
                  disabled={treeState.actionLoading}
                  className={`px-3 py-2 border text-xs sm:text-sm transition-colors ${
                    treeState.actionLoading
                      ? "border-orange-500/40 text-orange-300/60 cursor-not-allowed"
                      : "border-orange-500/60 text-orange-200 hover:bg-orange-500 hover:text-black"
                  }`}
                >
                  {treeState.actionLoading ? "EXPANDING..." : "EXPAND_AS_SECTION"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

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
              <div className="mb-8 flex flex-col gap-3">
                <button
                  className="flex items-center gap-4 opacity-60 hover:opacity-100 text-sm transition-opacity"
                  onClick={() => toggleConceptTree(chunk.id, chunk.topic)}
                >
                  <span className="h-px bg-gray-600 flex-grow"></span>
                  <span className="tracking-widest text-orange-500/80">{'// ' + chunk.topic.toUpperCase()}</span>
                  <span className="h-px bg-gray-600 flex-grow"></span>
                </button>
                {renderConceptTree(chunk.id, chunk.topic)}
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
