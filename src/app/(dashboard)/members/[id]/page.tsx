"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Edit,
  Phone,
  Calendar,
  CreditCard,
  FileText,
  Loader2,
  CheckCircle,
  MessageSquare,
  Trash2,
} from "lucide-react";
import {
  cn,
  formatCurrency,
  formatDate,
  formatPhone,
  MEMBER_STATUS_COLORS,
} from "@/lib/utils";
import { toast } from "sonner";
import type { MemberRow, PaymentRow } from "@/types/database.types";



/**
 * Member detail page — shows member info + full payment history timeline.
 */
export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<MemberRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Sending Reminder State
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // Edit Payment Dialog State
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [editStatus, setEditStatus] = useState<string>("pending");
  const [editDueDate, setEditDueDate] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editPaidDate, setEditPaidDate] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [savingPayment, setSavingPayment] = useState(false);

  // Delete state
  const [showDeleteMember, setShowDeleteMember] = useState(false);
  const [deletingMember, setDeletingMember] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [memberRes, paymentsRes] = await Promise.all([
        supabase.from("members").select("*").eq("id", id).single(),
        supabase
          .from("payments")
          .select("*")
          .eq("member_id", id)
          .order("due_date", { ascending: false }),
      ]);

      const memberRaw = memberRes as unknown as { data: MemberRow | null; error: unknown };
      if (memberRaw.error || !memberRaw.data) {
        toast.error("Member not found.");
        router.push("/members");
        return;
      }

      setMember(memberRaw.data);
      setPayments((paymentsRes.data ?? []) as PaymentRow[]);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openEditPayment(payment: PaymentRow) {
    setEditingPayment(payment);
    setEditStatus(payment.status);
    setEditDueDate(payment.due_date);
    setEditAmount(payment.amount.toString());
    setEditPaidDate(payment.paid_date || new Date().toISOString().split("T")[0]);
    setEditNotes(payment.notes || "");
  }

  async function handleSavePayment() {
    if (!editingPayment) return;
    setSavingPayment(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("payments")
        .update({
          status: editStatus,
          due_date: editDueDate,
          amount: Number(editAmount),
          paid_date: editStatus === "paid" ? editPaidDate : null,
          notes: editNotes || null,
        } as never)
        .eq("id", editingPayment.id);

      if (error) throw error;
      toast.success("Payment updated successfully!");
      setEditingPayment(null);
      await fetchData();
    } catch {
      toast.error("Failed to update payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleSendReminder(payment: PaymentRow) {
    if (!member?.phone) {
      toast.error("Member has no phone number attached.");
      return;
    }
    setSendingReminder(payment.id);
    try {
      // Ensure E164 format (+92...) but strip the '+' for Baileys
      let phone = member.phone;
      if (phone.startsWith("0")) phone = "92" + phone.slice(1);
      if (phone.startsWith("+")) phone = phone.slice(1);

      const message = `Hello ${member.full_name}, this is a reminder from GymFlow. Your payment of ${formatCurrency(payment.amount)} was due on ${formatDate(payment.due_date)}. Please clear your dues at your earliest convenience. Thank you!`;

      const res = await fetch("/api/wa/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send message");
      }
      toast.success("Reminder message sent via WhatsApp!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSendingReminder(null);
    }
  }

  async function handleDeleteMember() {
    if (!member) return;
    setDeletingMember(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("members").delete().eq("id", member.id);
      if (error) throw error;
      toast.success("Member deleted.");
      router.push("/members");
    } catch {
      toast.error("Failed to delete member.");
    } finally {
      setDeletingMember(false);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    setDeletingPaymentId(paymentId);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("payments").delete().eq("id", paymentId);
      if (error) throw error;
      toast.success("Payment deleted.");
      await fetchData();
    } catch {
      toast.error("Failed to delete payment.");
    } finally {
      setDeletingPaymentId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!member) return null;

  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = payments
    .filter((p) => p.status !== "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={member.full_name}>
        <div className="flex gap-2">
          <Link href="/members">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <Link href={`/members/${id}/edit`}>
            <Button size="sm" variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDeleteMember(true)}
            className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Member info card */}
        <Card className="border-zinc-200/60 dark:border-zinc-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Profile</CardTitle>
              <Badge
                className={cn(
                  "capitalize border-0",
                  MEMBER_STATUS_COLORS[member.status]
                )}
              >
                {member.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Phone className="h-4 w-4 shrink-0 text-zinc-400" />
              {formatPhone(member.phone)}
            </div>
            {member.cnic && (
              <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                {member.cnic}
              </div>
            )}
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Calendar className="h-4 w-4 shrink-0 text-zinc-400" />
              Joined {formatDate(member.join_date)}
            </div>
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <CreditCard className="h-4 w-4 shrink-0 text-zinc-400" />
              {formatCurrency(member.plan_fee)} / month (day {member.billing_day})
            </div>
            {member.address && (
              <p className="text-zinc-500 dark:text-zinc-400">{member.address}</p>
            )}
            {member.notes && (
              <>
                <Separator />
                <p className="text-zinc-500 italic dark:text-zinc-400">
                  {member.notes}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Revenue summary */}
        <Card className="border-zinc-200/60 dark:border-zinc-800 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Payment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Total Paid
                </p>
                <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
              <div className="rounded-xl bg-red-50 p-4 dark:bg-red-900/20">
                <p className="text-xs text-red-600 dark:text-red-400">
                  Outstanding
                </p>
                <p className="mt-1 text-xl font-bold text-red-700 dark:text-red-300">
                  {formatCurrency(totalOutstanding)}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Total Payments
                </p>
                <p className="mt-1 text-xl font-bold text-zinc-700 dark:text-zinc-300">
                  {payments.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment history */}
      <Card className="border-zinc-200/60 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">
              No payments recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-200/60 dark:border-zinc-800">
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow
                    key={payment.id}
                    className="border-zinc-200/60 dark:border-zinc-800"
                  >
                    <TableCell>{formatDate(payment.due_date)}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500">
                      {payment.paid_date ? formatDate(payment.paid_date) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {payment.status === "overdue" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendReminder(payment)}
                            disabled={sendingReminder === payment.id}
                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950"
                          >
                            {sendingReminder === payment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MessageSquare className="h-4 w-4" />
                            )}
                            <span className="sr-only">Send Reminder</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditPayment(payment)}
                          className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeletePayment(payment.id)}
                          disabled={deletingPaymentId === payment.id}
                          className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                        >
                          {deletingPaymentId === payment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Payment Dialog */}
      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              Update payment details, amount, status, or dates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={editStatus} onValueChange={(val) => setEditStatus(val || "pending")}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (PKR)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  min={1}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
              {editStatus === "paid" && (
                <div className="space-y-2">
                  <Label htmlFor="paid_date">Paid Date</Label>
                  <Input
                    id="paid_date"
                    type="date"
                    value={editPaidDate}
                    onChange={(e) => setEditPaidDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Method of payment, receipt #, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPayment(null)} disabled={savingPayment}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePayment}
              disabled={savingPayment}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {savingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Member Confirmation Dialog */}
      <Dialog open={showDeleteMember} onOpenChange={setShowDeleteMember}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{member?.full_name}</strong>? This will also delete all their payment records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteMember(false)} disabled={deletingMember}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteMember}
              disabled={deletingMember}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingMember && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
