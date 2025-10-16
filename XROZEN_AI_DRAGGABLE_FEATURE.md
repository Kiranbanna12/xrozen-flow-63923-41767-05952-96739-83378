# 🤖 XrozenAI Draggable Floating Assistant

## ✨ Features

### 1. **Draggable Floating Button**
- **स्क्रीन पर कहीं भी Move करें**: AI assistant button को click करके drag करें और screen पर कहीं भी रख सकते हैं
- **Position Automatically Save**: आपकी पसंदीदा position automatically save हो जाती है और अगली बार वहीं दिखेगी
- **Visual Feedback**: Dragging के time cursor `grabbing` में बदल जाता है और एक grip icon दिखता है

### 2. **Show/Hide Toggle**
- **Settings से Control**: Settings page में जाकर AI Assistant को show/hide कर सकते हैं
- **Popup में Settings**: AI popup window में भी settings button है जहाँ से direct toggle कर सकते हैं
- **Persistent Settings**: आपकी preference localStorage में save हो जाती है

### 3. **Smart Positioning**
- **Viewport Bounds**: Button screen की boundaries से बाहर नहीं जा सकता
- **Default Position**: पहली बार bottom-right corner में दिखता है
- **Responsive**: Screen size change होने पर भी properly positioned रहता है

## 🎯 Usage

### Button को Move करना:
1. AI assistant button पर **click करें और hold करें**
2. Mouse को drag करके button को जहाँ चाहें move करें
3. Release करने पर position save हो जाती है

### AI Assistant को Hide करना:

#### Method 1: Settings Page से
1. Sidebar में **Settings** पर click करें
2. **AI Assistant** section में जाएं
3. **"Show Floating AI Button"** toggle को OFF करें

#### Method 2: AI Popup से
1. AI assistant button पर click करके popup open करें
2. Header में **Settings (⚙️)** icon पर click करें
3. **"Show AI Button"** toggle को OFF करें

### Fir se Enable करना:
- Settings page में जाकर toggle को ON करें
- या Sidebar में **XrozenAI** menu item पर click करके full page access करें

## 🔧 Technical Implementation

### Component: `src/components/ai/XrozenAI.tsx`

#### Key Features:
1. **State Management**:
   ```typescript
   const [position, setPosition] = useState<Position>(() => {
     const saved = localStorage.getItem('xrozen-ai-position');
     return saved ? JSON.parse(saved) : { x: window.innerWidth - 100, y: window.innerHeight - 180 };
   });
   ```

2. **Drag Handler**:
   - `onMouseDown`: Drag start करता है और offset calculate करता है
   - `onMouseMove`: Position update करता है viewport bounds के अंदर
   - `onMouseUp`: Dragging stop करता है

3. **Visibility Control**:
   - localStorage में `xrozen-ai-visible` key से store होता है
   - Settings page से toggle करने पर StorageEvent dispatch होता है
   - Real-time update के लिए event listener लगा है

### Settings Integration: `src/pages/Settings.tsx`

AI Assistant card जोड़ा गया है जिसमें:
- Toggle switch for show/hide
- Feature description
- Usage instructions
- Toast notifications for user feedback

## 📱 User Experience

### Visual Indicators:
- **Grip Icon**: Hover करने पर छोटा grip icon दिखता है
- **Cursor Change**: Dragging के time `grabbing` cursor
- **Smooth Transitions**: Hover effects के साथ smooth scale animation
- **Tooltip**: "Drag to move • Click to open XrozenAI"

### Accessibility:
- Keyboard accessible (click to open)
- Clear visual feedback
- Intuitive controls
- Help text in settings

## 🚀 Benefits

1. **Personalization**: हर user अपनी preference के अनुसार button position set कर सकता है
2. **Flexibility**: Screen के किसी भी area में रख सकते हैं जहाँ comfortable हो
3. **Privacy**: जरूरत न हो तो hide कर सकते हैं
4. **Persistence**: Settings automatically save हो जाती हैं
5. **Always Accessible**: Hide होने के बाद भी sidebar से access कर सकते हैं

## 💡 Tips

1. **Best Position**: अपने workflow के हिसाब से button को ऐसे position करें जहाँ बार-बार access करना आसान हो
2. **Don't Block Important Content**: Button को ऐसे area में रखें जो important content को cover न करे
3. **Multiple Screens**: अगर multiple screens use करते हैं तो हर screen size के लिए position adjust हो जाता है
4. **Quick Access**: Frequently used features के पास रखने से productivity बढ़ती है

## 🔮 Future Enhancements (Possible)

- Button size customization
- Multiple AI assistants (different contexts)
- Keyboard shortcuts for positioning
- Snap to edges feature
- Theme-based appearance changes
- Custom icons/colors

---

**Made with ❤️ for Xrozen Workflow**
