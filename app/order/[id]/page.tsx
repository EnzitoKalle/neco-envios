'use client'

import { useState, useEffect, Suspense } from 'react'
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

function OrderTrackingContent() {
  const params = useParams()
  const orderId = params?.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    let myId = localStorage.getItem('neco_driver_id')
    if (!myId) {
      myId = localStorage.getItem('neco_client_id') || crypto.randomUUID()
      localStorage.setItem('neco_client_id', myId)
    }
    setCurrentUserId(myId)

    const fetchOrderAndMessages = async () => {
      const { data: orderData } = await supabase.from('orders').select('*').eq('id', orderId).single()
      if (orderData) setOrder(orderData)

      const { data: msgData } = await supabase.from('messages').select('*').eq('order_id', orderId).order('created_at', { ascending: true })
      if (msgData) setMessages(msgData)
      setLoading(false)
    }

    fetchOrderAndMessages()
  }, [orderId])

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando seguimiento...</div>
  if (!order) return <div className="p-8 text-center text-red-500">El pedido no existe.</div>

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg p-6 border border-slate-100">
        <div className="flex items-center justify-between mb-4 border-b pb-3">
          <h1 className="text-xl font-bold text-slate-900">Seguimiento de Envío</h1>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-700">← Inicio</Link>
        </div>
        <div className="text-2xl font-black text-emerald-600 border rounded-xl p-4 text-center bg-emerald-50 mb-4">
          ${order.final_price}
        </div>
        <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-2 mb-6">
          <div><span className="font-bold text-slate-500">Retiro:</span> <span className="text-slate-800 font-medium">{order.origin_address}</span></div>
          <div><span className="font-bold text-slate-500">Entrega:</span> <span className="text-slate-800 font-medium">{order.destination_address}</span></div>
        </div>
      </div>
    </div>
  )
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Cargando...</div>}>
      <OrderTrackingContent />
    </Suspense>
  )
}