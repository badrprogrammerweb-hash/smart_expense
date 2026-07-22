import type { InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";
import { formatDisplayDate, type DisplayDateValue } from "@/lib/format/date";

export type DateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value"> & {
  value: DisplayDateValue;
};

export function DateField({ value, ...props }: DateFieldProps) {
  return <Input {...props} dir="ltr" inputMode="numeric" value={formatDisplayDate(value)} pattern="\\d{2}/\\d{2}/\\d{4}" />;
}
