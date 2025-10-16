# Google Drive Video Player - CORS Solution

## Problem / समस्या

Google Drive के videos को directly HTML5 `<video>` tag में load करने पर **CORS error** आता है:
```
Access to video at 'https://drive.google.com/uc?export=download&id=...' 
from origin 'http://localhost:8080' has been blocked by CORS policy
```

## Solution / समाधान

हमने एक **hybrid approach** बनाया है जो:
1. एक iframe के अंदर HTML5 video player रखता है
2. iframe में एक custom HTML page load होता है
3. उस page में Google Drive video embed होता है
4. Parent window और iframe के बीच postMessage API से communication होता है

## Architecture / संरचना

```
┌─────────────────────────────────────────┐
│  UniversalVideoPlayer (Parent)         │
│  ┌───────────────────────────────────┐  │
│  │  GoogleDrivePlayer (Component)   │  │
│  │  ┌─────────────────────────────┐ │  │
│  │  │  iframe (data URL)          │ │  │
│  │  │  ┌───────────────────────┐  │ │  │
│  │  │  │  HTML5 Video Element  │  │ │  │
│  │  │  │  (Google Drive video) │  │ │  │
│  │  │  └───────────────────────┘  │ │  │
│  │  │         ↕️ postMessage       │ │  │
│  │  └─────────────────────────────┘ │  │
│  │  Custom Controls Overlay          │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## How It Works / कैसे काम करता है

### 1. GoogleDrivePlayer Component

यह component एक iframe बनाता है जिसमें custom HTML content है:

```typescript
<iframe src={`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`} />
```

### 2. iframe HTML Content

iframe के अंदर का HTML:
```html
<video id="player" controls crossorigin="anonymous">
  <source src="https://drive.google.com/uc?id=${fileId}&export=stream" />
  <source src="https://www.googleapis.com/drive/v3/files/${fileId}?alt=media" />
  <source src="https://docs.google.com/uc?id=${fileId}&export=download" />
</video>
```

**Multiple sources क्यों?**
- अलग-अलग Google Drive URLs different conditions में काम करते हैं
- Browser automatically पहला working source select करता है

### 3. postMessage Communication

#### Parent → iframe (Commands):
```javascript
// Play video
iframe.postMessage({ action: 'play' }, '*');

// Pause video
iframe.postMessage({ action: 'pause' }, '*');

// Seek to time
iframe.postMessage({ action: 'seek', value: 120 }, '*');

// Get current time
iframe.postMessage({ action: 'getCurrentTime' }, '*');
```

#### iframe → Parent (Events):
```javascript
// Time update
window.parent.postMessage({
  source: 'google-drive-player',
  type: 'timeupdate',
  time: video.currentTime
}, '*');

// Duration loaded
window.parent.postMessage({
  source: 'google-drive-player',
  type: 'durationchange',
  totalTime: video.duration
}, '*');

// Play/Pause events
window.parent.postMessage({
  source: 'google-drive-player',
  type: 'play' // or 'pause'
}, '*');
```

### 4. Time Tracking

**Automatic time updates:**
```typescript
// iframe में video element पर event listener
video.addEventListener('timeupdate', () => {
  window.parent.postMessage({
    source: 'google-drive-player',
    type: 'timeupdate',
    time: video.currentTime
  }, '*');
});
```

**Polling mechanism (backup):**
```typescript
// अगर video play हो रहा है तो हर 500ms में time request करो
useEffect(() => {
  if (isReady && isPlaying) {
    const interval = setInterval(() => {
      sendMessageToIframe('getCurrentTime');
    }, 500);
    return () => clearInterval(interval);
  }
}, [isReady, isPlaying]);
```

## Features / विशेषताएं

✅ **Real-time Time Tracking**
- Video चलते समय हर moment current time update होता है
- `onTimeUpdate` callback से parent component को notify होता है

✅ **Custom Controls**
- Play/Pause button
- Volume control with slider
- Mute/Unmute toggle
- Seek bar for jumping to any time
- Time display (current/total)
- Fullscreen mode

✅ **Timestamp Feedback**
- Comments के साथ accurate timestamp save होता है
- Timestamp पर click करने से video उस moment पर jump करता है

✅ **CORS Issue Solved**
- iframe के अंदर video load होने से CORS problem नहीं आती
- Same-origin policy bypass हो जाती है (iframe में data URL है)

## API Methods / API तरीके

### seekTo(seconds)
Video को किसी specific time पर jump करता है:
```typescript
playerRef.current.seekTo(120); // Jump to 2:00
```

### getCurrentTime()
Current video time return करता है:
```typescript
const time = playerRef.current.getCurrentTime(); // Returns seconds
```

## Usage Example / उपयोग का उदाहरण

```tsx
import { useRef } from 'react';
import { GoogleDrivePlayer } from './GoogleDrivePlayer';

function VideoPreview() {
  const playerRef = useRef<any>(null);
  
  const handleTimeUpdate = (time: number) => {
    console.log('Current time:', time);
  };
  
  const handleSeek = () => {
    // Jump to 2 minutes
    playerRef.current?.seekTo(120);
  };
  
  return (
    <GoogleDrivePlayer
      ref={playerRef}
      fileId="1oEfha3o_rCgpfbY67LYbj-OJf1mhWhaG"
      onTimeUpdate={handleTimeUpdate}
    />
  );
}
```

## Integration with UniversalVideoPlayer

`UniversalVideoPlayer` ab automatically detect करता है ki video Google Drive ka hai:

```tsx
// Platform detection
if (url.includes("drive.google.com")) {
  setPlatform("google-drive");
}

// Rendering
if (platform === 'google-drive') {
  const fileId = extractGoogleDriveId(url);
  return (
    <GoogleDrivePlayer
      ref={googleDrivePlayerRef}
      fileId={fileId}
      onTimeUpdate={setCurrentTime}
    />
  );
}
```

## Benefits / फायदे

1. **No CORS Errors**: iframe approach se CORS issues resolve ho jate hain
2. **HTML5 Control**: Full JavaScript control over video playback
3. **Time Tracking**: YouTube jaisa accurate time tracking
4. **Custom UI**: Apne design ke according controls
5. **Same Interface**: YouTube aur Google Drive dono same API use karte hain

## Testing / टेस्टिंग

### Prerequisites:
1. Google Drive में video upload karo
2. File ko "Anyone with the link" sharing setting do
3. Link copy karo (format: `https://drive.google.com/file/d/FILE_ID/view`)

### Test Steps:
1. ✅ Video preview page kholo
2. ✅ Video play honi chahiye (no CORS error)
3. ✅ Custom controls visible hone chahiye
4. ✅ Time tracking real-time update hona chahiye
5. ✅ Feedback add karo with timestamp
6. ✅ Timestamp par click karo - video jump honi chahiye
7. ✅ Play/Pause, Volume, Seek sab controls test karo

## Troubleshooting / समस्या निवारण

### Video Load Nahi Ho Rahi
- Check: File public hai ya nahi
- Check: File ID sahi hai ya nahi
- Check: Browser console me koi error to nahi

### Time Tracking Nahi Ho Raha
- Check: Video actually play ho rahi hai
- Check: Browser console me postMessage events aa rahe hain
- Fallback: Polling mechanism automatically retry karti hai

### Controls Kaam Nahi Kar Rahe
- Check: iframe ready hai (loadedmetadata event)
- Check: postMessage properly send ho raha hai
- Debug: Console me message events check karo

## Comparison with YouTube

| Feature | YouTube | Google Drive (New) |
|---------|---------|-------------------|
| Player Type | iframe (YouTube API) | iframe (Custom HTML5) |
| Time Tracking | ✅ postMessage | ✅ postMessage |
| Accuracy | ✅ Excellent | ✅ Excellent |
| Custom Controls | ❌ YouTube UI | ✅ Custom UI |
| CORS Issues | ❌ None | ❌ Solved |
| Implementation | Unchanged | New |

**Result**: Ab dono platforms me same level ka time tracking available hai! 🎉
