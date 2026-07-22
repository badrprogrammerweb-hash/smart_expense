import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";

export function SearchField(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" className="ps-10" {...props} /></div>;
}
