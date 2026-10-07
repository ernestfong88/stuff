export interface OrderScreenProps {
  /** The open order (dine-in check or pick up / delivery order). */
  orderId: string;
  /** Back to wherever the check was opened from. */
  onClose: () => void;
}

/** Take the order, fire courses, and close the check with payment. */
export function OrderScreen(_props: OrderScreenProps) {
  return null;
}
