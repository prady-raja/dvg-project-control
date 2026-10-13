import React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

/** One confirmation for destructive actions only (U-03): says what will happen, then asks. */
export default function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', destructive = true, onConfirm }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''} onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
