"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Smartphone,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type WaStatus = "connected" | "disconnected" | "connecting" | "banned";

interface StatusResponse {
  status: WaStatus;
  qrCode: string | null;
  phoneNumber: string | null;
  connectedAt: string | null;
  socketActive: boolean;
}

/** Calls our Next.js API proxy → wa-service */
async function waFetch(action: string, method: "GET" | "POST" = "GET") {
  const res = await fetch(`/api/wa/${action}`, { method });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const STATUS_CONFIG: Record<
  WaStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  connected: {
    label: "Connected",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: CheckCircle,
  },
  connecting: {
    label: "Connecting…",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: Loader2,
  },
  disconnected: {
    label: "Disconnected",
    color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    icon: WifiOff,
  },
  banned: {
    label: "Banned",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: XCircle,
  },
};

/**
 * WhatsApp connection page — shows QR code for pairing, live status,
 * and connect/disconnect controls.
 * Uses Supabase Realtime for live status updates.
 */
export default function WhatsAppPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await waFetch("status");
      setStatus(data);
    } catch {
      /* wa-service may be offline, ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Supabase Realtime subscription for live updates
  useEffect(() => {
    const supabase = createClient();
    
    // Subscribe to wa_sessions changes
    const channel = supabase
      .channel('wa-session-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wa_sessions',
        },
        (payload) => {
          const newStatus = payload.new as any;
          setStatus((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: newStatus.status,
              qrCode: newStatus.qr_code,
              phoneNumber: newStatus.phone_number,
              connectedAt: newStatus.connected_at,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleConnect() {
    setConnecting(true);
    try {
      await waFetch("connect", "POST");
      toast.success("Connecting… scan the QR code with WhatsApp.");
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to connect.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await waFetch("disconnect", "POST");
      toast.success("WhatsApp disconnected.");
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect.");
    } finally {
      setDisconnecting(false);
    }
  }

  const cfg = status ? STATUS_CONFIG[status.status] : STATUS_CONFIG.disconnected;
  const StatusIcon = cfg.icon;
  const isConnected = status?.status === "connected";
  const isConnecting = status?.status === "connecting";
  const isBanned = status?.status === "banned";

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp"
        description="Connect your WhatsApp to send automated payment reminders."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Card */}
        <Card className="border-zinc-200/60 dark:border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Connection Status</CardTitle>
              <Badge className={`gap-1.5 border-0 ${cfg.color}`}>
                <StatusIcon
                  className={`h-3.5 w-3.5 ${isConnecting ? "animate-spin" : ""}`}
                />
                {cfg.label}
              </Badge>
            </div>
            <CardDescription>
              {isBanned
                ? "⚠️ This WhatsApp number has been banned. Please use a different number."
                : isConnected
                ? `Connected as +${status?.phoneNumber}`
                : "Scan the QR code with your WhatsApp to connect."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-zinc-400" />
                  <span>
                    {status?.phoneNumber
                      ? `+${status.phoneNumber}`
                      : "No phone linked"}
                  </span>
                </div>
                {status?.connectedAt && (
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-zinc-400" />
                    <span>
                      Connected{" "}
                      {new Date(status.connectedAt).toLocaleString("en-PK")}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {isBanned ? (
                <Button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {connecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Reconnect with New Number
                </Button>
              ) : !isConnected ? (
                <Button
                  onClick={handleConnect}
                  disabled={connecting || isConnecting}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {connecting || isConnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="mr-2 h-4 w-4" />
                  )}
                  {isConnecting ? "Waiting for scan…" : "Connect WhatsApp"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                >
                  {disconnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <WifiOff className="mr-2 h-4 w-4" />
                  )}
                  Disconnect
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchStatus}
                title="Refresh status"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR Code Card */}
        <Card className="border-zinc-200/60 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">QR Code</CardTitle>
            <CardDescription>
              Open WhatsApp → Linked Devices → Link a Device → scan this code.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-6">
            {loading ? (
              <Skeleton className="h-52 w-52 rounded-xl" />
            ) : isBanned ? (
              <div className="flex flex-col items-center gap-3 text-red-500 dark:text-red-400">
                <XCircle className="h-16 w-16" />
                <p className="text-sm font-medium text-center">
                  This number has been banned by WhatsApp.
                  <br />
                  Please reconnect with a different number.
                </p>
              </div>
            ) : status?.qrCode ? (
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={status.qrCode}
                  alt="WhatsApp QR Code"
                  width={208}
                  height={208}
                  className="rounded-lg"
                />
              </div>
            ) : isConnected ? (
              <div className="flex flex-col items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-16 w-16" />
                <p className="text-sm font-medium">WhatsApp is connected!</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-zinc-400">
                <Smartphone className="h-16 w-16" />
                <p className="text-sm text-center">
                  Click &ldquo;Connect WhatsApp&rdquo; to generate a QR code.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="border-zinc-200/60 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">How to Connect</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal ml-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              Click <strong className="text-zinc-900 dark:text-white">Connect WhatsApp</strong>{" "}
              — a QR code will appear within a few seconds.
            </li>
            <li>
              Open <strong className="text-zinc-900 dark:text-white">WhatsApp</strong> on your phone
              → tap the menu (⋮) →{" "}
              <strong className="text-zinc-900 dark:text-white">Linked Devices</strong>.
            </li>
            <li>
              Tap{" "}
              <strong className="text-zinc-900 dark:text-white">Link a Device</strong> and scan the
              QR code shown above.
            </li>
            <li>
              Once connected, GymFlow will automatically send payment reminders
              to your members via WhatsApp.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
