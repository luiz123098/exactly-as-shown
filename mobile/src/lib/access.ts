export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export type PartnerStatus = 'pending' | 'meeting_proposed' | 'meeting_confirmed' | 'approved' | 'rejected';

// Mirrors public.my_access() in the database.
export type Access = {
  is_admin: boolean;
  is_subscriber: boolean;
  membership_expires_at: string | null;
  member_application: { status: ApplicationStatus; decision_reason: string | null } | null;
  partner: {
    id: string;
    status: PartnerStatus;
    active: boolean;
    company_name: string;
    decision_reason: string | null;
    meeting_at: string | null;
    meeting_place: string | null;
    meeting_request: string | null;
  } | null;
};

// The four profiles of the spec. UI uses this to choose screens; the server
// enforces the same rules independently.
export type Kind = 'admin' | 'partner' | 'subscriber' | 'non_subscriber';

export function kindOf(a: Access): Kind {
  if (a.is_admin) return 'admin';
  if (a.partner?.status === 'approved' && a.partner.active) return 'partner';
  if (a.is_subscriber) return 'subscriber';
  return 'non_subscriber';
}
