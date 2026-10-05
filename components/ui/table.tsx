import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

export function Table({ className = '', ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded border border-line">
      <table className={`w-full border-collapse text-left text-body [&_tbody_tr:last-child_td]:border-b-0 ${className}`} {...props} />
    </div>
  )
}

export function Th({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`whitespace-nowrap border-b border-line bg-subtle px-3 py-1.5 text-caption font-medium text-muted ${className}`}
      {...props}
    />
  )
}

export function Td({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`border-b border-line px-3 py-1.5 align-top ${className}`} {...props} />
}
