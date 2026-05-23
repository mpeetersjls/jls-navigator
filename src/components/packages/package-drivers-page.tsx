import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, UserCircle2, Search, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

type DeliveryDriver = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  license_number: string | null;
  notes: string | null;
  active: boolean;
};

const EMPTY = { name: "", email: "", phone: "", license_number: "", notes: "", active: true };

export function PackageDriversPage() {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryDriver | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryDriver | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("delivery_drivers")
      .select("*")
      .order("name");
    if (error) {
      if (String(error.message).includes("does not exist") || String(error.code) === "42P01") {
        setTableError(true);
      } else {
        toast.error(error.message);
      }
    } else {
      setDrivers(data as DeliveryDriver[]);
      setTableError(false);
    }
    setLoading(false);
  }

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(d: DeliveryDriver) {
    setEditing(d);
    setForm({
      name: d.name, email: d.email ?? "", phone: d.phone ?? "",
      license_number: d.license_number ?? "", notes: d.notes ?? "", active: d.active,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        license_number: form.license_number || null,
        notes: form.notes || null,
        active: form.active,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await (supabase as any).from("delivery_drivers").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Driver updated");
      } else {
        const { error } = await (supabase as any).from("delivery_drivers").insert([payload]);
        if (error) throw error;
        toast.success("Driver added");
      }
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await (supabase as any).from("delivery_drivers").delete().eq("id", deleteTarget.id);
    if (error) toast.error(error.message);
    else { toast.success("Driver removed"); await load(); }
    setDeleteTarget(null);
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const filtered = useMemo(() => {
    if (!q.trim()) return drivers;
    const s = q.toLowerCase();
    return drivers.filter((d) =>
      [d.name, d.email, d.phone, d.license_number].some((v) => String(v ?? "").toLowerCase().includes(s)),
    );
  }, [drivers, q]);

  if (tableError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <UserCircle2 className="h-12 w-12 text-muted-foreground/40" />
        <div>
          <p className="font-semibold text-sm">Delivery Drivers table not set up</p>
          <p className="text-xs text-muted-foreground mt-1">
            Apply migration <code>20260523000004_delivery_drivers.sql</code> in the Supabase Dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card/40 px-5 py-3">
        <div className="flex items-center gap-2">
          <UserCircle2 className="h-4 w-4 text-primary" />
          <h1 className="font-display text-base font-semibold">Delivery Drivers</h1>
          <span className="text-xs text-muted-foreground">({drivers.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drivers…" className="h-8 w-48 pl-8 text-xs" />
          </div>
          <Button onClick={openNew} size="sm" className="h-8 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Driver
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <UserCircle2 className="h-10 w-10 opacity-30" />
            <p className="text-sm">{q ? `No drivers matching "${q}"` : "No delivery drivers yet."}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {["Name", "Email", "Phone", "License", "Notes", "Status", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-1.5 font-medium text-sm">{d.name}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {d.email ? (
                        <a href={`mailto:${d.email}`} className="flex items-center gap-1 text-primary hover:underline">
                          <Mail className="h-3 w-3" />{d.email}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {d.phone ? (
                        <a href={`tel:${d.phone}`} className="flex items-center gap-1 hover:underline">
                          <Phone className="h-3 w-3" />{d.phone}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{d.license_number ?? "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground max-w-[150px] truncate">{d.notes ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {d.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(d)} className="h-7 w-7 p-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(d)} className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Add"} Delivery Driver</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={set("name")} placeholder="Full name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={set("email")} placeholder="driver@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input type="tel" value={form.phone} onChange={set("phone")} placeholder="+971 50 000 0000" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>License Number</Label>
              <Input value={form.license_number} onChange={set("license_number")} placeholder="DL-XXXXXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={set("notes")} placeholder="Any notes…" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="active">Active</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={handleSave} disabled={busy} className="gap-1.5">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save Changes" : "Add Driver"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove driver?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
