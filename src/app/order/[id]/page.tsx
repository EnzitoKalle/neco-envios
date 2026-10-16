'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Order {
  id: string
  origin_address: string
  destination_address: string
  vehicle_required: string
  final_price: number
  status: 'pending' | 'accepted' | 'heading_to_pickup' | 'picked_up' | 'delivered' | 'cancelled'
  driver_id: string
}

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
}

export default function OrderTrackingPage() {
  const params = useParams()
  const orderId = params?.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    // Obtener ID del repartidor local o generar temporal para cliente
    let myId = localStorage.getItem('neco_driver_id')
    if (!myId) {
      myId = localStorage.getItem('neco_client_id') || crypto.randomUUID()
      localStorage.setItem('neco_client_id', myId)
    }
    setCurrentUserId(myId)

    const fetchOrderAndMessages = async () => {
      // 1. Cargar datos del pedido
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (orderData) setOrder(orderData)

      // 2. Cargar historial del chat
      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })

      if (msgData) setMessages(msgData)
      setLoading(false)
    }

    fetchOrderAndMessages()

    // 3. Suscribirse a cambios en tiempo real del pedido y los mensajes (Supabase Realtime)
    const orderSubscription = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder(payload.new as Order)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(orderSubscription)
    }
  }, [orderId])

  // Actualizar el estado del pedido (para el repartidor)
  const updateStatus = async (newStatus: Order['status']) => {
    if (!order) return
    const isDelivered = newStatus === 'delivered'

    await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', order.id)

    // Si se entregó, liberar al repartidor para que vuelva a estar disponible
    if (isDelivered && order.driver_id) {
      await supabase
        .from('profiles')
        .update({ is_busy: false })
        .eq('id', order.driver_id)
    }
  }

  // Enviar mensaje en el chat
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !order) return

    await supabase.from('messages').insert({
      order_id: order.id,
      sender_id: currentUserId,
      content: newMessage.trim(),
    })

    setNewMessage('')
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando seguimiento de envío...</div>
  }

  if (!order) {
    return <div className="p-8 text-center text-red-500">El pedido solicitado no existe.</div>
  }

  const isDriver = order.driver_id === currentUserId

  const statusLabels: Record<Order['status'], { label: string; color: string }> = {
    pending: { label: '⏳ Esperando Confirmación', color: 'bg-amber-100 text-amber-800' },
    accepted: { label: '🟢 Pedido Aceptado', color: 'bg-blue-100 text-blue-800' },
    heading_to_pickup: { label: '🛵 En Camino a Retirar', color: 'bg-purple-100 text-purple-800' },
    picked_up: { label: '📦 Retirado', color: 'bg-indigo-100 text-indigo-800' },
    delivered: { label: '✅ Entregado', color: 'bg-emerald-100 text-emerald-800' },
    cancelled: { label: '❌ Cancelado', color: 'bg-rose-100 text-rose-800' },
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg p-6 border border-slate-100">
        
        <div className="flex items-center justify-between mb-4 border-b pb-3">
          <h1 className="text-xl font-bold text-slate-900">Seguimiento de Envío</h1>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-700">← Inicio</Link>
        </div>

        {/* Estado Actual */}
        <div className="mb-6 text-center">
          <span className={`inline-block text-sm font-extrabold px-4 py-2 rounded-full ${statusLabels[order.status].color}`}>
            {statusLabels[order.status].label}
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-2">${order.final_price}</div>
        </div>

        {/* Botones de Cambio de Estado (Exclusivo para Repartidores) */}
        {isDriver && order.status !== 'delivered' && (
          <div className="bg-slate-50 p-4 rounded-xl mb-6 border border-slate-200">
            <p className="text-xs font-bold text-slate-600 mb-2">Cambiar Estado del Pedido:</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => updateStatus('accepted')} className="bg-blue-600 text-white text-xs font-bold py-2 rounded-lg">
                🟢 Aceptar Pedido
              </button>
              <button onClick={() => updateStatus('heading_to_pickup')} className="bg-purple-600 text-white text-xs font-bold py-2 rounded-lg">
                🛵 En Camino
              </button>
              <button onClick={() => updateStatus('picked_up')} className="bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg">
                📦 Retirado
              </button>
              <button onClick={() => updateStatus('delivered')} className="bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg">
                ✅ Entregado
              </button>
            </div>
          </div>
        )}

        {/* Detalle de Direcciones */}
        <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-2 mb-6">
          <div><span className="font-bold text-slate-500">Retiro:</span> <span className="text-slate-800 font-medium">{order.origin_address}</span></div>
          <div><span className="font-bold text-slate-500">Entrega:</span> <span className="text-slate-800 font-medium">{order.destination_address}</span></div>
          <div><span className="font-bold text-slate-500">Vehículo:</span> <span className="text-slate-800 font-medium">{order.vehicle_required}</span></div>
        </div>

        {/* Chat en Tiempo Real */}
        <div className="border rounded-xl p-4 bg-slate-50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Chat en Tiempo Real</h2>
          
          <div className="h-48 overflow-y-auto space-y-2 mb-3 p-2 bg-white rounded-lg border">
            {messages.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Aún no hay mensajes en este envío.</p>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_id === currentUserId
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-xs ${
                      isMe ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              placeholder="Escribe un mensaje..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 border rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button type="submit" className="bg-slate-900 text-white font-bold text-xs px-4 rounded-xl">
              Enviar
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}