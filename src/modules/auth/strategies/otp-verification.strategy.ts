import type {
  ApplicationStatus,
  UserRole,
} from '../../../common/constants/enums.js';

export interface OtpVerificationResult {
  accessToken: string;
  refreshToken: string;
  role: UserRole | null;
  isNewUser: boolean;
  applicationStatus: ApplicationStatus | null;
  message: string;
}

export type OtpPurposeType = 'login' | 'change_phone';

export abstract class OtpVerificationStrategy {
  abstract postVerification(payload: object): Promise<OtpVerificationResult | { message: string }>;
}
