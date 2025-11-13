export enum InviteStatus {
  NONE = 'none',
  PENDING = 'pending',
  USED = 'used'
}

export interface Invite {
  id: number;
  secret: string;
  signer: string;
  status: InviteStatus;
  updateDate: string;
}

export interface AddInviteRequest {
  secret: string;
  signer: string;
}

export interface CheckInviteRequest {
  address: string;
  secret?: string;
}
