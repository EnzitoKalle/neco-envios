/* NECO ENVÍOS - Parte 2B: lado del repartidor. Se carga desde index.html */
(function () {
  const R = { perfil:null, zSel:new Set(), precios:{}, sug:{}, tope:2, poll:null, hb:null, tab:'pedidos',
              rostro:null, dni:null, stream:null, deferred:null, mapa:null, activos:0 };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); R.deferred = e; });
  const root = () => $('v-repartidor');
  const esApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const card = h => `<div class="clean-card rounded-3xl p-5 space-y-3">${h}</div>`;
  const btn = (id, txt, cls) => `<button id="${id}" type="button" class="${cls || 'w-full bg-gradient-to-r from-brand-700 to-brand-500 text-white font-black text-sm rounded-2xl py-3.5 shadow-md active:scale-[.98]'}">${txt}</button>`;
  const volver = () => `<div class="flex justify-between items-center mb-3"><button onclick="irInicio()" type="button" class="text-xs font-bold text-brand-600 flex items-center gap-1"><i data-lucide="arrow-left" class="w-4 h-4"></i> Volver</button>${sesion && !esAnon() ? '<button data-salir type="button" class="text-xs font-bold text-slate-500 underline">Cerrar sesión</button>' : ''}</div>`;
  async function salir() { if (!confirm('¿Cerrar sesión de Google?')) return; localStorage.removeItem('ne_volver'); await _sb.auth.signOut(); location.reload(); }
  root().addEventListener('click', e => { if (e.target.closest('[data-salir]')) salir(); });

  function detener() { clearInterval(R.poll); clearInterval(R.hb); cerrarCamara(); }
  function cerrarCamara() { if (R.stream) { R.stream.getTracks().forEach(t => t.stop()); R.stream = null; } }

  window.irRepartidor = async function () { vista('repartidor'); await pantalla(); };

  async function pantalla() {
    detener();
    if (!esApp() && !localStorage.getItem('ne_skip_install')) return pInstalar();
    const { data } = await _sb.auth.getSession();
    const s = data.session;
    if (!s || s.user.is_anonymous) return pLogin();
    sesion = s;
    const r = await _sb.from('ne_repartidores').select('*').eq('user_id', s.user.id).maybeSingle();
    R.perfil = r.data;
    if (!R.perfil) return pRegistro();
    await cargarBase(); pPanel();
  }

  /* ---------- 1. INSTALAR ---------- */
  function pInstalar() {
    root().innerHTML = volver() + card(`
      <div class="text-center"><img src="icon-192.png" alt="" class="w-16 h-16 mx-auto rounded-2xl shadow-md">
      <h2 class="text-xl font-black mt-3">Instalá la app de repartidores</h2>
      <p class="text-xs text-slate-500 mt-1">Con la app instalada recibís avisos de nuevos pedidos y funciona más rápido.</p></div>
      ${R.deferred ? btn('i-inst', 'Instalar app') : ''}
      ${esIOS ? `<div class="bg-brand-50 border border-brand-200 rounded-2xl p-3 text-xs text-brand-700 space-y-1"><b>En iPhone:</b><p>1. Abrí esta página en <b>Safari</b>.</p><p>2. Tocá el botón <b>Compartir</b> (cuadrado con flecha).</p><p>3. Elegí <b>"Agregar a pantalla de inicio"</b>.</p><p>4. Abrí la app desde el ícono nuevo.</p></div>`
        : (!R.deferred ? `<div class="bg-brand-50 border border-brand-200 rounded-2xl p-3 text-xs text-brand-700"><b>En Android:</b> tocá los 3 puntitos de Chrome y elegí <b>"Instalar app"</b> o <b>"Agregar a pantalla de inicio"</b>.</div>` : '')}
      ${btn('i-sig', 'Ya la instalé / Continuar', 'w-full bg-slate-100 text-slate-700 font-bold text-sm rounded-2xl py-3')}`);
    ico();
    if ($('i-inst')) $('i-inst').onclick = async () => { R.deferred.prompt(); await R.deferred.userChoice; R.deferred = null; pantalla(); };
    $('i-sig').onclick = () => { localStorage.setItem('ne_skip_install', '1'); pantalla(); };
  }

  /* ---------- 2. LOGIN GOOGLE (obligatorio) ---------- */
  function pLogin() {
    root().innerHTML = volver() + card(`
      <h2 class="text-xl font-black">Ingresá con Google</h2>
      <p class="text-xs text-slate-500">Para trabajar como repartidor necesitamos que ingreses con tu cuenta de Google.</p>
      ${btn('l-go', 'Continuar con Google')}`);
    $('l-go').onclick = async () => {
      localStorage.setItem('ne_volver', 'rep');
      const { error } = await _sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } });
      if (error) mostrarToast(error.message);
    };
  }

  /* ---------- 3. REGISTRO ---------- */
  async function comprimir(file, max) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
  }
  function pRegistro() {
    R.rostro = null; R.dni = null;
    root().innerHTML = volver() + card(`
      <h2 class="text-xl font-black">Registro de repartidor</h2>
      <p class="text-xs text-slate-500">Revisamos tus datos antes de aprobarte. El DNI solo lo ve el administrador.</p>
      <div><label class="text-[11px] font-extrabold text-slate-500 uppercase">Nombre completo</label><input id="g-nom" maxlength="80" class="clean-input w-full rounded-xl px-3 py-2.5 text-sm mt-1"></div>
      <div><label class="text-[11px] font-extrabold text-slate-500 uppercase">Número de documento</label><input id="g-doc" inputmode="numeric" maxlength="15" class="clean-input w-full rounded-xl px-3 py-2.5 text-sm mt-1"></div>
      <div><label class="text-[11px] font-extrabold text-slate-500 uppercase">Vehículo</label>
        <select id="g-veh" class="clean-input w-full rounded-xl px-3 py-2.5 text-sm mt-1"><option value="moto">🏍️ Moto</option><option value="bici">🚲 Bici</option><option value="auto">🚗 Auto</option></select></div>
      <div><label class="text-[11px] font-extrabold text-slate-500 uppercase">Foto del DNI (frente)</label>
        <input id="g-dni" type="file" accept="image/*" class="block w-full text-xs mt-1"><p id="g-dni-ok" class="text-[11px] text-brand-600 font-bold"></p></div>
      <div><label class="text-[11px] font-extrabold text-slate-500 uppercase">Foto de rostro (se toma ahora con la cámara)</label>
        <video id="g-video" playsinline muted class="hidden w-full max-w-[260px] mx-auto rounded-2xl bg-black mt-2"></video>
        <img id="g-prev" class="hidden w-32 h-32 rounded-2xl object-cover mx-auto mt-2 border border-brand-300" alt="">
        <div class="flex gap-2 mt-2">${btn('g-cam', 'Abrir cámara', 'flex-1 bg-slate-900 text-white font-bold text-xs rounded-xl py-2.5')}${btn('g-cap', 'Sacar foto', 'hidden flex-1 bg-brand-600 text-white font-bold text-xs rounded-xl py-2.5')}</div></div>
      ${btn('g-send', 'Enviar registro')}`);
    $('g-dni').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { R.dni = await comprimir(f, 1400); $('g-dni-ok').textContent = '✓ DNI cargado'; } catch (x) { mostrarToast('No pudimos leer esa imagen'); } };
    $('g-cam').onclick = async () => {
      try {
        R.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        const v = $('g-video'); v.srcObject = R.stream; v.classList.remove('hidden'); await v.play(); $('g-cap').classList.remove('hidden');
      } catch (x) { mostrarToast('No se pudo abrir la cámara. Permití el acceso en tu navegador.'); }
    };
    $('g-cap').onclick = () => {
      const v = $('g-video'); if (!v.videoWidth) return;
      const s = Math.min(v.videoWidth, v.videoHeight), c = document.createElement('canvas'); c.width = c.height = 480;
      c.getContext('2d').drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, 480, 480);
      c.toBlob(b => { R.rostro = b; $('g-prev').src = URL.createObjectURL(b); $('g-prev').classList.remove('hidden'); }, 'image/jpeg', 0.85);
      cerrarCamara(); v.classList.add('hidden'); $('g-cap').classList.add('hidden');
    };
    $('g-send').onclick = enviarRegistro;
  }
  async function enviarRegistro() {
    const nom = $('g-nom').value.trim(), doc = $('g-doc').value.replace(/\D/g, ''), veh = $('g-veh').value;
    if (nom.length < 3) return mostrarToast('Poné tu nombre completo');
    if (doc.length < 6) return mostrarToast('Revisá el número de documento');
    if (!R.dni) return mostrarToast('Falta la foto del DNI');
    if (!R.rostro) return mostrarToast('Falta la foto de rostro con la cámara');
    const b = $('g-send'); b.disabled = true; b.textContent = 'Enviando...';
    try {
      const ses = (await _sb.auth.getSession()).data.session;
      if (!ses || ses.user.is_anonymous) throw new Error('Tu sesión de Google se perdió. Volvé a ingresar.');
      const uid = ses.user.id, t = Date.now();
      const pDni = uid + '/dni-' + t + '.jpg', pRos = uid + '/rostro-' + t + '.jpg';
      let r = await _sb.storage.from('ne-dni').upload(pDni, R.dni, { contentType: 'image/jpeg' });
      if (r.error) throw new Error('Subiendo DNI: ' + r.error.message);
      r = await _sb.storage.from('ne-rostros').upload(pRos, R.rostro, { contentType: 'image/jpeg' });
      if (r.error) throw new Error('Subiendo foto de rostro: ' + r.error.message);
      r = await _sb.from('ne_repartidores').insert({ user_id: uid, nombre: nom, documento: doc, vehiculo: veh, dni_path: pDni, rostro_path: pRos });
      if (r.error) throw new Error('Guardando datos: ' + r.error.message);
      mostrarToast('Registro enviado. Ahora elegí tus zonas y precios.'); R.tab = 'zonas'; pantalla();
    } catch (e) { mostrarToast('Error: ' + (e.message || e)); b.disabled = false; b.textContent = 'Enviar registro'; }
  }

  /* ---------- 4. DATOS BASE ---------- */
  async function cargarBase() {
    const uid = sesion.user.id;
    if (!zonas.length) await cargarZonas();
    const [st, sg, rz, rp] = await Promise.all([
      _sb.from('ne_settings').select('tope_simultaneos').eq('id', 1).single(),
      _sb.from('ne_precios_sugeridos').select('*'),
      _sb.from('ne_rep_zonas').select('zona_id').eq('user_id', uid),
      _sb.from('ne_rep_precios').select('*').eq('user_id', uid)]);
    R.tope = st.data ? st.data.tope_simultaneos : 2;
    R.sug = {}; (sg.data || []).forEach(x => R.sug[x.zona_retiro + '-' + x.zona_entrega] = x.precio);
    R.zSel = new Set((rz.data || []).map(x => x.zona_id));
    R.precios = {}; (rp.data || []).forEach(x => R.precios[x.zona_retiro + '-' + x.zona_entrega] = x.precio);
  }

  /* ---------- 5. PANEL ---------- */
  function pPanel() {
    const p = R.perfil;
    root().innerHTML = volver() + `
      <div class="flex items-center gap-3 mb-3"><img src="${esc(SUPABASE_URL)}/storage/v1/object/public/ne-rostros/${encodeURI(p.rostro_path || '')}?t=${Date.now() % 100000}" class="w-12 h-12 rounded-2xl object-cover bg-slate-100 border border-brand-200" alt="">
      <div class="flex-1 min-w-0"><p class="font-black text-slate-900 truncate">${esc(p.nombre)}</p><p id="r-badge" class="text-[11px] font-bold"></p></div></div>
      <div class="flex gap-1.5 mb-3">${['pedidos:Pedidos', 'horarios:Horarios', 'zonas:Zonas y precios', 'historial:Ganancias'].map(t => { const [k, l] = t.split(':'); return `<button data-tab="${k}" type="button" class="flex-1 text-[11px] font-black rounded-xl py-2 ${R.tab === k ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}">${l}</button>`; }).join('')}</div>
      <div id="r-cont"></div>`;
    root().querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { R.tab = b.dataset.tab; pPanel(); });
    ico();
    if (R.tab === 'pedidos') tabPedidos(); else if (R.tab === 'horarios') tabHorarios(); else if (R.tab === 'zonas') tabZonas(); else tabHistorial();
  }

  /* --- Pedidos --- */
  const SIG = { aceptado: 'En camino a dirección de retiro', en_camino_retiro: 'Retirado', retirado: 'Entregado' };
  function tabPedidos() {
    const p = R.perfil, c = $('r-cont');
    if (p.estado !== 'aprobado') {
      c.innerHTML = card(`<p class="font-black">${p.estado === 'pendiente' ? '⏳ Cuenta pendiente de aprobación' : '⏸ Cuenta pausada'}</p>
        <p class="text-xs text-slate-500">${p.estado === 'pendiente' ? 'Cuando el administrador te apruebe vas a poder conectarte y recibir pedidos. Mientras tanto, completá tus zonas y precios.' : 'Contactá al administrador para reactivarla.'}</p>`);
      return;
    }
    c.innerHTML = card(`
      <div class="flex items-center justify-between"><div><p class="font-black">Estado</p><p id="r-est" class="text-xs"></p></div>
        <button id="r-on" type="button" class="text-xs font-black px-4 py-2.5 rounded-xl active:scale-95"></button></div>
      <p id="r-aviso" class="text-[11px] text-brand-700 font-bold"></p>
      <p class="text-[11px] text-slate-500">Quedás conectado hasta que te desconectes. Activá la campanita 🔔 (arriba) para recibir los pedidos aunque tengas la app cerrada o el celu bloqueado.</p>
      <div class="flex items-center justify-between text-xs"><span class="font-bold text-slate-600">Pedidos simultáneos (máx.)</span>
        <select id="r-max" class="clean-input rounded-xl px-3 py-1.5">${Array.from({ length: Math.min(R.tope, 2) }, (_, i) => `<option value="${i + 1}" ${p.max_simultaneos === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div>`) +
      `<div id="r-lista" class="space-y-3 mt-3"></div>`;
    $('r-on').onclick = async () => {
      const quiere = !R.perfil.en_linea;
      const { data, error } = await _sb.rpc('ne_set_online', { p_on: quiere });
      if (error) return mostrarToast(error.message);
      R.perfil.en_linea = quiere; pintarEstado();
      if (quiere) { $('r-aviso').textContent = ''; mostrarToast('Estás conectado'); return; }
      const f = fmtProximo(data && data.proximo);
      $('r-aviso').textContent = f ? 'Te desconectaste. Vas a volver a conectarte automáticamente ' + f + ' (según tus horarios).'
                                   : 'Te desconectaste. No tenés horarios cargados: conectate a mano cuando quieras, o cargalos en la pestaña Horarios.';
      mostrarToast('Estás desconectado');
    };
    $('r-max').onchange = async e => { const v = +e.target.value; const { error } = await _sb.from('ne_repartidores').update({ max_simultaneos: v }).eq('user_id', sesion.user.id); if (error) mostrarToast(error.message); else { R.perfil.max_simultaneos = v; pintarEstado(); } };
    refrescarPedidos();
    R.poll = setInterval(refrescarPedidos, 8000);
    R.hb = setInterval(() => { if (R.perfil.en_linea) _sb.rpc('ne_heartbeat'); }, 120000);
    if (R.perfil.en_linea) _sb.rpc('ne_heartbeat');
  }
  function pintarEstado() {
    const p = R.perfil, on = $('r-on'); if (!on) return;
    const ocupado = p.en_linea && R.activos >= p.max_simultaneos;
    $('r-est').innerHTML = !p.en_linea ? '<span class="text-slate-500 font-bold">⚪ Desconectado</span>' : ocupado ? '<span class="text-amber-600 font-bold">🟠 En reparto / Ocupado</span>' : '<span class="text-brand-600 font-bold">🟢 Conectado</span>';
    on.textContent = p.en_linea ? 'Desconectarme' : 'Conectarme';
    on.className = 'text-xs font-black px-4 py-2.5 rounded-xl active:scale-95 ' + (p.en_linea ? 'bg-slate-100 text-slate-700' : 'bg-brand-600 text-white');
  }
  async function refrescarPedidos() {
    if (R.tab !== 'pedidos' || !$('r-lista')) return;
    await _sb.rpc('ne_vencer');
    await _sb.rpc('ne_conectar_si_horario');
    const me = await _sb.from('ne_repartidores').select('en_linea,estado,max_simultaneos').eq('user_id', sesion.user.id).single();
    if (me.data) Object.assign(R.perfil, me.data);
    const { data } = await _sb.from('ne_pedidos').select('*').eq('repartidor_id', sesion.user.id)
      .in('estado', ['solicitado', 'aceptado', 'en_camino_retiro', 'retirado']).order('creado');
    const L = data || []; R.activos = L.filter(x => x.estado !== 'solicitado').length; pintarEstado();
    const box = $('r-lista'); if (!box) return; box.innerHTML = '';
    if (!L.length) { box.innerHTML = '<p class="text-center text-xs text-slate-400 py-6">No tenés pedidos en este momento.</p>'; return; }
    L.forEach(o => {
      const d = document.createElement('div'); d.className = 'clean-card rounded-3xl p-4 space-y-2';
      d.innerHTML = `<div class="flex justify-between items-start"><b class="text-xs text-brand-700">${esc(ESTADOS[o.estado])}</b><b class="text-lg text-brand-600">${money(o.precio)}</b></div>
        <p class="text-xs text-slate-600">📍 <b>Retiro:</b> ${esc(fixDir(o.retiro_dir))}</p><p class="text-xs text-slate-600">🏁 <b>Entrega:</b> ${esc(fixDir(o.entrega_dir))}</p>
        ${o.comercio ? `<p class="text-[11px] text-slate-400">Comercio: ${esc(o.comercio)}</p>` : ''}<p class="text-[11px] text-slate-400">Cliente: ${esc(o.cliente_nombre)}</p>
        <div class="flex gap-2 pt-1" data-acc></div>`;
      const acc = d.querySelector('[data-acc]');
      const mk = (t, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'flex-1 text-xs font-black rounded-xl py-2.5 active:scale-95 ' + cls; b.textContent = t; b.onclick = async () => { b.disabled = true; await fn(); b.disabled = false; }; acc.appendChild(b); };
      if (o.estado === 'solicitado') {
        mk('Aceptar', 'bg-brand-600 text-white', async () => { const { error } = await _sb.rpc('ne_responder', { p_pedido: o.id, p_acepta: true }); if (error) mostrarToast(error.message); refrescarPedidos(); });
        mk('Rechazar', 'bg-slate-100 text-slate-700', async () => { const { error } = await _sb.rpc('ne_responder', { p_pedido: o.id, p_acepta: false }); if (error) mostrarToast(error.message); refrescarPedidos(); });
      } else {
        mk(SIG[o.estado], 'bg-gradient-to-r from-brand-700 to-brand-500 text-white', async () => { const { error } = await _sb.rpc('ne_avanzar', { p_pedido: o.id }); if (error) mostrarToast(error.message); else mostrarToast('Listo'); refrescarPedidos(); });
        mk('💬 Chat', 'bg-slate-100 text-slate-700', async () => abrirChat(o.id));
      }
      box.appendChild(d);
    });
  }

  /* --- Horarios --- */
  function fmtProximo(iso) {
    if (!iso) return null;
    const d = new Date(iso), hoy = new Date(), man = new Date(Date.now() + 864e5);
    const dia = d.toDateString() === hoy.toDateString() ? 'hoy' : d.toDateString() === man.toDateString() ? 'mañana' : 'el ' + d.toLocaleDateString('es-AR', { weekday: 'long' });
    return dia + ' a las ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];   // posición + 1 = día ISO
  async function tabHorarios() {
    const c = $('r-cont'); c.innerHTML = '<p class="text-xs text-slate-400">Cargando...</p>';
    const { data, error } = await _sb.from('ne_horarios').select('*').eq('repartidor_id', sesion.user.id).order('desde');
    if (error) { c.textContent = 'Error: ' + error.message; return; }
    const h0 = data[0] || null, sel = new Set(h0 ? h0.dias : [1, 2, 3, 4, 5, 6, 7]);
    const hs = []; for (let h = 0; h < 24; h++) for (const m of ['00', '30']) hs.push(String(h).padStart(2, '0') + ':' + m);
    const desde = h0 ? h0.desde.slice(0, 5) : '09:00', hasta = h0 ? h0.hasta.slice(0, 5) : '24:00';
    const optD = hs.map(h => `<option value="${h}" ${h === desde ? 'selected' : ''}>${h}</option>`).join('');
    const optH = `<option value="24:00" ${hasta === '24:00' ? 'selected' : ''}>No: me desconecto yo</option>` + hs.slice(1).map(h => `<option value="${h}" ${h === hasta ? 'selected' : ''}>${h}</option>`).join('');
    c.innerHTML = card(`<p class="font-black">Conexión automática</p>
      <p class="text-[11px] text-slate-500">Si la activás, te conectás solo a la hora que elijas, aunque no abras la app. Siempre podés conectarte o desconectarte a mano.</p>
      <label class="flex items-center gap-2 text-sm font-bold"><input id="h-on" type="checkbox" class="w-5 h-5" ${h0 ? 'checked' : ''}> Conectarme automáticamente</label>
      <div id="h-cfg" class="${h0 ? '' : 'hidden'} space-y-3">
        <div><label class="text-[11px] font-extrabold text-slate-500 uppercase">A partir de las</label><select id="h-de" class="clean-input w-full rounded-xl px-3 py-2 text-sm mt-1">${optD}</select></div>
        <div><label class="text-[11px] font-extrabold text-slate-500 uppercase">¿Desconectarme solo a una hora?</label><select id="h-ha" class="clean-input w-full rounded-xl px-3 py-2 text-sm mt-1">${optH}</select></div>
        <div><label class="text-[11px] font-extrabold text-slate-500 uppercase">Días</label>
          <div id="h-dias" class="flex gap-1 mt-1">${DIAS.map((n, i) => `<button type="button" data-d="${i + 1}" class="flex-1 text-[11px] font-black rounded-lg py-2 ${sel.has(i + 1) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}">${n}</button>`).join('')}</div></div>
      </div>
      ${btn('h-save', 'Guardar')}`);
    $('h-on').onchange = e => $('h-cfg').classList.toggle('hidden', !e.target.checked);
    $('h-dias').querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const on = !b.classList.contains('bg-brand-600');
      b.classList.toggle('bg-brand-600', on); b.classList.toggle('text-white', on); b.classList.toggle('bg-slate-100', !on); b.classList.toggle('text-slate-600', !on);
    });
    $('h-save').onclick = async () => {
      const uid = sesion.user.id;
      const dias = [...$('h-dias').querySelectorAll('[data-d]')].filter(b => b.classList.contains('bg-brand-600')).map(b => +b.dataset.d);
      const de = $('h-de').value, ha = $('h-ha').value;
      if ($('h-on').checked) {
        if (!dias.length) return mostrarToast('Elegí al menos un día');
        if (ha <= de) return mostrarToast('La hora de desconexión tiene que ser mayor que la de conexión');
      }
      let x = await _sb.from('ne_horarios').delete().eq('repartidor_id', uid); if (x.error) return mostrarToast(x.error.message);
      if ($('h-on').checked) { x = await _sb.from('ne_horarios').insert({ repartidor_id: uid, dias, desde: de, hasta: ha }); if (x.error) return mostrarToast('Error: ' + x.error.message); }
      mostrarToast($('h-on').checked ? 'Conexión automática guardada' : 'Conexión automática desactivada');
    };
  }

  /* --- Zonas y precios --- */
  const zn = id => (zonas.find(z => z.id === id) || {}).nombre || '?';
  function tabZonas() {
    $('r-cont').innerHTML = card(`<p class="font-black">1 · Tocá las zonas donde trabajás</p>
      <div id="rep-mapa" style="height:260px;border-radius:1rem;z-index:0"></div><p id="z-cant" class="text-[11px] text-slate-500"></p>`) +
      `<div id="z-precios" class="mt-3"></div>`;
    if (R.mapa) { R.mapa.remove(); R.mapa = null; }
    R.mapa = L.map('rep-mapa').setView([-38.56, -58.74], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(R.mapa);
    zonas.forEach(z => {
      const col = rgbaOk(z.color);
      const lay = L.geoJSON(z.geojson, { style: () => estiloZ(z, col) }).bindTooltip(z.nombre, { sticky: true }).addTo(R.mapa);
      lay.on('click', () => { if (R.zSel.has(z.id)) R.zSel.delete(z.id); else R.zSel.add(z.id); lay.setStyle(estiloZ(z, col)); pintarPrecios(); });
    });
    pintarPrecios();
  }
  const estiloZ = (z, col) => R.zSel.has(z.id) ? { color: col, weight: 3, fillColor: col, fillOpacity: .55 } : { color: col, weight: 1, fillOpacity: .08 };
  function leerInputs() { document.querySelectorAll('[data-p]').forEach(i => { const v = parseFloat(i.value); if (v > 0) R.precios[i.dataset.p] = v; else delete R.precios[i.dataset.p]; }); }
  function pintarPrecios() {
    leerInputs();
    const ids = zonas.filter(z => R.zSel.has(z.id)).map(z => z.id);
    $('z-cant').textContent = ids.length ? 'Zonas elegidas: ' + ids.map(zn).join(', ') : 'Todavía no elegiste zonas.';
    const box = $('z-precios'); if (!ids.length) { box.innerHTML = ''; return; }
    let h = `<p class="font-black mb-2">2 · Tu precio por recorrido</p>
      <div class="flex gap-2 mb-3"><input id="z-todos" type="number" min="1" inputmode="numeric" placeholder="Precio para todas" class="clean-input flex-1 rounded-xl px-3 py-2 text-sm">${btn('z-aplicar', 'Aplicar a todas', 'bg-slate-900 text-white text-xs font-black rounded-xl px-3')}</div><div class="space-y-3">`;
    ids.forEach(a => {
      h += `<div class="clean-card rounded-2xl p-3"><p class="text-xs font-black text-brand-700 mb-2">Retiro en ${esc(zn(a))}</p>`;
      ids.forEach(b => { const k = a + '-' + b;
        h += `<div class="flex items-center gap-2 mb-1.5"><span class="flex-1 text-[11px] text-slate-600">→ ${esc(zn(b))}${R.sug[k] ? `<br><span class="text-brand-500">Sugerido: ${money(R.sug[k])}</span>` : ''}</span>
          <input data-p="${k}" type="number" min="1" inputmode="numeric" value="${R.precios[k] || ''}" placeholder="$" class="clean-input w-24 rounded-xl px-2 py-1.5 text-sm text-right"></div>`; });
      h += '</div>';
    });
    box.innerHTML = h + `</div><div class="mt-3">${btn('z-save', 'Guardar zonas y precios')}</div>`;
    $('z-aplicar').onclick = () => { const v = parseFloat($('z-todos').value); if (!(v > 0)) return mostrarToast('Poné un precio'); document.querySelectorAll('[data-p]').forEach(i => i.value = v); leerInputs(); };
    $('z-save').onclick = guardarZP;
  }
  async function guardarZP() {
    leerInputs();
    const uid = sesion.user.id, ids = zonas.filter(z => R.zSel.has(z.id)).map(z => z.id);
    if (!ids.length) return mostrarToast('Elegí al menos una zona');
    const filas = [];
    for (const a of ids) for (const b of ids) { const v = R.precios[a + '-' + b]; if (!(v > 0)) return mostrarToast(`Falta el precio ${zn(a)} → ${zn(b)}`); filas.push({ user_id: uid, zona_retiro: a, zona_entrega: b, precio: v }); }
    const b = $('z-save'); b.disabled = true;
    try {
      let r = await _sb.from('ne_rep_zonas').delete().eq('user_id', uid); if (r.error) throw r.error;
      r = await _sb.from('ne_rep_zonas').insert(ids.map(z => ({ user_id: uid, zona_id: z }))); if (r.error) throw r.error;
      r = await _sb.from('ne_rep_precios').delete().eq('user_id', uid); if (r.error) throw r.error;
      r = await _sb.from('ne_rep_precios').insert(filas); if (r.error) throw r.error;
      mostrarToast('Zonas y precios guardados');
    } catch (e) { mostrarToast('Error: ' + (e.message || e)); await cargarBase(); }
    b.disabled = false;
  }

  /* --- Ganancias / historial --- */
  async function tabHistorial() {
    const c = $('r-cont'); c.innerHTML = '<p class="text-xs text-slate-400">Cargando...</p>';
    const { data, error } = await _sb.from('ne_pedidos').select('id,estado,precio,comision_pct,retiro_dir,entrega_dir,creado,entregado_en,aceptado_en,cancelado_en,comision_condonada')
      .eq('repartidor_id', sesion.user.id).in('estado', ['entregado', 'cancelado']).order('creado', { ascending: false }).limit(100);
    if (error) { c.textContent = 'Error al cargar'; return; }
    const ent = data.filter(x => x.estado === 'entregado'), hoy = new Date().toDateString(), sem = Date.now() - 7 * 864e5;
    const suma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
    const tot = arr => suma(arr.filter(x => x.estado === 'entregado'), x => +x.precio), com = arr => suma(arr.filter(x => !x.comision_condonada), x => x.precio * x.comision_pct / 100);
    const cuando = x => new Date(x.estado === 'entregado' ? x.entregado_en : x.cancelado_en), cobrables = ent;
    const dia = cobrables.filter(x => cuando(x).toDateString() === hoy), sm = cobrables.filter(x => cuando(x).getTime() > sem);
    const bloque = (t, a) => { const T = Math.round(tot(a)), C = Math.round(com(a)); const k = (v, l) => `<div><p class="text-base font-black text-slate-900">${v}</p><p class="text-[10px] text-slate-500">${l}</p></div>`;
      return `<div class="rounded-2xl bg-slate-50 p-3"><p class="text-[11px] font-extrabold text-slate-400 uppercase mb-2">${t}</p>
        <div class="grid grid-cols-3 gap-2 text-center">${k(a.length, 'Envíos')}${k(money(T), 'Cobrado')}${k(money(C), 'Comisión')}</div>
        <div class="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center"><span class="text-xs font-bold text-slate-600">Te quedan</span><span class="text-xl font-black text-brand-600">${money(T - C)}</span></div></div>`; };
    c.innerHTML = card(`<p class="font-black">Tus ganancias</p>${bloque('Hoy', dia)}${bloque('Últimos 7 días', sm)}${bloque('Total', cobrables)}
      <p class="text-[11px] text-slate-400">La comisión se la pagás al administrador cada semana.</p>`) + '<div id="h-lista" class="space-y-2 mt-3"></div>';
    data.forEach(x => { const d = document.createElement('div'); d.className = 'clean-card rounded-2xl p-3 text-xs';
      d.innerHTML = `<div class="flex justify-between"><b class="${x.estado === 'entregado' ? 'text-brand-700' : 'text-rose-600'}">${esc(ESTADOS[x.estado])}</b><b>${money(x.precio)}</b></div><p class="text-slate-500 truncate">${esc(fixDir(x.retiro_dir))} → ${esc(fixDir(x.entrega_dir))}</p><p class="text-[10px] text-slate-400">${new Date(x.creado).toLocaleString('es-AR')}</p>`;
      $('h-lista').appendChild(d); });
  }

  /* --- Volver de Google --- */
  if (localStorage.getItem('ne_volver') === 'rep') {
    localStorage.removeItem('ne_volver');
    setTimeout(() => { localStorage.setItem('ne_skip_install', localStorage.getItem('ne_skip_install') || ''); irRepartidor(); }, 600);
  }
})();
