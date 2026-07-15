/**
 * DealKart — Shared Configuration
 * After deploying Apps Script as Web App, paste the URL below.
 */
const DK = {
  // ── Paste your Google Apps Script Web App URL here after deploy ──
  API_URL: 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE',

  // Fallback demo mode when API is not configured
  DEMO_MODE: true,

  // Admin password (change after first login via admin settings / Code.gs)
  // Client-side check only for UX; real gate is Apps Script ADMIN_PASSWORD
  ADMIN_PASSWORD_HINT: 'Set in Code.gs',

  // CallMeBot — admin default (changeable from admin panel)
  ADMIN_WHATSAPP: '917004984949',

  // Session keys
  SESSION_KEY: 'dealkart_session',

  // Status flow (timeline order)
  STATUS_FLOW: [
    'Order Placed',
    'Product Received',
    'Reviewed',
    'Review Live',
    'Refund form filled',
    'Got Refund'
  ],

  // Extra statuses (not in main flow)
  EXTRA_STATUSES: [
    'Review deleted',
    'product not delivered',
    'Cancelled by Amazon',
    'A/c block 4 review',
    'under moderation issue',
    'Reviw not live/Cancelled',
    'Returned to seller by amz',
    'Error on this product'
  ],

  // Map status → badge color class
  STATUS_BADGE: {
    'Order Placed': 'badge-blue',
    'Product Received': 'badge-cyan',
    'Reviewed': 'badge-purple',
    'Review Live': 'badge-yellow',
    'Refund form filled': 'badge-yellow',
    'Got Refund': 'badge-green',
    'Review deleted': 'badge-red',
    'product not delivered': 'badge-red',
    'Cancelled by Amazon': 'badge-red',
    'A/c block 4 review': 'badge-red',
    'under moderation issue': 'badge-yellow',
    'Reviw not live/Cancelled': 'badge-red',
    'Returned to seller by amz': 'badge-red',
    'Error on this product': 'badge-red'
  },

  // Timeline step index for a status
  statusStep(status) {
    const i = this.STATUS_FLOW.indexOf(status);
    if (i >= 0) return i;
    // terminal / error statuses
    if (['Got Refund'].includes(status)) return 5;
    return -1;
  },

  badge(status) {
    return this.STATUS_BADGE[status] || 'badge-gray';
  }
};

// ── Session helpers ──
const Session = {
  get() {
    try {
      const raw = sessionStorage.getItem(DK.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  set(data) {
    sessionStorage.setItem(DK.SESSION_KEY, JSON.stringify(data));
  },
  clear() {
    sessionStorage.removeItem(DK.SESSION_KEY);
  },
  isAdmin() {
    const s = this.get();
    return s && s.role === 'admin';
  },
  isBuyer() {
    const s = this.get();
    return s && s.role === 'buyer';
  },
  user() {
    return this.get();
  }
};

// ── Toast ──
function showToast(message, type = 'info', ms = 3500) {
  let box = document.querySelector('.toast-container');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toast-container';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  t.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${escapeHtml(message)}</span>`;
  box.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(40px)';
    t.style.transition = 'all 0.3s';
    setTimeout(() => t.remove(), 300);
  }, ms);
}

// ── Escape ──
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Format helpers ──
function formatINR(n) {
  const num = Number(n);
  if (isNaN(num)) return '₹—';
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return String(d); }
}

function formatDateTime(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return String(d); }
}

// ── API client ──
const API = {
  async call(action, params = {}, method = 'GET') {
    // Demo mode / placeholder URL
    if (!DK.API_URL || DK.API_URL.includes('YOUR_APPS_SCRIPT')) {
      return DemoAPI.handle(action, params, method);
    }

    try {
      if (method === 'GET') {
        const qs = new URLSearchParams({ action, ...flattenParams(params) });
        const res = await fetch(`${DK.API_URL}?${qs}`, { method: 'GET', redirect: 'follow' });
        return await res.json();
      } else {
        // Apps Script web apps often need text/plain for POST to avoid CORS preflight issues
        const res = await fetch(DK.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, ...params }),
          redirect: 'follow'
        });
        return await res.json();
      }
    } catch (err) {
      console.error('API error', err);
      // Fall back to demo so UI stays usable offline
      showToast('API unreachable — using demo data', 'warning');
      return DemoAPI.handle(action, params, method);
    }
  },

  get(action, params) { return this.call(action, params, 'GET'); },
  post(action, params) { return this.call(action, params, 'POST'); }
};

function flattenParams(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenParams(v, key));
    } else if (v != null) {
      out[key] = String(v);
    }
  }
  return out;
}

// ── Image compress (client-side ≤200KB) ──
async function compressImage(file, maxKB = 200) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const maxDim = 1280;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        let quality = 0.85;
        const tryEncode = () => {
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('Compress failed')); return; }
            if (blob.size <= maxKB * 1024 || quality <= 0.35) {
              const r2 = new FileReader();
              r2.onload = () => resolve({
                base64: r2.result.split(',')[1],
                mimeType: 'image/jpeg',
                name: (file.name || 'screenshot').replace(/\.\w+$/, '') + '.jpg',
                size: blob.size
              });
              r2.readAsDataURL(blob);
            } else {
              quality -= 0.1;
              tryEncode();
            }
          }, 'image/jpeg', quality);
        };
        tryEncode();
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

// ── Nav auth state ──
function updateNavAuth() {
  const s = Session.get();
  const loginBtn = document.getElementById('navLoginBtn');
  const dashBtn = document.getElementById('navDashBtn');
  const logoutBtn = document.getElementById('navLogoutBtn');
  const userChip = document.getElementById('navUserChip');

  if (s) {
    if (loginBtn) loginBtn.classList.add('hidden');
    if (dashBtn) {
      dashBtn.classList.remove('hidden');
      dashBtn.href = s.role === 'admin' ? 'admin-dashboard.html' : 'buyer-dashboard.html';
      dashBtn.textContent = s.role === 'admin' ? 'Admin' : 'My Orders';
    }
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (userChip) {
      userChip.classList.remove('hidden');
      userChip.textContent = s.name || s.userId || 'User';
    }
  } else {
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (dashBtn) dashBtn.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (userChip) userChip.classList.add('hidden');
  }
}

function logout() {
  Session.clear();
  showToast('Logged out', 'success');
  setTimeout(() => { window.location.href = 'index.html'; }, 500);
}

function toggleMobileNav() {
  document.getElementById('navLinks')?.classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', updateNavAuth);

// ═══════════════════════════════════════════
// DEMO API — localStorage-backed mock backend
// ═══════════════════════════════════════════
const DemoAPI = (() => {
  const LS = 'dealkart_demo_db';

  function seed() {
    const existing = localStorage.getItem(LS);
    if (existing) return JSON.parse(existing);

    const db = {
      nextOrderNo: 5,
      adminPassword: 'admin123',
      adminWhatsApp: '917004984949',
      accounts: [
        { UserID: 'B_Rahul_04', Name: 'Rahul Kumar', Mobile: '9876543210', WhatsApp: '919876543210', Role: 'buyer' },
        { UserID: 'B_Priya_02', Name: 'Priya Singh', Mobile: '9876501234', WhatsApp: '919876501234', Role: 'buyer' },
        { UserID: 'A_Reviewer_01', Name: 'Reviewer Account 1', Mobile: '9000000001', WhatsApp: '919000000001', Role: 'account' },
        { UserID: 'A_Reviewer_02', Name: 'Reviewer Account 2', Mobile: '9000000002', WhatsApp: '919000000002', Role: 'account' }
      ],
      mediators: [
        { Name: 'Nitesh', Contact: '9800000001', WhatsApp: '919800000001' },
        { Name: 'Panda', Contact: '9800000002', WhatsApp: '919800000002' },
        { Name: 'Wolf Samrat', Contact: '9800000003', WhatsApp: '919800000003' }
      ],
      platforms: [
        'Amazon', 'Flipkart', 'Meesho', 'Myntra', 'Blinkit',
        'Amz_Empty', 'Amz_Rating', 'Fkt_Exchange'
      ],
      statuses: [
        ...DK.STATUS_FLOW,
        ...DK.EXTRA_STATUSES
      ],
      orders: [
        {
          Timestamp: '2026-07-01T10:30:00',
          OrderNo: '1',
          OrderedPlatform: 'Amazon',
          AccountName: 'A_Reviewer_01',
          ProductName: 'boAt Airdopes 131 Wireless Earbuds',
          SellerName: 'Clicktech Retail',
          ProductLink: 'https://amazon.in/dp/demo1',
          PlatformOrderID: 'AMZ-403-1234567',
          PricePaid: 899,
          Less: 400,
          ToGet: 499,
          DealContactNo: '9876543210',
          MediatorName: 'Nitesh',
          OrderDate: '2026-07-01',
          FriendUserID: 'B_Rahul_04',
          FriendLess: 350,
          ForWhom: 'Friend',
          Notes: 'Priority deal',
          ReviewLink: '',
          MediatorOrderForm: '',
          MediatorRefundForm: '',
          OrderScreenshot: '',
          OrderStatus: 'Got Refund',
          DeliveryDate: '2026-07-04',
          ReviewDate: '2026-07-05',
          ReviewLiveDate: '2026-07-06',
          RefundFormDate: '2026-07-07',
          RefundDate: '2026-07-10',
          ActualGot: 499,
          PaymentMethod: 'UPI'
        },
        {
          Timestamp: '2026-07-05T14:00:00',
          OrderNo: '2',
          OrderedPlatform: 'Flipkart',
          AccountName: 'A_Reviewer_02',
          ProductName: 'Noise ColorFit Pulse 2 Max',
          SellerName: 'RetailNet',
          ProductLink: 'https://flipkart.com/demo2',
          PlatformOrderID: 'FKT-OD123456789',
          PricePaid: 1499,
          Less: 600,
          ToGet: 899,
          DealContactNo: '9876501234',
          MediatorName: 'Panda',
          OrderDate: '2026-07-05',
          FriendUserID: 'B_Priya_02',
          FriendLess: 550,
          ForWhom: 'Friend',
          Notes: '',
          ReviewLink: '',
          MediatorOrderForm: '',
          MediatorRefundForm: '',
          OrderScreenshot: '',
          OrderStatus: 'Review Live',
          DeliveryDate: '2026-07-08',
          ReviewDate: '2026-07-09',
          ReviewLiveDate: '2026-07-11',
          RefundFormDate: '',
          RefundDate: '',
          ActualGot: '',
          PaymentMethod: ''
        },
        {
          Timestamp: '2026-07-10T09:15:00',
          OrderNo: '3',
          OrderedPlatform: 'Amazon',
          AccountName: 'A_Reviewer_01',
          ProductName: 'Prestige Iris 750W Mixer Grinder',
          SellerName: 'Cloudtail India',
          ProductLink: 'https://amazon.in/dp/demo3',
          PlatformOrderID: 'AMZ-402-7654321',
          PricePaid: 2499,
          Less: 900,
          ToGet: 1599,
          DealContactNo: '9876543210',
          MediatorName: 'Wolf Samrat',
          OrderDate: '2026-07-10',
          FriendUserID: 'B_Rahul_04',
          FriendLess: 800,
          ForWhom: 'Friend',
          Notes: 'Waiting for delivery',
          ReviewLink: '',
          MediatorOrderForm: '',
          MediatorRefundForm: '',
          OrderScreenshot: '',
          OrderStatus: 'Product Received',
          DeliveryDate: '2026-07-13',
          ReviewDate: '',
          ReviewLiveDate: '',
          RefundFormDate: '',
          RefundDate: '',
          ActualGot: '',
          PaymentMethod: ''
        },
        {
          Timestamp: '2026-07-12T16:45:00',
          OrderNo: '4',
          OrderedPlatform: 'Meesho',
          AccountName: 'A_Reviewer_02',
          ProductName: 'Cotton Bedsheet King Size Combo',
          SellerName: 'HomeDecor Hub',
          ProductLink: 'https://meesho.com/demo4',
          PlatformOrderID: 'MSH-99887766',
          PricePaid: 599,
          Less: 250,
          ToGet: 349,
          DealContactNo: '',
          MediatorName: 'Nitesh',
          OrderDate: '2026-07-12',
          FriendUserID: '',
          FriendLess: '',
          ForWhom: 'Self',
          Notes: 'Self deal',
          ReviewLink: '',
          MediatorOrderForm: '',
          MediatorRefundForm: '',
          OrderScreenshot: '',
          OrderStatus: 'Order Placed',
          DeliveryDate: '',
          ReviewDate: '',
          ReviewLiveDate: '',
          RefundFormDate: '',
          RefundDate: '',
          ActualGot: '',
          PaymentMethod: ''
        }
      ],
      deals: [
        {
          id: 'D1',
          ProductName: 'Samsung 25W Type-C Fast Charger',
          Platform: 'Amazon',
          PricePaid: 699,
          Less: 350,
          ToGet: 349,
          MediatorName: 'Nitesh',
          Notes: 'Limited stock deal',
          Active: true
        },
        {
          id: 'D2',
          ProductName: 'Milton Thermosteel 1L Flask',
          Platform: 'Flipkart',
          PricePaid: 899,
          Less: 400,
          ToGet: 499,
          MediatorName: 'Panda',
          Notes: 'Exchange deal available',
          Active: true
        },
        {
          id: 'D3',
          ProductName: 'Havells Instanio 3L Instant Geyser',
          Platform: 'Amazon',
          PricePaid: 3299,
          Less: 1200,
          ToGet: 2099,
          MediatorName: 'Wolf Samrat',
          Notes: 'High value — review required',
          Active: true
        },
        {
          id: 'D4',
          ProductName: 'Realme Buds Wireless 3 Neo',
          Platform: 'Flipkart',
          PricePaid: 1299,
          Less: 550,
          ToGet: 749,
          MediatorName: 'Nitesh',
          Notes: '',
          Active: true
        },
        {
          id: 'D5',
          ProductName: 'Solimo Microfiber Bedsheet',
          Platform: 'Amazon',
          PricePaid: 799,
          Less: 300,
          ToGet: 499,
          MediatorName: 'Panda',
          Notes: 'Easy review product',
          Active: true
        },
        {
          id: 'D6',
          ProductName: 'Pigeon Mini Handy Chopper',
          Platform: 'Meesho',
          PricePaid: 249,
          Less: 120,
          ToGet: 129,
          MediatorName: 'Nitesh',
          Notes: 'Quick turnover',
          Active: true
        }
      ],
      queries: []
    };
    localStorage.setItem(LS, JSON.stringify(db));
    return db;
  }

  function save(db) { localStorage.setItem(LS, JSON.stringify(db)); }
  function db() { return seed(); }

  function ok(data) { return { success: true, data }; }
  function fail(msg) { return { success: false, error: msg }; }

  return {
    handle(action, params) {
      const d = db();
      switch (action) {
        case 'ping':
          return ok({ mode: 'demo', time: new Date().toISOString() });

        case 'getStats': {
          const orders = d.orders;
          const total = orders.length;
          const active = orders.filter(o => !['Got Refund', 'Cancelled by Amazon', 'product not delivered', 'Error on this product', 'Returned to seller by amz'].includes(o.OrderStatus)).length;
          const refunded = orders.filter(o => o.OrderStatus === 'Got Refund').length;
          const cashback = orders
            .filter(o => o.OrderStatus === 'Got Refund')
            .reduce((s, o) => s + (Number(o.ActualGot) || Number(o.ToGet) || 0), 0);
          return ok({ total, active, refunded, cashback, buyers: d.accounts.filter(a => a.Role === 'buyer').length, mediators: d.mediators.length });
        }

        case 'getOrders': {
          let list = [...d.orders];
          if (params.friendUserId) {
            list = list.filter(o => o.FriendUserID === params.friendUserId);
          }
          if (params.orderNo) {
            list = list.filter(o => String(o.OrderNo) === String(params.orderNo));
          }
          if (params.status) {
            list = list.filter(o => o.OrderStatus === params.status);
          }
          // newest first
          list.sort((a, b) => Number(b.OrderNo) - Number(a.OrderNo));
          return ok(list);
        }

        case 'getOrder': {
          const o = d.orders.find(x => String(x.OrderNo) === String(params.orderNo));
          return o ? ok(o) : fail('Order not found');
        }

        case 'getDeals':
          return ok(d.deals.filter(x => x.Active !== false));

        case 'getDropdowns':
          return ok({
            platforms: d.platforms,
            accounts: d.accounts.map(a => a.UserID || a.Name),
            accountDetails: d.accounts,
            mediators: d.mediators.map(m => m.Name),
            mediatorDetails: d.mediators,
            statuses: d.statuses,
            buyers: d.accounts.filter(a => a.Role === 'buyer')
          });

        case 'loginBuyer': {
          const q = String(params.identifier || '').trim().toLowerCase();
          if (!q) return fail('Enter mobile or UserID');
          const user = d.accounts.find(a =>
            a.Role === 'buyer' && (
              String(a.Mobile).toLowerCase() === q ||
              String(a.UserID).toLowerCase() === q ||
              String(a.WhatsApp).toLowerCase() === q
            )
          );
          if (!user) return fail('Buyer not found. Contact admin to get access.');
          return ok({
            role: 'buyer',
            userId: user.UserID,
            name: user.Name,
            mobile: user.Mobile,
            whatsapp: user.WhatsApp
          });
        }

        case 'loginAdmin': {
          if (String(params.password) === d.adminPassword) {
            return ok({ role: 'admin', name: 'Admin', userId: 'admin' });
          }
          return fail('Invalid admin password');
        }

        case 'addOrder': {
          const order = { ...(params.order || params) };
          order.OrderNo = String(d.nextOrderNo++);
          order.Timestamp = new Date().toISOString();
          order.OrderStatus = order.OrderStatus || 'Order Placed';
          const paid = Number(order.PricePaid) || 0;
          const less = Number(order.Less) || 0;
          order.ToGet = order.ToGet != null && order.ToGet !== '' ? order.ToGet : (paid - less);
          d.orders.push(order);
          save(d);
          return ok({ order, whatsapp: { buyer: true, admin: true } });
        }

        case 'updateOrder': {
          const no = String(params.orderNo || (params.order && params.order.OrderNo));
          const idx = d.orders.findIndex(o => String(o.OrderNo) === no);
          if (idx < 0) return fail('Order not found');
          const prev = d.orders[idx].OrderStatus;
          const patch = params.order || params;
          d.orders[idx] = { ...d.orders[idx], ...patch, OrderNo: no };
          const notifyRefund = prev !== 'Got Refund' && d.orders[idx].OrderStatus === 'Got Refund';
          save(d);
          return ok({ order: d.orders[idx], notifyRefund });
        }

        case 'requestDeal': {
          const req = {
            id: 'Q' + Date.now(),
            type: 'deal_request',
            buyerName: params.buyerName,
            buyerMobile: params.buyerMobile,
            buyerUserId: params.buyerUserId,
            dealId: params.dealId,
            dealName: params.dealName,
            time: new Date().toISOString()
          };
          d.queries.push(req);
          save(d);
          return ok({ request: req, whatsappAdmin: true });
        }

        case 'raiseQuery': {
          const q = {
            id: 'Q' + Date.now(),
            type: 'query',
            buyerUserId: params.buyerUserId,
            buyerName: params.buyerName,
            orderNo: params.orderNo,
            message: params.message,
            time: new Date().toISOString()
          };
          d.queries.push(q);
          save(d);
          return ok(q);
        }

        case 'sendWhatsApp': {
          // Demo: just log
          console.log('[Demo WhatsApp]', params);
          return ok({ sent: true, demo: true, to: params.phone, message: params.message });
        }

        case 'getSettings':
          return ok({
            adminWhatsApp: d.adminWhatsApp,
            adminPasswordSet: true,
            mode: 'demo'
          });

        case 'updateSettings': {
          if (params.adminWhatsApp) d.adminWhatsApp = String(params.adminWhatsApp).replace(/\D/g, '');
          if (params.adminPassword) d.adminPassword = String(params.adminPassword);
          save(d);
          return ok({ adminWhatsApp: d.adminWhatsApp });
        }

        case 'addAccount': {
          d.accounts.push(params.account || params);
          save(d);
          return ok(d.accounts);
        }

        case 'addMediator': {
          d.mediators.push(params.mediator || params);
          save(d);
          return ok(d.mediators);
        }

        case 'uploadScreenshot': {
          // Demo: return a data-uri placeholder reference
          return ok({
            url: params.base64
              ? `data:${params.mimeType || 'image/jpeg'};base64,${params.base64.slice(0, 40)}…`
              : '',
            fileId: 'demo_' + Date.now()
          });
        }

        case 'getQueries':
          return ok(d.queries.slice().reverse());

        default:
          return fail('Unknown action: ' + action);
      }
    }
  };
})();
