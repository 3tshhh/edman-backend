import type { User } from '../../modules/user/user.entity.js';

export interface IAuthUser {
  verifiedToken: VerifiedToken;
  user: User;
}

export interface VerifiedToken {
  userId: string;
  role: string | null;
  jti: string;
  exp: number;
}

export interface OtpPayload {
  phone: string;
  purpose: 'login';
  hashedCode: string;
  jti: string;
  exp: number;
  sub?: object;
}
