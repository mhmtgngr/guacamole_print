# Browser Extension Installation Guide

## Chrome/Edge Installation:

1. Open Chrome/Edge browser
2. Navigate to: `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select this folder: `C:\Users\Mehmet\guacamole-print-solution\guacamole-extension`
6. Verify "Guacamole Print Agent" appears in the extension list

## Test the Extension:

1. Open the test page: `C:\Users\Mehmet\guacamole-print-solution\test-print-agent.html`
2. Click "Test WebSocket Connection" - should show "Connected"
3. Click "Send Test Print Job" - should trigger print dialog
4. Check browser console for any errors

## Troubleshooting:

- If extension shows errors, check the manifest.json permissions
- Ensure the local print agent remains running on port 8181
- Check browser console (F12) for WebSocket connection errors
- Try refreshing the page after installing the extension

## Guacamole Testing:

1. Connect to your Guacamole session
2. Try to print any document
3. The extension should intercept the print job
4. Print dialog should appear on your local machine