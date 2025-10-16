# 🤖 XrozenAI ड्रैग करने योग्य फ्लोटिंग असिस्टेंट

## ✨ विशेषताएं

### 1. **ड्रैग करने योग्य फ्लोटिंग बटन**
- **स्क्रीन पर कहीं भी ले जाएं**: AI assistant button को click करके drag करें और screen पर कहीं भी रख सकते हैं
- **Position अपने आप Save**: आपकी पसंदीदा position automatically save हो जाती है और अगली बार वहीं दिखेगी
- **Visual Feedback**: Dragging के समय cursor `grabbing` में बदल जाता है और एक grip icon दिखता है

### 2. **Show/Hide टॉगल**
- **Settings से नियंत्रण**: Settings page में जाकर AI Assistant को show/hide कर सकते हैं
- **Popup में Settings**: AI popup window में भी settings button है जहाँ से सीधे toggle कर सकते हैं
- **Persistent Settings**: आपकी preference localStorage में save हो जाती है

### 3. **स्मार्ट पोजिशनिंग**
- **Viewport Bounds**: Button screen की boundaries से बाहर नहीं जा सकता
- **Default Position**: पहली बार bottom-right corner में दिखता है
- **Responsive**: Screen size बदलने पर भी properly positioned रहता है

## 🎯 उपयोग

### Button को Move करना:
1. AI assistant button पर **click करें और hold करें**
2. Mouse को drag करके button को जहाँ चाहें move करें
3. Release करने पर position save हो जाती है

### AI Assistant को छिपाना (Hide):

#### तरीका 1: Settings Page से
1. Sidebar में **Settings** पर click करें
2. **AI Assistant** section में जाएं
3. **"Show Floating AI Button"** toggle को OFF करें

#### तरीका 2: AI Popup से
1. AI assistant button पर click करके popup खोलें
2. Header में **Settings (⚙️)** icon पर click करें
3. **"Show AI Button"** toggle को OFF करें

### फिर से Enable करना:
- Settings page में जाकर toggle को ON करें
- या Sidebar में **XrozenAI** menu item पर click करके full page access करें

## 🔧 तकनीकी कार्यान्वयन

### Component: `src/components/ai/XrozenAI.tsx`

#### मुख्य विशेषताएं:
1. **State Management**:
   ```typescript
   const [position, setPosition] = useState<Position>(() => {
     const saved = localStorage.getItem('xrozen-ai-position');
     return saved ? JSON.parse(saved) : { x: window.innerWidth - 100, y: window.innerHeight - 180 };
   });
   ```

2. **Drag Handler**:
   - `onMouseDown`: Drag शुरू करता है और offset calculate करता है
   - `onMouseMove`: Position update करता है viewport bounds के अंदर
   - `onMouseUp`: Dragging बंद करता है

3. **Visibility Control**:
   - localStorage में `xrozen-ai-visible` key से store होता है
   - Settings page से toggle करने पर StorageEvent dispatch होता है
   - Real-time update के लिए event listener लगा है

### Settings Integration: `src/pages/Settings.tsx`

AI Assistant card जोड़ा गया है जिसमें:
- Toggle switch for show/hide
- Feature description का विवरण
- उपयोग के निर्देश
- User feedback के लिए toast notifications

## 📱 उपयोगकर्ता अनुभव

### Visual संकेतक:
- **Grip Icon**: Hover करने पर छोटा grip icon दिखता है जो बताता है कि आप इसे drag कर सकते हैं
- **Cursor Change**: Dragging के समय `grabbing` cursor दिखता है
- **Smooth Transitions**: Hover effects के साथ smooth scale animation
- **Tooltip**: "Drag to move • Click to open XrozenAI"

### सुलभता (Accessibility):
- Keyboard से accessible (click to open)
- स्पष्ट visual feedback
- सहज नियंत्रण
- Settings में help text

## 🚀 लाभ

1. **व्यक्तिगतकरण (Personalization)**: हर user अपनी preference के अनुसार button position set कर सकता है
2. **लचीलापन (Flexibility)**: Screen के किसी भी area में रख सकते हैं जहाँ comfortable हो
3. **गोपनीयता (Privacy)**: जरूरत न हो तो hide कर सकते हैं और बाद में फिर से enable कर सकते हैं
4. **स्थायित्व (Persistence)**: Settings automatically save हो जाती हैं, बार-बार set करने की जरूरत नहीं
5. **हमेशा उपलब्ध (Always Accessible)**: Hide होने के बाद भी sidebar से access कर सकते हैं

## 💡 सुझाव

1. **Best Position**: अपने workflow के हिसाब से button को ऐसे position करें जहाँ बार-बार access करना आसान हो
2. **महत्वपूर्ण Content को Block न करें**: Button को ऐसे area में रखें जो important content को cover न करे
3. **Multiple Screens**: अगर multiple screens use करते हैं तो हर screen size के लिए position adjust हो जाता है
4. **Quick Access**: Frequently used features के पास रखने से productivity बढ़ती है
5. **Experiment करें**: Different positions try करें और देखें कौन सा आपके लिए सबसे अच्छा काम करता है

## 📋 उपयोग के उदाहरण

### Scenario 1: वीडियो एडिटिंग के दौरान
- Screen के left side में button रखें
- Right side में video preview देखें
- जरूरत पड़ने पर quick AI access

### Scenario 2: Project Management
- Bottom-center में button रखें
- ऊपर की तरफ dashboard देखें
- नीचे से AI quickly access करें

### Scenario 3: Multi-tasking
- Screen के किनारे में रखें
- Middle में काम करें
- Peripheral vision में AI button रहे

## 🎨 Customization Options (Current)

- ✅ Position customization (drag anywhere)
- ✅ Show/Hide toggle
- ✅ Persistent settings
- ✅ Visual feedback
- ✅ Settings access from multiple places

## 🔮 भविष्य में संभावित सुधार

- Button size customization
- Multiple AI assistants (अलग-अलग contexts के लिए)
- Keyboard shortcuts for positioning
- Snap to edges feature (किनारों से automatically align)
- Theme-based appearance changes (dark/light mode)
- Custom icons/colors (अपना favorite icon choose करें)
- Quick action buttons (mini shortcuts)
- Voice activation (बोलकर activate करें)

## 🛠️ Troubleshooting

### अगर Button दिख नहीं रहा:
1. Settings में जाकर check करें कि toggle ON है
2. Browser refresh करें
3. LocalStorage clear करें और फिर से login करें

### अगर Position Save नहीं हो रहा:
1. Browser में localStorage enabled है check करें
2. Incognito/Private mode में नहीं हैं check करें
3. Browser console में errors check करें

### अगर Drag नहीं हो रहा:
1. Button पर properly click और hold करें
2. Screen boundaries के अंदर drag करें
3. Browser compatibility check करें

## 📞 Support

किसी भी समस्या या सुझाव के लिए:
- Settings में feedback दें
- XrozenAI से पूछें
- Support team से संपर्क करें

---

**❤️ के साथ Xrozen Workflow के लिए बनाया गया**

## 🎓 शिक्षा (Learning)

यह feature दर्शाता है कि कैसे:
- React hooks (`useState`, `useEffect`) का उपयोग करके stateful components बनाएं
- localStorage का उपयोग करके user preferences save करें
- Mouse events handle करें (drag and drop)
- Real-time updates के लिए StorageEvent का उपयोग करें
- Clean और maintainable code लिखें

---

**Version:** 1.0.0  
**Last Updated:** 2025-01-11  
**Author:** Xrozen Development Team
