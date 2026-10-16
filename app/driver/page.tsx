'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { NECOCHEA_ZONES, VEHICLE_TYPES, Zone, VehicleType } from '@/constants/zones'
import Link from 'next/link'

export default function DriverDashboardPage() {
  const [driverId, setDriverId] = useState<string>('')
  const [fullName, setFullName] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType>('Moto')
  const [vehicleDesc, setVehicleDesc] = useState('')
  const [baseZone, setBaseZone] = useState<Zone>('Centro')
  const [isOnline, setIsOnline] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  
  // Guardar tarifas por zona
  const [rates, setRates] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Cargar perfil o inicializar borrador
  useEffect(() => {
    const initDriver = async () => {
      // Usaremos un ID persistente en localStorage para simular sesión en esta fase
      let localId = localStorage.getItem('neco_driver_id')
      if (!localId) {
        localId = crypto.randomUUID()
        localStorage.setItem('neco_driver_id', localId)
      }
      setDriverId(localId)

      // Cargar datos del perfil de Supabase si existen
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', localId)
        .single()

      if (profile) {
        setFullName(profile.full_name || '')
        setVehicleType(profile.vehicle_type || 'Moto')
        setVehicleDesc(profile.vehicle_description || '')
        setBaseZone(profile.base_zone || 'Centro')
        setIsOnline(profile.is_online || false)
        setIsBusy(profile.is_busy || false)
      }

      // Cargar tarifas existentes
      const { data: existingRates } = await supabase
        .from('driver_rates')
        .select('destination_zone, price')
        .eq('driver_id', localId)

      if (existingRates) {
        const ratesMap: Record<string, number> = {}
        existingRates.forEach((r) => {
          ratesMap[r.destination_zone] = r.price
        })
        setRates(ratesMap)
      }

      setLoading(false)
    }

    initDriver()
  }, [])

  // Cambiar el estado de En línea / Desconectado
  const toggleOnline = async () => {
    const nextState = !isOnline
    setIsOnline(nextState)

    if (driverId) {
      await supabase.from('profiles').upsert({
        id: driverId,
        role: 'driver',
        full_name: fullName || 'Repartidor Neco',
        vehicle_type: vehicleType,
        vehicle_description: vehicleDesc,
        base_zone: baseZone,
        is_online: nextState,
      })
    }
  }

  // Guardar cambios del perfil y tarifas
  const handleSaveProfile = async () => {
    if (!fullName) {
      alert('Por favor ingresa tu Nombre y Apellido.')
      return
    }

    setSaving(true)
    try {
      // 1. Guardar o actualizar perfil
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: driverId,
        role: 'driver',
        full_name: fullName,
        vehicle_type: vehicleType,
        vehicle_description: vehicleDesc,
        base_zone: baseZone,
        is_online: isOnline,
        is_busy: isBusy,
      })

      if (profileErr) throw profileErr

      // 2. Guardar tarifas por cada zona de Necochea
      for (const zone of NECOCHEA_ZONES) {
        const price = rates[zone] || 0
        if (price > 0) {
          // Eliminar tarifa previa e insertar nueva para mantener limpio
          await supabase
            .from('driver_rates')
            .delete()
            .eq('driver_id', driverId)
            .eq('destination_zone', zone)

          await supabase.from('driver_rates').insert({
            driver_id: driverId,
            destination_zone: zone,
            price: price,
          })
        }
      }

      alert('¡Perfil y tarifas actualizadas con éxito!')
    } catch (err) {
      console.error('Error guardando perfil:', err)
      alert('Ocurrió un error al guardar los datos.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando panel de repartidor...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg p-6 border border-slate-100">
        
        {/* Cabecera del Panel */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Panel del Repartidor</h1>
            <p className="text-xs text-slate-500">Configura tu disponibilidad y precios en Necochea</p>
          </div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">← Inicio</Link>
        </div>

        {/* Switch En Línea / Desconectado */}
        <div className={`p-4 rounded-2xl mb-6 flex items-center justify-between border transition ${
          isOnline ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200'
        }`}>
          <div>
            <span className={`text-xs font-extrabold uppercase px-2.5 py-1 rounded-full ${
              isOnline ? 'bg-emerald-600 text-white' : 'bg-slate-400 text-white'
            }`}>
              {isOnline ? '🟢 En Línea' : '🔴 Desconectado'}
            </span>
            <p className="text-xs text-slate-600 mt-2">
              {isOnline 
                ? 'Estás visible para recibir pedidos de clientes.' 
                : 'Ponte "En Línea" cuando estés listo para trabajar.'}
            </p>
          </div>

          <button
            onClick={toggleOnline}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow ${
              isOnline 
                ? 'bg-slate-900 text-white hover:bg-slate-800' 
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {isOnline ? 'Desconectar' : 'Conectarse'}
          </button>
        </div>

        {/* Formulario de Perfil */}
        <div className="space-y-4 mb-8">
          <h2 className="text-md font-bold text-slate-800 border-b pb-2">Datos del Repartidor</h2>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre y Apellido</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Vehículo</label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                className="w-full border rounded-xl p-3 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {VEHICLE_TYPES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Zona Base (Donde estás)</label>
              <select
                value={baseZone}
                onChange={(e) => setBaseZone(e.target.value as Zone)}
                className="w-full border rounded-xl p-3 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {NECOCHEA_ZONES.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción corta de tu vehículo</label>
            <input
              type="text"
              value={vehicleDesc}
              onChange={(e) => setVehicleDesc(e.target.value)}
              placeholder="Ej: Honda Wave roja 110cc / Mochila térmica grande"
              className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Configuración de Tarifas por Zona Base */}
        <div className="space-y-4 mb-8">
          <div>
            <h2 className="text-md font-bold text-slate-800">Tarifas por Zona de Entrega</h2>
            <p className="text-xs text-slate-500">
              Define cuánto cobras por llevar un envío desde tu Zona Base (<b>{baseZone}</b>) hasta cada destino:
            </p>
          </div>

          <div className="space-y-2">
            {NECOCHEA_ZONES.map((zone) => (
              <div key={zone} className="flex items-center justify-between border rounded-xl p-3 bg-slate-50">
                <span className="text-xs font-semibold text-slate-700">{zone}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-500">$</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={rates[zone] || ''}
                    onChange={(e) => setRates({ ...rates, [zone]: Number(e.target.value) })}
                    className="w-24 border rounded-lg p-2 text-right text-sm font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Botón de Guardar */}
        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl transition shadow-md"
        >
          {saving ? 'Guardando cambios...' : '💾 Guardar Mi Perfil y Tarifas'}
        </button>

      </div>
    </div>
  )
}