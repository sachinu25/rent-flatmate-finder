"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Clock, MessageCircle, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { api, errorMessage } from "@/lib/api";
import type { InterestStatus } from "@/lib/types";

export interface ViewerInterest {
  id: string;
  status: InterestStatus;
  conversationId: string | null;
}

export function InterestAction({
  listingId,
  listingTitle,
  ownerName,
  interest,
  role,
  filled,
  onChange,
}: {
  listingId: string;
  listingTitle: string;
  ownerName: string;
  interest: ViewerInterest | null;
  role: "TENANT" | "OWNER" | "ADMIN" | null;
  filled: boolean;
  onChange: (i: ViewerInterest | null) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  if (!role) {
    return (
      <Button asChild size="lg" className="w-full">
        <Link href={`/login?next=/listings/${listingId}`}>Sign in to request a visit</Link>
      </Button>
    );
  }
  if (role !== "TENANT") {
    return <p className="rounded-xl bg-secondary p-3 text-center text-sm text-muted-foreground">Only tenant accounts can send requests.</p>;
  }

  if (interest?.status === "ACCEPTED") {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="size-4" /> {ownerName} accepted your request</p>
        <Button asChild size="lg" className="w-full">
          <Link href={interest.conversationId ? `/messages/${interest.conversationId}` : "/messages"}>
            <MessageCircle /> Open chat
          </Link>
        </Button>
      </div>
    );
  }
  if (interest?.status === "DECLINED") {
    return (
      <p className="flex items-center justify-center gap-2 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">
        <XCircle className="size-4" /> Your request was declined
      </p>
    );
  }
  if (interest?.status === "PENDING") {
    const withdraw = async () => {
      setWithdrawing(true);
      try {
        await api.delete(`/interests/${interest.id}`);
        onChange(null);
        toast.success("Request withdrawn");
        setConfirmWithdraw(false);
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setWithdrawing(false);
      }
    };
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-warning"><Clock className="size-4" /> Request sent — awaiting reply</p>
        <Button variant="outline" className="w-full" onClick={() => setConfirmWithdraw(true)}>Withdraw request</Button>
        <ConfirmDialog
          open={confirmWithdraw}
          onOpenChange={setConfirmWithdraw}
          title="Withdraw your request?"
          description={`${ownerName} will no longer see your request for “${listingTitle}”. You can send a new one later.`}
          confirmLabel="Withdraw"
          destructive
          loading={withdrawing}
          onConfirm={() => void withdraw()}
        />
      </div>
    );
  }

  if (filled) {
    return <p className="rounded-xl bg-secondary p-3 text-center text-sm text-muted-foreground">This home has been filled.</p>;
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api.post<{ interest: { id: string; status: InterestStatus } }>("/interests", { listingId, message: message.trim() || undefined });
      onChange({ id: res.data!.interest.id, status: "PENDING", conversationId: null });
      toast.success("Request sent", { description: `${ownerName} will be notified.` });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, "Could not send request"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full">
          <Send /> Request to connect
        </Button>
      </DialogTrigger>
      <DialogContent title={`Message ${ownerName}`} description="Introduce yourself — a short note about you and your move-in plans gets the best response.">
        <form onSubmit={send} className="space-y-4">
          <label htmlFor="interest-msg" className="sr-only">Message</label>
          <Textarea
            id="interest-msg"
            value={message}
            maxLength={1000}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Hi ${ownerName}, I'm interested in “${listingTitle}”. I'm looking to move in around…`}
            rows={5}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground tabular-nums">{message.length}/1000</span>
            <Button type="submit" loading={sending}>Send request</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
