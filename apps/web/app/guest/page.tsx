import type { Metadata } from "next";

import { GuestExperience } from "../../components/guest/guest-experience";

export const metadata: Metadata = {
  title: "Guest help",
  description: "Temporary, booking-scoped access to a Steward property incident.",
};

interface GuestPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GuestPage({ searchParams }: GuestPageProps) {
  const query = await searchParams;

  return (
    <GuestExperience
      initialAccess={first(query.access)}
      initialCamera={first(query.camera)}
      initialFixture={first(query.fixture)}
      initialFrame={first(query.frame)}
    />
  );
}
