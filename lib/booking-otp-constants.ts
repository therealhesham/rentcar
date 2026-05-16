/** طول رمز التحقق (حجز مباشر + دخول العميل). */
export const BOOKING_OTP_LENGTH = 4;

export const BOOKING_OTP_REGEX = /^\d{4}$/;

export function bookingOtpLengthLabelAr(): string {
  return `${BOOKING_OTP_LENGTH} أرقام`;
}
