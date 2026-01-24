// Guacamole Print/File Interception
// Version 3.0 - Fixed: intercepts onfile at instance level (onprint doesn't exist in Guacamole)
// Print jobs from RDP arrive as onfile events with application/pdf mimetype

(function() {
    'use strict';

    console.log('[PrintAgent] Initializing file/print interception...');

    // ===== CONFIGURATION =====
    var AGENT_CONFIG = {
        wsUrl: 'ws://localhost:8181/ws',
        reconnectInterval: 5000,
        maxReconnectAttempts: 10
    };

    // ===== WEBSOCKET CONNECTION =====
    var websocket = null;
    var reconnectAttempts = 0;
    var reconnectTimer = null;

    function connectWebSocket() {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            websocket = new WebSocket(AGENT_CONFIG.wsUrl);
        } catch (e) {
            console.log('[PrintAgent] WebSocket creation failed:', e.message);
            scheduleReconnect();
            return;
        }

        websocket.onopen = function() {
            reconnectAttempts = 0;
            console.log('[PrintAgent] Connected to print agent');
        };

        websocket.onerror = function() {
            console.log('[PrintAgent] WebSocket error');
        };

        websocket.onclose = function() {
            console.log('[PrintAgent] Disconnected from print agent');
            scheduleReconnect();
        };

        websocket.onmessage = function(event) {
            try {
                var msg = JSON.parse(event.data);
                console.log('[PrintAgent] Message:', msg.type, msg.status || '');
            } catch (e) {
                // ignore
            }
        };
    }

    function scheduleReconnect() {
        if (reconnectTimer) return;
        if (reconnectAttempts >= AGENT_CONFIG.maxReconnectAttempts) {
            console.log('[PrintAgent] Max reconnect attempts reached');
            return;
        }
        reconnectAttempts++;
        reconnectTimer = setTimeout(function() {
            reconnectTimer = null;
            connectWebSocket();
        }, AGENT_CONFIG.reconnectInterval);
    }

    function isWebSocketReady() {
        return websocket && websocket.readyState === WebSocket.OPEN;
    }

    // ===== SEND FILE TO PRINT AGENT =====
    // The C# PrintAgentService expects: type="file_transfer", file.name, file.content, file.type, metadata.isPDF
    function sendToPrintAgent(blob, filename, mimetype) {
        if (!isWebSocketReady()) {
            console.log('[PrintAgent] WebSocket not connected, cannot send:', filename);
            return false;
        }

        var reader = new FileReader();
        reader.onload = function() {
            var base64Data = reader.result.split(',')[1];
            var isPDF = mimetype === 'application/pdf' || (filename && filename.toLowerCase().endsWith('.pdf'));

            var message = {
                type: 'file_transfer',
                messageId: Date.now().toString(),
                file: {
                    name: filename || (isPDF ? 'print-job.pdf' : 'download'),
                    content: base64Data,
                    type: mimetype || 'application/octet-stream'
                },
                metadata: {
                    isPDF: isPDF,
                    userName: 'default',
                    source: 'guacamole'
                }
            };

            console.log('[PrintAgent] Sending file_transfer: ' + filename + ' (' + blob.size + ' bytes, isPDF: ' + isPDF + ')');
            websocket.send(JSON.stringify(message));
            console.log('[PrintAgent] Sent successfully');
        };
        reader.onerror = function() {
            console.log('[PrintAgent] Failed to read blob for:', filename);
        };
        reader.readAsDataURL(blob);
        return true;
    }

    // ===== ZIP REPAIR (for truncated Office documents) =====
    function repairZipIfNeeded(data, filename) {
        if (data[0] !== 0x50 || data[1] !== 0x4B) {
            return data; // Not a ZIP file
        }

        // Check if EOCD exists
        var hasEOCD = false;
        for (var i = data.length - 22; i >= Math.max(0, data.length - 65558); i--) {
            if (data[i] === 0x50 && data[i+1] === 0x4B &&
                data[i+2] === 0x05 && data[i+3] === 0x06) {
                var cdOffset = data[i+16] | (data[i+17] << 8) | (data[i+18] << 16) | (data[i+19] << 24);
                var cdSize = data[i+12] | (data[i+13] << 8) | (data[i+14] << 16) | (data[i+15] << 24);
                if (cdOffset + cdSize === i && cdOffset < data.length) {
                    hasEOCD = true;
                    break;
                }
            }
        }

        if (hasEOCD) {
            return data; // ZIP is valid
        }

        console.log('[PrintAgent] ZIP corrupted, rebuilding central directory for:', filename);

        // Scan local file headers
        var entries = [];
        var pos = 0;
        while (pos < data.length - 30) {
            if (data[pos] === 0x50 && data[pos+1] === 0x4B &&
                data[pos+2] === 0x03 && data[pos+3] === 0x04) {
                var compSize = data[pos+18] | (data[pos+19] << 8) | (data[pos+20] << 16) | (data[pos+21] << 24);
                var nameLen = data[pos+26] | (data[pos+27] << 8);
                var extraLen = data[pos+28] | (data[pos+29] << 8);
                var headerSize = 30 + nameLen + extraLen;

                entries.push({
                    offset: pos,
                    compressedSize: compSize,
                    nameLen: nameLen,
                    headerSize: headerSize
                });

                pos += headerSize + compSize;
            } else {
                pos++;
            }
        }

        if (entries.length === 0) {
            return data; // Can't repair
        }

        // Build central directory
        var cdEntries = [];
        for (var j = 0; j < entries.length; j++) {
            var e = entries[j];
            var cdEntry = new Uint8Array(46 + e.nameLen);
            cdEntry.set([0x50, 0x4B, 0x01, 0x02], 0); // Signature
            cdEntry.set([20, 0], 4); // Version made by
            cdEntry.set([20, 0], 6); // Version needed

            // Copy compression method, CRC, sizes from local header
            for (var k = 0; k < 16; k++) {
                cdEntry[10 + k] = data[e.offset + 8 + k];
            }

            // Filename length
            cdEntry[28] = e.nameLen & 0xFF;
            cdEntry[29] = (e.nameLen >> 8) & 0xFF;

            // Local header offset
            cdEntry[42] = e.offset & 0xFF;
            cdEntry[43] = (e.offset >> 8) & 0xFF;
            cdEntry[44] = (e.offset >> 16) & 0xFF;
            cdEntry[45] = (e.offset >> 24) & 0xFF;

            // Copy filename
            for (var k = 0; k < e.nameLen; k++) {
                cdEntry[46 + k] = data[e.offset + 30 + k];
            }

            cdEntries.push(cdEntry);
        }

        // Calculate total CD size
        var cdTotalSize = 0;
        for (var j = 0; j < cdEntries.length; j++) {
            cdTotalSize += cdEntries[j].length;
        }

        // Build new ZIP
        var newZip = new Uint8Array(data.length + cdTotalSize + 22);
        newZip.set(data, 0);

        var cdStart = data.length;
        var cdPos = cdStart;
        for (var j = 0; j < cdEntries.length; j++) {
            newZip.set(cdEntries[j], cdPos);
            cdPos += cdEntries[j].length;
        }

        // EOCD
        var eocd = new Uint8Array(22);
        eocd.set([0x50, 0x4B, 0x05, 0x06], 0);
        eocd[8] = entries.length & 0xFF;
        eocd[9] = (entries.length >> 8) & 0xFF;
        eocd[10] = entries.length & 0xFF;
        eocd[11] = (entries.length >> 8) & 0xFF;
        eocd[12] = cdTotalSize & 0xFF;
        eocd[13] = (cdTotalSize >> 8) & 0xFF;
        eocd[14] = (cdTotalSize >> 16) & 0xFF;
        eocd[15] = (cdTotalSize >> 24) & 0xFF;
        eocd[16] = cdStart & 0xFF;
        eocd[17] = (cdStart >> 8) & 0xFF;
        eocd[18] = (cdStart >> 16) & 0xFF;
        eocd[19] = (cdStart >> 24) & 0xFF;

        newZip.set(eocd, cdPos);

        console.log('[PrintAgent] ZIP repaired: ' + data.length + ' -> ' + (cdPos + 22) + ' bytes');
        return newZip.subarray(0, cdPos + 22);
    }

    // ===== INTERCEPT VIA ANGULAR SERVICE =====
    // Guacamole sends file data as blob instructions through the WebSocket tunnel.
    // We intercept tunnelService.downloadStream, and instead of creating an iframe
    // for HTTP download, we read the stream data directly via stream.onblob + ACKs.

    function interceptDownloadStream(origDownloadStream, tunnel, stream, mimetype, filename) {
        console.log('[PrintAgent] downloadStream intercepted:', filename, 'type:', mimetype);

        var isPDF = mimetype === 'application/pdf' || (filename && filename.toLowerCase().endsWith('.pdf'));
        var isOfficeDoc = filename && /\.(xlsx|docx|pptx)$/i.test(filename);

        // Only intercept PDFs and Office docs when WebSocket is connected
        if (!isWebSocketReady() || (!isPDF && !isOfficeDoc)) {
            console.log('[PrintAgent] Passing to default download:', filename);
            origDownloadStream(tunnel, stream, mimetype, filename);
            return;
        }

        console.log('[PrintAgent] Intercepting via WebSocket stream:', filename);

        // IMPORTANT: Guacamole sends file data through the WebSocket tunnel as
        // blob instructions. The HTTP download endpoint (iframe) ALSO reads from
        // the same source - but we can't use both. We MUST read via WebSocket
        // by setting stream.onblob IMMEDIATELY and sending ACKs to keep data flowing.
        //
        // The stream object is a Guacamole.InputStream with:
        //   - onblob(base64data): called when a blob arrives
        //   - onend(): called when stream is complete
        //   - sendAck(message, code): acknowledges receipt, requests more data

        var chunks = [];
        var totalSize = 0;
        var chunkCount = 0;

        // Set onblob handler IMMEDIATELY - before any blob instructions arrive
        stream.onblob = function(base64Data) {
            chunkCount++;

            if (!base64Data || base64Data.length === 0) {
                console.log('[PrintAgent] Empty blob #' + chunkCount + ', sending ACK');
                stream.sendAck('OK', 0x0000);
                return;
            }

            try {
                var binaryString = atob(base64Data);
                var bytes = new Uint8Array(binaryString.length);
                for (var i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                chunks.push(bytes);
                totalSize += bytes.length;

                if (chunkCount <= 3 || chunkCount % 50 === 0) {
                    console.log('[PrintAgent] Blob #' + chunkCount + ': ' + bytes.length + ' bytes (total: ' + totalSize + ')');
                }
            } catch (err) {
                console.log('[PrintAgent] Blob decode error:', err.message);
            }

            // ACK to request next blob - THIS IS CRITICAL for data to keep flowing
            stream.sendAck('OK', 0x0000);
        };

        stream.onend = function() {
            console.log('[PrintAgent] Stream ended:', filename, '(' + chunkCount + ' chunks, ' + totalSize + ' bytes)');

            if (totalSize < 100) {
                console.log('[PrintAgent] File too small (' + totalSize + ' bytes), ignoring');
                return;
            }

            // Combine all chunks
            var combined = new Uint8Array(totalSize);
            var offset = 0;
            for (var i = 0; i < chunks.length; i++) {
                combined.set(chunks[i], offset);
                offset += chunks[i].length;
            }

            // Repair ZIP if needed (Office docs)
            if (isOfficeDoc) {
                combined = repairZipIfNeeded(combined, filename);
            }

            // Send to print agent
            var blob = new Blob([combined], { type: mimetype || 'application/octet-stream' });
            console.log('[PrintAgent] Sending to print agent:', filename, '(' + blob.size + ' bytes)');
            sendToPrintAgent(blob, filename, mimetype);
        };

        // Send initial ACK to tell guacd we're ready to receive data
        console.log('[PrintAgent] Sending initial ACK for stream');
        stream.sendAck('OK', 0x0000);
    }

    function patchAngularService() {
        // Find Angular app element
        var appElement = document.querySelector('[ng-app]') || document.querySelector('.ng-scope') || document.body;

        try {
            var angular = window.angular;
            if (!angular) {
                return false;
            }

            var injector = angular.element(appElement).injector();
            if (!injector) {
                return false;
            }

            var tunnelService = injector.get('tunnelService');
            if (!tunnelService || !tunnelService.downloadStream) {
                return false;
            }

            if (tunnelService.__printAgentPatched) {
                return true;
            }

            var origDownloadStream = tunnelService.downloadStream;

            tunnelService.downloadStream = function(tunnel, stream, mimetype, filename) {
                interceptDownloadStream(origDownloadStream, tunnel, stream, mimetype, filename);
            };

            tunnelService.__printAgentPatched = true;
            console.log('[PrintAgent] tunnelService.downloadStream patched successfully!');
            return true;

        } catch (e) {
            console.log('[PrintAgent] Angular service patch error:', e.message);
            return false;
        }
    }

    // ===== INITIALIZATION =====
    // Start WebSocket connection immediately
    connectWebSocket();

    // Patch Angular service - needs to wait for Angular to bootstrap
    var patchAttempts = 0;
    var patchInterval = setInterval(function() {
        patchAttempts++;
        if (patchAngularService()) {
            clearInterval(patchInterval);
        } else if (patchAttempts >= 60) { // 30 seconds timeout
            clearInterval(patchInterval);
            console.log('[PrintAgent] WARNING: Could not patch tunnelService after 30 seconds');
        }
    }, 500);

    console.log('[PrintAgent] Interception module loaded, waiting for Angular...');
})();
