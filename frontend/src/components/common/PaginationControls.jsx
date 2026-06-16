export default function PaginationControls({
  currentPage,
  itemLabel = "kejadian",
  itemsPerPage,
  onPageChange,
  totalItems,
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  return (
    <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
      <p className="text-xs text-gray-500">
        Menampilkan {totalItems === 0 ? 0 : startIndex + 1} -{" "}
        {Math.min(startIndex + itemsPerPage, totalItems)} dari {totalItems}{" "}
        {itemLabel}
      </p>
      <div className="flex gap-2">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg disabled:opacity-50"
        >
          Sebelumnya
        </button>

        <div className="flex items-center gap-1">
          {[...Array(totalPages)]
            .map((_, index) => (
              <button
                key={index}
                onClick={() => onPageChange(index + 1)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                  currentPage === index + 1
                    ? "bg-blue-500 text-white"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {index + 1}
              </button>
            ))
            .slice(
              Math.max(0, currentPage - 2),
              Math.min(totalPages, currentPage + 1),
            )}
        </div>

        <button
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg disabled:opacity-50"
        >
          Selanjutnya
        </button>
      </div>
    </div>
  );
}
