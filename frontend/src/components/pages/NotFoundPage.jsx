import { Home, SearchX } from "lucide-react";

export default function NotFoundPage({ onBackHome }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
        <SearchX size={26} />
      </div>
      <h2 className="text-xl font-bold text-gray-900">
        Halaman tidak ditemukan
      </h2>
      <p className="text-sm text-gray-400 mt-2">
        Menu yang diminta tidak tersedia atau sudah tidak aktif.
      </p>
      <button
        onClick={onBackHome}
        className="mt-6 inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold px-4 py-2.5 rounded-lg"
      >
        <Home size={16} />
        Kembali ke Dashboard
      </button>
    </div>
  );
}
