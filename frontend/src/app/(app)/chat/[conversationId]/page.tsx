import { redirect } from "next/navigation";

/** Backward-compatible URL: /chat/:id → /messages/:id */
export default async function LegacyChatRedirect({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  redirect(`/messages/${encodeURIComponent(conversationId)}`);
}
