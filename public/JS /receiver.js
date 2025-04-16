// receiver.js

// Ensure Socket.IO client is loaded before this script
// Ensure html5-qrcode library is loaded before this script

// Establish Socket.IO connection
// The server URL might need adjustment depending on your setup
// If served from the same origin, io() is usually sufficient.
const socket = io();

// --- State Variables ---
let currentRoomCode = null;
// Using a Map to manage state for potentially multiple simultaneous transfers
const activeTransfers = new Map(); // Map<transferId, transferState>

// --- Constants ---
const TRANSFER_INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes (match server)

// --- Element Selections ---
// Initial Join Screen Elements
const initialJoinScreen = document.querySelector(".join-screen");
const connectRoomBtn = document.getElementById("receiver-start-con-btn");
const joinInput = document.getElementById("join-id");
const scanQrBtn = document.getElementById("scan-qr-btn");
const qrScannerContainer = document.getElementById("qr-scanner-container");
const qrScannerElementId = "qr-scanner"; // ID of the div *inside* the container for Html5Qrcode

// File Transfer Screen Elements
const fileShareScreen = document.querySelector(".fs-screen"); // The whole section
// Container where dynamically generated file items are added
const receivedFilesContainer = document.getElementById("received-files");
const cancelTransferBtn = document.getElementById("cancel-download"); // Cancel button in footer

// Optional Status Message Element (Add to HTML if needed)
const statusMessageElement = document.getElementById("status-message");

// QR Code Scanner Instance Holder
let html5QrCode = null;

// --- Utility Functions ---

/**
 * Updates a status message area on the page, or logs to console if element not found.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - If true, displays the message as an error (e.g., red text).
 */
function updateStatusMessage(message, isError = false) {
    if (statusMessageElement) {
        statusMessageElement.textContent = message;
        statusMessageElement.style.color = isError ? 'var(--accent-error, #a94442)' : 'inherit'; // Use CSS variable
        statusMessageElement.style.display = 'block'; // Ensure it's visible
    } else {
        // Fallback logging
        if (isError) {
            console.error(`Status [Receiver]: ${message}`);
        } else {
            console.log(`Status [Receiver]: ${message}`);
        }
    }
}

/**
 * Initializes a file writer using the File System Access API if available.
 * Prompts the user to select a save location.
 * Returns the writable stream or null if cancelled, errored, or API not supported.
 * @param {string} filename - Suggested filename for the save dialog.
 * @param {string} transferId - The unique ID for this transfer.
 * @returns {Promise<FileSystemWritableFileStream|null>}
 */
async function initializeFileWriter(filename, transferId) {
    try {
        // Check if the API is supported
        if ('showSaveFilePicker' in window) {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                // Define acceptable file types (using a generic default)
                types: [{
                    description: 'Downloaded File',
                    accept: { 'application/octet-stream': ['.*'] } // Generic catch-all
                }],
            });
            console.log(`File handle obtained for ${filename} (Transfer: ${transferId})`);
            // Create a writable stream
            return await handle.createWritable();
        } else {
            console.warn("File System Access API not supported. Using memory buffer fallback.");
            return null; // Indicate fallback needed
        }
    } catch (err) {
        // Handle errors, especially user cancellation
        if (err.name === 'AbortError') {
            console.log(`User cancelled save dialog for ${filename} (Transfer: ${transferId}).`);
            // Notify sender and handle local error state
            socket.emit("transfer-cancel", { transferId, reason: "Receiver cancelled save." });
            handleTransferError(transferId, "Save cancelled by user.");
        } else {
            console.error(`FileSystem API error for ${filename}:`, err);
            handleTransferError(transferId, `File system error: ${err.message}`);
        }
        return null; // Indicate failure
    }
}

/**
 * Switches between the initial join UI and the file transfer UI.
 * @param {'join' | 'transfer'} screenToShow - Which screen to display.
 */
function showScreen(screenToShow) {
    if (initialJoinScreen) {
        initialJoinScreen.style.display = screenToShow === 'join' ? 'block' : 'none';
    }
    if (fileShareScreen) {
        fileShareScreen.style.display = screenToShow === 'transfer' ? 'block' : 'none';
    }
    // Stop QR scanner if navigating away from the join screen
    if (screenToShow !== 'join' && html5QrCode && html5QrCode.isScanning) {
        stopQrScanner();
    }
    // Ensure QR scanner container is hidden when showing join screen initially
    if (screenToShow === 'join' && qrScannerContainer) {
         qrScannerContainer.style.display = "none";
    }
}

// --- QR Code Scanner Functions ---

/**
 * Starts the QR code scanner using html5-qrcode library.
 */
function startQrScanner() {
    // Ensure the target element exists in the container
    if (!qrScannerContainer) {
         console.error("QR Scanner container element not found.");
         return;
    }
    // Dynamically add the target div if it doesn't exist
    if (!document.getElementById(qrScannerElementId)) {
        const scannerDiv = document.createElement('div');
        scannerDiv.id = qrScannerElementId;
        qrScannerContainer.innerHTML = ''; // Clear previous content/errors
        qrScannerContainer.appendChild(scannerDiv);
         console.log(`Created QR Scanner element #${qrScannerElementId}`);
    }

     qrScannerContainer.style.display = "block"; // Show the container

    if (html5QrCode && html5QrCode.isScanning) {
        console.log("QR Scanner already running.");
        return;
    }

    // Create a new instance targeting the specific div ID
    html5QrCode = new Html5Qrcode(qrScannerElementId);
    const qrConfig = {
        fps: 10, // Scan rate
        qrbox: { width: 250, height: 250 }, // Scanning box size
        rememberLastUsedCamera: true, // Improve user experience
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] // Only use camera
     };

    // Function to handle successful scan
    const onScanSuccess = (decodedText, decodedResult) => {
        console.log(`QR Code detected: ${decodedText}`);
        stopQrScanner();
        if (joinInput) {
            joinInput.value = decodedText; // Populate input field
        }
        handleJoinRoom(); // Attempt to join room automatically
    };

    // Function to handle errors (called continuously during scanning)
    const onScanFailure = (errorMessage) => {
        // console.warn(`QR Scanner warning: ${errorMessage}`); // Can be noisy, uncomment for debugging
    };

    // Start scanning, prefer back camera
    html5QrCode.start({ facingMode: "environment" }, qrConfig, onScanSuccess, onScanFailure)
    .catch(err => {
        console.warn("Failed to start QR scanner with back camera:", err, "Trying default camera...");
        // If back camera fails, try starting with any available camera
        html5QrCode.start({ }, qrConfig, onScanSuccess, onScanFailure)
        .catch(finalErr => {
             console.error("Failed to start QR scanner with any camera:", finalErr);
              qrScannerContainer.innerHTML = `<p style="color: red; padding: 1rem;">Could not start QR Scanner. Please ensure camera permissions are granted. Error: ${finalErr.message}</p>`;
        });
    });
     updateStatusMessage("Point camera at the QR code...");
}

/**
 * Stops the active QR code scanner instance.
 */
function stopQrScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop()
            .then(() => {
                console.log("QR Scanner stopped successfully.");
                if (qrScannerContainer) {
                    qrScannerContainer.style.display = "none"; // Hide container
                    // Optionally clear the inner content
                    const scannerDiv = document.getElementById(qrScannerElementId);
                    if(scannerDiv) scannerDiv.innerHTML = '';
                }
            })
            .catch(err => {
                console.error("Error stopping QR scanner:", err);
                // Still hide the container even if stopping failed
                 if (qrScannerContainer) qrScannerContainer.style.display = "none";
            })
            .finally(() => {
                html5QrCode = null; // Clear instance variable
            });
    } else {
        // Ensure container is hidden if scanner wasn't running
         if (qrScannerContainer) qrScannerContainer.style.display = "none";
    }
}

// --- Room Joining ---

/**
 * Handles the logic for joining a room using the value in the input field.
 */
function handleJoinRoom() {
    if (!joinInput) return; // Should not happen if elements are selected correctly

    const roomCode = joinInput.value.trim();
    if (!roomCode) {
        updateStatusMessage("Please enter a valid room code.", true);
        return;
    }
    stopQrScanner(); // Stop scanner if it was running
    updateStatusMessage(`Attempting to join room ${roomCode}...`);
    // Disable button while attempting?
    if(connectRoomBtn) connectRoomBtn.disabled = true;
    socket.emit("join-room", { roomCode });
}

// --- Socket Event Handlers ---

socket.on("connect", () => {
    console.log("✅ Connected to server with ID:", socket.id);
    showScreen('join'); // Show join screen on connect/reconnect
    updateStatusMessage("Enter Room Code or Scan QR Code to join.");
     if(connectRoomBtn) connectRoomBtn.disabled = false; // Re-enable button
});

socket.on("disconnect", (reason) => {
    console.log(`🔌 Disconnected from server: ${reason}`);
    showScreen('join');
    updateStatusMessage(`Disconnected: ${reason}. Please rejoin.`, true);
    // Abort all active transfers on disconnect
    for (const transferId of activeTransfers.keys()) {
        handleTransferError(transferId, "Disconnected from server");
    }
    activeTransfers.clear();
    currentRoomCode = null;
     if(connectRoomBtn) connectRoomBtn.disabled = false; // Re-enable button
});

socket.on("join-success", (roomCode) => {
    console.log(`✅ Joined room: ${roomCode}`);
    currentRoomCode = roomCode;
    showScreen('transfer'); // Switch to the file transfer view
    updateStatusMessage(`Joined Room ${roomCode}. Waiting for sender...`);
    if (receivedFilesContainer) {
        receivedFilesContainer.innerHTML = ''; // Clear any previous file list
    }
     if(connectRoomBtn) connectRoomBtn.disabled = false; // Re-enable button
});

socket.on("join-failed", (message) => {
    console.error(`❌ Failed to join room: ${message}`);
    updateStatusMessage(`Join Failed: ${message}`, true);
    showScreen('join'); // Stay on join screen
     if(connectRoomBtn) connectRoomBtn.disabled = false; // Re-enable button
});

socket.on("peer-disconnected", ({ roomCode, reason }) => {
    if (roomCode === currentRoomCode) {
        console.warn(`🚶 Peer disconnected: ${reason}`);
        updateStatusMessage(`Sender disconnected: ${reason}. Transfer aborted.`, true);
        // Abort any active transfer from this peer
        for (const [transferId, transfer] of activeTransfers.entries()) {
            // Assuming only one sender per room for now
             handleTransferError(transferId, "Sender disconnected");
        }
        // Consider forcing back to join screen after a delay?
        // setTimeout(() => {
        //     showScreen('join');
        //     updateStatusMessage("Sender left. Join a new room.", true);
        // }, 3000);
    }
});

// 1. Receive File Metadata (Creates UI Element and Initializes Transfer)
socket.on("fs-meta", async (metadata) => {
    const { transferId, filename, total_buffer_size, file_type } = metadata; // Ensure file_type is received
    console.log(`📄 Received metadata for ${filename} (ID: ${transferId}, Size: ${total_buffer_size}, Type: ${file_type})`);

    if (!receivedFilesContainer) {
        console.error("Cannot display file: #received-files container not found.");
        // Maybe notify sender of error?
        return;
    }

    if (activeTransfers.has(transferId)) {
        console.warn(`Received duplicate metadata for transfer ${transferId}. Ignoring.`);
        return;
    }

    // --- Create File Item UI Element ---
    const fileItem = document.createElement("div");
    fileItem.classList.add("file-item");
    fileItem.dataset.transferId = transferId;

    // Calculate display size
    const sizeMB = (total_buffer_size / (1024 * 1024)).toFixed(2);
    const sizeKB = (total_buffer_size / 1024).toFixed(1);
    const displaySize = total_buffer_size >= 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

    // Set inner HTML with structure for name, size, and progress
    fileItem.innerHTML = `
      <span class="file-name" title="${filename}">${filename}</span>
      <span class="file-size">${displaySize}</span>
      <div class="file-status">
          <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: 0%;"></div>
          </div>
          <span class="progress-text">0%</span>
      </div>
      <div class="file-action">
          </div>
    `;
    receivedFilesContainer.appendChild(fileItem);
    updateStatusMessage(`Preparing to receive ${filename}...`);

    // --- Initialize File Writer (Prompts User for Save Location) ---
    const fileWriter = await initializeFileWriter(filename, transferId);

    // If initializeFileWriter returned null due to error/cancel, it calls handleTransferError,
    // which sets the status to 'error'. We check that status here.
    const existingTransferState = activeTransfers.get(transferId);
    if (existingTransferState && existingTransferState.status === 'error') {
        console.log(`File writer initialization failed or was cancelled for ${transferId}. Aborting.`);
        return; // Stop processing this metadata
    }

    // If fileWriter is null but no error state set (e.g., API not supported), log fallback.
    if (fileWriter === null) {
        console.log(`Proceeding with memory buffer fallback for ${transferId}`);
    }

    // --- Initialize Transfer State ---
    const transferState = {
        metadata: { ...metadata, file_type: file_type || 'application/octet-stream' }, // Store metadata, ensure type default
        receivedSize: 0,
        progressBarFillNode: fileItem.querySelector(".progress-bar-fill"),
        progressTextNode: fileItem.querySelector(".progress-text"),
        fileItemNode: fileItem,
        status: 'starting', // starting, receiving, completing, complete, error
        fileWriter: fileWriter, // Can be null
        buffer: fileWriter ? null : [], // Use buffer only if fileWriter is null
        lastChunkTime: Date.now(),
        monitorInterval: null
    };
    activeTransfers.set(transferId, transferState);

    // Start monitoring for inactivity
    startTransferMonitor(transferId);

    // Request the first chunk from the sender
    console.log(`Requesting first chunk for ${transferId}`);
    socket.emit("next-batch", { transferId });
    transferState.status = 'receiving';
    updateStatusMessage(`Receiving ${filename}...`);
});

// 2. Receive File Chunk (Processes and Writes Data)
socket.on("fs-chunk", async ({ transferId, chunk, offset, isLastChunk }) => {
    const transfer = activeTransfers.get(transferId);
    // Ignore if transfer isn't active or doesn't exist
    if (!transfer || transfer.status !== 'receiving') {
        // console.warn(`Received chunk for inactive/unknown transfer ${transferId}. Status: ${transfer?.status}`);
        return;
    }

    transfer.lastChunkTime = Date.now(); // Update activity timestamp

    try {
        // Write chunk using appropriate method
        if (transfer.fileWriter) {
            // Using File System Access API: Ensure chunk is ArrayBuffer or Blob
            const dataToWrite = (chunk instanceof ArrayBuffer || chunk instanceof Blob) ? chunk : new Uint8Array(chunk).buffer;
            await transfer.fileWriter.write({ type: 'write', data: dataToWrite, position: offset });
        } else {
            // Using memory buffer fallback: Ensure chunk is ArrayBuffer or similar
            const dataToBuffer = (chunk instanceof ArrayBuffer || chunk instanceof Blob) ? chunk : new Uint8Array(chunk).buffer;
            transfer.buffer.push(dataToBuffer);
        }

        transfer.receivedSize += chunk.byteLength;
        updateTransferProgress(transferId); // Update visual progress

        // Check if file transfer is complete
        if (transfer.receivedSize >= transfer.metadata.total_buffer_size) {
            console.log(`🏁 Received final expected chunk for ${transferId}. Total size: ${transfer.receivedSize}`);
            // Double check size matches exactly if needed, though >= should be sufficient
            if(transfer.receivedSize > transfer.metadata.total_buffer_size) {
                 console.warn(`Received size (${transfer.receivedSize}) exceeds metadata size (${transfer.metadata.total_buffer_size}) for ${transferId}`);
            }
            await completeFileTransfer(transferId); // Finalize the file
        } else {
            // Request the next chunk
            socket.emit("next-batch", { transferId });
        }

    } catch (err) {
        console.error(`Error processing chunk for ${transferId}:`, err);
        handleTransferError(transferId, `Chunk processing error: ${err.message}`);
    }
});

// 3. Handle Transfer Aborted by Peer/Server
socket.on("transfer-aborted", ({ transferId, reason }) => {
    console.warn(`️ Transfer ${transferId} aborted by peer/server: ${reason}`);
    handleTransferError(transferId, `Transfer Aborted: ${reason}`);
});


// --- File Handling Logic ---

/**
 * Updates the progress bar UI for a given transfer.
 * @param {string} transferId - The ID of the transfer to update.
 */
function updateTransferProgress(transferId) {
    const transfer = activeTransfers.get(transferId);
    // Ensure all necessary parts exist and status is correct
    if (!transfer || !transfer.progressBarFillNode || !transfer.progressTextNode || transfer.status !== 'receiving') {
        // console.warn(`Cannot update progress for ${transferId}, missing nodes or wrong status: ${transfer?.status}`);
        return;
    }

    // Calculate percentage, ensuring total_buffer_size is not zero
    let percentage = 0;
    if (transfer.metadata.total_buffer_size > 0) {
        percentage = Math.min(100, Math.floor(
            (transfer.receivedSize / transfer.metadata.total_buffer_size) * 100
        ));
    } else if (transfer.receivedSize > 0) {
        // Handle case of zero-size file metadata but received data (shouldn't happen ideally)
        percentage = 100;
    }


    // Update the visual elements
    transfer.progressBarFillNode.style.width = `${percentage}%`;
    transfer.progressTextNode.textContent = `${percentage}%`;
}

/**
 * Finalizes a file transfer, closing the writer or creating a download link.
 * @param {string} transferId - The ID of the transfer to complete.
 */
async function completeFileTransfer(transferId) {
    const transfer = activeTransfers.get(transferId);
    // Prevent double completion or completion of errored transfers
    if (!transfer || transfer.status === 'complete' || transfer.status === 'error') {
        console.log(`Transfer ${transferId} already completed or errored. Skipping completion.`);
        return;
    }

    console.log(`Completing file transfer for ${transferId}`);
    transfer.status = 'completing'; // Mark as completing to prevent race conditions
    stopTransferMonitor(transferId); // Stop inactivity timer

    try {
        let statusText = "Error"; // Default status text
        let statusClass = "error"; // Default class for UI styling

        if (transfer.fileWriter) {
            // --- Using File System Access API ---
            await transfer.fileWriter.close();
            statusText = "Saved";
            statusClass = "complete";
            updateStatusMessage(`${transfer.metadata.filename} saved successfully.`);
            console.log(`✅ File ${transfer.metadata.filename} saved via FileSystem API.`);
        } else {
            // --- Using Memory Buffer Fallback ---
            console.log(`Creating Blob for ${transfer.metadata.filename} (Type: ${transfer.metadata.file_type})`);
            const blob = new Blob(transfer.buffer, { type: transfer.metadata.file_type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = transfer.metadata.filename;
            document.body.appendChild(a);
            a.click(); // Trigger download
            statusText = "Downloaded";
            statusClass = "complete";

            // Clean up the Blob URL after a short delay
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                console.log(`✅ File ${transfer.metadata.filename} downloaded via Blob URL.`);
            }, 100);
            updateStatusMessage(`${transfer.metadata.filename} downloaded.`);
        }

        // Update UI elements for this specific file item
        if (transfer.progressTextNode) {
            transfer.progressTextNode.textContent = statusText;
        }
        if (transfer.progressBarFillNode) {
             transfer.progressBarFillNode.style.width = '100%'; // Ensure bar is full
             transfer.progressBarFillNode.classList.remove('error'); // Remove error class if present
             transfer.progressBarFillNode.classList.add(statusClass); // Add complete class
        }
         if (transfer.fileItemNode) {
            transfer.fileItemNode.classList.remove('error'); // Remove error class if present
            transfer.fileItemNode.classList.add(statusClass); // Add complete class to item
        }

        transfer.status = 'complete'; // Mark transfer as complete in state

    } catch (err) {
        console.error(`Error completing file ${transferId}:`, err);
        // Let error handler update UI and state
        handleTransferError(transferId, `File completion error: ${err.message}`);
    } finally {
       // Clean buffer regardless of success/failure if using fallback
       // Ensure transfer object still exists before accessing buffer
       const finalTransferState = activeTransfers.get(transferId);
       if (finalTransferState && !finalTransferState.fileWriter) {
           finalTransferState.buffer = []; // Clear buffer array
           console.log(`Cleared memory buffer for ${transferId}`);
       }
    }
}

/**
 * Handles errors during a transfer, updating UI and state.
 * @param {string} transferId - The ID of the transfer that errored.
 * @param {string} errorMessage - A description of the error.
 */
function handleTransferError(transferId, errorMessage) {
    const transfer = activeTransfers.get(transferId);
    // Prevent handling errors multiple times
    if (!transfer || transfer.status === 'error') {
        return;
    }

    console.error(`Transfer Error [${transferId}]: ${errorMessage}`);
    transfer.status = 'error'; // Mark as errored
    stopTransferMonitor(transferId); // Stop inactivity timer

    // Update UI elements for this specific file item
    if (transfer.progressTextNode) {
        transfer.progressTextNode.textContent = "Error!";
    }
     if (transfer.progressBarFillNode) {
        transfer.progressBarFillNode.style.width = '100%'; // Optional: Fill bar with error color
        transfer.progressBarFillNode.classList.remove('complete'); // Remove complete class if present
        transfer.progressBarFillNode.classList.add('error'); // Add class for error styling
    }
    if (transfer.fileItemNode) {
        transfer.fileItemNode.classList.remove('complete'); // Remove complete class if present
        transfer.fileItemNode.classList.add('error'); // Add class to item for styling
    }

    updateStatusMessage(`Error receiving ${transfer.metadata?.filename || 'file'}: ${errorMessage}`, true);

    // Attempt to abort the file writer if it exists and hasn't been closed
    if (transfer.fileWriter) {
        // Check if it has a state property (newer API) or just try aborting
        // Note: abort() might throw if already closed or closing, hence the catch.
        transfer.fileWriter.abort().catch(err => console.warn(`Non-critical error aborting writer for ${transferId}: ${err.message}`));
    }
    // Clear memory buffer if used
    transfer.buffer = null;

    // Consider removing from activeTransfers map after error, maybe after a delay
    // setTimeout(() => activeTransfers.delete(transferId), 5000);
}

// --- Transfer Monitoring ---

/**
 * Starts an interval timer to monitor inactivity for a specific transfer.
 * @param {string} transferId - The ID of the transfer to monitor.
 */
function startTransferMonitor(transferId) {
    const transfer = activeTransfers.get(transferId);
    // Don't start if already monitoring
    if (!transfer || transfer.monitorInterval) return;

    console.log(`Starting inactivity monitor for transfer ${transferId}`);
    transfer.monitorInterval = setInterval(() => {
        const now = Date.now();
        // Check if status is still 'receiving' before timing out
        if (transfer.status === 'receiving' && (now - transfer.lastChunkTime > TRANSFER_INACTIVITY_TIMEOUT)) {
            console.error(`Transfer timeout detected for ${transferId}`);
            // Let error handler stop the monitor and update state/UI
            handleTransferError(transferId, "Transfer timed out due to inactivity.");
        } else if (transfer.status !== 'receiving' && transfer.status !== 'starting') {
            // If transfer completed or errored elsewhere, stop monitoring
             stopTransferMonitor(transferId);
        }
    }, 5000); // Check every 5 seconds
}

/**
 * Stops the inactivity monitor for a specific transfer.
 * @param {string} transferId - The ID of the transfer whose monitor to stop.
 */
function stopTransferMonitor(transferId) {
    const transfer = activeTransfers.get(transferId);
    if (transfer && transfer.monitorInterval) {
        clearInterval(transfer.monitorInterval);
        transfer.monitorInterval = null; // Clear the interval ID from state
        console.log(`Stopped inactivity monitor for transfer ${transferId}`);
    }
}


// --- Initial Event Listeners ---
if (connectRoomBtn) connectRoomBtn.addEventListener("click", handleJoinRoom);
if (scanQrBtn) scanQrBtn.addEventListener("click", startQrScanner);
if (joinInput) joinInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        e.preventDefault(); // Prevent potential form submission
        handleJoinRoom();
    }
});

// Cancel Button Listener
if (cancelTransferBtn) {
    cancelTransferBtn.addEventListener("click", () => {
        console.log("Cancel button clicked");
        // Find the first active (receiving or starting) transfer to cancel
        let transferToCancelId = null;
        for (const [id, transfer] of activeTransfers.entries()) {
            // Target transfers that are actively receiving or just started
            if (transfer.status === 'receiving' || transfer.status === 'starting') {
                transferToCancelId = id;
                break; // Cancel the first one found
            }
        }

        if (transferToCancelId) {
            console.log(`Attempting to cancel transfer: ${transferToCancelId}`);
            // Notify the sender/server (important for sender to stop sending)
            socket.emit("transfer-cancel", { transferId: transferToCancelId, reason: "Receiver cancelled." });
            // Handle the error state locally immediately
            handleTransferError(transferToCancelId, "Cancelled by user.");
        } else {
            console.log("No active transfer found to cancel.");
            updateStatusMessage("No active transfer to cancel.");
        }
    });
}


// --- Visibility Change Handler ---
// Notify server if tab goes to background/foreground (useful for resource management)
document.addEventListener('visibilitychange', () => {
    if (socket.connected) { // Only emit if connected
        const state = document.visibilityState === 'hidden' ? 'background' : 'foreground';
        console.log(`Tab visibility changed to: ${state}`);
        socket.emit('tab-state', { state }); // Server can handle this if needed
    }
});


// --- Initial Setup ---
// Show the initial join screen when the page loads
showScreen('join');
console.log("Receiver script initialized.");