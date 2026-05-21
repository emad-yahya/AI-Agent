export type UserRole = 'owner' | 'demo';

export interface UserDoc {
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  expiresAt: FirebaseFirestore.Timestamp | null;
  maxMasterScans: number;
  maxScans: number;
  usedMasterScans: number;
  usedScans: number;
  createdAt: FirebaseFirestore.Timestamp;
  createdBy: string | null;
  lastLoginAt?: FirebaseFirestore.Timestamp | null;
}

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  active: boolean;
  expiresAt: string | null;
  maxMasterScans: number;
  maxScans: number;
  usedMasterScans: number;
  usedScans: number;
  createdAt: string;
  lastLoginAt: string | null;
  expired: boolean;
}
