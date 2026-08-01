import type { Metadata } from "next";
import Link from "next/link";

import { StewardLogo } from "../../components/steward-logo";
import { OwnerWorkspace } from "./owner-workspace";

export const metadata: Metadata = {
  title: "Owner workspace",
  description: "What needs you, what Steward is handling, and what has been resolved.",
};

export default function OwnerPage() {
  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Steward home">
          <StewardLogo markClassName="wordmark-logo" />
        </Link>
        <nav aria-label="Workspace navigation">
          <Link href="/owner" aria-current="page">Properties</Link>
        </nav>
        <span className="system-state"><span aria-hidden="true" />Live</span>
      </header>
      <main className="operate-shell narrow-operate">
        <header className="operate-header">
          <div>
            <h1>Your properties</h1>
          </div>
        </header>
        <OwnerWorkspace />
      </main>
    </>
  );
}
