// Simple file interception - ZIP truncation detection only
// Version 2.0 - Simplified for reliability

console.log('🚀 INITIALIZING FILE INTERCEPTION...');

var originalOnFile = null;

// Repair corrupted ZIP files by rebuilding central directory from local file headers
function repairZipFile(zipData, filename) {
    console.log('🔧 Starting ZIP repair for ' + filename + ' (' + zipData.length + ' bytes)');
    
    var entries = [];
    var pos = 0;
    
    // Scan for local file headers (PK\x03\x04)
    while (pos < zipData.length - 30) {
        if (zipData[pos] === 0x50 && zipData[pos+1] === 0x4B &&
            zipData[pos+2] === 0x03 && zipData[pos+3] === 0x04) {
            
            // Read local file header
            var compressedSize = zipData[pos + 18] | (zipData[pos + 19] << 8) |
                                (zipData[pos + 20] << 16) | (zipData[pos + 21] << 24);
            var uncompressedSize = zipData[pos + 22] | (zipData[pos + 23] << 8) |
                                  (zipData[pos + 24] << 16) | (zipData[pos + 25] << 24);
            var nameLen = zipData[pos + 26] | (zipData[pos + 27] << 8);
            var extraLen = zipData[pos + 28] | (zipData[pos + 29] << 8);
            var headerSize = 30 + nameLen + extraLen;
            
            // Get filename
            var nameBytes = zipData.subarray(pos + 30, pos + 30 + nameLen);
            var filenameEntry = '';
            for (var i = 0; i < nameLen; i++) {
                filenameEntry += String.fromCharCode(nameBytes[i]);
            }
            
            console.log('📦 Found entry: ' + filenameEntry + ' at ' + pos + 
                        ', compressed: ' + compressedSize + ', header: ' + headerSize);
            
            entries.push({
                name: filenameEntry,
                offset: pos,
                compressedSize: compressedSize,
                uncompressedSize: uncompressedSize,
                headerSize: headerSize
            });
            
            pos += headerSize + compressedSize;
        } else {
            pos++;
        }
    }
    
    if (entries.length === 0) {
        console.log('❌ No ZIP entries found');
        return null;
    }
    
    console.log('✅ Found ' + entries.length + ' ZIP entries');
    
    // Build central directory
    var cdData = [];
    var cdOffset = 0;
    
    for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        
        // Central directory header (46 bytes + name + extra + comment)
        var cdHeader = new Uint8Array(46 + e.name.length);
        cdHeader.set([0x50, 0x4B, 0x01, 0x02], 0);  // Signature
        cdHeader.set([20, 0], 4);  // Version needed
        cdHeader.set([0, 0, 0, 0], 6);  // General purpose
        cdHeader.set([8, 0], 10);  // Compression method (deflate)
        cdHeader.set([0, 0], 12);  // Last mod time
        cdHeader.set([0, 0, 14]);  // Last mod date
        
        // CRC32, sizes (placeholder, should read from local header)
        for (var j = 0; j < 12; j++) {
            cdHeader[16 + j] = zipData[e.offset + 14 + j];
        }
        
        // Filename length
        cdHeader[28] = e.name.length & 0xFF;
        cdHeader[29] = (e.name.length >> 8) & 0xFF;
        
        // Extra and comment length (0)
        cdHeader[30] = 0;
        cdHeader[31] = 0;
        cdHeader[32] = 0;
        cdHeader[33] = 0;
        
        // Disk number start, internal/external attrs (0)
        for (var j = 0; j < 8; j++) {
            cdHeader[34 + j] = 0;
        }
        
        // Local header offset
        cdHeader[42] = e.offset & 0xFF;
        cdHeader[43] = (e.offset >> 8) & 0xFF;
        cdHeader[44] = (e.offset >> 16) & 0xFF;
        cdHeader[45] = (e.offset >> 24) & 0xFF;
        
        // Copy filename
        for (var j = 0; j < e.name.length; j++) {
            cdHeader[46 + j] = e.name.charCodeAt(j);
        }
        
        // Add to central directory
        for (var j = 0; j < cdHeader.length; j++) {
            cdData.push(cdHeader[j]);
        }
        
        cdOffset += cdHeader.length;
    }
    
    console.log('📋 Central directory size: ' + cdData.length + ' bytes at offset ' + cdOffset);
    
    // Calculate end of central directory position
    var eocdPos = zipData.length;
    var cd = new Uint8Array(cdData);
    
    // Create new ZIP with valid structure
    var newZipSize = zipData.length + cdData.length + 22;
    var newZip = new Uint8Array(newZipSize);
    
    // Copy original data
    newZip.set(zipData, 0);
    
    // Copy central directory
    newZip.set(cd, zipData.length);
    
    // End of central directory record
    var eocd = new Uint8Array(22);
    eocd.set([0x50, 0x4B, 0x05, 0x06], 0);  // Signature
    eocd.set([0, 0], 4);  // Disk number
    eocd.set([0, 0], 6);  // Start disk
    eocd[8] = entries.length & 0xFF;
    eocd[9] = (entries.length >> 8) & 0xFF;
    eocd[10] = entries.length & 0xFF;
    eocd[11] = (entries.length >> 8) & 0xFF;
    
    var cdSize = cdData.length;
    eocd[12] = cdSize & 0xFF;
    eocd[13] = (cdSize >> 8) & 0xFF;
    eocd[14] = (cdSize >> 16) & 0xFF;
    eocd[15] = (cdSize >> 24) & 0xFF;
    
    var cdOff = zipData.length;
    eocd[16] = cdOff & 0xFF;
    eocd[17] = (cdOff >> 8) & 0xFF;
    eocd[18] = (cdOff >> 16) & 0xFF;
    eocd[19] = (cdOff >> 24) & 0xFF;
    
    eocd[20] = 0;  // Comment length
    eocd[21] = 0;
    
    newZip.set(eocd, zipData.length + cdData.length);
    
    console.log('✅ ZIP repair complete! New size: ' + newZipSize + ' bytes');
    
    return { data: newZip, size: newZipSize };
}

// Monkey patch Guacamole client to intercept onfile
(function() {
    var Guacamole = window.Guacamole;
    if (!Guacamole) {
        console.log('❌ Guacamole not available');
        return;
    }

    var proto = Guacamole.Client.prototype;
    if (!proto) {
        return;
    }

    var originalOnFile = proto.onfile;

    proto.onfile = function(stream, mimetype, filename) {
        console.log('🎯 onfile called:', mimetype, filename);

        var isZip = filename && (filename.endsWith('.xlsx') || filename.endsWith('.docx') || filename.endsWith('.pptx'));
        var isPDF = mimetype === 'application/pdf' || (filename && filename.endsWith('.pdf'));

        console.log('📄 File detected:', filename, 'isZIP:', isZip, 'isPDF:', isPDF);

        // Set up interceptors
        var chunks = [];
        var totalSize = 0;
        var chunkCount = 0;

        stream.onblob = function(base64Data) {
            if (!base64Data || base64Data.length === 0) {
                stream.sendAck('OK', 0x0000);
                return;
            }

            chunkCount++;
            try {
                var binaryString = atob(base64Data);
                var bytes = new Uint8Array(binaryString.length);
                for (var i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                chunks.push(bytes);
                totalSize += bytes.length;
                console.log('📄 chunk #' + chunkCount + ': ' + bytes.length + ' bytes (total: ' + totalSize + ')');
            } catch (err) {
                console.log('⚠️ Chunk decode error: ' + err.message);
            }

            stream.sendAck('OK', 0x0000);
        };

        stream.onend = function() {
            console.log('🏁 Stream ended for: ' + filename + ' (' + chunkCount + ' chunks, ' + totalSize + ' bytes)');

            if (totalSize < 500) {
                console.log('⚠️ Skipping tiny file: ' + filename);
                return;
            }

            // ZIP corruption detection and repair
            if (isZip && totalSize > 1000) {
                var combinedArray = new Uint8Array(totalSize);
                var offset = 0;
                for (var i = 0; i < chunks.length; i++) {
                    var chunk = chunks[i];
                    combinedArray.set(chunk, offset);
                    offset += chunk.length;
                }

                var header = combinedArray[0] === 0x50 && combinedArray[1] === 0x4B ? 'PK' : '??';

                if (header === 'PK') {
                    var eocdOffset = -1;
                    
                    for (var i = combinedArray.length - 22; i >= Math.max(0, combinedArray.length - 65558); i--) {
                        if (combinedArray[i] === 0x50 && combinedArray[i+1] === 0x4B &&
                            combinedArray[i+2] === 0x05 && combinedArray[i+3] === 0x06) {
                            
                            var cdOffset = combinedArray[i + 16] | (combinedArray[i + 17] << 8) |
                                           (combinedArray[i + 18] << 16) | (combinedArray[i + 19] << 24);
                            var cdSize = combinedArray[i + 12] | (combinedArray[i + 13] << 8) |
                                         (combinedArray[i + 14] << 16) | (combinedArray[i + 15] << 24);
                            var commentLen = combinedArray[i + 20] | (combinedArray[i + 21] << 8);
                            
                            if (i + 22 + commentLen === combinedArray.length &&
                                cdOffset + cdSize === i &&
                                cdOffset < combinedArray.length &&
                                cdOffset >= 0) {
                                eocdOffset = i;
                                break;
                            }
                        }
                    }

                    if (eocdOffset === -1) {
                        console.log('🔧 ZIP file corrupted! Attempting repair...');
                        var repaired = repairZipFile(combinedArray, filename);
                        if (repaired) {
                            console.log('✅ ZIP file repaired! Size: ' + repaired.size + ' bytes');
                            totalSize = repaired.size;
                            combinedArray = repaired.data;
                        } else {
                            console.log('❌ ZIP repair failed. File may be unusable.');
                        }
                    }
                    
                    // Send (repaired) file to print agent
                    if (websocket && websocket.readyState === 1) {
                        var blob = new Blob([combinedArray], { type: mimetype || 'application/octet-stream' });
                        console.log('📄 Created blob: ' + blob.size + ' bytes');
                        interceptFile(null, blob, filename, mimetype);
                        return; // Don't call original handler
                    } else {
                        console.log('⚠️ WebSocket not connected, falling back to original handler');
                        if (originalOnFile) {
                             originalOnFile.apply(this, arguments);
                        }
                        return;
                    }
                }
            }

            // For non-ZIP files, call original handler
            if (originalOnFile) {
                 originalOnFile.apply(this, arguments);
            }
        };

        stream.sendAck('OK', 0x0000);
    };

    console.log('✅ FILE INTERCEPTION READY');
})();

// ===== PRINT AGENT INTEGRATION =====
(function() {
    var AGENT_CONFIG = {
        wsConnected: false,
        wsUrl: 'ws://localhost:8181/ws'
    };

    var websocket = null;

    function connectWebSocket() {
        if (websocket && websocket.readyState === 1) {
            return;
        }

        console.log('🔗 Connecting to print agent: ' + AGENT_CONFIG.wsUrl);
        websocket = new WebSocket(AGENT_CONFIG.wsUrl);

        websocket.onopen = function() {
            AGENT_CONFIG.wsConnected = true;
            console.log('✅ Print agent CONNECTED');
        };

        websocket.onerror = function() {
            AGENT_CONFIG.wsConnected = false;
            console.log('❌ Print agent connection error');
        };

        websocket.onclose = function() {
            AGENT_CONFIG.wsConnected = false;
            console.log('🔌 Print agent disconnected');
        };

        websocket.onmessage = function(event) {
            try {
                var msg = JSON.parse(event.data);
                console.log('📨 Print agent message:', msg.type);

                if (msg.type === 'print_status') {
                    console.log('🖨️ Print status: ' + msg.status);
                }
            } catch (e) {
                console.log('⚠️ Print agent message error:', e.message);
            }
        };
    }

    function interceptPDF(url, blob, filename) {
        return new Promise(function(resolve) {
            var reader = new FileReader();
            reader.onload = function() {
                var base64Data = reader.result.split(',')[1];
                var message = {
                    type: 'pdf_print',
                    messageId: Date.now().toString(),
                    pdf: {
                        content: base64Data,
                        filename: filename
                    }
                };
                console.log('📄 Sending PDF to print agent...');
                websocket.send(JSON.stringify(message));
                console.log('✅ PDF sent to print agent');
                resolve(true);
            };
            reader.onerror = function() {
                console.log('❌ Failed to read PDF as base64');
                resolve(false);
            };
            reader.readAsDataURL(blob);
        });
    }

    function interceptFile(url, blob, filename, mimetype) {
        return new Promise(function(resolve) {
            var reader = new FileReader();
            reader.onload = function() {
                var base64Data = reader.result.split(',')[1];
                var message = {
                    type: 'fileTransfer',
                    messageId: Date.now().toString(),
                    file: {
                        content: base64Data,
                        filename: filename,
                        type: mimetype,
                        size: blob.size
                    }
                };
                console.log('📄 Sending file to print agent: ' + filename + ' (' + blob.size + ' bytes)');
                websocket.send(JSON.stringify(message));
                console.log('✅ File sent to print agent');
                resolve(true);
            };
            reader.onerror = function() {
                console.log('❌ Failed to read file as base64');
                resolve(false);
            };
            reader.readAsDataURL(blob);
        });
    }

    // Monkey patch for print detection
    (function() {
        var Guacamole = window.Guacamole;
        var GuacamoleClient = Guacamole.Client;

        if (!Guacamole || !GuacamoleClient) {
            console.log('❌ Guacamole not available');
            return;
        }

        var proto = GuacamoleClient.prototype;

        if (!proto) {
            console.log('❌ Guacamole.Client.prototype not available');
            return;
        }

        var originalOnPrint = proto.onprint;

        proto.onprint = function(stream, mimetype, filename) {
            console.log('🖨️ Print detected:', mimetype, filename);

            var isPDF = mimetype === 'application/pdf';

            if (isPDF) {
                var fileBuffer = {
                    chunks: [],
                    totalSize: 0
                };

                stream.onblob = function(base64Data) {
                    if (!base64Data || base64Data.length === 0) {
                        stream.sendAck('OK', 0x0000);
                        return;
                    }

                    try {
                        var binaryString = atob(base64Data);
                        var bytes = new Uint8Array(binaryString.length);
                        for (var i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }

                        fileBuffer.chunks.push(bytes);
                        fileBuffer.totalSize += bytes.length;
                    } catch (err) {
                        console.log('⚠️ Chunk decode error: ' + err.message);
                    }

                    stream.sendAck('OK', 0x0000);
                };

                stream.onend = function() {
                    console.log('🏁 Print stream ended: ' + fileBuffer.chunks.length + ' chunks, ' + fileBuffer.totalSize + ' bytes');

                    if (fileBuffer.totalSize === 0 || fileBuffer.totalSize < 1024) {
                        console.log('⚠️ Print file too small: ' + fileBuffer.totalSize + ' bytes');
                        if (originalOnPrint) {
                            originalOnPrint.call(this, stream, mimetype, filename);
                        }
                        return;
                    }

                    var combinedArray = new Uint8Array(fileBuffer.totalSize);
                    var offset = 0;
                    for (var i = 0; i < fileBuffer.chunks.length; i++) {
                        var chunk = fileBuffer.chunks[i];
                        combinedArray.set(chunk, offset);
                        offset += chunk.length;
                    }

                    var blob = new Blob([combinedArray], { type: 'application/pdf' });
                    console.log('📄 Created PDF blob: ' + blob.size + ' bytes');

                    interceptPDF(null, blob, filename).then(function(sent) {
                        if (sent) {
                            console.log('✅ PDF sent to print agent!');
                        } else {
                            console.log('❌ Failed to send PDF to print agent');
                            if (originalOnPrint) {
                                originalOnPrint.call(this, stream, mimetype, filename);
                            }
                        }
                    });
                };

                stream.sendAck('OK', 0x0000);
            } else {
                if (originalOnPrint) {
                    originalOnPrint.call(this, stream, mimetype, filename);
                }
            }
        };
    })();

    console.log('✅ PRINT INTERCEPTION READY');

    // Initialize WebSocket connection
    connectWebSocket();
})();

// Wait for Guacamole client to initialize
setTimeout(function() {
    console.log('⏱️ Waiting for Guacamole client...');
    var checkCount = 0;
    var maxChecks = 20;

    var checkInterval = setInterval(function() {
        checkCount++;
        if (window.Guacamole && window.Guacamole.Client) {
            clearInterval(checkInterval);
            console.log('✅ Guacamole client detected');
            return;
        }

        if (checkCount >= maxChecks) {
            clearInterval(checkInterval);
            console.log('⚠️ Guacamole client not detected after 10 seconds');
        }
    }, 500);
}, 1000);
