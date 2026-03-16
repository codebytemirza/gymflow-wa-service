import { cn, PAYMENT_STATUS_COLORS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/types/database.types";

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  className?: string;
}

/**
 * Colored badge for payment status: paid (green), pending (amber), overdue (red).
 */
export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  return (
    <Badge
      className={cn(
        "capitalize border-0",
        PAYMENT_STATUS_COLORS[status],
        className
      )}
    >
      {status}
    </Badge>
  );
}
