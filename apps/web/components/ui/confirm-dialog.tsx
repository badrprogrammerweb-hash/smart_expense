import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function ConfirmDialog({ open, onOpenChange, title, consequence, confirmLabel, onConfirm, loading = false }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; consequence: string; confirmLabel: string; onConfirm: () => void; loading?: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange} title={title} footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="destructive" onClick={onConfirm} loading={loading}>{confirmLabel}</Button></>}><p>{consequence}</p></Dialog>;
}
