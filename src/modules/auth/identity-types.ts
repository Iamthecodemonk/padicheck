export type PendingOtp = {
  challenge_id: string; code_digest: string; purpose: 'signup' | 'verify_email' | 'password_reset';
  email: string; display_name?: string; password_hash?: string; users_id?: string;
};
export interface AuthChallenges {
  putOtp(key: string, pending: PendingOtp): Promise<boolean>;
  consumeOtp(key: string, challengeId: string, digest: string, purpose: PendingOtp['purpose']): Promise<PendingOtp | null>;
  discardOtp(key: string, challengeId: string): Promise<void>;
  putNonce(key: string, context: string): Promise<void>;
  consumeNonce(key: string, context: string): Promise<boolean>;
  ping(): Promise<void>;
  close(): Promise<void>;
}
export interface OtpMailer {
  sendCode(email: string, code: string, context?: OtpDeliveryContext): Promise<void>;
  verify(): Promise<void>;
  close(): void | Promise<void>;
}
export type OtpDeliveryContext = { key: string; challenge_id: string; expires_at: number; purpose?: 'password_reset' };
export type GoogleIdentity = { sub: string; email: string; name: string; nonce: string; authoritative_email: boolean };
export interface GoogleVerifier { verify(idToken: string): Promise<GoogleIdentity> }
export type AuthDependencies = { challenges?: AuthChallenges; mailer?: OtpMailer; google?: GoogleVerifier; platformEnabled?: boolean };
