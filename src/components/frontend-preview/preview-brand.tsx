export function PreviewBrandMark() {
  return (
    <svg
      className="preview-brand-mark"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="preview-brand-tile" x="1" y="1" width="38" height="38" rx="11" />
      <g transform="translate(7 7) scale(.8125)">
        <circle className="preview-brand-head-one" cx="10" cy="9" r="3.5" />
        <path className="preview-brand-person-one" d="M5 25V18C5 15.7909 6.79086 14 9 14H12C13.5 14 14.8 14.8 15.5 16" />
        <circle className="preview-brand-head-two" cx="22" cy="9" r="3.5" />
        <path className="preview-brand-person-two" d="M27 25V18C27 15.7909 25.2091 14 23 14H20C18.5 14 17.2 14.8 16.5 16L14 21" />
      </g>
    </svg>
  );
}
