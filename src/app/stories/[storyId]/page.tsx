"use client";

import { useParams } from "next/navigation";
import StoryWorkspace from "@/components/stories/StoryWorkspace";

export default function StoryPage() {
  const params = useParams<{ storyId: string }>();

  return <StoryWorkspace storyId={params.storyId} />;
}