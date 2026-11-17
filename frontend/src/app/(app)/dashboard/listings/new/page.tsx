"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { ListingForm } from "@/components/listing/listing-form";
import { PageHeader } from "@/components/ui/primitives";

export default function NewListingPage() {
  return (
    <ProtectedRoute roles={["OWNER"]}>
      <PageHeader eyebrow="New listing" title="List your place" description="Takes about five minutes. You can edit everything later." />
      <ListingForm />
    </ProtectedRoute>
  );
}
