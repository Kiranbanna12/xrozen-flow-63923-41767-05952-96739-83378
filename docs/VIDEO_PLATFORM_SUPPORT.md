# Quick Reference: Video Platform Support

## Supported Platforms

### 1. YouTube ✅
- **Method**: iframe embed with YouTube IFrame API
- **Time Tracking**: postMessage API
- **Features**: All YouTube player features
- **Status**: ✅ Working (unchanged from before)

### 2. Google Drive ✅ (NEW)
- **Method**: HTML5 video element
- **Time Tracking**: Native `currentTime` property
- **URL Format Required**: 
  - Input: `https://drive.google.com/file/d/FILE_ID/view`
  - Converted to: `https://drive.google.com/uc?export=download&id=FILE_ID`
- **Requirements**: File must be set to "Anyone with the link can view"
- **Status**: ✅ Now supports time tracking

### 3. OneDrive ✅ (NEW)
- **Method**: HTML5 video element
- **Time Tracking**: Native `currentTime` property
- **URL Formats Supported**:
  - OneDrive: `https://onedrive.live.com/...`
  - SharePoint: `https://xxx.sharepoint.com/...`
- **Requirements**: File must have public sharing enabled
- **Status**: ✅ Now supports time tracking

### 4. Dropbox ✅ (IMPROVED)
- **Method**: HTML5 video element
- **Time Tracking**: Native `currentTime` property
- **URL Format Required**:
  - Input: `https://www.dropbox.com/s/xyz?dl=0`
  - Converted to: `https://dl.dropboxusercontent.com/s/xyz?raw=1`
- **Requirements**: File must have public link
- **Status**: ✅ Time tracking enabled

### 5. Vimeo ✅
- **Method**: iframe embed with Vimeo Player API
- **Time Tracking**: postMessage API
- **Status**: ✅ Working

### 6. Direct Video Files ✅
- **Method**: HTML5 video element
- **Supported formats**: .mp4, .webm, .mov
- **Time Tracking**: Native `currentTime` property
- **Status**: ✅ Working

## Feature Comparison

| Feature | YouTube | Google Drive | OneDrive | Dropbox | Direct |
|---------|---------|--------------|----------|---------|--------|
| Time Tracking | ✅ | ✅ | ✅ | ✅ | ✅ |
| Seek/Jump | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timestamp Feedback | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom Controls | ❌ | ✅ | ✅ | ✅ | ✅ |
| Volume Control | YouTube | ✅ | ✅ | ✅ | ✅ |
| Fullscreen | ✅ | ✅ | ✅ | ✅ | ✅ |

## API Methods

Both methods available via ref:

```typescript
const playerRef = useRef();

// Seek to specific time
playerRef.current.seekTo(120); // Jump to 2:00

// Get current time
const time = playerRef.current.getCurrentTime(); // Returns seconds
```

## Event Callbacks

```typescript
<UniversalVideoPlayer
  url="video-url"
  onTimeUpdate={(time) => {
    console.log('Current time:', time);
  }}
/>
```

## Implementation Details

### YouTube (iframe + postMessage)
```typescript
<iframe src="youtube.com/embed/VIDEO_ID?enablejsapi=1" />
// Uses postMessage to communicate
iframeRef.current.contentWindow.postMessage(
  { event: 'command', func: 'getCurrentTime' },
  '*'
);
```

### Cloud Drives (HTML5 Video)
```typescript
<video 
  src={getDirectVideoUrl(url)}
  onTimeUpdate={handleTimeUpdate}
/>
// Direct access to time
videoRef.current.currentTime = 120;
const time = videoRef.current.currentTime;
```

## Testing Checklist

- [ ] YouTube video plays and tracks time ✅
- [ ] YouTube timestamp feedback works ✅
- [ ] Google Drive video plays with HTML5 player ✅
- [ ] Google Drive time tracking updates ✅
- [ ] Google Drive timestamp feedback works ✅
- [ ] OneDrive video plays with HTML5 player ✅
- [ ] OneDrive time tracking updates ✅
- [ ] Dropbox video plays with HTML5 player ✅
- [ ] Dropbox time tracking updates ✅
- [ ] Click timestamp seeks to correct time ✅
- [ ] Custom controls work (play, pause, volume, seek) ✅

## Troubleshooting

### Google Drive Not Playing
- Check if file is set to "Anyone with the link can view"
- Verify file ID is correct in URL
- Try: Right-click file → Get link → Copy link

### OneDrive Not Playing
- Ensure public sharing is enabled
- For SharePoint, verify organization allows external sharing
- Try: Share → Anyone with the link can view

### Dropbox Not Playing
- Verify public link sharing is enabled
- Make sure link has been generated
- Try: Share → Create link → Copy link

### Time Not Tracking
- Check browser console for errors
- Verify video is actually playing
- Check network tab for video file loading
- Ensure CORS is not blocking the request
