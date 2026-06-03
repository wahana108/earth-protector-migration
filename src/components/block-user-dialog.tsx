'use client';

import { useState } from 'react';
import { Loader2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { blockUser } from '@/lib/blocks';

interface BlockUserDialogProps {
  targetUserId: string;
  targetName: string;
  currentUserId: string;
  onClose: () => void;
  onBlocked: () => void;
}

export function BlockUserDialog({
  targetUserId, targetName, currentUserId, onClose, onBlocked,
}: BlockUserDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleBlock() {
    if (!reason.trim()) { setError('Alasan pemblokiran wajib diisi.'); return; }
    setLoading(true);
    setError('');
    try {
      await blockUser(currentUserId, targetUserId, reason.trim());
      onBlocked();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memblokir. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Blokir Pengguna</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Blokir <span className="font-medium text-foreground">{targetName}</span>?
            Setelah diblokir, kalian tidak bisa saling bertransaksi atau berinteraksi.
          </p>
          <Textarea
            placeholder="Alasan pemblokiran (wajib)…"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant="destructive" onClick={handleBlock} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <UserX className="h-4 w-4 mr-1.5" />
            Blokir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
