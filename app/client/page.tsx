'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { NECOCHEA_ZONES, VEHICLE_TYPES, Zone, VehicleType } from '@/constants/zones'
import Link from 'next/link'

interface DriverQuote {
  id: string
  full_name: string
  vehicle_type: string
  vehicle_description: string | null
  is_verified: boolean
  base_zone: string
  calculated_price: number
}

export default function ClientRequestPage() {
  const [originZone, setOriginZone] = useState<Zone>(NECOCHEA_ZONES[0])
  const [destinationZone, setDestinationZone] = useState<Zone>(NECOCHEA_ZONES[1])
  const [originAddress, setOriginAddress] = useState('')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [vehicle, setVehicle] = useState<VehicleType>('Moto')
  
  const [availableDrivers, setAvailableDrivers] = useState<DriverQuote[]>([])
  const [loading, setLoading] = useState(false)
  const [requestingId, setRequestingId] = useState<string | null>(null)

  // Buscar repartidores disponibles según zona y vehículo
  const searchDrivers = async () => {
    setLoading(true)
    try {
      // 1. Obtener repartidores en línea, no ocupados y con el vehículo requerido
      const { data: drivers, error: driverError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver')
        .eq('is_online', true)
        .eq('is_busy', false)
        .eq('vehicle_type', vehicle)

      if (driverError) throw driverError

      if (!drivers || drivers.length === 0) {
        setAvailableDrivers([])
        setLoading(false)
        return
      }

      const quotes: DriverQuote[] = []

      // 2. Para cada repartidor, buscar la tarifa correspondiente a la zona de destino
      for (const driver of drivers) {
        const { data: rates } = await supabase
          .from('driver_rates')
          .select('price')
          .eq('driver_id', driver.id)
          .eq('destination_zone', destinationZone)
          .single()

        if (rates && rates.price) {
          quotes.push({
            id: driver.id,
            full_name: driver.full_name,
            vehicle_type: driver.vehicle_type,
            vehicle_description: driver.vehicle_description,
            is_verified: driver.is_verified,
            base_zone: driver.base_zone,
            calculated_price: rates.price,
          })
        }
      }

      setAvailableDrivers(quotes)
    } catch (err) {
      console.error('Error buscando repartidores:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    searchDrivers()
  }, [originZone, destinationZone, vehicle])

  const handleSelectDriver = async (driver: DriverQuote) => {
    if (!originAddress || !destinationAddress) {
      alert('Por favor completa la dirección exacta de retiro y entrega.')
      return
    }

    setRequestingId(driver.id)
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          origin_address: `${originAddress} (${originZone})`,
          destination_address: `${destinationAddress} (${destinationZone})`,
          vehicle_required: vehicle,
          driver_id: driver.id,
          final_price: driver.calculated_price,
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error

      // Redirigir a la vista de seguimiento/chat
      window.location.href = `/order/${order.id}`
    } catch (err) {
      console.error('Error al crear pedido:', err)
      alert('Ocurrió un error al solicitar el repartidor.')
      setRequestingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg p-6 border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Solicitar Envío</h1>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">← Volver</Link>
        </div>

        {/* Formulario de Ubicación */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Zona de Retiro</label>
            <select
              value={originZone}
              onChange={(e) => setOriginZone(e.target.value as Zone)}
              className="w-full border rounded-xl p-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {NECOCHEA_ZONES.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Dirección exacta de retiro (ej: Calle 61 #2450)"
              value={originAddress}
              onChange={(e) => setOriginAddress(e.target.value)}
              className="w-full mt-2 border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Zona de Entrega</label>
            <select
              value={destinationZone}
              onChange={(e) => setDestinationZone(e.target.value as Zone)}
              className="w-full border rounded-xl p-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {NECOCHEA_ZONES.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Dirección exacta de entrega (ej: Av. 2 #3800)"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              className="w-full mt-2 border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Vehículo Necesario</label>
            <div className="grid grid-cols-3 gap-2">
              {VEHICLE_TYPES.map((v) => (
                <button
                  key={v}
                  onClick={() => setVehicle(v)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                    vehicle === v
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de Repartidores Disponibles */}
        <hr className="my-6 border-slate-100" />
        <h2 className="text-lg font-bold text-slate-900 mb-4">Repartidores Disponibles</h2>

        {loading ? (
          <p className="text-center text-slate-400 py-6 text-sm">Buscando tarifas en tiempo real...</p>
        ) : availableDrivers.length === 0 ? (
          <div className="text-center bg-slate-50 rounded-xl p-6 text-slate-500 text-sm">
            No hay repartidores disponibles en este momento para el vehículo y las zonas elegidas.
          </div>
        ) : (
          <div className="space-y-3">
            {availableDrivers.map((driver) => (
              <div
                key={driver.id}
                className="flex items-center justify-between border rounded-2xl p-4 bg-white hover:border-emerald-200 transition shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{driver.full_name}</span>
                    {driver.is_verified && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                        ✓ Verificado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {driver.vehicle_type} {driver.vehicle_description ? `• ${driver.vehicle_description}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Base: {driver.base_zone || 'Necochea'}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-lg font-black text-emerald-600">
                    ${driver.calculated_price}
                  </div>
                  <button
                    onClick={() => handleSelectDriver(driver)}
                    disabled={requestingId === driver.id}
                    className="mt-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition"
                  >
                    {requestingId === driver.id ? 'Solicitando...' : 'Solicitar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}