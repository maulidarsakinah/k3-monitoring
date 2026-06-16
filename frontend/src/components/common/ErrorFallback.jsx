import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorFallback({
  message = "Terjadi kesalahan pada aplikasi.",
  onRetry,
  title = "Aplikasi tidak dapat menampilkan halaman",
}) {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-8">
      <section className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-5">
          <AlertTriangle size={26} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          {message}
        </p>
        <button
          onClick={onRetry || (() => window.location.reload())}
          className="mt-6 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700"
        >
          <RefreshCw size={15} />
          Muat Ulang
        </button>
      </section>
    </main>
  );
}
