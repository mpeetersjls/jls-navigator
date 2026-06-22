interface Props {
  scope: string
  onClick?: () => void
}

export function PermissionCell({ scope, onClick }: Props) {
  if (scope === 'none' || !scope) {
    return (
      <td className="px-2 py-2 text-center cursor-pointer" onClick={onClick} title="none">
        <span className="text-muted-foreground/30 text-xs">—</span>
      </td>
    )
  }

  if (scope === 'full' || scope === 'global') {
    return (
      <td
        className="px-2 py-2 text-center cursor-pointer group"
        onClick={onClick}
        title={scope}
      >
        <span className="text-emerald-600 dark:text-emerald-400 text-xs">✓</span>
      </td>
    )
  }

  return (
    <td
      className="px-2 py-2 text-center cursor-pointer group"
      onClick={onClick}
      title={scope}
    >
      <span className="text-[9px] font-semibold uppercase text-amber-600 dark:text-amber-400">
        {scope}
      </span>
    </td>
  )
}
