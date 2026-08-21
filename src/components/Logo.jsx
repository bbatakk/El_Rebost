export default function Logo({ size = 40 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="11" y="5.5" width="26" height="7" rx="2.4" fill="#E0A96D" />
      <rect x="15" y="12.5" width="18" height="3.5" fill="#F0E8D5" />
      <rect x="8" y="16" width="32" height="27" rx="5.5" fill="#FFFFFF" stroke="#D9CBB0" strokeWidth="1.2" />
      <circle cx="24" cy="30" r="7" fill="#EF5350" />
      <ellipse cx="24" cy="22" rx="3.2" ry="1.8" fill="#66BB6A" transform="rotate(-25 24 22)" />
    </svg>
  )
}
