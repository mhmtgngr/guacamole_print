// Guacamole Print Interception v9.0 - Robust blob + stream interception
// 1. Intercepts URL.createObjectURL to catch ALL blob downloads (print + file)
// 2. Intercepts Guacamole.Client.onfile for direct stream capture (stream.index >= 0)
// 3. Falls through to blob interception for stream.index === -1
console.log('🚀 PRINT INTERCEPTION v9.0');

(function() {
    'use strict';

    // ===== CONFIGURATION =====
    var AGENT_URL = 'ws://localhost:8181/ws';
    var ws = null;
    var isConnected = false;
    var reconnectTimer = null;

    // Track blobs we've already sent to avoid duplicates
    var sentBlobs = new WeakSet();
    // Track filenames from onfile events for blob URL mapping
    var pendingFileNames = {};
    // Track files already captured via stream (to skip iframe/blob duplicates)
    var capturedFiles = {};

    // ===== WEBSOCKET CONNECTION =====
    function connect() {
        if (ws && ws.readyState === WebSocket.OPEN) return;

        try {
            console.log('🔗 Connecting to print agent:', AGENT_URL);
            ws = new WebSocket(AGENT_URL);

            ws.onopen = function() {
                isConnected = true;
                console.log('✅ Print agent CONNECTED');
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
            };

            ws.onclose = function() {
                isConnected = false;
                console.log('🔌 Print agent disconnected');
                ws = null;
                if (!reconnectTimer) {
                    reconnectTimer = setTimeout(connect, 5000);
                }
            };

            ws.onerror = function() {
                isConnected = false;
            };

            ws.onmessage = function(event) {
                try {
                    var msg = JSON.parse(event.data);
                    console.log('📨 Print agent:', msg.type, msg.data ? msg.data.action : '');
                } catch (e) {}
            };

            // Heartbeat: detect dead connections
            var pingInterval = setInterval(function() {
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    clearInterval(pingInterval);
                    return;
                }
                try {
                    ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                } catch (e) {
                    console.log('💀 Dead connection detected, reconnecting...');
                    clearInterval(pingInterval);
                    isConnected = false;
                    ws.close();
                }
            }, 10000);
        } catch (e) {
            console.log('❌ WebSocket error:', e.message);
            if (!reconnectTimer) {
                reconnectTimer = setTimeout(connect, 5000);
            }
        }
    }

    // ===== SEND FILE TO PRINT AGENT =====
    function sendToPrintAgent(filename, blob, mimetype) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.log('❌ Print agent not connected');
            return false;
        }

        // Prevent duplicate sends
        if (sentBlobs.has(blob)) {
            console.log('⏭️ Blob already sent, skipping:', filename);
            return true;
        }
        sentBlobs.add(blob);

        var reader = new FileReader();
        reader.onload = function() {
            var base64 = reader.result.split(',')[1];
            var message = {
                messageId: Date.now().toString(),
                type: 'file_transfer',
                timestamp: new Date().toISOString(),
                file: {
                    name: filename,
                    content: base64,
                    type: mimetype || 'application/octet-stream'
                },
                metadata: {
                    userName: 'guacamole',
                    isPDF: mimetype === 'application/pdf' || filename.toLowerCase().endsWith('.pdf'),
                    source: 'v9-intercept'
                }
            };
            console.log('📤 Sending to print agent:', filename, '(' + blob.size + ' bytes)');
            ws.send(JSON.stringify(message));
            console.log('✅ Sent to print agent!');
        };
        reader.onerror = function() {
            console.log('❌ FileReader error for:', filename);
        };
        reader.readAsDataURL(blob);
        return true;
    }

    // ===== 1. INTERCEPT URL.createObjectURL - catches ALL blob downloads =====
    var originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function(obj) {
        var blobUrl = originalCreateObjectURL(obj);

        if (obj instanceof Blob && isConnected && obj.size > 0) {
            // Determine filename from pending onfile events or use default
            var filename = null;
            var mimetype = obj.type || 'application/octet-stream';
            var now = Date.now();

            // Check pending filenames (set by onfile handler)
            for (var key in pendingFileNames) {
                if (now - pendingFileNames[key].time < 10000) { // within 10 seconds
                    filename = pendingFileNames[key].name;
                    mimetype = pendingFileNames[key].type || mimetype;
                    delete pendingFileNames[key];
                    break;
                }
            }

            if (!filename) {
                // Guess filename from mimetype
                var ext = 'bin';
                if (mimetype === 'application/pdf') ext = 'pdf';
                else if (mimetype.indexOf('spreadsheet') >= 0 || mimetype.indexOf('excel') >= 0) ext = 'xlsx';
                else if (mimetype.indexOf('wordprocessing') >= 0 || mimetype.indexOf('msword') >= 0) ext = 'docx';
                else if (mimetype.indexOf('image/png') >= 0) ext = 'png';
                else if (mimetype.indexOf('image/jpeg') >= 0) ext = 'jpg';
                else if (mimetype.indexOf('text/plain') >= 0) ext = 'txt';
                filename = 'download-' + Date.now() + '.' + ext;
            }

            console.log('🎯 Blob URL created:', filename, '(' + obj.size + ' bytes, ' + mimetype + ')');
            sendToPrintAgent(filename, obj, mimetype);
        }

        return blobUrl;
    };
    console.log('✅ URL.createObjectURL patched');

    // ===== 2. INTERCEPT ANCHOR CLICKS - catches <a download> clicks =====
    document.addEventListener('click', function(e) {
        var link = e.target.closest ? e.target.closest('a') : null;
        if (!link) return;

        var href = link.href || '';
        var download = link.getAttribute('download');

        // Intercept blob: URLs and /streams/ URLs
        if (isConnected && (href.indexOf('blob:') === 0 || href.indexOf('/streams/') >= 0)) {
            var filename = download || href.split('/').pop().split('?')[0] || 'download';
            filename = decodeURIComponent(filename);

            console.log('🔗 Download link clicked:', filename, href.substring(0, 80));

            e.preventDefault();
            e.stopPropagation();

            fetch(href, { credentials: 'same-origin' })
                .then(function(r) { return r.blob(); })
                .then(function(blob) {
                    if (blob.size > 0) {
                        console.log('📄 Link download blob:', blob.size, 'bytes');
                        sendToPrintAgent(filename, blob, blob.type || 'application/octet-stream');
                    }
                })
                .catch(function(err) {
                    console.log('❌ Link fetch error:', err.message);
                });
        }
    }, true);
    console.log('✅ Anchor click interceptor active');

    // ===== 3. PATCH GUACAMOLE CLIENT onfile =====
    function patchGuacamoleClient() {
        if (!window.Guacamole || !window.Guacamole.Client) {
            return false;
        }

        var Client = window.Guacamole.Client;
        if (Client.__v9Patched) return true;

        var clients = new WeakMap();

        Object.defineProperty(Client.prototype, 'onfile', {
            get: function() {
                var data = clients.get(this);
                return data ? data.wrappedHandler : null;
            },
            set: function(handler) {
                var self = this;

                var wrappedHandler = function(stream, mimetype, filename) {
                    console.log('📁 Guacamole.Client.onfile:', filename, 'stream.index:', stream.index, 'type:', mimetype);

                    // Register pending filename for blob URL interception
                    pendingFileNames[stream.index] = {
                        name: filename,
                        type: mimetype,
                        time: Date.now()
                    };

                    // For streams with valid index: capture blob data directly
                    if (stream.index >= 0 && isConnected) {
                        console.log('📥 Capturing stream data for:', filename);

                        var chunks = [];
                        var totalSize = 0;

                        stream.onblob = function(base64Data) {
                            if (!base64Data) {
                                stream.sendAck('OK', 0x0000);
                                return;
                            }
                            try {
                                var binary = atob(base64Data);
                                var bytes = new Uint8Array(binary.length);
                                for (var i = 0; i < binary.length; i++) {
                                    bytes[i] = binary.charCodeAt(i);
                                }
                                chunks.push(bytes);
                                totalSize += bytes.length;
                                console.log('📄 Stream chunk:', bytes.length, '(total:', totalSize + ')');
                            } catch (e) {
                                console.log('⚠️ Decode error:', e.message);
                            }
                            stream.sendAck('OK', 0x0000);
                        };

                        stream.onend = function() {
                            console.log('🏁 Stream ended:', filename, totalSize, 'bytes');
                            if (totalSize > 0) {
                                var combined = new Uint8Array(totalSize);
                                var offset = 0;
                                for (var i = 0; i < chunks.length; i++) {
                                    combined.set(chunks[i], offset);
                                    offset += chunks[i].length;
                                }
                                var blob = new Blob([combined], { type: mimetype });
                                capturedFiles[filename] = Date.now();
                                sendToPrintAgent(filename, blob, mimetype);
                            }
                        };

                        // Send initial ACK to start data flow
                        stream.sendAck('OK', 0x0000);
                        return; // We handle the stream exclusively
                    }

                    // For stream.index === -1 or not connected:
                    // Let original handler process it.
                    // Our URL.createObjectURL override will catch the resulting blob.
                    console.log('➡️ Passing to original handler (stream.index:', stream.index + ')');
                    if (handler) {
                        handler.call(self, stream, mimetype, filename);
                    }
                };

                clients.set(this, { originalHandler: handler, wrappedHandler: wrappedHandler });
            },
            configurable: true
        });

        Client.__v9Patched = true;
        console.log('✅ Guacamole.Client.onfile patched');
        return true;
    }

    // ===== 4. PATCH IFRAME SRC (backup for older Guacamole versions) =====
    var originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName) {
        var element = originalCreateElement(tagName);

        if (tagName.toLowerCase() === 'iframe') {
            var originalSrc = '';
            Object.defineProperty(element, 'src', {
                get: function() { return originalSrc; },
                set: function(value) {
                    if (value && isConnected) {
                        // Check for blob: URLs
                        if (value.indexOf('blob:') === 0) {
                            console.log('📁 Download iframe blob URL intercepted');
                            var iframeName = 'download-' + Date.now();

                            originalSrc = 'about:blank';
                            element.setAttribute('src', 'about:blank');

                            fetch(value)
                                .then(function(r) { return r.blob(); })
                                .then(function(blob) {
                                    if (blob.size > 0) {
                                        sendToPrintAgent(iframeName, blob, blob.type || 'application/octet-stream');
                                    }
                                })
                                .catch(function(e) {
                                    console.log('❌ Iframe blob fetch error:', e.message);
                                });
                            return;
                        }

                        // Check for /streams/ URLs
                        if (value.indexOf('/streams/') >= 0) {
                            var match = value.match(/\/streams\/(\d+)\//);
                            var streamIndex = match ? parseInt(match[1]) : -1;

                            if (streamIndex >= 0) {
                                var urlParts = value.split('/');
                                var filename = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);

                                // Skip if already captured via stream
                                if (capturedFiles[filename] && (Date.now() - capturedFiles[filename] < 30000)) {
                                    console.log('⏭️ Iframe skip (already captured):', filename);
                                    originalSrc = 'about:blank';
                                    element.setAttribute('src', 'about:blank');
                                    return;
                                }

                                console.log('📁 Download iframe intercepted, stream:', streamIndex);

                                originalSrc = 'about:blank';
                                element.setAttribute('src', 'about:blank');

                                fetch(value, { credentials: 'same-origin' })
                                    .then(function(r) { return r.blob(); })
                                    .then(function(blob) {
                                        if (blob.size > 0) {
                                            sendToPrintAgent(filename, blob, blob.type || 'application/octet-stream');
                                        }
                                    })
                                    .catch(function(e) {
                                        console.log('❌ Download fetch error:', e.message);
                                    });
                                return;
                            }
                        }
                    }
                    originalSrc = value;
                    element.setAttribute('src', value);
                },
                configurable: true
            });
        }
        return element;
    };
    console.log('✅ createElement patched');

    // ===== INITIALIZE =====
    connect();

    // Patch Guacamole.Client when available
    var patchAttempts = 0;
    var patchInterval = setInterval(function() {
        patchAttempts++;
        if (patchGuacamoleClient()) {
            clearInterval(patchInterval);
            console.log('✅ PRINT INTERCEPTION v9.0 READY');
        } else if (patchAttempts >= 60) {
            clearInterval(patchInterval);
            console.log('⚠️ Guacamole.Client not found after 30s');
        }
    }, 500);

    // Status (less frequent)
    setInterval(function() {
        if (isConnected) console.log('📊 Print Agent: CONNECTED');
    }, 60000);
})();
