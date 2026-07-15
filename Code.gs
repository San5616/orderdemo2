/**
 * DealKart — Google Apps Script Web App Backend
 * ------------------------------------------------
 * SETUP:
 * 1. Create a Google Sheet with tabs: Orders, Accounts, Mediator, Platform, Dashboard
 * 2. File → Project properties / Script properties: set SHEET_ID (optional if bound)
 * 3. Set ADMIN_PASSWORD and ADMIN_WHATSAPP below
 * 4. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy Web App URL into _config.js → DK.API_URL and set DEMO_MODE = false
 *
 * CallMeBot: activate each number by messaging the bot first
 *   https://www.callmebot.com/blog/free-api-whatsapp-messages/
 */

// ═══════════════ CONFIG ═══════════════
const CONFIG = {
  // Leave empty if this script is bound to the spreadsheet
  SHEET_ID: '', // e.g. '1abc...xyz'

  ADMIN_PASSWORD: 'admin123', // CHANGE THIS
  ADMIN_WHATSAPP: '917004984949', // digits only with country code

  // Drive folder for screenshots (create folder → share with script account → paste ID)
  DRIVE_FOLDER_ID: '', // optional; uses root if empty

  // CallMeBot API key (default public key used by CallMeBot for WhatsApp)
  // User must activate: send "I allow callmebot to send me messages" to +34 644 66 25 23
  CALLMEBOT_APIKEY: '123123', // user-specific key from CallMeBot after activation

  ORDERS_HEADERS: [
    'Timestamp', 'OrderNo', 'OrderedPlatform', 'AccountName', 'ProductName',
    'SellerName', 'ProductLink', 'PlatformOrderID', 'PricePaid', 'Less', 'ToGet',
    'DealContactNo', 'MediatorName', 'OrderDate', 'FriendUserID', 'FriendLess',
    'ForWhom', 'Notes', 'ReviewLink', 'MediatorOrderForm', 'MediatorRefundForm',
    'OrderScreenshot', 'OrderStatus', 'DeliveryDate', 'ReviewDate', 'ReviewLiveDate',
    'RefundFormDate', 'RefundDate', 'ActualGot', 'PaymentMethod'
  ]
};

// ═══════════════ ENTRY POINTS ═══════════════
function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    let params = {};
    if (method === 'POST' && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      params = e.parameter;
    }
    const action = params.action || '';
    const result = route(action, params);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, error: String(err.message || err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function route(action, p) {
  switch (action) {
    case 'ping': return ok({ mode: 'live', time: new Date().toISOString() });
    case 'getStats': return ok(getStats());
    case 'getOrders': return ok(getOrders(p));
    case 'getOrder': {
      const o = getOrderByNo(p.orderNo);
      return o ? ok(o) : fail('Order not found');
    }
    case 'getDeals': return ok(getDeals());
    case 'getDropdowns': return ok(getDropdowns());
    case 'loginBuyer': return loginBuyer(p);
    case 'loginAdmin': return loginAdmin(p);
    case 'addOrder': return addOrder(p.order || p);
    case 'updateOrder': return updateOrder(p);
    case 'requestDeal': return requestDeal(p);
    case 'raiseQuery': return raiseQuery(p);
    case 'sendWhatsApp': return sendWhatsAppAction(p);
    case 'getSettings': return ok({
      adminWhatsApp: getScriptProp('ADMIN_WHATSAPP') || CONFIG.ADMIN_WHATSAPP,
      adminPasswordSet: true,
      mode: 'live'
    });
    case 'updateSettings': return updateSettings(p);
    case 'addAccount': return addAccount(p.account || p);
    case 'addMediator': return addMediator(p.mediator || p);
    case 'uploadScreenshot': return uploadScreenshot(p);
    case 'getQueries': return ok(getQueries());
    default: return fail('Unknown action: ' + action);
  }
}

function ok(data) { return { success: true, data: data }; }
function fail(msg) { return { success: false, error: msg }; }

// ═══════════════ SHEET HELPERS ═══════════════
function getSpreadsheet() {
  if (CONFIG.SHEET_ID) return SpreadsheetApp.openById(CONFIG.SHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function sheetToObjects(sheetName) {
  const sh = getSheet(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(h => String(h).trim());
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(c => c === '' || c == null)) continue;
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j]; });
    obj._row = i + 1; // 1-based sheet row
    rows.push(obj);
  }
  return rows;
}

function ensureOrdersHeader() {
  const sh = getSheet('Orders');
  if (sh.getLastRow() === 0) {
    sh.appendRow(CONFIG.ORDERS_HEADERS);
    sh.getRange(1, 1, 1, CONFIG.ORDERS_HEADERS.length).setFontWeight('bold');
  }
}

function getScriptProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function setScriptProp(key, val) {
  PropertiesService.getScriptProperties().setProperty(key, String(val));
}

// ═══════════════ ACTIONS ═══════════════
function getStats() {
  const orders = sheetToObjects('Orders');
  const accounts = sheetToObjects('Accounts');
  const mediators = sheetToObjects('Mediator');
  const closed = ['Got Refund', 'Cancelled by Amazon', 'product not delivered', 'Error on this product', 'Returned to seller by amz'];
  const total = orders.length;
  const active = orders.filter(o => closed.indexOf(String(o.OrderStatus)) < 0).length;
  const refunded = orders.filter(o => String(o.OrderStatus) === 'Got Refund').length;
  const cashback = orders
    .filter(o => String(o.OrderStatus) === 'Got Refund')
    .reduce((s, o) => s + (Number(o.ActualGot) || Number(o.ToGet) || 0), 0);
  return {
    total, active, refunded, cashback,
    buyers: accounts.filter(a => String(a.Role || '').toLowerCase() === 'buyer' || String(a.UserID || '').indexOf('B_') === 0).length,
    mediators: mediators.length
  };
}

function getOrders(p) {
  let list = sheetToObjects('Orders');
  if (p.friendUserId) {
    list = list.filter(o => String(o.FriendUserID) === String(p.friendUserId));
  }
  if (p.orderNo) {
    list = list.filter(o => String(o.OrderNo) === String(p.orderNo));
  }
  if (p.status) {
    list = list.filter(o => String(o.OrderStatus) === String(p.status));
  }
  list.sort((a, b) => Number(b.OrderNo) - Number(a.OrderNo));
  // strip internal _row from public responses if needed — keep for admin updates via orderNo
  return list.map(sanitizeOrder);
}

function sanitizeOrder(o) {
  const copy = {};
  CONFIG.ORDERS_HEADERS.forEach(h => { copy[h] = o[h] != null ? o[h] : ''; });
  // serialize dates
  ['Timestamp', 'OrderDate', 'DeliveryDate', 'ReviewDate', 'ReviewLiveDate', 'RefundFormDate', 'RefundDate'].forEach(k => {
    if (copy[k] instanceof Date) copy[k] = copy[k].toISOString();
  });
  return copy;
}

function getOrderByNo(orderNo) {
  const list = sheetToObjects('Orders');
  const o = list.find(x => String(x.OrderNo) === String(orderNo));
  return o ? sanitizeOrder(o) : null;
}

function getDeals() {
  // Optional "Deals" sheet; otherwise derive recent active-looking products from orders
  const ss = getSpreadsheet();
  const dealsSheet = ss.getSheetByName('Deals');
  if (dealsSheet && dealsSheet.getLastRow() > 1) {
    return sheetToObjects('Deals').filter(d => d.Active !== false && String(d.Active).toLowerCase() !== 'false');
  }
  // Fallback: last unique products as "deals"
  const orders = sheetToObjects('Orders').slice().reverse();
  const seen = {};
  const deals = [];
  orders.forEach(o => {
    const key = String(o.ProductName);
    if (!key || seen[key]) return;
    seen[key] = true;
    deals.push({
      id: 'O' + o.OrderNo,
      ProductName: o.ProductName,
      Platform: o.OrderedPlatform,
      PricePaid: o.PricePaid,
      Less: o.Less,
      ToGet: o.ToGet,
      MediatorName: o.MediatorName,
      Notes: o.Notes || '',
      Active: true
    });
  });
  return deals.slice(0, 24);
}

function getDropdowns() {
  const accounts = sheetToObjects('Accounts');
  const mediators = sheetToObjects('Mediator');
  const platformSheet = sheetToObjects('Platform');

  let platforms = platformSheet.map(r => r.Platform || r.Name || r.platform).filter(Boolean);
  let statuses = platformSheet.map(r => r.Status || r.status).filter(Boolean);

  if (!platforms.length) {
    platforms = ['Amazon', 'Flipkart', 'Meesho', 'Myntra', 'Blinkit', 'Amz_Empty', 'Amz_Rating', 'Fkt_Exchange'];
  }
  if (!statuses.length) {
    statuses = [
      'Order Placed', 'Product Received', 'Reviewed', 'Review Live',
      'Refund form filled', 'Got Refund', 'Review deleted', 'product not delivered',
      'Cancelled by Amazon', 'A/c block 4 review', 'under moderation issue',
      'Reviw not live/Cancelled', 'Returned to seller by amz', 'Error on this product'
    ];
  }

  const buyers = accounts.filter(a =>
    String(a.Role || '').toLowerCase() === 'buyer' || String(a.UserID || '').indexOf('B_') === 0
  );

  return {
    platforms: unique(platforms),
    accounts: accounts.map(a => a.UserID || a.Name).filter(Boolean),
    accountDetails: accounts,
    mediators: mediators.map(m => m.Name).filter(Boolean),
    mediatorDetails: mediators,
    statuses: unique(statuses),
    buyers: buyers
  };
}

function unique(arr) {
  const s = [];
  arr.forEach(x => { if (x && s.indexOf(x) < 0) s.push(x); });
  return s;
}

function loginBuyer(p) {
  const q = String(p.identifier || '').trim().toLowerCase();
  if (!q) return fail('Enter mobile or UserID');
  const accounts = sheetToObjects('Accounts');
  const user = accounts.find(a => {
    const mobile = String(a.Mobile || '').toLowerCase();
    const uid = String(a.UserID || '').toLowerCase();
    const wa = String(a.WhatsApp || '').toLowerCase();
    const role = String(a.Role || '').toLowerCase();
    const isBuyer = role === 'buyer' || uid.indexOf('b_') === 0 || role === '';
    return isBuyer && (mobile === q || uid === q || wa === q || wa === '91' + q);
  });
  if (!user) return fail('Buyer not found. Contact admin to get access.');
  return ok({
    role: 'buyer',
    userId: user.UserID,
    name: user.Name,
    mobile: user.Mobile,
    whatsapp: user.WhatsApp
  });
}

function loginAdmin(p) {
  const pass = getScriptProp('ADMIN_PASSWORD') || CONFIG.ADMIN_PASSWORD;
  if (String(p.password) === String(pass)) {
    return ok({ role: 'admin', name: 'Admin', userId: 'admin' });
  }
  return fail('Invalid admin password');
}

function nextOrderNo() {
  ensureOrdersHeader();
  const sh = getSheet('Orders');
  const last = sh.getLastRow();
  if (last < 2) return 1;
  const nos = sh.getRange(2, 2, last - 1, 1).getValues().map(r => Number(r[0]) || 0);
  return Math.max.apply(null, nos.concat([0])) + 1;
}

function addOrder(raw) {
  ensureOrdersHeader();
  const sh = getSheet('Orders');
  const orderNo = nextOrderNo();
  const paid = Number(raw.PricePaid) || 0;
  const less = Number(raw.Less) || 0;
  const toGet = raw.ToGet != null && raw.ToGet !== '' ? Number(raw.ToGet) : (paid - less);

  const order = {
    Timestamp: new Date(),
    OrderNo: orderNo,
    OrderedPlatform: raw.OrderedPlatform || '',
    AccountName: raw.AccountName || '',
    ProductName: raw.ProductName || '',
    SellerName: raw.SellerName || '',
    ProductLink: raw.ProductLink || '',
    PlatformOrderID: raw.PlatformOrderID || '',
    PricePaid: paid,
    Less: less,
    ToGet: toGet,
    DealContactNo: raw.DealContactNo || '',
    MediatorName: raw.MediatorName || '',
    OrderDate: raw.OrderDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    FriendUserID: raw.FriendUserID || '',
    FriendLess: raw.FriendLess || '',
    ForWhom: raw.ForWhom || 'Self',
    Notes: raw.Notes || '',
    ReviewLink: raw.ReviewLink || '',
    MediatorOrderForm: raw.MediatorOrderForm || '',
    MediatorRefundForm: raw.MediatorRefundForm || '',
    OrderScreenshot: raw.OrderScreenshot || '',
    OrderStatus: raw.OrderStatus || 'Order Placed',
    DeliveryDate: raw.DeliveryDate || '',
    ReviewDate: raw.ReviewDate || '',
    ReviewLiveDate: raw.ReviewLiveDate || '',
    RefundFormDate: raw.RefundFormDate || '',
    RefundDate: raw.RefundDate || '',
    ActualGot: raw.ActualGot || '',
    PaymentMethod: raw.PaymentMethod || ''
  };

  const row = CONFIG.ORDERS_HEADERS.map(h => order[h] != null ? order[h] : '');
  sh.appendRow(row);

  // WhatsApp notifications
  try {
    notifyOrderCreated(order);
  } catch (err) {
    Logger.log('WA notify error: ' + err);
  }

  return ok({ order: sanitizeOrder(order), whatsapp: { buyer: true, admin: true } });
}

function updateOrder(p) {
  const orderNo = String(p.orderNo || (p.order && p.order.OrderNo) || '');
  if (!orderNo) return fail('orderNo required');
  const list = sheetToObjects('Orders');
  const existing = list.find(o => String(o.OrderNo) === orderNo);
  if (!existing) return fail('Order not found');

  const prevStatus = String(existing.OrderStatus);
  const patch = p.order || p;
  const merged = Object.assign({}, existing, patch, { OrderNo: orderNo });
  // recompute ToGet if prices changed
  if (patch.PricePaid != null || patch.Less != null) {
    const paid = Number(merged.PricePaid) || 0;
    const less = Number(merged.Less) || 0;
    if (patch.ToGet == null || patch.ToGet === '') merged.ToGet = paid - less;
  }

  const sh = getSheet('Orders');
  const rowNum = existing._row;
  const values = CONFIG.ORDERS_HEADERS.map(h => merged[h] != null ? merged[h] : '');
  sh.getRange(rowNum, 1, 1, CONFIG.ORDERS_HEADERS.length).setValues([values]);

  const notifyRefund = prevStatus !== 'Got Refund' && String(merged.OrderStatus) === 'Got Refund';
  if (notifyRefund) {
    try { notifyRefundDone(merged); } catch (err) { Logger.log(err); }
  }

  return ok({ order: sanitizeOrder(merged), notifyRefund: notifyRefund });
}

function requestDeal(p) {
  const sh = getOrCreateLogSheet('Queries');
  sh.appendRow([
    new Date(), 'deal_request', p.buyerName || '', p.buyerMobile || '',
    p.buyerUserId || '', p.dealId || '', p.dealName || '', p.message || ''
  ]);

  const adminWa = getScriptProp('ADMIN_WHATSAPP') || CONFIG.ADMIN_WHATSAPP;
  const msg =
    '🛒 *Deal Request*\n' +
    'Buyer: ' + (p.buyerName || '') + '\n' +
    'Mobile: ' + (p.buyerMobile || '') + '\n' +
    'UserID: ' + (p.buyerUserId || '') + '\n' +
    'Deal: ' + (p.dealName || p.dealId || '') + '\n' +
    'Time: ' + new Date().toLocaleString('en-IN');
  try { callMeBot(adminWa, msg); } catch (e) { Logger.log(e); }

  return ok({ request: p, whatsappAdmin: true });
}

function raiseQuery(p) {
  const sh = getOrCreateLogSheet('Queries');
  sh.appendRow([
    new Date(), 'query', p.buyerName || '', '', p.buyerUserId || '',
    p.orderNo || '', '', p.message || ''
  ]);
  const adminWa = getScriptProp('ADMIN_WHATSAPP') || CONFIG.ADMIN_WHATSAPP;
  const msg =
    '❓ *Buyer Query*\n' +
    'From: ' + (p.buyerName || p.buyerUserId || '') + '\n' +
    'Order: #' + (p.orderNo || '—') + '\n' +
    'Message: ' + (p.message || '');
  try { callMeBot(adminWa, msg); } catch (e) { Logger.log(e); }
  return ok(p);
}

function getOrCreateLogSheet(name) {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(['Timestamp', 'Type', 'BuyerName', 'BuyerMobile', 'BuyerUserID', 'OrderOrDealId', 'DealName', 'Message']);
  }
  return sh;
}

function getQueries() {
  const ss = getSpreadsheet();
  const sh = ss.getSheetByName('Queries');
  if (!sh || sh.getLastRow() < 2) return [];
  return sheetToObjects('Queries').reverse();
}

function sendWhatsAppAction(p) {
  const phone = String(p.phone || '').replace(/\D/g, '');
  const message = String(p.message || '');
  if (!phone || !message) return fail('phone and message required');
  const res = callMeBot(phone, message);
  return ok({ sent: true, result: res });
}

function updateSettings(p) {
  if (p.adminWhatsApp) setScriptProp('ADMIN_WHATSAPP', String(p.adminWhatsApp).replace(/\D/g, ''));
  if (p.adminPassword) setScriptProp('ADMIN_PASSWORD', String(p.adminPassword));
  if (p.callmebotKey) setScriptProp('CALLMEBOT_APIKEY', String(p.callmebotKey));
  return ok({
    adminWhatsApp: getScriptProp('ADMIN_WHATSAPP') || CONFIG.ADMIN_WHATSAPP
  });
}

function addAccount(acc) {
  const sh = getSheet('Accounts');
  if (sh.getLastRow() === 0) sh.appendRow(['UserID', 'Name', 'Mobile', 'WhatsApp', 'Role']);
  sh.appendRow([
    acc.UserID || '', acc.Name || '', acc.Mobile || '', acc.WhatsApp || '', acc.Role || 'buyer'
  ]);
  return ok(sheetToObjects('Accounts'));
}

function addMediator(m) {
  const sh = getSheet('Mediator');
  if (sh.getLastRow() === 0) sh.appendRow(['Name', 'Contact', 'WhatsApp']);
  sh.appendRow([m.Name || '', m.Contact || '', m.WhatsApp || '']);
  return ok(sheetToObjects('Mediator'));
}

function uploadScreenshot(p) {
  if (!p.base64) return fail('No image data');
  const blob = Utilities.newBlob(
    Utilities.base64Decode(p.base64),
    p.mimeType || 'image/jpeg',
    p.name || ('screenshot_' + Date.now() + '.jpg')
  );
  let folder;
  if (CONFIG.DRIVE_FOLDER_ID) {
    folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  } else {
    const folders = DriveApp.getFoldersByName('DealKart_Screenshots');
    folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('DealKart_Screenshots');
  }
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return ok({ url: file.getUrl(), fileId: file.getId(), viewUrl: 'https://drive.google.com/uc?id=' + file.getId() });
}

// ═══════════════ WHATSAPP (CallMeBot) ═══════════════
function callMeBot(phone, text) {
  const apikey = getScriptProp('CALLMEBOT_APIKEY') || CONFIG.CALLMEBOT_APIKEY;
  const clean = String(phone).replace(/\D/g, '');
  if (!clean) return 'no phone';
  const url = 'https://api.callmebot.com/whatsapp.php'
    + '?phone=' + encodeURIComponent(clean)
    + '&text=' + encodeURIComponent(text)
    + '&apikey=' + encodeURIComponent(apikey);
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return resp.getContentText();
}

function notifyOrderCreated(order) {
  const adminWa = getScriptProp('ADMIN_WHATSAPP') || CONFIG.ADMIN_WHATSAPP;

  // Buyer message
  let buyerPhone = '';
  if (order.FriendUserID) {
    const accounts = sheetToObjects('Accounts');
    const buyer = accounts.find(a => String(a.UserID) === String(order.FriendUserID));
    if (buyer) buyerPhone = buyer.WhatsApp || buyer.Mobile || '';
  }
  if (!buyerPhone && order.DealContactNo) buyerPhone = order.DealContactNo;

  if (buyerPhone) {
    const cashback = order.ForWhom === 'Friend' && order.FriendLess
      ? order.FriendLess
      : order.Less;
    const msg =
      '✅ *Order Confirmed — DealKart*\n' +
      'Order No: *#' + order.OrderNo + '*\n' +
      'Product: ' + order.ProductName + '\n' +
      'Platform: ' + order.OrderedPlatform + '\n' +
      'Paid: ₹' + order.PricePaid + '\n' +
      'Cashback: ₹' + cashback + '\n' +
      'Date: ' + order.OrderDate + '\n' +
      'Track: Use Order #' + order.OrderNo + ' on DealKart';
    callMeBot(buyerPhone, msg);
  }

  // Admin message
  const adminMsg =
    '📦 *New Order #' + order.OrderNo + '*\n' +
    'Product: ' + order.ProductName + '\n' +
    'Platform: ' + order.OrderedPlatform + '\n' +
    'Account: ' + order.AccountName + '\n' +
    'Mediator: ' + order.MediatorName + '\n' +
    'Paid: ₹' + order.PricePaid + ' | Less: ₹' + order.Less + ' | ToGet: ₹' + order.ToGet + '\n' +
    'For: ' + order.ForWhom + (order.FriendUserID ? ' (' + order.FriendUserID + ')' : '') + '\n' +
    'Contact: ' + (order.DealContactNo || '—') + '\n' +
    'Platform OID: ' + (order.PlatformOrderID || '—');
  callMeBot(adminWa, adminMsg);
}

function notifyRefundDone(order) {
  let buyerPhone = '';
  if (order.FriendUserID) {
    const accounts = sheetToObjects('Accounts');
    const buyer = accounts.find(a => String(a.UserID) === String(order.FriendUserID));
    if (buyer) buyerPhone = buyer.WhatsApp || buyer.Mobile || '';
  }
  if (!buyerPhone && order.DealContactNo) buyerPhone = order.DealContactNo;
  if (!buyerPhone) return;

  const amount = order.ActualGot || order.ToGet || order.FriendLess || order.Less;
  const msg =
    '💰 *Cashback Received — DealKart*\n' +
    'Order No: *#' + order.OrderNo + '*\n' +
    'Product: ' + order.ProductName + '\n' +
    'Cashback: *₹' + amount + '*\n' +
    'Date: ' + (order.RefundDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')) + '\n' +
    'Payment: ' + (order.PaymentMethod || '—') + '\n' +
    'Thank you for using DealKart!';
  callMeBot(buyerPhone, msg);
}

// ═══════════════ ONE-TIME SHEET SETUP ═══════════════
/**
 * Run this once from the Apps Script editor to create tabs + headers + sample rows.
 */
function setupSheetTemplate() {
  const ss = getSpreadsheet();

  // Orders
  let sh = ss.getSheetByName('Orders') || ss.insertSheet('Orders');
  sh.clear();
  sh.appendRow(CONFIG.ORDERS_HEADERS);
  sh.setFrozenRows(1);

  // Accounts
  sh = ss.getSheetByName('Accounts') || ss.insertSheet('Accounts');
  sh.clear();
  sh.appendRow(['UserID', 'Name', 'Mobile', 'WhatsApp', 'Role']);
  sh.appendRow(['B_Rahul_04', 'Rahul Kumar', '9876543210', '919876543210', 'buyer']);
  sh.appendRow(['B_Priya_02', 'Priya Singh', '9876501234', '919876501234', 'buyer']);
  sh.appendRow(['A_Reviewer_01', 'Reviewer Account 1', '9000000001', '919000000001', 'account']);
  sh.appendRow(['A_Reviewer_02', 'Reviewer Account 2', '9000000002', '919000000002', 'account']);
  sh.setFrozenRows(1);

  // Mediator
  sh = ss.getSheetByName('Mediator') || ss.insertSheet('Mediator');
  sh.clear();
  sh.appendRow(['Name', 'Contact', 'WhatsApp']);
  sh.appendRow(['Nitesh', '9800000001', '919800000001']);
  sh.appendRow(['Panda', '9800000002', '919800000002']);
  sh.appendRow(['Wolf Samrat', '9800000003', '919800000003']);
  sh.setFrozenRows(1);

  // Platform (platforms + statuses in columns)
  sh = ss.getSheetByName('Platform') || ss.insertSheet('Platform');
  sh.clear();
  sh.appendRow(['Platform', 'Status']);
  const platforms = ['Amazon', 'Flipkart', 'Meesho', 'Myntra', 'Blinkit', 'Amz_Empty', 'Amz_Rating', 'Fkt_Exchange'];
  const statuses = [
    'Order Placed', 'Product Received', 'Reviewed', 'Review Live',
    'Refund form filled', 'Got Refund', 'Review deleted', 'product not delivered',
    'Cancelled by Amazon', 'A/c block 4 review', 'under moderation issue',
    'Reviw not live/Cancelled', 'Returned to seller by amz', 'Error on this product'
  ];
  const max = Math.max(platforms.length, statuses.length);
  for (let i = 0; i < max; i++) {
    sh.appendRow([platforms[i] || '', statuses[i] || '']);
  }
  sh.setFrozenRows(1);

  // Dashboard — formulas summary
  sh = ss.getSheetByName('Dashboard') || ss.insertSheet('Dashboard');
  sh.clear();
  sh.getRange('A1').setValue('DealKart Dashboard (auto)');
  sh.getRange('A3').setValue('Total Orders');
  sh.getRange('B3').setFormula('=COUNTA(Orders!B2:B)');
  sh.getRange('A4').setValue('Got Refund');
  sh.getRange('B4').setFormula('=COUNTIF(Orders!W2:W,"Got Refund")');
  sh.getRange('A5').setValue('Total Cashback (ActualGot)');
  sh.getRange('B5').setFormula('=SUMIF(Orders!W2:W,"Got Refund",Orders!AC2:AC)');
  sh.getRange('A6').setValue('Active (not closed)');
  sh.getRange('B6').setFormula('=B3-B4');

  // Deals optional sheet
  sh = ss.getSheetByName('Deals') || ss.insertSheet('Deals');
  sh.clear();
  sh.appendRow(['id', 'ProductName', 'Platform', 'PricePaid', 'Less', 'ToGet', 'MediatorName', 'Notes', 'Active']);
  sh.appendRow(['D1', 'Samsung 25W Type-C Fast Charger', 'Amazon', 699, 350, 349, 'Nitesh', 'Limited stock', true]);
  sh.appendRow(['D2', 'Milton Thermosteel 1L Flask', 'Flipkart', 899, 400, 499, 'Panda', '', true]);
  sh.appendRow(['D3', 'Havells Instanio 3L Instant Geyser', 'Amazon', 3299, 1200, 2099, 'Wolf Samrat', 'Review required', true]);
  sh.setFrozenRows(1);

  SpreadsheetApp.flush();
  Logger.log('Sheet template ready: ' + ss.getUrl());
}
