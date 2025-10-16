# 📱 Mobile Access Setup Guide | मोबाइल एक्सेस सेटअप गाइड

## English Instructions

### Quick Setup (3 Steps)

#### Step 1: Configure Firewall (Run as Administrator)
```powershell
.\setup-mobile-access.ps1
```

#### Step 2: Start Servers
```bash
# Start both frontend and backend
npm run start
```

#### Step 3: Access from Mobile
Open your mobile browser and visit:
- **Frontend App**: `http://192.168.1.8:8080`
- **API Status**: `http://192.168.1.8:3001/api/health`

---

### Important Requirements

1. ✅ **Same WiFi Network**: Both computer and mobile must be connected to the same WiFi
2. ✅ **Firewall Configured**: Run the PowerShell script as Administrator
3. ✅ **Servers Running**: Both frontend (8080) and backend (3001) must be running

---

### Troubleshooting

#### "Failed to fetch" Error
- ✅ Check if backend server is running: `http://192.168.1.8:3001/api/health`
- ✅ Verify firewall rules are added
- ✅ Confirm both devices are on same WiFi

#### Cannot Connect at All
- ✅ Check your computer's IP address: `ipconfig`
- ✅ Update `.env` file with correct IP address
- ✅ Restart both servers after changing `.env`

#### Different IP Address
If your computer IP is different from `192.168.1.8`:
1. Run `ipconfig` to get your IPv4 address
2. Update `.env` file: `VITE_API_URL=http://YOUR_IP:3001/api`
3. Update `src/server/app.ts` CORS origins
4. Restart servers

---

## हिंदी निर्देश

### त्वरित सेटअप (3 स्टेप्स)

#### स्टेप 1: फायरवॉल कॉन्फ़िगर करें (Administrator के रूप में चलाएं)
```powershell
.\setup-mobile-access.ps1
```

#### स्टेप 2: सर्वर्स स्टार्ट करें
```bash
# Frontend और Backend दोनों स्टार्ट करें
npm run start
```

#### स्टेप 3: मोबाइल से एक्सेस करें
अपने मोबाइल ब्राउज़र में खोलें:
- **Frontend App**: `http://192.168.1.8:8080`
- **API Status**: `http://192.168.1.8:3001/api/health`

---

### जरूरी आवश्यकताएं

1. ✅ **Same WiFi Network**: कंप्यूटर और मोबाइल दोनों एक ही WiFi से जुड़े होने चाहिए
2. ✅ **Firewall Configured**: PowerShell script को Administrator के रूप में चलाएं
3. ✅ **Servers Running**: Frontend (8080) और Backend (3001) दोनों चल रहे होने चाहिए

---

### समस्या समाधान

#### "Failed to fetch" Error आ रहा है
- ✅ देखें कि backend server चल रहा है: `http://192.168.1.8:3001/api/health`
- ✅ Firewall rules जोड़े गए हैं या नहीं जांचें
- ✅ दोनों devices same WiFi पर हैं या नहीं confirm करें

#### Connect ही नहीं हो रहा
- ✅ अपने computer का IP address देखें: `ipconfig`
- ✅ `.env` file में सही IP address update करें
- ✅ `.env` बदलने के बाद servers restart करें

#### IP Address अलग है
अगर आपके computer का IP `192.168.1.8` से अलग है:
1. `ipconfig` चलाकर अपना IPv4 address देखें
2. `.env` file update करें: `VITE_API_URL=http://आपका_IP:3001/api`
3. `src/server/app.ts` में CORS origins update करें
4. Servers restart करें

---

## Configuration Files Modified

### `.env`
```bash
VITE_API_URL=http://192.168.1.8:3001/api
PORT=3001
NODE_ENV=development
```

### `src/server/app.ts`
```typescript
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:8080',
    'http://192.168.1.8:8080',
    'http://172.27.160.1:8080'
  ],
  credentials: true,
}));
```

### `src/server/index.ts`
```typescript
// Listen on all network interfaces
const server = app.listen(Number(PORT), '0.0.0.0', () => {
  // Server logs...
});
```

---

## Network Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 8080 | http://192.168.1.8:8080 |
| Backend (Express) | 3001 | http://192.168.1.8:3001 |
| WebSocket | 3001 | ws://192.168.1.8:3001 |

---

## Security Notes

⚠️ **Important**: This setup is for development only!
- Only use on trusted private networks
- Never expose these ports to the internet
- Use proper authentication in production

---

## Additional Commands

### Check if servers are running
```bash
# Check backend
curl http://192.168.1.8:3001/api/health

# Check frontend (from browser)
# Visit: http://192.168.1.8:8080
```

### View firewall rules
```powershell
Get-NetFirewallRule -DisplayName "*Xrozen*"
```

### Remove firewall rules
```powershell
Remove-NetFirewallRule -DisplayName "Xrozen Vite Dev Server"
Remove-NetFirewallRule -DisplayName "Xrozen Backend API Server"
```

---

## Support

अगर कोई समस्या आए तो:
1. Server logs देखें
2. Browser console में errors देखें
3. Network tab में API calls check करें
4. `ipconfig` से IP address verify करें
