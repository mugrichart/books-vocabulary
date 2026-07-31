"use client";

import { useCallback, useEffect, useState } from "react";
import type { StorySummary } from "@/lib/stories";

interface CreateStoryPayload {
  title: string;
  bookId: string;
  bookTitle: string;
}

export function useStories() {
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stories", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to fetch stories");
      }

      const data = await res.json();
      setStories(Array.isArray(data?.stories) ? data.stories : []);
    } catch (error) {
      console.error("Failed to load stories:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchStories();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fetchStories]);

  const createStory = useCallback(async (payload: CreateStoryPayload) => {
    const res = await fetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || "Failed to create story");
    }

    const data = await res.json();
    if (data?.story) {
      setStories((prev) => [data.story, ...prev]);
    }

    return data?.story as StorySummary;
  }, []);

  const deleteStory = useCallback(async (storyId: string) => {
    const res = await fetch(`/api/stories/${storyId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || "Failed to delete story");
    }

    setStories((prev) => prev.filter((story) => story.id !== storyId));
  }, []);

  return {
    stories,
    isLoading,
    fetchStories,
    createStory,
    deleteStory,
  };
}