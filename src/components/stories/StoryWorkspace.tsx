"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Loader2, MoreHorizontal, PenLine, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { contentUsesWord } from "@/lib/story-matching";
import type { StoryChapter, StoryDetail, StoryNodeType, StoryScene } from "@/lib/stories";

type EditorMode = "outline" | "write";

type SelectedNode = {
  type: StoryNodeType;
  id: string;
};

type CaptureWord = {
  id: string;
  word: string;
  sentence: string;
  explanation: string;
};

const CAPTURE_BATCH_SIZE = 10;
const SCENE_SAVE_DEBOUNCE_MS = 2000;

interface Props {
  storyId: string;
}

export default function StoryWorkspace({ storyId }: Props) {
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [sceneMode, setSceneMode] = useState<EditorMode>("outline");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Saved");
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<"chapter" | "scene">("chapter");
  const [newTitle, setNewTitle] = useState("");
  const [targetChapterId, setTargetChapterId] = useState("");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [captureWords, setCaptureWords] = useState<CaptureWord[]>([]);
  const [captureTotal, setCaptureTotal] = useState(0);
  const [capturesLoading, setCapturesLoading] = useState(false);
  const [activeCapture, setActiveCapture] = useState<CaptureWord | null>(null);
  const [manualCheckedCaptureIds, setManualCheckedCaptureIds] = useState<Set<string>>(new Set());
  const [matchAnchorText, setMatchAnchorText] = useState("");
  const [loadedCaptureCursor, setLoadedCaptureCursor] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ type: StoryNodeType; id: string; payload: Record<string, unknown> } | null>(null);
  const latestSaveTokenRef = useRef(0);
  const lastAutoAdvanceSceneRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStory() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/stories/${storyId}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to load story");
        }

        const data = await res.json();
        if (cancelled) return;

        const nextStory = data?.story as StoryDetail;
        setStory(nextStory);
        setSelectedNode((current) => current ?? { type: "story", id: nextStory.id });
      } catch (error) {
        console.error("Failed to load story:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadStory();
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  const chapters = story?.chapters ?? [];
  const scenes = story?.scenes ?? [];

  const selectedChapter = useMemo(() => {
    if (!selectedNode || !story) return null;
    if (selectedNode.type === "chapter") {
      return story.chapters.find((chapter) => chapter.id === selectedNode.id) ?? null;
    }
    if (selectedNode.type === "scene") {
      const scene = story.scenes.find((entry) => entry.id === selectedNode.id);
      return story.chapters.find((chapter) => chapter.id === scene?.chapterId) ?? null;
    }
    return null;
  }, [selectedNode, story]);

  const selectedScene = useMemo(() => {
    if (!selectedNode || !story || selectedNode.type !== "scene") return null;
    return story.scenes.find((scene) => scene.id === selectedNode.id) ?? null;
  }, [selectedNode, story]);

  const selectedSceneId = selectedScene?.id ?? null;
  const storyCaptureCursor = story?.captureCursor ?? 0;
  const storyBookId = story?.bookId ?? null;
  const usedCaptureIds = useMemo(() => {
    const used = new Set<string>(manualCheckedCaptureIds);
    if (!selectedScene || sceneMode !== "write") {
      return used;
    }

    if (!matchAnchorText.trim()) {
      return used;
    }

    captureWords.forEach((capture) => {
      if (contentUsesWord(matchAnchorText, capture.word)) {
        used.add(capture.id);
      }
    });

    return used;
  }, [captureWords, manualCheckedCaptureIds, matchAnchorText, sceneMode, selectedScene]);
  const cumulativeUsedCount = Math.min(captureTotal, storyCaptureCursor + usedCaptureIds.size);
  const cumulativeRemainingCount = Math.max(0, captureTotal - cumulativeUsedCount);
  const displayedActiveCapture = useMemo(() => {
    if (!activeCapture) return null;
    return captureWords.find((item) => item.id === activeCapture.id) ?? null;
  }, [activeCapture, captureWords]);

  useEffect(() => {
    if (!selectedSceneId || sceneMode !== "write" || !storyBookId) {
      return;
    }

    const activeBookId = storyBookId;
    const activeCaptureCursor = storyCaptureCursor;
    let cancelled = false;
    async function loadCaptures() {
      setCapturesLoading(true);
      try {
        const url = new URL(`/api/capture/${activeBookId}`, window.location.origin);
        url.searchParams.set("mode", "highlight");
        url.searchParams.set("skip", String(activeCaptureCursor));
        url.searchParams.set("limit", String(CAPTURE_BATCH_SIZE));

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to fetch scene captures");
        }

        const data = await res.json();
        if (cancelled) return;
        const nextCaptures = Array.isArray(data?.captures)
          ? data.captures.map((capture: CaptureWord) => ({
              id: capture.id,
              word: capture.word,
              sentence: capture.sentence,
              explanation: capture.explanation,
            }))
          : [];
        setCaptureWords(nextCaptures);
        setCaptureTotal(typeof data?.total === "number" ? data.total : nextCaptures.length);
        setLoadedCaptureCursor(activeCaptureCursor);
      } catch (error) {
        console.error("Failed to load scene captures:", error);
        if (!cancelled) {
          setCaptureWords([]);
          setLoadedCaptureCursor(null);
        }
      } finally {
        if (!cancelled) {
          setCapturesLoading(false);
        }
      }
    }

    loadCaptures();
    return () => {
      cancelled = true;
    };
  }, [sceneMode, selectedSceneId, storyBookId, storyCaptureCursor]);

  const updateStory = useCallback((updater: (current: StoryDetail) => StoryDetail) => {
    setStory((current) => (current ? updater(current) : current));
  }, []);

  const scheduleSave = useCallback((type: StoryNodeType, id: string, payload: Record<string, unknown>) => {
    const previousPending = pendingSaveRef.current;
    pendingSaveRef.current =
      previousPending && previousPending.type === type && previousPending.id === id
        ? {
            type,
            id,
            payload: { ...previousPending.payload, ...payload },
          }
        : { type, id, payload };

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setSaveLabel("Saving...");
    debounceRef.current = setTimeout(async () => {
      const pendingSave = pendingSaveRef.current;
      if (!pendingSave) {
        return;
      }

      latestSaveTokenRef.current += 1;
      const saveToken = latestSaveTokenRef.current;
      setIsSaving(true);

      try {
        let endpoint = `/api/stories/${storyId}`;
        if (pendingSave.type === "chapter") {
          endpoint = `/api/stories/${storyId}/chapters/${pendingSave.id}`;
        }
        if (pendingSave.type === "scene") {
          endpoint = `/api/stories/${storyId}/scenes/${pendingSave.id}`;
        }

        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pendingSave.payload),
        });

        if (!res.ok) {
          throw new Error("Failed to save draft");
        }

        if (pendingSaveRef.current?.type === pendingSave.type && pendingSaveRef.current?.id === pendingSave.id) {
          pendingSaveRef.current = null;
        }

        if (latestSaveTokenRef.current === saveToken) {
          setSaveLabel("Saved");
        }
      } catch (error) {
        console.error("Failed to save story content:", error);
        if (latestSaveTokenRef.current === saveToken) {
          setSaveLabel("Save failed");
        }
      } finally {
        if (latestSaveTokenRef.current === saveToken) {
          setIsSaving(false);
        }
      }
    }, SCENE_SAVE_DEBOUNCE_MS);
  }, [storyId]);

  const updateChapter = useCallback((chapterId: string, payload: Partial<StoryChapter>) => {
    updateStory((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      chapters: current.chapters.map((chapter) =>
        chapter.id === chapterId
          ? { ...chapter, ...payload, updatedAt: new Date().toISOString() }
          : chapter
      ),
    }));
    scheduleSave("chapter", chapterId, payload);
  }, [scheduleSave, updateStory]);

  const updateScene = useCallback((sceneId: string, payload: Partial<StoryScene>) => {
    updateStory((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      scenes: current.scenes.map((scene) =>
        scene.id === sceneId
          ? { ...scene, ...payload, updatedAt: new Date().toISOString() }
          : scene
      ),
    }));
    scheduleSave("scene", sceneId, payload);
  }, [scheduleSave, updateStory]);

  const updateStoryOutline = useCallback((outline: string) => {
    updateStory((current) => ({
      ...current,
      outline,
      updatedAt: new Date().toISOString(),
    }));
    scheduleSave("story", storyId, { outline });
  }, [scheduleSave, storyId, updateStory]);

  const updateStoryCaptureCursor = useCallback((cursor: number) => {
    const safeCursor = Math.max(0, Math.floor(cursor));
    updateStory((current) => ({
      ...current,
      captureCursor: safeCursor,
      updatedAt: new Date().toISOString(),
    }));
    scheduleSave("story", storyId, { captureCursor: safeCursor });
  }, [scheduleSave, storyId, updateStory]);

  useEffect(() => {
    if (!selectedScene || sceneMode !== "write" || captureWords.length === 0) {
      lastAutoAdvanceSceneRef.current = null;
      return;
    }

    const allUsed = captureWords.every((capture) => usedCaptureIds.has(capture.id));
    if (!allUsed) {
      lastAutoAdvanceSceneRef.current = null;
      return;
    }

    if (loadedCaptureCursor === null || loadedCaptureCursor !== storyCaptureCursor) {
      return;
    }

    const currentCursor = storyCaptureCursor;
    const sceneCursorKey = `${selectedScene.id}:${currentCursor}:${captureWords.map((item) => item.id).join("|")}`;
    if (lastAutoAdvanceSceneRef.current === sceneCursorKey) {
      return;
    }

    if (currentCursor + captureWords.length >= captureTotal) {
      lastAutoAdvanceSceneRef.current = sceneCursorKey;
      return;
    }

    lastAutoAdvanceSceneRef.current = sceneCursorKey;
    const timeoutId = window.setTimeout(() => {
      updateStoryCaptureCursor(currentCursor + captureWords.length);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [captureTotal, captureWords, loadedCaptureCursor, sceneMode, selectedScene, storyCaptureCursor, updateStoryCaptureCursor, usedCaptureIds]);
  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTitle.trim()) return;
    if (createKind === "scene" && !targetChapterId) return;

    setIsSubmittingCreate(true);
    try {
      if (createKind === "chapter") {
        const res = await fetch(`/api/stories/${storyId}/chapters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle.trim() }),
        });

        if (!res.ok) {
          throw new Error("Failed to create chapter");
        }

        const data = await res.json();
        updateStory((current) => ({
          ...current,
          updatedAt: new Date().toISOString(),
          chapterCount: current.chapterCount + 1,
          chapters: [...current.chapters, data.chapter],
        }));
        setExpandedChapters((prev) => ({ ...prev, [data.chapter.id]: true }));
        setSelectedNode({ type: "chapter", id: data.chapter.id });
      } else {
        const res = await fetch(`/api/stories/${storyId}/scenes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterId: targetChapterId, title: newTitle.trim() }),
        });

        if (!res.ok) {
          throw new Error("Failed to create scene");
        }

        const data = await res.json();
        updateStory((current) => ({
          ...current,
          updatedAt: new Date().toISOString(),
          sceneCount: current.sceneCount + 1,
          scenes: [...current.scenes, data.scene],
        }));
        setExpandedChapters((prev) => ({ ...prev, [targetChapterId]: true }));
        setSelectedNode({ type: "scene", id: data.scene.id });
        setSceneMode("outline");
        setMatchAnchorText("");
      }

      setNewTitle("");
      setTargetChapterId(chapters[0]?.id ?? "");
      setIsCreateOpen(false);
    } catch (error) {
      console.error("Failed to create story node:", error);
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  function openCreateDialog(kind: "chapter" | "scene") {
    setCreateKind(kind);
    setNewTitle("");
    setTargetChapterId(selectedChapter?.id ?? chapters[0]?.id ?? "");
    setIsCreateOpen(true);
  }

  async function handleDeleteChapter(chapterId: string) {
    if (!story) return;
    const chapter = story.chapters.find((item) => item.id === chapterId);
    if (!chapter) return;

    const confirmDelete = window.confirm(`Delete chapter \"${chapter.title}\" and all its scenes?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/stories/${storyId}/chapters/${chapterId}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete chapter");
      }

      const remainingChapters = story.chapters.filter((item) => item.id !== chapterId);
      const removedScenes = story.scenes.filter((scene) => scene.chapterId === chapterId);

      updateStory((current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        chapterCount: Math.max(0, current.chapterCount - 1),
        sceneCount: Math.max(0, current.sceneCount - removedScenes.length),
        chapters: current.chapters.filter((item) => item.id !== chapterId),
        scenes: current.scenes.filter((scene) => scene.chapterId !== chapterId),
      }));

      if (
        (selectedNode?.type === "chapter" && selectedNode.id === chapterId) ||
        (selectedNode?.type === "scene" && story.scenes.some((scene) => scene.id === selectedNode.id && scene.chapterId === chapterId))
      ) {
        if (remainingChapters.length > 0) {
          setSelectedNode({ type: "chapter", id: remainingChapters[0].id });
        } else {
          setSelectedNode({ type: "story", id: story.id });
        }
        setSceneMode("outline");
        setMatchAnchorText("");
      }
    } catch (error) {
      console.error("Failed to delete chapter:", error);
    }
  }

  async function handleDeleteScene(sceneId: string) {
    if (!story) return;
    const sceneToDelete = story.scenes.find((scene) => scene.id === sceneId);
    if (!sceneToDelete) return;

    const confirmDelete = window.confirm(`Delete scene \"${sceneToDelete.title}\"?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/stories/${storyId}/scenes/${sceneId}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete scene");
      }

      const remainingScenesInChapter = story.scenes.filter(
        (scene) => scene.chapterId === sceneToDelete.chapterId && scene.id !== sceneId
      );

      updateStory((current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        sceneCount: Math.max(0, current.sceneCount - 1),
        scenes: current.scenes.filter((scene) => scene.id !== sceneId),
      }));

      if (selectedNode?.type === "scene" && selectedNode.id === sceneId) {
        if (remainingScenesInChapter.length > 0) {
          setSelectedNode({ type: "scene", id: remainingScenesInChapter[0].id });
        } else {
          setSelectedNode({ type: "chapter", id: sceneToDelete.chapterId });
        }
        setSceneMode("outline");
        setMatchAnchorText("");
      }
    } catch (error) {
      console.error("Failed to delete scene:", error);
    }
  }

  function toggleManualChecked(captureId: string) {
    setManualCheckedCaptureIds((prev) => {
      const next = new Set(prev);
      if (next.has(captureId)) {
        next.delete(captureId);
      } else {
        next.add(captureId);
      }
      return next;
    });
  }

  function renderSidebarCenter() {
    if (selectedScene && sceneMode === "write") {
      return (
        <div className="relative flex-1 overflow-y-auto px-4 py-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Capture Batch</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {storyCaptureCursor + 1}-{storyCaptureCursor + captureWords.length} of {captureTotal}
              </p>
            </div>
            {capturesLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="space-y-3">
            {captureWords.map((capture) => {
              const used = usedCaptureIds.has(capture.id);
              return (
                <div
                  key={capture.id}
                  onClick={() => setActiveCapture(capture)}
                  className={`relative rounded-2xl border px-4 py-3 transition ${used ? "border-emerald-500/40 bg-emerald-500/10 text-foreground" : "border-border bg-card text-foreground hover:border-border/80"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-left text-sm font-semibold tracking-tight text-foreground">
                      {capture.word}
                    </span>
                    <button
                      type="button"
                      aria-label={used ? "Uncheck word" : "Mark word as used"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleManualChecked(capture.id);
                      }}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${used ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
                    >
                      <Check className={`h-4 w-4 ${used ? "opacity-100" : "opacity-30"}`} />
                    </button>
                  </div>
                </div>
              );
            })}

            {!capturesLoading && captureWords.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-5 text-sm text-muted-foreground">
                {captureTotal === 0
                  ? "This inspiration book has no captures yet. Add captures in the reader first."
                  : "You have exhausted the current scene's capture stream."}
              </div>
            )}
          </div>

          {displayedActiveCapture && (
            <div className="pointer-events-none absolute inset-x-4 top-1/2 z-40 -translate-y-1/2 rounded-2xl border border-border bg-popover p-4 text-sm text-popover-foreground shadow-2xl">
              <div className="pointer-events-auto flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Definition</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{displayedActiveCapture.word}</p>
                </div>
                <button
                  type="button"
                  aria-label="Close definition"
                  onClick={() => setActiveCapture(null)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 font-semibold">Meaning</p>
              <p className="mt-1 text-muted-foreground">{displayedActiveCapture.explanation || "No explanation available yet."}</p>
              <p className="mt-3 font-semibold">Example</p>
              <p className="mt-1 text-muted-foreground">{displayedActiveCapture.sentence || "No example sentence captured yet."}</p>
            </div>
          )}

          {captureWords.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              Words auto-match when possible. Use the checkmark to mark a word manually whenever matching misses.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <button
          type="button"
          onClick={() => {
            if (!story) return;
            setSelectedNode({ type: "story", id: story.id });
            setMatchAnchorText("");
          }}
          className={`mb-2 flex w-full items-center rounded-2xl px-3 py-3 text-left transition ${selectedNode?.type === "story" ? "bg-primary text-primary-foreground shadow-lg" : "text-foreground hover:bg-accent"}`}
        >
          <p className="truncate text-sm font-semibold">{story?.title ?? "Story"}</p>
        </button>

        <div className="space-y-2">
          {chapters.map((chapter) => {
            const isExpanded = expandedChapters[chapter.id] ?? true;
            const chapterScenes = scenes.filter((scene) => scene.chapterId === chapter.id);
            const isActiveChapter = selectedNode?.type === "chapter" && selectedNode.id === chapter.id;

            return (
              <div key={chapter.id} className="rounded-2xl border border-border bg-background">
                <div className="flex items-center gap-1 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => setExpandedChapters((prev) => ({ ...prev, [chapter.id]: !isExpanded }))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNode({ type: "chapter", id: chapter.id });
                      setMatchAnchorText("");
                    }}
                    className={`flex-1 rounded-xl px-3 py-2 text-left transition ${isActiveChapter ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"}`}
                  >
                    <p className="text-sm font-semibold">{chapter.title}</p>
                    <p className={`text-xs ${isActiveChapter ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{chapterScenes.length} scene{chapterScenes.length === 1 ? "" : "s"}</p>
                  </button>
                  <button
                    type="button"
                    aria-label="Delete chapter"
                    onClick={() => {
                      void handleDeleteChapter(chapter.id);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="space-y-1 px-2 pb-2">
                    {chapterScenes.map((scene) => {
                      const isActiveScene = selectedNode?.type === "scene" && selectedNode.id === scene.id;
                      return (
                        <div
                          key={scene.id}
                          className={`flex items-center gap-1 rounded-xl px-1 py-1 transition ${isActiveScene ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-accent"}`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedNode({ type: "scene", id: scene.id });
                              setMatchAnchorText(sceneMode === "write" ? scene.content : "");
                            }}
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left"
                          >
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActiveScene ? "bg-primary/20" : "bg-muted"}`}>
                              <PenLine className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{scene.title}</p>
                              <p className={`text-xs ${isActiveScene ? "text-foreground/70" : "text-muted-foreground"}`}>
                                {scene.content.trim() ? "Draft started" : "Outline first"}
                              </p>
                            </div>
                          </button>
                          <button
                            type="button"
                            aria-label="Delete scene"
                            onClick={() => {
                              void handleDeleteScene(scene.id);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}

                    {chapterScenes.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No scenes yet. Add one from the footer menu.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {chapters.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-5 text-sm text-muted-foreground">
              Start by outlining the story, then create your first chapter.
            </div>
          )}
        </div>
      </div>
    );
  }

  const activeValue = selectedNode?.type === "story"
    ? story?.outline ?? ""
    : selectedNode?.type === "chapter"
      ? selectedChapter?.outline ?? ""
      : sceneMode === "outline"
        ? selectedScene?.outline ?? ""
        : selectedScene?.content ?? "";

  function handleEditorChange(value: string) {
    if (!selectedNode) return;

    if (selectedNode.type === "story") {
      updateStoryOutline(value);
      if (matchAnchorText) setMatchAnchorText("");
      return;
    }

    if (selectedNode.type === "chapter") {
      updateChapter(selectedNode.id, { outline: value });
      if (matchAnchorText) setMatchAnchorText("");
      return;
    }

    if (sceneMode === "outline") {
      updateScene(selectedNode.id, { outline: value });
      if (matchAnchorText) setMatchAnchorText("");
      return;
    }

    updateScene(selectedNode.id, { content: value });

    // Avoid matching on every keystroke; trigger checks at sentence/phrase boundaries.
    if (/[.!?;:]\s*$/.test(value)) {
      setMatchAnchorText(value);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[65vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Story not found</h1>
        <p className="text-sm text-slate-500">The requested story could not be loaded.</p>
        <Link href="/stories" className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Back to stories
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="flex w-[320px] min-w-75 flex-col border-r border-border bg-card">
          <div className="border-b border-border px-4 py-4">
            <Link
              href="/stories"
              className="mb-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Stories
            </Link>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Inspiration Book</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{story!.bookTitle}</h2>
              </div>
              <div className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
                {story!.sceneCount} scene{story!.sceneCount === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {renderSidebarCenter()}

          <div className="border-t border-border p-4">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700">
                <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> New</span>
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-52">
                <DropdownMenuItem onClick={() => openCreateDialog("chapter")}>New chapter</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openCreateDialog("scene")} disabled={chapters.length === 0}>
                  New scene
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 bg-muted/30 px-6 py-6">
          <div className="mx-auto w-full max-w-4xl rounded-none border border-border bg-[#f6efdd] px-10 py-10 shadow-[0_18px_45px_rgba(15,23,42,0.28)] dark:border-zinc-700">
            <textarea
              value={activeValue}
              onChange={(event) => handleEditorChange(event.target.value)}
              placeholder={
                selectedNode?.type === "story"
                  ? "Sketch the premise, major themes, ending shape, and the feeling you want this story to leave behind..."
                  : selectedNode?.type === "chapter"
                    ? "Outline the chapter arc, emotional turns, and what each scene must accomplish..."
                    : sceneMode === "outline"
                      ? "Outline the beats of this scene before you start writing prose..."
                      : "Write the scene here using the capture words from the left sidebar..."
              }
              className="min-h-[78vh] w-full resize-none border-none bg-transparent text-[17px] leading-8 text-zinc-900 outline-none placeholder:text-zinc-500"
            />
          </div>
        </section>

        <aside className="hidden w-72 min-w-72 border-l border-border bg-card lg:flex lg:flex-col">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Session</p>
              {selectedScene && (
                <div className="inline-flex rounded-full border border-border bg-background p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSceneMode("outline");
                      setMatchAnchorText("");
                    }}
                    className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${sceneMode === "outline" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Outline
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSceneMode("write");
                      setMatchAnchorText(selectedScene?.content ?? "");
                    }}
                    className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${sceneMode === "write" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Write
                  </button>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Story</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{story!.title}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">Chapter</p>
            <p className="mt-1 text-sm font-medium text-foreground">{selectedChapter?.title ?? "No chapter selected"}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">Scene</p>
            <p className="mt-1 text-sm font-medium text-foreground">{selectedScene?.title ?? "No scene selected"}</p>
            <p className="mt-2 text-xs text-muted-foreground">{isSaving ? "Saving..." : saveLabel}</p>
          </div>

          <div className="px-4 py-4">
            {selectedScene ? (
              <div className="space-y-4">
                {sceneMode === "write" && (
                  <div className="space-y-2 rounded-xl border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
                    <p>
                      {cumulativeUsedCount}/{captureTotal} words used
                    </p>
                    <p>{cumulativeRemainingCount} words remaining</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Create a scene to unlock outline/write switching.</p>
            )}
          </div>
        </aside>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{createKind === "chapter" ? "Create Chapter" : "Create Scene"}</DialogTitle>
              <DialogDescription>
                {createKind === "chapter"
                  ? "A chapter stays in outline mode until it contains scenes."
                  : "A scene can switch between outline and write mode after creation."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                required
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder={createKind === "chapter" ? "Chapter title" : "Scene title"}
              />

              {createKind === "scene" && (
                <label className="block space-y-2 text-sm text-foreground">
                  <span className="font-medium">Chapter</span>
                  <select
                    required
                    value={targetChapterId}
                    onChange={(event) => setTargetChapterId(event.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
                  >
                    <option value="" disabled>Select a chapter</option>
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>{chapter.title}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSubmittingCreate}>
                {isSubmittingCreate ? <Loader2 className="h-4 w-4 animate-spin" /> : createKind === "chapter" ? "Create chapter" : "Create scene"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}