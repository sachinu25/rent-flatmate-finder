import { MessagesSquare } from "lucide-react";

export default function MessagesIndex() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="grid size-16 place-items-center rounded-3xl bg-primary-soft text-primary">
        <MessagesSquare className="size-8" />
      </div>
      <h2 className="mt-5 text-lg font-bold">Your conversations</h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">Select a conversation to start chatting. New chats appear when a request is accepted.</p>
    </div>
  );
}
