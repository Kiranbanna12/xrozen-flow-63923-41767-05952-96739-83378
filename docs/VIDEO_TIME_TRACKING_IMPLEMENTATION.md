# Video Time Tracking Implementation

## Overview
Implemented HTML5 video player for Google Drive, OneDrive, Dropbox, and other cloud storage services to enable automatic time tracking, similar to YouTube videos.

## Changes Made

### 1. **URL Conversion Functions**
Added `getDirectVideoUrl()` function to convert cloud storage sharing URLs to direct video stream URLs:

- **Google Drive**: Converts to `https://drive.google.com/uc?export=download&id={fileId}` format
- **OneDrive**: Converts embed links to download links, adds `download=1` parameter for SharePoint
- **Dropbox**: Changes domain to `dl.dropboxusercontent.com` and adds `?raw=1` parameter

### 2. **Platform Detection**
Updated `detectPlatform()` to properly identify:
- YouTube (kept unchanged)
- Google Drive
- OneDrive/SharePoint
- Dropbox
- Vimeo
- Direct video files (.mp4, .webm, .mov)

### 3. **Player Implementation**

#### YouTube (Unchanged - Already Working)
- Uses iframe embed with YouTube IFrame API
- Time tracking via `postMessage` API
- Periodic polling for `getCurrentTime`
- Event listeners for `onStateChange` and `infoDelivery`

#### Google Drive, OneDrive, Dropbox (New - HTML5 Video)
- Uses native HTML5 `<video>` element
- Direct access to `currentTime` property
- Event listeners:
  - `onTimeUpdate`: Updates current time every frame
  - `onLoadedMetadata`: Gets video duration
  - `onPlay`/`onPause`: Tracks playback state

### 4. **Time Tracking Features**

All platforms now support:
- ✅ Real-time timestamp updates
- ✅ Seek to specific timestamp
- ✅ Current time display
- ✅ Feedback comments with timestamps
- ✅ Click timestamp to jump to that moment

### 5. **Custom Video Controls**

HTML5 video includes custom controls:
- Play/Pause button
- Volume control with slider
- Mute/Unmute toggle
- Seek bar with progress
- Time display (current/total)
- Fullscreen button

### 6. **API Methods**

The `UniversalVideoPlayer` exposes these methods via ref:

```typescript
{
  seekTo: (seconds: number) => void,
  getCurrentTime: () => number
}
```

Both methods work across all platforms (YouTube, Google Drive, OneDrive, Dropbox, etc.)

## Technical Details

### YouTube Implementation (Unchanged)
```typescript
// iframe with enablejsapi=1
// postMessage communication
iframeRef.current.contentWindow.postMessage(
  JSON.stringify({ event: 'command', func: 'getCurrentTime' }),
  '*'
);
```

### HTML5 Video Implementation (New)
```typescript
// Direct HTML5 video element
<video 
  src={getDirectVideoUrl(url)}
  onTimeUpdate={handleTimeUpdate}
  onLoadedMetadata={handleLoadedMetadata}
/>

// Direct access to current time
const currentTime = videoRef.current.currentTime;
```

## Browser Compatibility

### Requirements for Cloud Storage Videos:
1. **Google Drive**: File must be set to "Anyone with the link can view"
2. **OneDrive**: File must have public sharing enabled
3. **Dropbox**: File must have public link sharing enabled
4. **CORS**: Some cloud services may have CORS restrictions - added `crossOrigin="anonymous"` attribute

## Testing

To test time tracking:
1. Upload video to Google Drive/OneDrive/Dropbox
2. Generate public sharing link
3. Add link to project version
4. Open video preview page
5. Add feedback with timestamps
6. Click timestamps to verify seek functionality

## Benefits

1. **Unified Experience**: All video platforms now have time tracking
2. **Better Feedback**: Clients can add timestamped comments on any video platform
3. **HTML5 Control**: Full control over playback for cloud storage videos
4. **No Breaking Changes**: YouTube implementation remains exactly as it was

## Future Enhancements

Potential improvements:
- Add AWS S3 support
- Add Azure Blob Storage support
- Implement video quality selection
- Add playback speed controls
- Add keyboard shortcuts
- Implement picture-in-picture mode
