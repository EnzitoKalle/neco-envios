export const NECOCHEA_ZONES = [
  'Centro',
  'Playa / Villa Diaz Velez',
  'Quequen',
  'Zona Intermedia',
  'Puerto / Farol',
  'Villa del Deportista',
  'Barrio Parque',
] as const

export const VEHICLE_TYPES = [
  'Bicicleta',
  'Moto',
  'Auto o Camioneta',
] as const

export type Zone = typeof NECOCHEA_ZONES[number]
export type VehicleType = typeof VEHICLE_TYPES[number]
