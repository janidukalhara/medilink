export default function LoadingSpinner({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={`care-loader care-loader-${size}`}
      role="status"
      aria-label="Loading"
    >
      <span />
      <span />
      <span />
    </span>
  );
}
