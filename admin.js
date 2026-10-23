/* NECO ENVÍOS - Parte 2C: panel de administrador. Se carga desde index.html.
   La seguridad real está en la base de datos (tabla ne_admins + RLS): este archivo solo muestra el panel. */
(function () {
  const A = { tab: 'rep', reps: [], ajustes: null };
  const th = 'text-left text-[10px] font-extrabold text-slate-400 uppercase px-2 py-1.5';
  const td = 'px-2 py-2 text-xs border-t border-slate-100';
  const inp = 'clean-input rounded-xl px-3 py-2 text-sm';
  const bt = (t, c, a) => `<button type="button" ${a || ''} class="text-xs font-black rounded-xl px-3 py-2 active:scale-95 ${c}">${t}</button>`;

  /* ---- armar botón en el header + modal ---- */
  const b = document.createElement('button');
  b.id = 'btn-admin'; b.type = 'button'; b.className = 'hidden bg-slate-800 text-white p-2 rounded-xl active:scale-95 shadow-sm'; b.title = 'Panel admin';
  b.innerHTML = '<i data-lucide="shield-check" class="w-4 h-4 text-brand-300"></i>';
  const g = $('btn-google'); g.parentNode.insertBefore(b, g);
  const m = document.createElement('div');
  m.id = 'modal-admin'; m.className = 'modal-bottom-sheet fixed inset-0 bg-slate-900/40 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50';
  m.innerHTML = `<div class="clean-modal rounded-3xl p-5 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
    <div class="flex justify-between items-center mb-3"><h3 class="text-base font-black text-slate-900">Panel de administrador</h3>
    <button onclick="cerrarModal('modal-admin')" type="button" class="p-1 text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button></div>
    <div id="ad-tabs" class="flex gap-1.5 mb-3 overflow-x-auto custom-scrollbar"></div><div id="ad-cont"></div></div>`;
  document.body.appendChild(m);
  b.onclick = () => { abrirModal('modal-admin'); pintar(); };

  _sb.auth.onAuthStateChange((_e, s) => {
    setTimeout(async () => {
      b.classList.add('hidden');
      if (!s || s.user.is_anonymous) return;
      const { data } = await _sb.from('ne_admins').select('user_id').eq('user_id', s.user.id).maybeSingle();
      if (data) { b.classList.remove('hidden'); b.classList.add('flex'); ico(); }
    }, 0);
  });

  function pintar() {
    const T = [['rep', 'Repartidores'], ['rep2', 'Reporte semanal'], ['zon', 'Zonas y precios'], ['aj', 'Ajustes'], ['ped', 'Pedidos']];
    $('ad-tabs').innerHTML = T.map(([k, l]) => `<button data-t="${k}" type="button" class="flex-shrink-0 text-xs font-black rounded-xl px-3 py-2 ${A.tab === k ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}">${l}</button>`).join('');
    $('ad-tabs').querySelectorAll('[data-t]').forEach(x => x.onclick = () => { A.tab = x.dataset.t; pintar(); });
    ({ rep: tRep, rep2: tReporte, zon: tZonas, aj: tAjustes, ped: tPedidos })[A.tab]();
  }
  async function cargarReps() { const { data, error } = await _sb.from('ne_repartidores').select('*').order('creado', { ascending: false }); if (error) mostrarToast(error.message); A.reps = data || []; }
  async function cargarAjustes() { const { data } = await _sb.from('ne_settings').select('*').eq('id', 1).single(); A.ajustes = data; }

  /* ---- Repartidores ---- */
  async function tRep() {
    $('ad-cont').innerHTML = '<p class="text-xs text-slate-400">Cargando...</p>'; await cargarReps();
    const box = $('ad-cont'); box.innerHTML = '';
    const visibles = A.reps.filter(r => r.estado !== 'eliminado');
    const ac = await _sb.from('ne_aceptaciones').select('user_id,version,aceptado_en').eq('tipo', 'repartidor').order('aceptado_en'); const acep = {}; (ac.data || []).forEach(x => acep[x.user_id] = x);
    if (!visibles.length) { box.innerHTML = '<p class="text-xs text-slate-400">Todavía no hay repartidores registrados.</p>'; return; }
    visibles.forEach(r => {
      const d = document.createElement('div'); d.className = 'clean-card rounded-2xl p-3 mb-2 space-y-2';
      const col = { pendiente: 'bg-amber-100 text-amber-700', aprobado: 'bg-brand-100 text-brand-700', pausado: 'bg-slate-200 text-slate-600' }[r.estado];
      d.innerHTML = `<div class="flex items-center gap-3"><img src="${esc(SUPABASE_URL)}/storage/v1/object/public/ne-rostros/${encodeURI(r.rostro_path || '')}" class="w-12 h-12 rounded-xl object-cover bg-slate-100" alt="">
        <div class="flex-1 min-w-0"><p class="font-black text-sm truncate">${esc(r.nombre)}</p><p class="text-[11px] text-slate-500">DNI ${esc(r.documento)} · ${esc(r.vehiculo)} · ${r.en_linea ? '🟢 en línea' : '⚪ desconectado'}</p>
        <p class="text-[11px] ${acep[r.user_id] ? 'text-slate-400' : 'text-amber-600 font-bold'}">${acep[r.user_id] ? '✓ Aceptó los términos el ' + esc(new Date(acep[r.user_id].aceptado_en).toLocaleString('es-AR')) + ' (versión ' + esc(acep[r.user_id].version) + ')' : '⚠ Todavía no aceptó los términos'}</p></div>
        <span class="text-[10px] font-black px-2 py-1 rounded-full ${col}">${esc(r.estado)}</span></div>
        <div class="flex flex-wrap gap-2" data-b></div><div data-fotos class="hidden"></div>`;
      const bx = d.querySelector('[data-b]');
      const add = (t, c, fn) => { bx.insertAdjacentHTML('beforeend', bt(t, c)); bx.lastChild.onclick = fn; };
      add('Ver DNI y rostro', 'bg-slate-100 text-slate-700', async () => {
        const f = d.querySelector('[data-fotos]'); f.classList.remove('hidden');
        const s = await _sb.storage.from('ne-dni').createSignedUrl(r.dni_path, 300);
        if (s.error) { f.textContent = 'No se pudo abrir el DNI: ' + s.error.message; return; }
        f.innerHTML = `<p class="text-[10px] text-slate-400 mb-1">Enlaces temporales (5 min)</p><div class="flex gap-2"><a href="${esc(s.data.signedUrl)}" target="_blank" rel="noopener"><img src="${esc(s.data.signedUrl)}" class="h-40 rounded-xl border" alt="DNI"></a>
          <a href="${esc(SUPABASE_URL)}/storage/v1/object/public/ne-rostros/${encodeURI(r.rostro_path)}" target="_blank" rel="noopener"><img src="${esc(SUPABASE_URL)}/storage/v1/object/public/ne-rostros/${encodeURI(r.rostro_path)}" class="h-40 rounded-xl border" alt="Rostro"></a></div>`;
      });
      const cambiar = async nuevo => { const { error } = await _sb.from('ne_repartidores').update({ estado: nuevo }).eq('user_id', r.user_id); if (error) mostrarToast(error.message); else { mostrarToast('Listo'); tRep(); } };
      if (r.estado === 'pendiente') add('Aprobar', 'bg-brand-600 text-white', () => cambiar('aprobado'));
      if (r.estado === 'aprobado') add('Pausar', 'bg-amber-100 text-amber-700', () => cambiar('pausado'));
      if (r.estado === 'pausado') add('Reactivar', 'bg-brand-600 text-white', () => cambiar('aprobado'));
      add('Eliminar', 'bg-rose-50 text-rose-600 border border-rose-200', async () => {
        if (!confirm('¿Eliminar a ' + r.nombre + '? Se borran su DNI, su foto, sus zonas y sus precios. Los pedidos y comisiones pasadas quedan registrados sin sus datos personales. Esto no se puede deshacer.')) return;
        const { error } = await _sb.rpc('ne_eliminar_repartidor', { p_user: r.user_id });
        if (error) return mostrarToast('No se pudo eliminar: ' + error.message);
        const fallos = await borrarArchivosRep(r.user_id);
        mostrarToast(fallos ? 'Eliminado, pero quedaron archivos sin borrar: revisá Storage' : 'Repartidor eliminado'); tRep();
      });
      box.appendChild(d);
    });
  }

  /* ---- Reporte semanal ---- */
  function lunesISO() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); }
  async function tReporte() {
    await cargarAjustes();
    $('ad-cont').innerHTML = `<div class="flex flex-wrap items-end gap-2 mb-3"><div><label class="text-[11px] font-extrabold text-slate-500 uppercase">Semana desde (lunes)</label><input id="ar-d" type="date" value="${A.desde || lunesISO()}" class="${inp} block mt-1"></div>
      ${bt('Ver', 'bg-brand-600 text-white', 'id="ar-ver"')}${bt('Descargar CSV', 'bg-slate-900 text-white', 'id="ar-csv"')}
      <span class="text-[11px] text-slate-500">Comisión actual: <b>${A.ajustes ? Number(A.ajustes.comision_pct) : '?'}%</b> (cada pedido guarda la que regía al solicitar)</span></div><div id="ar-t" class="overflow-x-auto"></div>`;
    $('ar-ver').onclick = verReporte; $('ar-csv').onclick = csv; verReporte();
  }
  async function verReporte() {
    A.desde = $('ar-d').value; if (!A.desde) return mostrarToast('Elegí una fecha');
    const { data, error } = await _sb.rpc('ne_reporte_semanal', { p_desde: A.desde });
    if (error) return mostrarToast(error.message);
    A.rep2 = data || [];
    let h = `<table class="w-full"><thead><tr><th class="${th}">Repartidor</th><th class="${th}">Acept.</th><th class="${th}">Entreg.</th><th class="${th}">Cancel.</th><th class="${th}">Cobrado</th><th class="${th}">Te debe</th><th class="${th}"></th></tr></thead><tbody>`;
    A.rep2.forEach((r, i) => h += `<tr><td class="${td} font-bold">${esc(r.nombre)}</td><td class="${td}">${r.aceptados}</td><td class="${td}">${r.entregados}</td><td class="${td}">${r.cancelados}</td><td class="${td}">${money(Math.round(r.total_cobrado))}</td><td class="${td} font-black text-brand-700">${money(Math.round(r.comision_monto))}</td>
      <td class="${td}">${r.pagado ? '<span class="text-brand-600 font-black">✓ Pagado</span>' : (Number(r.comision_monto) > 0 ? bt('Marcar pagado', 'bg-brand-600 text-white', `data-pg="${i}"`) : '')}</td></tr>`);
    $('ar-t').innerHTML = h + '</tbody></table>';
    $('ar-t').querySelectorAll('[data-pg]').forEach(x => x.onclick = async () => {
      const r = A.rep2[+x.dataset.pg]; if (!confirm(`¿Marcar como pagado ${money(Math.round(r.comision_monto))} de ${r.nombre}?`)) return;
      const { error } = await _sb.rpc('ne_marcar_pagado', { p_rep: r.repartidor_id, p_desde: A.desde, p_monto: Math.round(r.comision_monto) });
      if (error) mostrarToast(error.message); else verReporte();
    });
  }
  function csv() {
    if (!A.rep2 || !A.rep2.length) return mostrarToast('Primero tocá "Ver"');
    const q = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const rows = [['Repartidor', 'Semana desde', 'Aceptados', 'Entregados', 'Cancelados', 'Total cobrado', 'Comision a pagar', 'Pagado']];
    A.rep2.forEach(r => rows.push([r.nombre, A.desde, r.aceptados, r.entregados, r.cancelados, Math.round(r.total_cobrado), Math.round(r.comision_monto), r.pagado ? 'SI' : 'NO']));
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `neco-envios-semana-${A.desde}.csv`; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---- Zonas y precios sugeridos ---- */
  async function tZonas() {
    if (!zonas.length) await cargarZonas();
    const { data } = await _sb.from('ne_precios_sugeridos').select('*'); A.sug = {}; (data || []).forEach(x => A.sug[x.zona_retiro + '-' + x.zona_entrega] = x.precio);
    let h = `<p class="text-xs text-slate-500 mb-2">Precio sugerido por recorrido (los repartidores lo ven como referencia). Dejá vacío para no sugerir.</p><div class="space-y-3">`;
    zonas.forEach(a => {
      h += `<div class="clean-card rounded-2xl p-3"><p class="text-xs font-black text-brand-700 mb-2">Retiro en ${esc(a.nombre)}</p>`;
      zonas.forEach(z => h += `<div class="flex items-center gap-2 mb-1.5"><span class="flex-1 text-[11px] text-slate-600">→ ${esc(z.nombre)}</span><input data-s="${a.id}-${z.id}" type="number" min="1" value="${A.sug[a.id + '-' + z.id] || ''}" class="${inp} w-24 text-right"></div>`);
      h += '</div>';
    });
    $('ad-cont').innerHTML = h + `</div><div class="mt-3">${bt('Guardar precios sugeridos', 'bg-brand-600 text-white w-full py-3', 'id="az-g"')}</div>`;
    $('az-g').onclick = async () => {
      const filas = []; document.querySelectorAll('[data-s]').forEach(i => { const v = parseFloat(i.value); if (v > 0) { const [a, z] = i.dataset.s.split('-'); filas.push({ zona_retiro: +a, zona_entrega: +z, precio: v }); } });
      let r = await _sb.from('ne_precios_sugeridos').delete().gt('zona_retiro', 0); if (r.error) return mostrarToast(r.error.message);
      if (filas.length) { r = await _sb.from('ne_precios_sugeridos').insert(filas); if (r.error) return mostrarToast(r.error.message); }
      mostrarToast('Precios sugeridos guardados');
    };
  }

  /* ---- Ajustes ---- */
  async function tAjustes() {
    await cargarAjustes(); const s = A.ajustes || {};
    const f = (id, l, v, min, max) => `<div><label class="text-[11px] font-extrabold text-slate-500 uppercase">${l}</label><input id="${id}" type="number" min="${min}" max="${max}" value="${Number(v)}" class="${inp} w-full mt-1"></div>`;
    $('ad-cont').innerHTML = `<div class="grid sm:grid-cols-2 gap-3">${f('aj-c', 'Comisión (%)', s.comision_pct, 0, 100)}${f('aj-t', 'Tope de pedidos simultáneos', s.tope_simultaneos, 1, 10)}
      ${f('aj-v', 'Minutos para responder una solicitud', s.timeout_solicitud_min, 1, 60)}${f('aj-h', 'Horas máximas seguidas conectado (se desconecta solo)', s.max_conectado_horas, 1, 24)}</div>
      <p class="text-[11px] text-slate-400 mt-2">Cada repartidor elige 1 o 2 pedidos simultáneos como máximo en su panel, sin pasar el tope.</p>
      <div class="mt-3">${bt('Guardar ajustes', 'bg-brand-600 text-white w-full py-3', 'id="aj-g"')}</div>`;
    $('aj-g').onclick = async () => {
      const { error } = await _sb.from('ne_settings').update({ comision_pct: +$('aj-c').value, tope_simultaneos: +$('aj-t').value, timeout_solicitud_min: +$('aj-v').value, max_conectado_horas: +$('aj-h').value }).eq('id', 1);
      if (error) mostrarToast(error.message); else mostrarToast('Ajustes guardados');
    };
  }

  /* ---- Todos los pedidos ---- */
  async function tPedidos() {
    $('ad-cont').innerHTML = '<p class="text-xs text-slate-400">Cargando...</p>'; await cargarReps();
    const nom = {}; A.reps.forEach(r => nom[r.user_id] = r.nombre);
    const { data, error } = await _sb.from('ne_pedidos').select('*').order('creado', { ascending: false }).limit(150);
    if (error) { $('ad-cont').textContent = error.message; return; }
    let h = `<div class="overflow-x-auto"><table class="w-full"><thead><tr><th class="${th}">Fecha</th><th class="${th}">Estado</th><th class="${th}">Repartidor</th><th class="${th}">Recorrido</th><th class="${th}">Precio</th><th class="${th}">Pago</th></tr></thead><tbody>`;
    (data || []).forEach(p => h += `<tr><td class="${td}">${esc(new Date(p.creado).toLocaleString('es-AR'))}</td><td class="${td} font-bold">${esc(ESTADOS[p.estado] || p.estado)}</td><td class="${td}">${esc(nom[p.repartidor_id] || '—')}</td><td class="${td}">${esc(fixDir(p.retiro_dir))} → ${esc(fixDir(p.entrega_dir))}</td><td class="${td} font-black">${money(p.precio)}</td><td class="${td}">${esc(p.pago_envio_metodo || "efectivo")} · ${p.pago_envio_momento === "retiro" ? "retiro" : "entrega"}${Number(p.adelanto_monto) > 0 ? " · adelanto " + money(p.adelanto_monto) : ""}</td></tr>`);
    $('ad-cont').innerHTML = h + '</tbody></table></div>';
  }
})();
