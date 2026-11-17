"use client";

import { useParams } from "next/navigation";

import { ChatThread } from "@/components/chat/chat-thread";

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  return <ChatThread key={conversationId} conversationId={conversationId} />;
}
