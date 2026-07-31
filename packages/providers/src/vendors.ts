import type { ApprovedVendor, IncidentStore } from "@steward/db";

export interface ExternalVendorDirectory {
  search(propertyId: string, serviceCategory: string): Promise<ApprovedVendor[]>;
}

export interface VendorCandidates {
  source: "approved" | "external" | "none";
  vendors: ApprovedVendor[];
}

export class ApprovedVendorDirectory {
  public constructor(
    private readonly store: IncidentStore,
    private readonly externalDirectory?: ExternalVendorDirectory,
  ) {}

  public async findCandidates(propertyId: string, serviceCategory: string): Promise<VendorCandidates> {
    const approved = await this.store.listApprovedVendors(propertyId, serviceCategory);
    if (approved.length > 0) return { source: "approved", vendors: approved };
    if (this.externalDirectory === undefined) return { source: "none", vendors: [] };
    const external = await this.externalDirectory.search(propertyId, serviceCategory);
    return { source: external.length > 0 ? "external" : "none", vendors: external };
  }
}
