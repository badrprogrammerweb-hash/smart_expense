export type SupportedCurrency =
  | "SAR"
  | "USD"
  | "EUR"
  | "GBP"
  | "AED"
  | "EGP"
  | "KWD"
  | "QAR"
  | "BHD"
  | "OMR";

export const minorUnitDigits: Record<SupportedCurrency, number> = {
  SAR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  EGP: 2,
  KWD: 3,
  QAR: 2,
  BHD: 3,
  OMR: 3,
};
