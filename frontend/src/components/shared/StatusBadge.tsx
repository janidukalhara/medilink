import React from 'react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  // Prescription flow
  processing:      { label: 'Processing',        color: 'bg-yellow-100 text-yellow-800',  icon: '⚙️' },
  extracted:       { label: 'Ready to Send',      color: 'bg-blue-100 text-blue-800',      icon: '📋' },
  quote_requested: { label: 'Quotes Requested',   color: 'bg-purple-100 text-purple-800',  icon: '📤' },
  quotes_received: { label: 'Quotes Received',    color: 'bg-indigo-100 text-indigo-800',  icon: '💰' },
  accepted:        { label: 'Quote Accepted',     color: 'bg-teal-100 text-teal-800',      icon: '✅' },
  confirmed:       { label: 'Order Confirmed',    color: 'bg-teal-100 text-teal-700',      icon: '📦' },
  preparing:       { label: 'Preparing',          color: 'bg-orange-100 text-orange-700',  icon: '🧴' },
  dispatched:      { label: 'Out for Delivery',   color: 'bg-blue-100 text-blue-700',      icon: '🚚' },
  delivered:       { label: 'Delivered',          color: 'bg-green-100 text-green-700',    icon: '🚪' },
  pickup_ready:    { label: 'Ready for Pickup',   color: 'bg-cyan-100 text-cyan-800',      icon: '🏪' },
  completed:       { label: 'Completed',          color: 'bg-green-200 text-green-800',    icon: '🎉' },
  cancelled:       { label: 'Cancelled',          color: 'bg-gray-100 text-gray-500',      icon: '✖️' },
  failed:          { label: 'OCR Failed',         color: 'bg-red-100 text-red-700',        icon: '❌' },
  // Quotation order status
  pending:         { label: 'Pending',            color: 'bg-yellow-100 text-yellow-700',  icon: '⏳' },
  submitted:       { label: 'Quote Submitted',    color: 'bg-blue-100 text-blue-700',      icon: '📩' },
  rejected:        { label: 'Not Selected',       color: 'bg-gray-100 text-gray-500',      icon: '—' },
  expired:         { label: 'Expired',            color: 'bg-gray-100 text-gray-400',      icon: '⌛' },
  picked_up:       { label: 'Picked Up',          color: 'bg-green-100 text-green-700',    icon: '🛍️' },
};

interface Props {
  status: string;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, showIcon = true, size = 'sm' }: Props) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    color: 'bg-gray-100 text-gray-600',
    icon:  '•',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium
      ${size === 'sm' ? 'text-xs' : 'text-sm'} ${cfg.color}`}>
      {showIcon && <span className="text-[10px]">{cfg.icon}</span>}
      {cfg.label}
    </span>
  );
}
