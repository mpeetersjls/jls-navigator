import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, UserCircle2 } from "lucide-react";
import { toast } from "sonner";

type Driver = { id: string; full_name: string; phone: string | null; email: string | null; license_no: string | null; status: string; notes: string | null };
const EMPTY = { full_name: "", phone: "", email: "", license_no: "", status: "active", notes: "" };

function StatusBadge({ status }: { status: string }) {
  const cls = status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status === "active" ? "Active" : "Inactive"}</span>;
}

export function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any).from("crew_drivers").select("*").order("full_name");
    if (error) toast.error(error.message); else setDrivers(data as Driver[]);
    setLoading(false);
  }

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(d: Driver) { setEditing(d); setForm({ full_name: d.full_name, phone: d.phone ?? "", email: d.email ?? "", license_no: d.license_no ?? "", status: d.status, notes: d.notes ?? "" }); setOpen(true); }

  async function handleSave() {
    if (!form.full_name.trim()) { toast.error("Full name is required"); return; }
    setBusy(true);
    try {
      const payload = { full_name: form.full_name.trim(), phone: form.phone || null, email: form.email || null, license_no: form.license_no || null, status: form.status, notes: form.notes || null, updated_at: new Date().toISOString() };
      if (editing) {
        const { error } = await (supabase as any).from("crew_drivers").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Driver updated");
      } else {
        const { error } = await (supabase as any).from("crew_drivers").insert([payload]);
        if (error) throw error;
        toast.success("Driver added");
      }
      setOpen(false); await load();
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setBusy(false); }
  }

  async function handleDelete(d: Driver) {
    if (!confirm(`Delete driver "${d.full_name}"?`)) return;
    const { error } = await (supabase as any).from("crew_drivers").delete().eq("id", d.id);
    if (error) toast.error(error.message); else { toast.success("Driver removed"); await load(); }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card/40 px-6 py-4">
        <div className="flex items-center gap-2">
          <UserCircle2 className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-semibold">Drivers</h1>
          <span className="text-sm text-muted-foreground ml-1">({drivers.length})</span>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add Driver</Button>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : drivers.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <UserCircle2 className="h-10 w-10 opacity-30" /><p className="text-sm">No drivers yet. Add your first driver.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>{["Full Name","Phone","Email","License No.","Status",""].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {drivers.map(d => (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{d.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.license_no ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(d)} className="h-7 w-7 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(d)} className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Driver</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Full Name <span className="text-destructive">*</span></Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Ahmed Al Mansouri" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+971 50 000 0000" /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="driver@jls.ae" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>License No.</Label><Input value={form.license_no} onChange={e => setForm(f => ({ ...f, license_no: e.target.value }))} placeholder="DXB-123456" /></div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes…" /></div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={handleSave} disabled={busy} className="gap-1.5">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? "Save Changes" : "Add Driver"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
