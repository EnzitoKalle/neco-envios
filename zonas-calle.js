/* NECO ENVÍOS - Motor de zonas por calle y altura.
   La zona de un envío se calcula SOLO con la calle y la altura que escribe el cliente.
   No usa mapas, GPS ni buscadores de direcciones. Corre completo en el navegador. */
(function (root) {
  const FUERA = 'Fuera de zona: el repartidor no llega';
  const HOSPITAL = 'Zona Hospital, 9 de Julio y río';

  // Cada dirección se convierte en: calle, bis y altura
  function leer(t) {
    t = String(t || '');
    if (/ribera|r[ií]o/i.test(t)) return { rio: true };
    if (/brown/i.test(t)) return { brown: true };
    if (/lober[ií]a/i.test(t)) { const n = t.match(/\d+/g); return n ? { calle: 578, bis: false, h: +n[n.length - 1] } : null; }
    // Saca palabras de relleno: «calle», «av.», «n°», «nro», «altura», «al»
    const s = t.replace(/\b(calle|avenida|av|diagonal|diag)\b\.?/gi, ' ')
               .replace(/\b(n[°º]|nro\.?|numero|número|altura|al)\s*/gi, ' ')
               .replace(/[#°º]/g, ' ');
    const m = s.match(/(?<!\d)(\d{1,3})(?!\d)\s*(bis)?[\s,.\-–]*(\d{1,5})(?!\d)/i);
    if (!m) return null;
    return { calle: +m[1], bis: !!m[2], h: +m[3] };
  }

  function posicion(a) {
    const par = a.calle % 2 === 0; let low;
    if (a.calle >= 500) {
      const playa = par && a.calle <= 512;
      low = 500 + 2 * Math.floor(a.h / 100) + (par ? ((a.h >= 1600 && !playa) ? 9 : 1) : 2);
      return { par, entre: [low, (par && !playa && a.h >= 1500 && a.h < 1600) ? 541 : low + 2] };
    }
    if (par) low = 2 * Math.floor(a.h / 100) + 1;
    else low = a.h < 400 ? 2 * Math.floor(a.h / 50) - 6 : 2 * Math.floor(a.h / 100) + 6;
    return { par, entre: [low, low + 2] };
  }

  // Cada zona = rectángulos de calles (pares desde-hasta, impares desde-hasta). «key» es el identificador estable.
  const ZONAS = [
    { key: 'playa-necochea', n: 'Playa Necochea', r: [{ pares: [2, 28], impares: [1, 91] }, { pares: [2, 8], impares: [91, 101] }] },
    { key: 'centro', n: 'Centro', r: [{ impares: [43, 91], pares: [30, 90] }, { impares: [43, 75], pares: [30, 98] }] },
    { key: 'hospital', n: HOSPITAL, r: [{ impares: [1, 41], pares: [30, 116] }, { impares: [41, 111], pares: [99, 116] }, { impares: [77, 111], pares: [92, 116] }] },
    { key: 'villa-deportista', n: 'Villa Deportista', r: [{ impares: [93, 171], pares: [10, 90] }] }
  ];
  const ZONAS_Q = [
    { key: 'playa-quequen', n: 'Playa Quequén y alrededores', r: [{ impares: [501, 577], pares: [502, 520] }, { impares: [565, 577], pares: [520, 594] }] },
    { key: 'intermedia-quequen', n: 'Zona Intermedia Quequén', r: [{ impares: [501, 563], pares: [522, 552] }, { impares: [551, 563], pares: [552, 594] }] },
    { key: 'centro-quequen', n: 'Centro Quequén', r: [{ impares: [501, 549], pares: [554, 594] }] }
  ];

  function zonaDe(a, p, lista) {
    const s = a.calle + (a.bis ? 1 : 0); // «75 bis» queda entre la 75 y la 77
    for (const z of lista) for (const r of z.r) {
      const [sr, br] = p.par ? [r.pares, r.impares] : [r.impares, r.pares];
      if (s >= sr[0] && s <= sr[1] && p.entre[0] >= br[0] - 2 && p.entre[1] <= br[1]) return z;
    }
    return null;
  }
  const porKey = k => ZONAS.concat(ZONAS_Q).find(z => z.key === k) || null;

  // Devuelve null si no se puede leer; si se lee: { zona, key, fuera, ent, txt }
  function calcular(t) {
    const a = leer(t); if (!a) return null;
    if (a.rio) return { zona: HOSPITAL, key: 'hospital', fuera: false, txt: 'Dice «ribera» o «río»' };
    if (a.brown) return { zona: 'Zona Intermedia Quequén', key: 'intermedia-quequen', fuera: false, txt: 'Av. Almirante Brown: siempre zona intermedia' };
    const q = a.calle >= 500, p = posicion(a), z = zonaDe(a, p, q ? ZONAS_Q : ZONAS);
    const txt = 'Calle ' + a.calle + (a.bis ? ' bis' : '') + (p.par ? ' (par)' : ' (impar)') + ', altura ' + a.h + ': la cuadra queda entre la ' + p.entre[0] + ' y la ' + p.entre[1];
    return { zona: z ? z.n : FUERA, key: z ? z.key : null, fuera: !z, ent: 'entre ' + p.entre[0] + ' y ' + p.entre[1], txt };
  }

  // Une las zonas del motor con las filas de ne_zonas (por nombre normalizado y, si no, por palabras clave)
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const CLAVES = { 'playa-necochea': /playa.*necochea/, 'centro': /^centro$/, 'hospital': /hospital|9 de julio/, 'villa-deportista': /villa deportista/,
    'centro-quequen': /centro.*quequen/, 'intermedia-quequen': /intermedia/, 'playa-quequen': /playa.*quequen/ };
  function idDeZona(key, filas) {
    const z = porKey(key); if (!z || !filas) return null;
    const exacta = filas.find(f => norm(f.nombre) === norm(z.n)); if (exacta) return exacta.id;
    const rx = CLAVES[key], f = rx && filas.find(f => rx.test(norm(f.nombre)));
    return f ? f.id : null;
  }
  function keyDeId(id, filas) {
    const f = (filas || []).find(x => String(x.id) === String(id)); if (!f) return null;
    const hit = ZONAS.concat(ZONAS_Q).find(z => norm(z.n) === norm(f.nombre)) || ZONAS.concat(ZONAS_Q).find(z => CLAVES[z.key].test(norm(f.nombre)));
    return hit ? hit.key : null;
  }

  root.ZonasCalle = { FUERA, leer, posicion, calcular, idDeZona, keyDeId, ZONAS, ZONAS_Q };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ZonasCalle;
})(typeof window !== 'undefined' ? window : globalThis);
