interface Props {
  scope: string
  onClick?: () => void
}

export function PermissionCell({ scope, onClick }: Props) {
  if (scope === 'none' || !scope) {
    return (
      <td className="px-2 py-2 text-center">
        <span className="text-white/15 text-xs">—</span>
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
        <span className="text-emerald-400 text-xs group-hover:text-emerald-300">✓</span>
      </td>
    )
  }

  return (
    <td
      className="px-2 py-2 text-center cursor-pointer group"
      onClick={onClick}
      title={scope}
    >
      <span className="text-[9px] font-semibold text-amber-400 group-hover:text-amber-300">
        {scope}
      </span>
    </td>
  )
}
