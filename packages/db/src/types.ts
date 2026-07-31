import type {
  IncidentEvent,
  IncidentSnapshot,
  PaymentRecord,
  ToolResult,
  VendorQuote,
  VerifiedOutcome,
} from "@steward/contracts";

export type ContactVerificationStatus = "pending" | "verified" | "revoked";

export interface ControlledContact {
  id: string;
  phoneE164: string;
  label: string;
  verificationStatus: ContactVerificationStatus;
  organizerControlled: boolean;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovedVendor {
  id: string;
  propertyId: string;
  contactId: string;
  name: string;
  serviceCategories: string[];
  priority: number;
  policyNotes: string | null;
  active: boolean;
}

export interface ProviderOperation {
  operationId: string;
  incidentId: string;
  provider: ToolResult["provider"];
  operation: string;
  status: ToolResult["status"];
  idempotencyKey: string | null;
  requestSummary: Record<string, unknown>;
  result: ToolResult | null;
  startedAt: string;
  completedAt: string | null;
}

export interface EvidenceRecord {
  id: string;
  incidentId: string;
  kind: "photo" | "video-frame" | "audio" | "tool-result" | "message" | "call-record";
  summary: string;
  submittedBy: string;
  verifiedBy: "guest" | "vendor" | "agent-vision" | "tool" | "owner" | null;
  createdAt: string;
}

export interface OrderedIncidentEvent {
  sequence: number;
  event: IncidentEvent;
}

export interface BeginOperationInput {
  operationId: string;
  incidentId: string;
  provider: ToolResult["provider"];
  operation: string;
  idempotencyKey?: string;
  requestSummary?: Record<string, unknown>;
  startedAt: string;
}

export interface IncidentStore {
  createIncident(snapshot: IncidentSnapshot, createdEvent: IncidentEvent): Promise<IncidentSnapshot>;
  getIncident(incidentId: string): Promise<IncidentSnapshot | null>;
  appendEvent(event: IncidentEvent): Promise<OrderedIncidentEvent>;
  listEvents(incidentId: string): Promise<OrderedIncidentEvent[]>;
  beginOperation(input: BeginOperationInput): Promise<ProviderOperation>;
  completeOperation(operationId: string, result: ToolResult): Promise<ProviderOperation>;
  getOperationByIdempotencyKey(idempotencyKey: string): Promise<ProviderOperation | null>;
  upsertControlledContact(contact: ControlledContact): Promise<ControlledContact>;
  getControlledContact(contactId: string): Promise<ControlledContact | null>;
  listApprovedVendors(propertyId: string, serviceCategory?: string): Promise<ApprovedVendor[]>;
  saveApprovedVendor(vendor: ApprovedVendor): Promise<ApprovedVendor>;
  saveVendorQuote(quote: VendorQuote): Promise<VendorQuote>;
  savePayment(payment: PaymentRecord): Promise<PaymentRecord>;
  getPaymentByIdempotencyKey(idempotencyKey: string): Promise<PaymentRecord | null>;
  getPaymentByProviderId(providerPaymentId: string): Promise<PaymentRecord | null>;
  recordProcessedStripeEvent(eventId: string, eventType: string, processedAt: string): Promise<boolean>;
  addEvidence(evidence: EvidenceRecord): Promise<EvidenceRecord>;
  hasEvidenceRefs(incidentId: string, evidenceRefs: string[]): Promise<boolean>;
  resolveIncident(incidentId: string, outcome: VerifiedOutcome, event: IncidentEvent): Promise<IncidentSnapshot>;
}

export function canContact(contact: ControlledContact): boolean {
  return contact.organizerControlled || contact.verificationStatus === "verified";
}
