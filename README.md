# DealKart — Personal Cashback Deal Tracker

**Owner:** San5616 (Admin/Mediator)  
**Repo:** [github.com/San5616/OrderDeals](https://github.com/San5616/OrderDeals)  
**Stack:** HTML/CSS/Vanilla JS · GitHub Pages · Google Sheets · Apps Script · CallMeBot WhatsApp

A personal web platform to track order deals taken from multiple mediators. Admin places orders using virtual reviewer accounts (sometimes for friends). Friends login and see only their orders. Public users can track by order number without login.

---

## Features

| Role | Capabilities |
|------|----------------|
| **Admin** | Full order form, edit status, WhatsApp panel, accounts/mediators, settings |
| **Buyer / Friend** | Login via mobile or UserID · own orders only · request deals · raise queries |
| **Public** | Track by Order No · 6-step timeline · no login |

- Client-side screenshot compress ≤200KB → Google Drive  
- WhatsApp alerts on order create, refund, deal request, manual send  
- Works **offline in Demo Mode** (localStorage) until Apps Script is connected  

---

## Files

```
DealKart/
├── index.html              Homepage + stats
├── deals.html              Public deals grid (prices blurred until login)
├── track.html              Public order tracking
├── login.html              Buyer + Admin tabs
├── buyer-dashboard.html    My orders / deals / queries
├── admin-dashboard.html    Order form, table, WhatsApp, settings
├── style.css               Dark blue premium theme
├── _config.js              API URL + session + demo API
├── Code.gs                 Google Apps Script backend
├── DealKart_Tracker.xlsx   Sheet template (import to Google Sheets)
└── README.md
```

---

## Quick start (Demo — no backend)

1. Open `index.html` in a browser (or serve the folder).  
2. **Admin login:** password `admin123`  
3. **Buyer login:** `B_Rahul_04` or mobile `9876543210`  
4. Seed data includes sample orders, deals, mediators.

> Demo data is stored in `localStorage` key `dealkart_demo_db`.

---

## Production setup (free)

### 1. Google Sheet

1. Create a new Google Spreadsheet.  
2. **Extensions → Apps Script**, paste contents of `Code.gs`.  
3. Set in `CONFIG` at top of `Code.gs`:
   - `ADMIN_PASSWORD`
   - `ADMIN_WHATSAPP` (e.g. `917004984949`)
   - `SHEET_ID` if the script is **not** bound to the sheet  
   - Optional: `DRIVE_FOLDER_ID` for screenshots  
4. Run function **`setupSheetTemplate`** once (authorize when prompted).  
   This creates tabs: `Orders`, `Accounts`, `Mediator`, `Platform`, `Dashboard`, `Deals`.  
5. Or import `DealKart_Tracker.xlsx` into Drive and convert to Sheets, then bind the script.

### 2. Deploy Web App

1. **Deploy → New deployment → Web app**  
   - Execute as: **Me**  
   - Who has access: **Anyone**  
2. Copy the Web App URL.  
3. In `_config.js`:

```js
API_URL: 'https://script.google.com/macros/s/XXXX/exec',
DEMO_MODE: false,  // optional flag; demo auto-disables when URL is set
```

### 3. CallMeBot WhatsApp

1. Save admin number in phone as contact.  
2. Send to **+34 644 66 25 23**:  
   `I allow callmebot to send me messages`  
3. Bot replies with your **apikey** — put it in `CONFIG.CALLMEBOT_APIKEY` or script property `CALLMEBOT_APIKEY`.  
4. Activate each buyer number the same way if they should receive messages.

### 4. GitHub Pages

```bash
# From this folder
git init
git add .
git commit -m "DealKart initial"
git branch -M main
git remote add origin https://github.com/San5616/OrderDeals.git
git push -u origin main
```

Then: **Settings → Pages → Deploy from branch `main` / root (or `/docs`)**.

Site URL: `https://san5616.github.io/OrderDeals/`

---

## Sheet structure

### Orders (main tracker)

Timestamp, OrderNo, OrderedPlatform, AccountName, ProductName, SellerName, ProductLink, PlatformOrderID, PricePaid, Less, ToGet, DealContactNo, MediatorName, OrderDate, FriendUserID, FriendLess, ForWhom, Notes, ReviewLink, MediatorOrderForm, MediatorRefundForm, OrderScreenshot, OrderStatus, DeliveryDate, ReviewDate, ReviewLiveDate, RefundFormDate, RefundDate, ActualGot, PaymentMethod

### Accounts

UserID · Name · Mobile · WhatsApp · Role (`buyer` | `account`)

### Mediator

Name · Contact · WhatsApp

### Platform

Platform names + Status values (two columns)

### Dashboard

Auto-summary formulas (read-only)

---

## Status flow (timeline)

1. Order Placed  
2. Product Received  
3. Reviewed  
4. Review Live  
5. Refund form filled  
6. Got Refund  

Plus exception statuses (cancelled, moderation, A/c block, etc.).

---

## WhatsApp triggers

| Trigger | Recipient |
|---------|-----------|
| Order form submitted | Buyer + Admin |
| Status → Got Refund | Buyer |
| Buyer requests deal | Admin |
| Manual panel send | Any number |

---

## Security notes

- Session is **client `sessionStorage` only** (as designed for this lightweight stack).  
- Change the default admin password immediately.  
- Apps Script is the real gate for admin password & data writes when live.  
- Do not commit real API keys/passwords if the repo is public — use Script Properties.

---

## Design

- Theme: Dark Blue premium (`#070b14` / `#0d1526` / accent `#3b82f6`)  
- Fonts: Inter + JetBrains Mono  
- Mobile-first, responsive  

---

## Pending checklist

- [x] Complete buyer-dashboard.html  
- [x] Complete admin-dashboard.html (Order Form + WhatsApp)  
- [ ] Connect Google Sheet ID in Code.gs  
- [ ] Deploy Apps Script → paste URL in `_config.js`  
- [ ] Upload to github.com/San5616/OrderDeals  
- [ ] Activate CallMeBot for +917004984949  
- [ ] Test full flow: Order → WhatsApp → Track → Status update  

---

MIT · Built for personal use by San5616
