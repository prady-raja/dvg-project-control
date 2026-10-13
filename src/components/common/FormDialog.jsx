import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * A form in a dialog on a desktop and in a bottom drawer on a phone (U-02), where
 * Save stays fixed at the bottom instead of scrolling out of reach.
 */
export default function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitting,
  submitLabel = 'Save',
  error,
  size = 'sm:max-w-lg',
}) {
  const mobile = useIsMobile();
  const guarded = (v) => !submitting && onOpenChange(v);
  const actions = (
    <>
      <Button type="button" variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)} disabled={submitting}>
        Cancel
      </Button>
      <Button type="submit" className="min-h-11" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </>
  );
  const body = (
    <>
      <div className="space-y-4 py-1">{children}</div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </>
  );
  const submit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={guarded}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-display">{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 pb-3">{body}</div>
            <div className="flex gap-2 border-t border-border bg-background px-4 py-3 [&>*]:flex-1">{actions}</div>
          </form>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={guarded}>
      <DialogContent className={`max-h-[92vh] overflow-y-auto ${size}`}>
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit}>
          {body}
          <DialogFooter className="mt-6">{actions}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
