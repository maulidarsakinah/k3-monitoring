// ============================================================
// StatCard.jsx
// A single dark navy summary card showing a label and value.
// Used for: Total Violations, Compliance %, Pending Validasi.
// ============================================================

export default function StatCard({ label, value }) {
  return (
    // Dark card with rounded corners and padding
    <div className="bg-[#0d1b2a] rounded-2xl px-7 py-6 flex items-center justify-between flex-1 min-w-0">
      {/* Left side: label text */}
      <span className="text-white text-base font-semibold leading-snug max-w-[55%]">
        {label}
      </span>
      {/* Right side: big value number */}
      <span className="text-white text-4xl font-bold tracking-tight">
        {value}
      </span>
    </div>
  );
}
