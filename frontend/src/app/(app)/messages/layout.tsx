"use client";

import { useParams } from "next/navigation";

import { ConversationList } from "@/components/chat/conversation-list";
import { cn } from "@/lib/utils";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ conversationId?: string }>();
  const activeId = params?.conversationId;

  return (
    <div className="-mx-4 -my-6 h-[calc(100dvh-4rem)] sm:-mx-6 sm:-my-8 lg:m-0 lg:h-[calc(100dvh-8rem)]">
      <div className="flex h-full overflow-hidden bg-card lg:rounded-3xl lg:border lg:border-border lg:shadow-soft">
        <aside className={cn("w-full flex-col border-r border-border md:flex md:w-80 lg:w-96", activeId ? "hidden" : "flex")} aria-label="Conversations">
          <div className="border-b border-border px-5 py-4">
            <h1 className="text-lg font-bold">Messages</h1>
          </div>
          <div className="min-h-0 flex-1">
            <ConversationList activeId={activeId} />
          </div>
        </aside>
        <section className={cn("min-w-0 flex-1 flex-col", activeId ? "flex" : "hidden md:flex")}>{children}</section>
      </div>
    </div>
  );
}
