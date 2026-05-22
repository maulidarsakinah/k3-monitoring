export default function ViolationBadges({
  value,
  emptyLabel = "Tidak ada pelanggaran",
  layout = "inline",
}) {
  const items = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  if (items.length === 0) {
    return <span className="text-xs text-gray-400">{emptyLabel}</span>;
  }

  if (layout === "list") {
    return (
      <ol className="space-y-1">
        {items.map((item, index) => (
          <li
            key={item}
            className="grid grid-cols-[1.25rem_1fr] items-start gap-2 text-xs text-red-700"
          >
            <span className="w-5 h-5 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-[10px] font-bold">
              {index + 1}
            </span>
            <span className="font-bold uppercase leading-5">{item}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-100 text-[10px] font-bold uppercase whitespace-nowrap"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          {item}
        </span>
      ))}
    </div>
  );
}
