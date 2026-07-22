import { Button } from "@/components/ui/button";

export function Pagination({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (page: number) => void }) {
  return <nav aria-label="Pagination" className="flex items-center justify-between gap-3"><Button variant="secondary" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Previous</Button><span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span><Button variant="secondary" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>Next</Button></nav>;
}
