# Person 2 integration handoff

Person 2 owns the final `/` landing page, `/guest/**`, landing visuals and 3D, and `packages/ui`.

During integration, **replace `apps/web/app/page.tsx` completely** with the landing page from `work/guest-visual`. The current Person 1 file is only a temporary route placeholder so the runtime can build and deploy before the visual branch is merged. It is not the approved landing design and should not be preserved or reconciled into Person 2's page.

Do not replace Person 1's `/voice`, `/owner/**`, `/vendor/**`, API routes, provider packages, database package, agent runtime, or Supabase migration when bringing in the visual branch.
