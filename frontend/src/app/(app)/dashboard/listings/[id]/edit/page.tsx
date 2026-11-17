"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { ListingForm } from "@/components/listing/listing-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlays";
import { ErrorState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import type { Listing } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading, reload } = useApi<{ listing: Listing; viewer: { isOwner: boolean } | null }>(`/listings/${id}`);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/listings/${id}`);
      toast.success("Listing deleted");
      router.replace("/dashboard/listings");
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <ProtectedRoute roles={["OWNER"]}>
      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.viewer?.isOwner ? (
        <ErrorState message="You can only edit your own listings." />
      ) : (
        <>
          <PageHeader
            eyebrow="Edit listing"
            title={data.listing.title}
            actions={
              <>
                <Button asChild variant="outline">
                  <Link href={`/listings/${id}`}><ExternalLink /> View</Link>
                </Button>
                <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirm(true)}>
                  <Trash2 /> Delete
                </Button>
              </>
            }
          />
          <ListingForm listing={data.listing} />
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title="Delete this listing permanently?"
            description="This removes the listing, its photos, all requests and any conversations linked to it. This cannot be undone. To stop new requests but keep history, mark it as filled instead."
            confirmLabel="Delete listing"
            destructive
            loading={deleting}
            onConfirm={() => void remove()}
          />
        </>
      )}
    </ProtectedRoute>
  );
}
