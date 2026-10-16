import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100 text-center">
        <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
          Necochea • Envíos Urbanos
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 mt-4 mb-2">
          Neco Envíos
        </h1>
        <p className="text-slate-600 mb-8 text-sm">
          Conectamos comercios y clientes con repartidores independientes de forma transparente y sin tarifas ciegas.
        </p>

        <div className="space-y-4">
          <Link
            href="/client"
            className="w-full block bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-xl transition shadow-md"
          >
            📦 Solicitar un Envío (Cliente)
          </Link>
          <Link
            href="/driver"
            className="w-full block bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition shadow-md"
          >
            🛵 Panel de Repartidor
          </Link>
        </div>
      </div>
    </main>
  )
}