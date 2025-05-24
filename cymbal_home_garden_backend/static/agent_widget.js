import { startAudioPlayerWorklet, startAudioRecorderWorklet, stopMicrophone, pauseMicrophoneInput, resumeMicrophoneInput } from './js/audio-modules.js';

document.addEventListener('DOMContentLoaded', () => {
    const agentWidget = document.querySelector('.agent-widget'); 
    if (!agentWidget) {
        console.error("Agent widget root (.agent-widget) not found.");
        return;
    }
    
    const videoDisplayContainer = agentWidget.querySelector('.video-display-container');
    const textChatContainer = agentWidget.querySelector('.text-chat-container');
    const messageArea = agentWidget.querySelector('.message-area');
    const chatInput = agentWidget.querySelector('.chat-input');

    const micIcon = agentWidget.querySelector('.mic-icon');
    const videoToggleButton = agentWidget.querySelector('.video-toggle-btn');
    const chatIcon = agentWidget.querySelector('.chat-icon');
    const endCallButton = agentWidget.querySelector('.end-call-icon');
    const closeButton = agentWidget.querySelector('.close-btn');
    const minimizeButton = agentWidget.querySelector('.minimize-btn');
    const imageOptionsToggleBtn = agentWidget.querySelector('.image-options-toggle-btn');
    const imageOptionsPopup = agentWidget.querySelector('.image-options-popup');
    const cameraBtn = agentWidget.querySelector('.camera-btn');
    const uploadLocalBtn = agentWidget.querySelector('.upload-local-btn');
    const imageUploadInput = document.getElementById('imageUploadInput');

    // Camera View Elements (for Phase 2)
    const cameraViewContainer = agentWidget.querySelector('.camera-view-container');
    const cameraFeed = document.getElementById('cameraFeed');
    const photoCanvas = document.getElementById('photoCanvas');
    const captureBtn = agentWidget.querySelector('.capture-btn');
    const cancelCameraBtn = agentWidget.querySelector('.cancel-camera-btn');
    
    let stagedImage = null; // For Phase 3: Combined image-text query
    let currentImagePreviewElement = null; // To remove preview if cancelled
    let localCameraStream = null; // For Phase 2: Camera stream
 
    let websocket = null;
    let currentSessionId = null;
    let isWsAudioMode = false; // Reflects the actual mode of the current/last WebSocket connection
    let userDesiredAudioMode = false; // User's intent, toggled by mic button
    
    let audioPlayerNode;
    let audioRecorderNode;
    let localMicStream = null;
    let isMicPausedForAgentSpeech = false; // Tracks if mic is paused due to agent speaking
    let waitingForAgentPlaybackToFinish = false; // Tracks if waiting for agent audio playback to finish
    
    let currentAgentMessageElement = null;
    let isOverallSessionStart = true; // Tracks if it's the very first interaction in this widget lifecycle
let initialGreetingSent = false; // Tracks if the first user message/greeting has been sent

    let audioChunkBuffer = [];
    const TARGET_AUDIO_CHUNK_SIZE_BYTES = 3200; // Aim for approx 100ms of 16kHz/16-bit audio (16000*2*0.1)
 
    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    function base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    function updateMicIcon(isAudioActive, isConnected) {
        if (!micIcon) return;
        micIcon.disabled = !isConnected;
        if (isAudioActive && isConnected) {
            micIcon.classList.add('active');
            micIcon.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        } else {
            micIcon.classList.remove('active');
            micIcon.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        }
    }
    
    function showUIMode(isAudio) {
        if (textChatContainer) textChatContainer.style.display = 'flex'; // Always visible for now
        if (videoDisplayContainer) videoDisplayContainer.style.display = 'none'; // Video not used

        if (isAudio) {
            if (chatIcon) chatIcon.classList.remove('active');
            if (micIcon) micIcon.classList.add('active'); // Icon state managed by updateMicIcon
        } else {
            if (chatIcon) chatIcon.classList.add('active');
            if (micIcon) micIcon.classList.remove('active');
        }
        if (videoToggleButton) videoToggleButton.classList.remove('active');
    }

    async function initializeAndStartAudioCapture() {
        console.log("[AudioInit] Attempting to start audio capture. Current WS audio mode:", isWsAudioMode, "Mic paused for agent speech:", isMicPausedForAgentSpeech);
        isMicPausedForAgentSpeech = false; // Reset on new capture initialization
        console.log("[AudioInit] Reset isMicPausedForAgentSpeech to false.");
        if (!isWsAudioMode) { // Should only be called if ws is in audio mode
            console.warn("[AudioInit] Not in WebSocket audio mode. Aborting audio start.");
            return;
        }
        if (localMicStream) {
            console.log("[AudioInit] Microphone stream already exists.");
            return;
        }

        try {
            if (!audioPlayerNode) {
                const [player] = await startAudioPlayerWorklet();
                audioPlayerNode = player;
                console.log("[AudioInit] Audio player worklet started.");

                // Setup message handler for playback finished events
                audioPlayerNode.port.onmessage = (event) => {
                    if (event.data && event.data.status === 'playback_finished') {
                        console.log("[AudioPlayer] Playback finished event received.");
                        waitingForAgentPlaybackToFinish = false;
                        console.log("[AudioPlayer] waitingForAgentPlaybackToFinish set to false.");

                        if (userDesiredAudioMode && isMicPausedForAgentSpeech) {
                            console.log("[AudioPlayer] User desires audio and mic was paused for agent. Resuming microphone input.");
                            if (localMicStream) { // Ensure localMicStream is still valid
                                resumeMicrophoneInput(localMicStream);
                                console.log("[AudioPlayer] resumeMicrophoneInput called.");
                            } else {
                                console.warn("[AudioPlayer] Cannot resume mic: localMicStream is null after playback finished.");
                            }
                            isMicPausedForAgentSpeech = false;
                            console.log("[AudioPlayer] isMicPausedForAgentSpeech set to false.");
                        } else {
                            if (!userDesiredAudioMode) console.log("[AudioPlayer] Playback finished, but userDesiredAudioMode is false. Mic not resumed.");
                            if (!isMicPausedForAgentSpeech) console.log("[AudioPlayer] Playback finished, but isMicPausedForAgentSpeech was already false. Mic not resumed by this logic.");
                        }
                    }
                };
                console.log("[AudioInit] Audio player port onmessage handler set up.");
            }
            const [recorder, , stream] = await startAudioRecorderWorklet(adkAudioRecorderHandler);
            audioRecorderNode = recorder;
            localMicStream = stream;
            
            updateMicIcon(true, websocket && websocket.readyState === WebSocket.OPEN);
            addMessageToChat("system", "Microphone activated.");
            console.log("[AudioInit] Audio recording started successfully.");
        } catch (err) {
            console.error("Error starting audio processing in initializeAndStartAudioCapture:", err);
            addMessageToChat("error", `Could not start microphone: ${err.message}. Please check permissions.`);
            updateMicIcon(false, websocket && websocket.readyState === WebSocket.OPEN);
            userDesiredAudioMode = false; // Revert desired mode if mic fails
            isWsAudioMode = false; // Revert actual mode
            // Consider switching back to text mode WebSocket if audio init fails
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                 // If WS was for audio, close it and reconnect in text.
                console.log("[AudioInit] Mic failed, attempting to revert to text mode WebSocket.");
                await connectWebSocketInternal(false); // Reconnect in text mode
            }
        }
    }

    function stopAudioCaptureAndProcessing() {
        console.log("[AudioStop] Attempting to stop audio capture. Mic paused for agent speech:", isMicPausedForAgentSpeech);
        // If there's any pending audio in the buffer, send it before stopping
        if (audioChunkBuffer.length > 0) {
            console.log("[AudioStop] Sending remaining buffered audio before stopping...");
            let totalBufferedBytes = 0;
            for (const chunk of audioChunkBuffer) {
                totalBufferedBytes += chunk.byteLength;
            }
            const concatenatedBuffer = new Uint8Array(totalBufferedBytes);
            let offset = 0;
            for (const chunk of audioChunkBuffer) {
                concatenatedBuffer.set(new Uint8Array(chunk), offset);
                offset += chunk.byteLength;
            }
            const base64Data = arrayBufferToBase64(concatenatedBuffer.buffer);
            const actualSampleRate = 16000;
             sendMessageToServer({
                mime_type: "audio/pcm",
                data: base64Data,
            });
            console.log(`[AudioStop] Sent remaining ${concatenatedBuffer.byteLength} bytes.`);
        }
        audioChunkBuffer = []; // Clear buffer on stop

        if (localMicStream) {
            stopMicrophone(localMicStream);
            localMicStream = null;
            console.log("[AudioStop] Microphone stream stopped.");
        }
        if (isMicPausedForAgentSpeech) {
            console.log("[AudioStop] Resetting isMicPausedForAgentSpeech to false as audio capture is stopping.");
            isMicPausedForAgentSpeech = false;
        }
        // audioRecorderNode and audioPlayerNode are managed by their worklets
        updateMicIcon(false, websocket && websocket.readyState === WebSocket.OPEN);
        // addMessageToChat("system", "Microphone deactivated."); // Message sent by micIcon handler
        console.log("[AudioStop] Audio processing stopped.");
    }
    
    function adkAudioRecorderHandler(pcmDataBuffer) {
        if (!isWsAudioMode || !websocket || websocket.readyState !== WebSocket.OPEN || !audioRecorderNode || !audioRecorderNode.context) {
            // Added checks for audioRecorderNode and its context
            if (!audioRecorderNode || !audioRecorderNode.context) {
                console.warn("[AudioSend] audioRecorderNode or its context is not available. Cannot send audio with sample rate.");
            }
            return;
        }

        // pcmDataBuffer is a Float32Array. Convert it to 16-bit PCM.
        // const float32Samples = pcmDataBuffer; // pcmDataBuffer is now expected to be an ArrayBuffer of 16-bit PCM

        // --- BEGIN REFINED CLIENT-SIDE DEBUG LOGGING ---
        if (typeof pcmDataBuffer === 'undefined') {
            console.error("[AudioSend DEBUG] pcmDataBuffer argument is UNDEFINED in adkAudioRecorderHandler. This is unexpected if audio-modules.js is correct.");
            return; // Cannot proceed
        } else if (pcmDataBuffer === null) {
            console.error("[AudioSend DEBUG] pcmDataBuffer argument is NULL in adkAudioRecorderHandler. This is unexpected.");
            return; // Cannot proceed
        } else {
            // pcmDataBuffer should be an ArrayBuffer from audio-modules.js (already 16-bit PCM)
            console.log(`[AudioSend DEBUG] adkAudioRecorderHandler received pcmDataBuffer. Type: ${typeof pcmDataBuffer}, instanceof ArrayBuffer: ${pcmDataBuffer instanceof ArrayBuffer}, byteLength: ${pcmDataBuffer.byteLength !== undefined ? pcmDataBuffer.byteLength : 'N/A'}`);
            if (!(pcmDataBuffer instanceof ArrayBuffer)) {
                console.error("[AudioSend DEBUG] CRITICAL: pcmDataBuffer is NOT an ArrayBuffer as expected from audio-modules.js! Halting audio send.");
                return; // Cannot proceed if not an ArrayBuffer
            }
            if (pcmDataBuffer.byteLength === 0) {
                 console.warn("[AudioSend DEBUG] pcmDataBuffer from audio-modules has a byteLength of 0. This will result in empty audio data being sent.");
                 // We might still send it to see if 0-length is the issue server-side, but it's problematic.
            }
        }
        if (!audioRecorderNode) console.error("[AudioSend DEBUG] audioRecorderNode is not defined at the time of adkAudioRecorderHandler call!");
        else if (!audioRecorderNode.context) console.error("[AudioSend DEBUG] audioRecorderNode.context is not defined at the time of adkAudioRecorderHandler call!");
        // --- END REFINED CLIENT-SIDE DEBUG LOGGING ---

        // The pcmDataBuffer received from audio-modules.js is ALREADY a 16-bit PCM ArrayBuffer.
        // No further conversion is needed here. The previous float32Samples logic was based on a misunderstanding.
        const int16Buffer = pcmDataBuffer; // This is an ArrayBuffer of 16-bit PCM data (e.g., 86 bytes)

        if (!int16Buffer || int16Buffer.byteLength === 0) {
            console.warn("[AudioSend] Received empty or invalid int16Buffer. Skipping.");
            return;
        }

        // Add new chunk to our buffer
        audioChunkBuffer.push(int16Buffer);

        // Calculate total size of buffered audio data
        let totalBufferedBytes = 0;
        for (const chunk of audioChunkBuffer) {
            totalBufferedBytes += chunk.byteLength;
        }

        // console.log(`[AudioSend] Buffered ${audioChunkBuffer.length} chunks, total bytes: ${totalBufferedBytes}`);

        if (totalBufferedBytes >= TARGET_AUDIO_CHUNK_SIZE_BYTES) {
            // Concatenate all ArrayBuffers in audioChunkBuffer
            const concatenatedBuffer = new Uint8Array(totalBufferedBytes);
            let offset = 0;
            for (const chunk of audioChunkBuffer) {
                concatenatedBuffer.set(new Uint8Array(chunk), offset);
                offset += chunk.byteLength;
            }
            audioChunkBuffer = []; // Clear the buffer

            const base64Data = arrayBufferToBase64(concatenatedBuffer.buffer);
            const actualSampleRate = 16000; // Audio data is resampled to 16kHz in audio-modules.js
            
            console.log(`[AudioSend] Sending buffered audio. Total bytes: ${concatenatedBuffer.byteLength}, Sample rate: ${actualSampleRate}, Base64 length: ${base64Data.length}`);
            
            sendMessageToServer({
                mime_type: "audio/pcm",
                data: base64Data,
            });
        }
    }

    async function connectWebSocketInternal(audioModeForThisConnection) {
        console.log(`[WSInternal] connectWebSocketInternal called. audioModeForThisConnection: ${audioModeForThisConnection}, WebSocket state: ${websocket ? websocket.readyState : 'null'}`);

        if (websocket) {
            console.log(`[WSInternal] Closing existing WebSocket (state: ${websocket.readyState}) before new connection.`);
            websocket.onopen = null;
            websocket.onmessage = null;
            websocket.onerror = null;
            websocket.onclose = null; 
            if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
                websocket.close(1000, "Client initiated new connection");
            }
            websocket = null; // Ensure old instance is cleared
        }
        
        isWsAudioMode = audioModeForThisConnection; // Set mode for this specific connection attempt
        // Ensure session ID is generated only once per widget lifecycle
        if (!currentSessionId) {
            currentSessionId = 'client_session_' + Date.now();
            console.log(`[WSInternal] Generated new client session ID: ${currentSessionId}`);
            isOverallSessionStart = true; // Mark that this is the start of an overall session
        } else {
            console.log(`[WSInternal] Reusing existing client session ID: ${currentSessionId}`);
        }
        const websocketUrl = `ws://localhost:8001/ws/agent_stream/${currentSessionId}?is_audio=${isWsAudioMode}`;

        console.log(`[WSInternal] Attempting to connect to: ${websocketUrl}`);
        addMessageToChat("system", `Connecting (audio: ${isWsAudioMode})...`);
        
        try {
            websocket = new WebSocket(websocketUrl);
        } catch (error) {
            console.error("[WSInternal] Error creating WebSocket object:", error);
            addMessageToChat("error", `Failed to create WebSocket: ${error.message}`);
            updateMicIcon(userDesiredAudioMode, false);
            return;
        }

        websocket.onopen = async () => {
            console.log(`[WSInternal] WebSocket opened (audio: ${isWsAudioMode}). State: ${websocket.readyState}`);
            addMessageToChat("system", "Connection opened.");
            if (chatInput) chatInput.disabled = false;
            updateMicIcon(userDesiredAudioMode, true);

            sendMessageToServer({ mime_type: "text/plain", data: "client_ready" });

            if (isWsAudioMode) { // If this connection is for audio
                console.log("[WSInternal] Audio mode active on WebSocket open. Initializing audio capture.");
                await initializeAndStartAudioCapture();
            } else { // Text mode connection
                if (localMicStream) { // Ensure mic is stopped if we connected in text mode
                    stopAudioCaptureAndProcessing();
                }
                // Only send the initial canned message if it's the very first message of the overall session
                if (isOverallSessionStart) {
                    sendMessageToServer({ mime_type: "text/plain", data: "Hello, how can you assist me with gardening?" });
                    isOverallSessionStart = false; // Mark that the initial message has been sent for this session
                }
            }
        };

        websocket.onmessage = (event) => {
            // console.log("[WSInternal] onmessage: Raw data:", event.data);
            let parsedData;
            try {
                parsedData = JSON.parse(event.data);
            } catch (error) {
                console.error("[WSInternal] onmessage: Error parsing JSON:", error, "Data:", event.data);
                // If data is a string and not JSON, display it as a fallback for simple text messages
                if (typeof event.data === 'string') {
                    if (!currentAgentMessageElement) currentAgentMessageElement = addMessageToChat("agent", "");
                    currentAgentMessageElement.textContent += event.data;
                    scrollToBottom();
                }
                return;
            }
            // console.log("[WSInternal] onmessage: Parsed data:", parsedData);

            if (parsedData.turn_complete === true || parsedData.interrupted === true || parsedData.interaction_completed === true) {
                currentAgentMessageElement = null; // Reset current message element
                if(parsedData.turn_complete) console.log("[WSInternal] Agent turn_complete received. Mic resumption now handled by playback_finished.");
                if(parsedData.interrupted) console.log("[WSInternal] Agent interrupted received. Mic resumption now handled by playback_finished.");
                if(parsedData.interaction_completed) console.log("[WSInternal] Agent interaction_completed received. Mic resumption now handled by playback_finished.");

                // DO NOT resume microphone here. It's now handled by the 'playback_finished' event from PCMPlayerProcessor.
                // This block can still handle other UI updates or state changes if needed.
                console.log("[WSInternal] Server signal (turn_complete/interrupted/interaction_completed) received. Microphone resumption is now contingent on client-side playback finishing.");
                return; // End processing for this message
            }

            // Preserve non-voice command handling
            if (parsedData.type === "command" && parsedData.command_name === "set_theme") {
                const themeValue = parsedData.payload?.theme;
                if (themeValue) {
                    console.log(`[WSInternal] Received 'set_theme': ${themeValue}`);
                    window.parent.postMessage({ "type": "SET_WEBSITE_THEME", "payload": themeValue }, 'http://localhost:5000');
                }
                currentAgentMessageElement = null; return;
            }
            if (parsedData.type === "command" && parsedData.command_name === "refresh_cart") {
                console.log(`[WSInternal] Received 'refresh_cart'. Payload:`, parsedData.payload);
                let messageToParent = { "type": "REFRESH_CART_DISPLAY" };
                if (parsedData.payload && parsedData.payload.added_item) { // Assuming payload contains added_item from server
                    messageToParent.added_item_details = parsedData.payload.added_item;
                    console.log(`[WSInternal] Attaching added_item_details to REFRESH_CART_DISPLAY message:`, parsedData.payload.added_item);
                } else {
                    console.log(`[WSInternal] No added_item_details in refresh_cart payload.`);
                }
                window.parent.postMessage(messageToParent, 'http://localhost:5000');
                currentAgentMessageElement = null; return;
            }
            if (parsedData.type === "product_recommendations" && parsedData.payload) {
               console.log("[WSInternal] Received product_recommendations.");
               addProductRecommendationsToChat(parsedData.payload);
               currentAgentMessageElement = null; return;
            }
            // Removed old trigger_checkout_modal handler
            // else if (parsedData.type === "command" && parsedData.command_name === "trigger_checkout_modal") {
            //     console.log(`[WSInternal] Received 'trigger_checkout_modal'. Relaying to parent.`);
            //     window.parent.postMessage({ type: 'initiate_checkout' }, '*');
            //     currentAgentMessageElement = null;
            //     console.log("[WSInternal] Posted 'initiate_checkout' message to parent window.");
            //     return;
            // }
            else if (parsedData.action === "display_ui" && parsedData.ui_element) {
                console.log(`[WSInternal] Received 'display_ui' action for element: ${parsedData.ui_element}. Relaying to parent. Payload:`, parsedData.payload);
                window.parent.postMessage({
                    type: "display_ui_component", // New type for main script
                    ui_element: parsedData.ui_element,
                    payload: parsedData.payload
                }, 'http://localhost:5000'); // Ensure correct origin
                currentAgentMessageElement = null; 
                return;
            } else if (parsedData.type === "ui_command" && parsedData.command_name) {
                // Handle other generic UI commands from the agent, relayed from streaming_server.py
                // This block might become redundant if all UI updates switch to the "display_ui" action format
                console.log(`[WSInternal] Received legacy 'ui_command': ${parsedData.command_name}. Relaying to parent with payload:`, parsedData.payload);
                // Post the entire parsedData object as it contains type, command_name, and payload
                window.parent.postMessage(parsedData, 'http://localhost:5000');
                currentAgentMessageElement = null; // Assuming UI commands don't have direct text for chat display in widget
                return; // Command relayed, done with this message
            }

            // Standard content messages
            if (parsedData.mime_type === "audio/pcm" && audioPlayerNode) {
                console.log("[WSInternal] Received audio/pcm from agent. User desires audio:", userDesiredAudioMode, "Mic stream exists:", !!localMicStream, "Mic paused for agent speech:", isMicPausedForAgentSpeech);
                // Agent is about to speak, pause microphone input if conditions met
                if (userDesiredAudioMode && localMicStream && !isMicPausedForAgentSpeech) {
                    console.log("[WSInternal] Agent audio playback starting. Pausing microphone input.");
                    pauseMicrophoneInput(localMicStream); // Ensure this function reliably stops sending mic data
                    isMicPausedForAgentSpeech = true;
                    console.log("[WSInternal] Microphone input paused. isMicPausedForAgentSpeech set to true.");
                    waitingForAgentPlaybackToFinish = true;
                    console.log("[WSInternal] waitingForAgentPlaybackToFinish set to true.");
                } else {
                    if (!userDesiredAudioMode) console.log("[WSInternal] Agent audio playback starting, but userDesiredAudioMode is false. Mic not paused.");
                    if (!localMicStream) console.log("[WSInternal] Agent audio playback starting, but localMicStream is null. Mic not paused.");
                    if (isMicPausedForAgentSpeech) console.log("[WSInternal] Agent audio playback starting, but isMicPausedForAgentSpeech is already true. Mic not paused again (already paused or waiting).");
                    // If mic is already paused for agent speech, we might still be waiting for previous playback to finish.
                    // Ensure waitingForAgentPlaybackToFinish is set if new audio comes in while already paused.
                    if(isMicPausedForAgentSpeech && !waitingForAgentPlaybackToFinish) {
                        waitingForAgentPlaybackToFinish = true;
                        console.log("[WSInternal] New agent audio while already paused, setting waitingForAgentPlaybackToFinish to true.");
                    }
                }

                if (typeof parsedData.data === 'string') {
                    const audioData = base64ToArrayBuffer(parsedData.data);
                    console.log("[WSInternal] Posting audio data to player worklet. Byte length:", audioData.byteLength);
                    audioPlayerNode.port.postMessage(audioData);
                } else {
                    console.warn("[WSInternal] Audio data received from agent is not a string. Cannot play.");
                }
            } else if (parsedData.mime_type === "text/plain" && typeof parsedData.data === 'string') {
                // If it's the first chunk for this agent message, create the element.
                if (!currentAgentMessageElement) {
                    currentAgentMessageElement = addMessageToChat("agent", parsedData.data);
                } else {
                    // If it's a partial update, append.
                    // If it's a full text update for the current message (partial is often null/false), replace.
                    if (parsedData.partial === true) {
                        currentAgentMessageElement.textContent += parsedData.data;
                    } else {
                        // Assuming non-partial or final chunk for this turn segment means full text
                        currentAgentMessageElement.textContent = parsedData.data;
                    }
                }
                scrollToBottom();
            } else {
                console.log("[WSInternal] Unhandled message structure:", parsedData);
            }
        };

        websocket.onclose = (event) => {
            console.log(`[WSInternal] onclose: Code: ${event.code}, Reason: '${event.reason}', Clean: ${event.wasClean}, WS State: ${websocket ? websocket.readyState : 'N/A'}`);
            addMessageToChat("system", `Connection closed. Code: ${event.code}.`);
            if (chatInput) chatInput.disabled = true;
            
            stopAudioCaptureAndProcessing(); // Ensure audio is stopped on any close
            isWsAudioMode = false; // Reflect that the connection is no longer in audio mode
            // userDesiredAudioMode remains as is, so UI reflects intent if user tries to reconnect
            updateMicIcon(userDesiredAudioMode, false); 
            websocket = null; // Clear the instance
        };

        websocket.onerror = (error) => {
            console.error("[WSInternal] onerror:", error);
            addMessageToChat("error", "WebSocket connection error.");
            if (chatInput) chatInput.disabled = true;

            stopAudioCaptureAndProcessing();
            isWsAudioMode = false;
            updateMicIcon(userDesiredAudioMode, false);
            websocket = null;
        };
    }

    function sendMessageToServer(payload) {
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            console.warn("[C2S] WebSocket not open/ready. Message not sent.", payload, `State: ${websocket ? websocket.readyState : 'null'}`);
            addMessageToChat("error", "Cannot send: Connection not open.");
            return;
        }

        let isValidPayload = false;
        let logSummary = "";

        // Validate and log simple payload (text, audio)
        if (payload.hasOwnProperty('mime_type') && payload.hasOwnProperty('data')) {
            if (payload.mime_type && typeof payload.data !== 'undefined') {
                isValidPayload = true;
                if (payload.mime_type === "audio/pcm") {
                    logSummary = `[C2S] Sending audio/pcm. Data length (base64): ${payload.data ? String(payload.data).length : 'N/A'}`;
                } else {
                    const dataPreview = typeof payload.data === 'string' && payload.data.length > 30 ? payload.data.substring(0,30) + "..." : payload.data;
                    logSummary = `[C2S] Sending simple message. Type: ${payload.mime_type}, Data preview: ${dataPreview}`;
                }
            } else {
                console.error("[C2S] Invalid simple message. MimeType:", payload.mime_type, "Data:", payload.data);
                addMessageToChat("error", "Attempted to send invalid message content.");
                return;
            }
        }
        // Validate and log 'parts' payload (multimodal)
        else if (payload.hasOwnProperty('parts') && Array.isArray(payload.parts)) {
            logSummary = `[C2S] Sending multimodal message with ${payload.parts.length} parts.`;
            isValidPayload = true; // Assume valid initially, check parts below
            for (let i = 0; i < payload.parts.length; i++) {
                const part = payload.parts[i];
                if (!part || !part.mime_type || typeof part.data === 'undefined') {
                    console.error(`[C2S] Invalid part in multimodal message. Part ${i}:`, part);
                    addMessageToChat("error", `Attempted to send invalid content in part ${i+1} of a multipart message.`);
                    isValidPayload = false; // Mark as invalid
                    break;
                }
                let dataPreview;
                if (typeof part.data === 'string') {
                    if (part.data.length > 30) {
                        dataPreview = part.data.substring(0, 30) + "...";
                    } else {
                        dataPreview = part.data; // Show the full short string
                    }
                } else {
                    dataPreview = typeof part.data;
                }
                logSummary += `\n  [Part ${i+1}] Type: ${part.mime_type}, Data preview: ${dataPreview}`;
            }
            if (!isValidPayload) return; // Do not send if any part was invalid
        }
        // Unknown payload structure
        else {
            console.error("[C2S] Unknown payload structure. Cannot validate or log properly:", payload);
            addMessageToChat("error", "Attempted to send message with unknown structure.");
            return;
        }

        if (isValidPayload) {
            console.log(logSummary); // Log the summary before sending
            const messageJson = JSON.stringify(payload);
            websocket.send(messageJson);
            // console.log("[C2S] Message sent to WebSocket."); // Optional: confirm after send
        }
    }

    function clearStagedImage() {
        stagedImage = null;
        if (currentImagePreviewElement) {
            currentImagePreviewElement.remove();
            currentImagePreviewElement = null;
        }
        if (chatInput) {
            chatInput.placeholder = "Type your message...";
        }
        if (cameraViewContainer && cameraViewContainer.style.display !== 'none') {
            cameraViewContainer.style.display = 'none';
            if (textChatContainer) textChatContainer.style.display = 'flex'; // Show chat
        }
        console.log("[ImageClear] Staged image cleared.");
    }
 
    // Modified to handle both file uploads and camera captures
    function addImagePreviewToChat(base64ImageDataUrl, imageName = "Captured Image", imageSizeText = "") {
        console.log(`[ImagePreview] Adding image preview. Name: ${imageName}, Size: ${imageSizeText}`);
        if (currentImagePreviewElement) { // Clear previous preview if any
            console.log("[ImagePreview] Removing existing preview element.");
            currentImagePreviewElement.remove();
        }
 
        const previewContainer = document.createElement('div');
        previewContainer.classList.add('message', 'user-message', 'staged-image-preview-container');
        
        const textElement = document.createElement('p');
        let previewMessage = `Image ready: ${imageName}`;
        if (imageSizeText) {
            previewMessage += ` (${imageSizeText})`;
        }
        previewMessage += ". Add your query:";
        textElement.textContent = previewMessage;
        
        const imgPreview = document.createElement('img');
        imgPreview.src = base64ImageDataUrl;
        imgPreview.style.maxWidth = '150px';
        imgPreview.style.maxHeight = '150px';
        imgPreview.style.borderRadius = '4px';
        imgPreview.style.marginTop = '5px';
        imgPreview.style.marginBottom = '5px';

        const cancelButton = document.createElement('button');
        cancelButton.innerHTML = '<i class="fa-solid fa-times"></i> Cancel Image';
        cancelButton.classList.add('cancel-staged-image-btn');
        cancelButton.title = "Remove this image before sending";
        cancelButton.onclick = () => {
            clearStagedImage();
        };
        
        previewContainer.appendChild(textElement);
        previewContainer.appendChild(imgPreview);
        previewContainer.appendChild(cancelButton);
        
        messageArea.appendChild(previewContainer);
        currentImagePreviewElement = previewContainer; // Store reference to the new preview
        scrollToBottom();
        if (chatInput) {
            chatInput.placeholder = "Ask a question about the image...";
            chatInput.focus();
        }
        console.log("[ImagePreview] Image preview added to chat.");
    }
    
    // --- Start Camera Functionality (Phase 2) ---
    async function startCamera() {
        console.log("[Camera] Attempting to start camera.");
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error("[Camera] getUserMedia not supported on this browser.");
            addMessageToChat("error", "Camera access is not supported by your browser.");
            return;
        }
 
        try {
            localCameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            console.log("[Camera] Camera stream obtained.");
            if (cameraFeed) {
                cameraFeed.srcObject = localCameraStream;
                cameraFeed.onloadedmetadata = () => {
                    cameraFeed.play();
                    console.log("[Camera] Camera feed playing.");
                };
            }
            if (cameraViewContainer) cameraViewContainer.style.display = 'flex';
            if (textChatContainer) textChatContainer.style.display = 'none';
            if (imageOptionsPopup) imageOptionsPopup.style.display = 'none'; // Hide options popup
            console.log("[Camera] Camera view activated.");
        } catch (err) {
            console.error("[Camera] Error accessing camera:", err);
            addMessageToChat("error", `Could not access camera: ${err.message}. Please check permissions.`);
            if (cameraViewContainer) cameraViewContainer.style.display = 'none';
            if (textChatContainer) textChatContainer.style.display = 'flex'; // Revert to chat view
            localCameraStream = null; // Ensure stream is null on error
        }
    }
 
    function stopCamera() {
        console.log("[Camera] Attempting to stop camera stream.");
        if (localCameraStream) {
            localCameraStream.getTracks().forEach(track => {
                track.stop();
                console.log(`[Camera] Track stopped: ${track.kind}`);
            });
            localCameraStream = null;
            if (cameraFeed) cameraFeed.srcObject = null;
            console.log("[Camera] Camera stream stopped and resources released.");
        }
        if (cameraViewContainer) cameraViewContainer.style.display = 'none';
        if (textChatContainer && textChatContainer.style.display === 'none') { // Only show if it was hidden
             textChatContainer.style.display = 'flex';
        }
    }
 
    function capturePhoto() {
        console.log("[Camera] Attempting to capture photo.");
        if (!localCameraStream || !cameraFeed || !photoCanvas) {
            console.error("[Camera] Cannot capture photo. Stream, feed, or canvas not available.");
            addMessageToChat("error", "Could not capture photo. Camera not ready.");
            return;
        }
 
        const context = photoCanvas.getContext('2d');
        photoCanvas.width = cameraFeed.videoWidth;
        photoCanvas.height = cameraFeed.videoHeight;
        context.drawImage(cameraFeed, 0, 0, photoCanvas.width, photoCanvas.height);
        console.log(`[Camera] Photo drawn to canvas. Dimensions: ${photoCanvas.width}x${photoCanvas.height}`);
 
        const imageDataUrl = photoCanvas.toDataURL('image/jpeg'); // Or 'image/png'
        console.log("[Camera] Photo converted to Data URL.");
 
        // Stage the image
        stagedImage = {
            mime_type: 'image/jpeg', // Or 'image/png'
            data: imageDataUrl.split(',')[1] // Get base64 part
        };
        console.log("[Camera] Image staged. MIME type: image/jpeg");
 
        addImagePreviewToChat(imageDataUrl, `captured_photo_${Date.now()}.jpg`);
 
        stopCamera(); // Stop camera and hide camera view
        // Text chat container should be made visible by stopCamera if it was hidden
        console.log("[Camera] Photo capture process complete. Camera stopped, preview shown.");
    }
 
    if (cameraBtn) {
        cameraBtn.addEventListener('click', () => {
            console.log("[UI] 'Camera' button clicked.");
            startCamera();
        });
    }
 
    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            console.log("[UI] 'Capture Photo' button clicked.");
            capturePhoto();
        });
    }
 
    if (cancelCameraBtn) {
        cancelCameraBtn.addEventListener('click', () => {
            console.log("[UI] 'Cancel Camera' button clicked.");
            stopCamera();
            clearStagedImage(); // Also clear any staged image if cancelling camera view
            if (imageOptionsPopup) imageOptionsPopup.style.display = 'none'; // Ensure options popup is hidden
            console.log("[UI] Camera cancelled and view reset.");
        });
    }
    // --- End Camera Functionality (Phase 2) ---
 
    function addMessageToChat(sender, text, imageInfo = null) {
        // console.log(`[addMessageToChat] ${sender}: ${text.substring(0, 50)}...`);
        if (!messageArea) {
            console.error("[addMessageToChat] messageArea is null.");
            return null;
        }
        const messageContainer = document.createElement('div');
        messageContainer.classList.add('message', sender === 'user' ? 'user-message' : 'agent-message');
        
        const textElement = document.createElement('p');
        textElement.textContent = text;
        messageContainer.appendChild(textElement);

        if (sender === 'user' && imageInfo && imageInfo.base64DataUrl) {
            const imgPreview = document.createElement('img');
            imgPreview.src = imageInfo.base64DataUrl;
            imgPreview.alt = imageInfo.name || "User image";
            imgPreview.style.maxWidth = '150px';
            imgPreview.style.maxHeight = '150px';
            imgPreview.style.borderRadius = '4px';
            imgPreview.style.marginTop = '5px';
            messageContainer.appendChild(imgPreview);
        }
        
        const timestampElement = document.createElement('span');
        timestampElement.classList.add('timestamp');
        timestampElement.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageContainer.appendChild(timestampElement);
        
        messageArea.appendChild(messageContainer);
        scrollToBottom();
        return textElement; // Might need to return messageContainer if more complex
    }

   function scrollToBottom() {
       if (messageArea) messageArea.scrollTop = messageArea.scrollHeight;
   }

    function addProductRecommendationsToChat(recommendationPayload) {
       if (!messageArea) { console.error("messageArea null in addProductRecommendationsToChat"); return; }
       const { title, products } = recommendationPayload;
       const recommendationsBlock = document.createElement('div');
       recommendationsBlock.className = 'product-recommendations-block';
       if (title) {
           const titleElement = document.createElement('h3');
           titleElement.className = 'recommendations-title';
           titleElement.textContent = title;
           recommendationsBlock.appendChild(titleElement);
       }
       const cardsContainer = document.createElement('div');
       cardsContainer.className = 'product-cards-container';
       if (products && Array.isArray(products)) {
           products.forEach(product => {
               const card = document.createElement('div');
               card.className = 'product-card';
               if (product.id) card.dataset.productId = product.id;
               const image = document.createElement('img');
               image.className = 'product-card-image';
               image.src = product.image_url || 'https://via.placeholder.com/60';
               image.alt = product.name || 'Product Image';
               const details = document.createElement('div');
               details.className = 'product-card-details';
               const nameElement = document.createElement('p');
               nameElement.className = 'product-card-name';
               nameElement.textContent = product.name || 'Unnamed Product';
               const priceElement = document.createElement('p');
               priceElement.className = 'product-card-price';
               priceElement.textContent = product.price || '';
               details.appendChild(nameElement);
               details.appendChild(priceElement);
               const link = document.createElement('a');
               link.className = 'product-card-link';
               link.href = product.product_url || '#';
               link.target = '_blank';
               link.setAttribute('aria-label', `View product ${product.name || ''}`);
               const icon = document.createElement('i');
               icon.className = 'fas fa-external-link-alt';
               link.appendChild(icon);
               card.appendChild(image);
               card.appendChild(details);
               card.appendChild(link);
               cardsContainer.appendChild(card);
           });
       }
       recommendationsBlock.appendChild(cardsContainer);
       messageArea.appendChild(recommendationsBlock);
       scrollToBottom();
    }

    agentWidget.addEventListener('widgetOpened', () => {
        console.log("Widget opened event received. Connecting in text mode.");
        userDesiredAudioMode = false; // Ensure initial desire is text
        // If currentSessionId is already set, it means we are re-opening/re-connecting, not a brand new session start.
        // The connectWebSocketInternal will handle generating it if it's null.
        connectWebSocketInternal(false);
    });

    function closeAndResetWidget() {
        userDesiredAudioMode = false; // Reset desired mode
        if (isWsAudioMode || localMicStream) stopAudioCaptureAndProcessing(); // Stop audio if it was active
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.close(1000, "Widget closing");
        }
        websocket = null;
        isWsAudioMode = false;
        if(messageArea) messageArea.innerHTML = '';
        agentWidget.dispatchEvent(new CustomEvent('widgetClosed', { bubbles: true }));
        updateMicIcon(false, false);
        if (chatInput) chatInput.disabled = true;
    }

    const sendButton = agentWidget.querySelector('.send-btn');
    if (sendButton && chatInput) {
        sendButton.addEventListener('click', () => {
            const textMessage = chatInput.value.trim();
            if (stagedImage) {
                if (textMessage === '') {
                    addMessageToChat("system", "Please add a text query for the staged image.");
                    return;
                }
                // Send combined image and text
                addMessageToChat("user", textMessage, { name: stagedImage.name, base64DataUrl: stagedImage.dataUrl });
                const augmentedTextMessage = "What is in the image I just uploaded? Also, " + textMessage;
                sendMessageToServer({
                    parts: [
                        { mime_type: stagedImage.mime_type, data: stagedImage.data },
                        { mime_type: "text/plain", data: augmentedTextMessage }
                    ]
                });
                clearStagedImage();
                chatInput.value = '';
                initialGreetingSent = true;
            } else if (textMessage !== '') {
                // Send text only
                addMessageToChat("user", textMessage);
                sendMessageToServer({ mime_type: "text/plain", data: textMessage });
                chatInput.value = '';
                initialGreetingSent = true;
            }
        });
    }

    // --- New Image Handling Logic ---
    if (imageOptionsToggleBtn && imageOptionsPopup) {
        imageOptionsToggleBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from bubbling to document
            const isPopupVisible = imageOptionsPopup.style.display === 'flex';
            imageOptionsPopup.style.display = isPopupVisible ? 'none' : 'flex';
        });

        // Hide popup if clicked outside
        document.addEventListener('click', (event) => {
            if (imageOptionsPopup.style.display === 'flex' &&
                !imageOptionsPopup.contains(event.target) &&
                !imageOptionsToggleBtn.contains(event.target)) {
                imageOptionsPopup.style.display = 'none';
            }
        });
    }

    if (uploadLocalBtn && imageUploadInput) {
        uploadLocalBtn.addEventListener('click', () => {
            if (!websocket || websocket.readyState !== WebSocket.OPEN) {
                addMessageToChat("error", "Cannot upload image: Connection not open.");
                return;
            }
            imageUploadInput.click(); // Trigger the hidden file input
            if (imageOptionsPopup) imageOptionsPopup.style.display = 'none';
        });
    }

    if (cameraBtn) {
        cameraBtn.addEventListener('click', () => {
            // Placeholder for Phase 2: Camera Functionality
            console.log("Camera button clicked - functionality to be implemented in Phase 2.");
            addMessageToChat("system", "Camera functionality not yet implemented.");
            if (cameraViewContainer) {
                // Example: Show camera view (actual stream setup in Phase 2)
                // cameraViewContainer.style.display = 'flex';
                // textChatContainer.style.display = 'none'; // Optionally hide chat
            }
            if (imageOptionsPopup) imageOptionsPopup.style.display = 'none';
        });
    }
    
    // Placeholder for camera view controls (Phase 2)
    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            console.log("Capture photo button clicked - Phase 2");
            // Logic to capture from cameraFeed to photoCanvas, then stageImage
        });
    }
    if (cancelCameraBtn) {
        cancelCameraBtn.addEventListener('click', () => {
            console.log("Cancel camera button clicked - Phase 2");
            // Logic to hide cameraViewContainer, stop camera stream
            // if (cameraViewContainer) cameraViewContainer.style.display = 'none';
            // if (textChatContainer) textChatContainer.style.display = 'flex';
        });
    }


    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) { // 5MB limit
                    addMessageToChat("error", "Image is too large. Max 5MB allowed.");
                    imageUploadInput.value = ''; // Reset input
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64ImageDataUrl = e.target.result; // This is data URL: "data:image/jpeg;base64,..."
                    const mimeType = file.type;
                    
                    stagedImage = {
                        name: file.name,
                        mime_type: mimeType, // Standardized to mime_type
                        data: base64ImageDataUrl.split(',')[1], // Standardized to data
                        dataUrl: base64ImageDataUrl // For local preview
                    };
                    
                    addImagePreviewToChat(base64ImageDataUrl, file.name, `${(file.size / 1024).toFixed(1)}KB`);
                    // DO NOT send immediately. Wait for text query.
                };
                reader.onerror = (error) => {
                    console.error("Error reading file:", error);
                    addMessageToChat("error", "Error reading image file.");
                    clearStagedImage();
                };
                reader.readAsDataURL(file);
                imageUploadInput.value = ''; // Reset input for next upload
            }
        });
    }
    // --- End New Image Handling Logic ---

    if (closeButton) closeButton.addEventListener('click', () => {
        clearStagedImage();
        closeAndResetWidget();
    });
    if (minimizeButton) minimizeButton.addEventListener('click', () => {
        clearStagedImage();
        closeAndResetWidget();
    });
    if (endCallButton) endCallButton.addEventListener('click', () => {
        clearStagedImage();
        closeAndResetWidget();
    });

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && chatInput.value.trim() !== '') {
                const textMessage = chatInput.value.trim();
                if (stagedImage) {
                    if (textMessage === '') {
                        addMessageToChat("system", "Please add a text query for the staged image.");
                        return;
                    }
                     // Send combined image and text
                    addMessageToChat("user", textMessage, { name: stagedImage.name, base64DataUrl: stagedImage.dataUrl });
                    const augmentedTextMessage = "What is in the image I just uploaded? Also, " + textMessage;
                    sendMessageToServer({
                        parts: [
                            { mime_type: stagedImage.mime_type, data: stagedImage.data },
                            { mime_type: "text/plain", data: augmentedTextMessage }
                        ]
                    });
                    clearStagedImage();
                    chatInput.value = '';
                    initialGreetingSent = true;
                } else if (textMessage !== '') {
                    // Send text only
                    addMessageToChat("user", textMessage);
                    sendMessageToServer({ mime_type: "text/plain", data: textMessage });
                    chatInput.value = '';
                    initialGreetingSent = true;
                }
            }
        });
        chatInput.disabled = true; 
    }

    if (micIcon) {
        micIcon.disabled = true; 
        micIcon.addEventListener('click', async () => {
            console.log(`[MicIcon Click] Current userDesiredAudioMode: ${userDesiredAudioMode}, current WS audio mode: ${isWsAudioMode}`);
            userDesiredAudioMode = !userDesiredAudioMode; // Toggle user's intent

            if (userDesiredAudioMode) { // User wants to START audio
                addMessageToChat("system", "Switching to audio mode...");
                showUIMode(true); // Update UI immediately to reflect intent
                // connectWebSocketInternal will handle closing old socket and opening new one in audio mode.
                // initializeAndStartAudioCapture will be called in websocket.onopen if successful.
                await connectWebSocketInternal(true); 
            } else { // User wants to STOP audio (switch to text mode)
                addMessageToChat("system", "Switching to text mode...");
                stopAudioCaptureAndProcessing(); // Stop mic capture immediately
                showUIMode(false); // Update UI
                // connectWebSocketInternal will handle closing old (audio) socket and opening new one in text mode.
                await connectWebSocketInternal(false);
            }
            updateMicIcon(userDesiredAudioMode, websocket && websocket.readyState === WebSocket.OPEN);
        });
    }

    if (chatIcon) { // Fallback to ensure text mode can be activated
        chatIcon.addEventListener('click', () => {
            console.log("[ChatIcon Click] Switching to text mode.");
            userDesiredAudioMode = false;
            stopAudioCaptureAndProcessing();
            showUIMode(false);
            connectWebSocketInternal(false);
            updateMicIcon(false, websocket && websocket.readyState === WebSocket.OPEN);
        });
    }
    
    if (videoToggleButton) {
        videoToggleButton.disabled = true; 
    }
    
    // Initial UI state
    showUIMode(false); // Start in text mode UI
    updateMicIcon(false, false); // Mic disabled initially

    // Listen for payment selection events from script.js (running in the same document)
    document.addEventListener('checkoutPaymentSelected', (event) => {
        if (event.detail) { // Make sure detail exists
            console.log("[Agent Widget] Received 'checkoutPaymentSelected' DOM event. Detail:", event.detail);
            
            // Ensure WebSocket is ready before sending
            if (!websocket || websocket.readyState !== WebSocket.OPEN) {
                console.warn("[Agent Widget] WebSocket not open/ready. Cannot send payment selection to agent.", event.detail);
                // Optionally, you could queue this message or notify the user/agent of the issue.
                // For now, just log a warning.
                return;
            }

            sendMessageToServer({
                event: "ui_event", // General event type for the agent
                sub_type: "payment_method_selected", // Specific sub_type for the agent to recognize
                data: event.detail // Contains { method: "savedCard", id: "...", ... } or { method: "newCard", status: "..." }
            });
            console.log("[Agent Widget] Payment selection details sent to agent via WebSocket.");
        } else {
            console.warn("[Agent Widget] Received 'checkoutPaymentSelected' DOM event, but event.detail is missing.");
        }
    });
});
