"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { GymRow, ProfileRow, Database } from "@/types/database.types";

/**
 * Settings page — update gym profile (name, address, phone, default fee).
 */
export default function SettingsPage() {
  const [gym, setGym] = useState<Partial<GymRow>>({});
  const [gymId, setGymId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchGym() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData } = await supabase
          .from("profiles")
          .select("gym_id")
          .eq("id", user.id)
          .single();

        const profile = profileData as Pick<ProfileRow, "gym_id"> | null;
        if (!profile?.gym_id) return;

        setGymId(profile.gym_id);

        const { data: gymData } = await supabase
          .from("gyms")
          .select("*")
          .eq("id", profile.gym_id)
          .single();

        if (gymData) setGym(gymData as GymRow);
      } catch {
        toast.error("Failed to load gym settings.");
      } finally {
        setLoading(false);
      }
    }
    fetchGym();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!gymId) return;

    setSaving(true);
    try {
      const supabase = createClient();
      const payload: Database["public"]["Tables"]["gyms"]["Update"] = {
        name: gym.name,
        address: gym.address ?? null,
        phone: gym.phone ?? null,
        default_fee: gym.default_fee,
      };
      const { error } = await supabase
        .from("gyms")
        .update(payload as never)
        .eq("id", gymId);

      if (error) {

        toast.error(error.message);
        return;
      }

      toast.success("Settings saved successfully!");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your gym profile and preferences."
      />

      <Card className="max-w-2xl border-zinc-200/60 dark:border-zinc-800">
        <CardHeader>
          <CardTitle>Gym Profile</CardTitle>
          <CardDescription>
            Update your gym&apos;s basic information.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSave}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Gym Name</Label>
              <Input
                id="name"
                value={gym.name ?? ""}
                onChange={(e) => setGym({ ...gym, name: e.target.value })}
                required
                placeholder="Iron Paradise Gym"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={gym.address ?? ""}
                onChange={(e) => setGym({ ...gym, address: e.target.value })}
                placeholder="123 Main Street, Lahore"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={gym.phone ?? ""}
                onChange={(e) => setGym({ ...gym, phone: e.target.value })}
                placeholder="03001234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_fee">Default Monthly Fee (PKR)</Label>
              <Input
                id="default_fee"
                type="number"
                value={gym.default_fee ?? ""}
                onChange={(e) =>
                  setGym({ ...gym, default_fee: Number(e.target.value) })
                }
                placeholder="3000"
                min={100}
              />
            </div>
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
