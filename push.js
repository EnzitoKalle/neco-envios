/* NECO ENVÍOS - Parte 3: activar notificaciones push en el navegador/app.
   PEGÁ ACÁ TU CLAVE PÚBLICA VAPID (la pública es segura de exponer). */
(function () {
  const VAPID_PUBLIC = 'BDTw7eeBhWjhfaVOVT8Zatjjp_VfFxFRUllzvXdznFpyyuNkUhDarQ018xPxP6sE-fJHFBkvFAUTaBDxWmFGGxw';
  const configurado = VAPID_PUBLIC.length > 60;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const nativo = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const soportado = nativo || ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);

  const key = () => { let s = VAPID_PUBLIC.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };

  async function guardar(sub) {
    await asegurarSesion();
    const j = sub.toJSON();
    const { error } = await _sb.rpc('ne_guardar_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    if (error) throw error;
  }
  async function suscribir() {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() });
    await guardar(sub);
  }

  /* ---- App Android: avisos con Firebase (FCM) ---- */
  let fcmListo = false;
  const PN = () => window.Capacitor.Plugins.PushNotifications;
  async function guardarFcm(token) {
    await asegurarSesion();
    const { error } = await _sb.rpc('ne_guardar_fcm', { p_token: token });
    if (error) throw error;
  }
  async function registrarNativo() {
    if (!fcmListo) {
      fcmListo = true;
      PN().addListener('registration', t => { guardarFcm(t.value).catch(() => {}); });
      PN().addListener('registrationError', () => {});
      // Al tocar el aviso se abre el chat o el panel que corresponda (la dirección viene en el aviso)
      PN().addListener('pushNotificationActionPerformed', a => { const u = a && a.notification && a.notification.data && a.notification.data.url; if (u && String(u).startsWith('/')) location.href = location.origin + u; });
      PN().addListener('pushNotificationReceived', n => { mostrarToast('🔔 ' + ((n.title || '') + (n.body ? ': ' + n.body : ''))); });   // con la app abierta Android no muestra el aviso, así que se muestra acá
      try { await PN().createChannel({ id: 'pedidos', name: 'Pedidos y mensajes', description: 'Avisos de pedidos nuevos y mensajes', importance: 5, visibility: 1, vibration: true }); } catch (e) {}
    }
    await PN().register();
  }
  async function estadoNativo() {
    try {
      if (!window.Capacitor.Plugins.PushNotifications) { window.__pushError = 'el módulo de avisos (PushNotifications) no está dentro de la app'; return 'error'; }
      const p = await PN().checkPermissions();
      if (p.receive === 'granted') { await registrarNativo(); return 'ok'; }
      return p.receive === 'denied' ? 'bloqueado' : 'pedir';
    } catch (e) { window.__pushError = String((e && e.message) || e); return 'error'; }
  }
  async function activarNativo() {
    try {
      const p = await PN().requestPermissions();
      if (p.receive !== 'granted') return { ok: false, msg: 'Las notificaciones quedaron bloqueadas. Activalas en Ajustes del celular → Aplicaciones → NecoEnvíos → Notificaciones.' };
      await registrarNativo();
      return { ok: true };
    } catch (e) { return { ok: false, msg: 'No se pudieron activar los avisos: ' + (e.message || e) }; }
  }

  // Estado de los avisos: 'ok' | 'pedir' (todavía no se pidió permiso) | 'bloqueado' | 'ios-instalar' | 'no-soportado'
  let guardadoPara = null;
  async function estado() {
    if (nativo) return estadoNativo();
    if (!configurado) return 'no-soportado';
    if (!soportado) return (ios && !standalone) ? 'ios-instalar' : 'no-soportado';
    if (Notification.permission === 'denied') return 'bloqueado';
    if (Notification.permission !== 'granted') return 'pedir';
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const { data } = await _sb.auth.getSession(), uid = data.session && data.session.user.id;
      if (!sub) { await suscribir(); guardadoPara = uid; }
      else if (uid && guardadoPara !== uid) { await guardar(sub); guardadoPara = uid; }
      return 'ok';
    } catch (e) { return 'pedir'; }
  }
  // Pide el permiso y deja el aviso andando. Tiene que llamarse desde un toque del usuario.
  async function activar() {
    if (nativo) return activarNativo();
    if (!soportado) return { ok: false, msg: (ios && !standalone) ? 'En iPhone primero instalá la app: Compartir → Agregar a pantalla de inicio. Después activá los avisos desde la app.' : 'Este navegador no permite avisos.' };
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return { ok: false, msg: 'Los avisos quedaron bloqueados. Podés activarlos en los ajustes del navegador.' };
      await suscribir();
      return { ok: true };
    } catch (e) { return { ok: false, msg: 'No se pudieron activar los avisos: ' + (e.message || e) }; }
  }
  const ayuda = {
    get error() { return 'No se pudieron activar los avisos de la app. Error técnico: ' + (window.__pushError || 'desconocido') + '. Sacá una captura de esta pantalla y mandásela a quien te dio la app.'; },
    bloqueado: nativo ? 'Las bloqueaste. Para activarlas: Ajustes del celular → Aplicaciones → NecoEnvíos → Notificaciones → Permitir. Después volvé y tocá «Revisar».' : 'Las bloqueaste. Para activarlas: tocá el candado 🔒 (o los 3 puntitos ⋮) de la barra del navegador → Permisos o Configuración del sitio → Notificaciones → Permitir. Después tocá «Revisar».',
    'ios-instalar': 'En iPhone primero instalá la app: tocá Compartir (cuadrado con flecha) → «Agregar a pantalla de inicio». Abrila desde el ícono y activá los avisos ahí.',
    'no-soportado': 'Este navegador no permite avisos. Instalá la app o abrí NecoEnvíos con Chrome.'
  };
  window.NecoPush = { estado, activar, ayuda };

  if (nativo) return;   // en la app no hace falta la campanita: el cartel grande del panel se encarga
  if (!configurado) return;
  if (!soportado && !(ios && !standalone)) return;

  // Campanita de la barra de arriba (para clientes y para quien quiera activarlos desde ahí)
  const b = document.createElement('button');
  b.id = 'btn-push'; b.type = 'button'; b.title = 'Activar avisos';
  b.className = 'bg-brand-50 border border-brand-200 text-brand-600 p-2 rounded-xl active:scale-95 shadow-sm flex items-center';
  b.innerHTML = '<i data-lucide="bell" class="w-4 h-4"></i>';
  const g = $('btn-google'); g.parentNode.insertBefore(b, g);
  ico();
  b.onclick = async () => { const r = await activar(); if (r.ok) { b.classList.add('hidden'); mostrarToast('¡Avisos activados!'); } else mostrarToast(r.msg); };

  // Si ya había permiso, vuelve a registrar la suscripción con el usuario actual (por si cambió de cuenta)
  async function revisar() {
    if (!soportado) return;
    if (Notification.permission === 'granted') {
      b.classList.add('hidden');
      try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await guardar(sub); } catch (e) {}
    }
  }
  _sb.auth.onAuthStateChange((ev, s) => { if (s && (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION')) setTimeout(revisar, 800); });
})();
