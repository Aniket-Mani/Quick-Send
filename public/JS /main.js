// Using FileSharing.js for transfer logic
import { shareFile, randomIdGenerator } from './FileSharing.js';
const socket = io();

// --- State Variables ---
let receiverId = null; // Stores the socket ID of the connected receiver
let currentRoomCode = null; // Stores the room code created by this sender

// --- Element Selections ---
const sendBtn = document.getElementById("send-btn");
console.log("sendBtn element:", sendBtn)
const receiveBtn = document.getElementById("receive-btn"); // Ensure this exists in HTML if used
const initialOptions = document.getElementById("initial-options");
const dynamicContent = document.getElementById("dynamic-content");
const dynamicContent2 = document.getElementById("dynamic-content2"); // Area for file transfer UI

// --- Utility Functions ---
// (generateQRCode and copyToClipboard remain the same as your provided version)
function generateQRCode(text, elementId = "qr-code") {
  console.log("Generating QR code for room:", elementId);
  const element = document.getElementById(elementId);
   if (!element) {
     console.error(`QR Code container #${elementId} not found.`);
     return;
   }
  if (typeof QRCode === 'undefined') {
    console.error("QRCode library not loaded. Make sure qrcode.min.js is included.");
     element.innerHTML = "QRCode library not loaded.";
    return;
  }
  element.innerHTML = ""; // Clear previous QR code
  try {
    new QRCode(element, {
      text: text,
      width: 150,
      height: 150,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    element.innerHTML = "Error generating QR code.";
  }
}

function copyToClipboard(text, buttonElement) {
   if (!navigator.clipboard) {
       console.warn("Clipboard API not available.");
        buttonElement.textContent = '❌'; // Indicate failure
       return;
   }
  navigator.clipboard.writeText(text).then(() => {
    const originalText = buttonElement.textContent;
    buttonElement.textContent = '✅';
    buttonElement.disabled = true;
    setTimeout(() => {
      buttonElement.textContent = originalText;
       buttonElement.disabled = false;
    }, 1500);
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    const originalText = buttonElement.textContent;
    buttonElement.textContent = '❌';
    buttonElement.disabled = true;
    setTimeout(() => {
      buttonElement.textContent = originalText;
       buttonElement.disabled = false;
    }, 1500);
  });
}

function updateStatusMessage(selector, message, isError = false) {
    const statusElem = document.querySelector(selector);
    if (statusElem) {
        statusElem.textContent = message;
        statusElem.style.color = isError ? 'red' : 'inherit';
    } else {
        console.log(`Status (${selector}): ${message}`);
    }
}

// --- UI Flow ---
// (showInitialOptions, showRoomCreationPrompt - adapt selectors if needed)
function showInitialOptions() {
    initialOptions.style.display = "block";
    dynamicContent.classList.add("hidden");
    dynamicContent2.classList.add("hidden");
    dynamicContent.innerHTML = ''; // Clear previous content
    dynamicContent2.innerHTML = '';
}

function showRoomCreationPrompt() {
  console.log("showRoomCreationPrompt function called");
    initialOptions.style.display = "none";
    dynamicContent2.classList.add("hidden");
    dynamicContent.classList.remove("hidden");
    console.log("dynamicContent:", dynamicContent);
    dynamicContent.innerHTML = `
      <div class="room-box centered">
        <h2>Create a Room</h2>
        <p>Click the button below to generate a unique room code.</p>
        <button class="btn primary-btn" id="create-room-btn">Create Room</button>
        <button class="btn secondary-btn" id="back-to-options-btn">Back</button>
      </div>
    `;
    console.log("dynamicContent.innerHTML set in showRoomCreationPrompt");
    document.getElementById("create-room-btn").addEventListener("click", handleCreateRoom);
    document.getElementById("back-to-options-btn").addEventListener("click", showInitialOptions);
}


// (showWaitingRoom - same as your version, ensures correct IDs)
function showWaitingRoom(roomCode) {
  console.log("showWaitingRoom called with roomCode:", roomCode);
  currentRoomCode = roomCode;
  initialOptions.style.display = "none";
  dynamicContent2.classList.add("hidden");
  dynamicContent.classList.remove("hidden");
  console.log("dynamicContent:", dynamicContent);
  dynamicContent.innerHTML = `
      <div class="room-box expanded centered">
        <h2>Room Created!</h2>
        <p class="room-code-container">Room Code:
          <strong id="room-code">${roomCode}</strong>
          <button class="copy-btn" id="copy-room-btn" title="Copy code">📋</button>
        </p>
        <p>Scan QR or share the code:</p>
        <div class="qr-code-container">
           <div id="qr-code">Generating...</div>
        </div>
        <div class="share-options">
          <p>Share via:</p>
          <div class="share-icons">
              <a href="https://wa.me/?text=Join%20my%20ShareDrop%20room%20with%20code:%20${roomCode}" target="_blank" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></a>
              <a href="mailto:?subject=ShareDrop%20Room%20Code&body=Join%20my%20ShareDrop%20room.%20Room%20Code:%20${roomCode}" target="_blank" title="Share via Email"><i class="fas fa-envelope"></i></a>
              <a href="sms:?body=Join%20my%20ShareDrop%20room.%20Room%20Code:%20${roomCode}" target="_blank" title="Share via SMS"><i class="fas fa-sms"></i></a>
              <a href="https://twitter.com/intent/tweet?text=Join%20my%20ShareDrop%20room%20with%20code:%20${roomCode}" target="_blank" title="Share on Twitter"><i class="fab fa-twitter"></i></a>
              </div>
        </div>
        <div class="status-message">
           <p>Waiting for receiver to join...</p>
        </div>
         <button class="btn secondary-btn" id="cancel-room-btn">Cancel Room</button>
      </div>
    `;
  console.log("dynamicContent.innerHTML set");
  generateQRCode(roomCode, "qr-code");
  console.log("generateQRCode called");

  document.getElementById("copy-room-btn").addEventListener("click", (event) => {
    copyToClipboard(roomCode, event.currentTarget);
  });

  document.getElementById("cancel-room-btn").addEventListener("click", () => {
      showInitialOptions();
      currentRoomCode = null;
      receiverId = null;
  });
}

// (showFileTransferUI - same as your version, ensures correct IDs)
function showFileTransferUI() {
  dynamicContent.classList.add("hidden"); // Hide waiting room content
  dynamicContent.innerHTML = '';
  dynamicContent2.classList.remove("hidden"); // Show transfer UI area
  dynamicContent2.innerHTML = `
    <section class="fs-screen" id="file-transfer-screen">
        <div class="file-send card">
            <header class="card-header">
                <h3>Send File</h3>
                <p>Room: ${currentRoomCode} | Receiver: ${receiverId ? receiverId.substring(0, 6) + '...' : 'N/A'}</p>
            </header>
            <div class="card-body">
                <div class="file-select">
                     <label for="fileInput" class="btn secondary-btn">Choose File</label>
                     <input type="file" id="fileInput" style="display: none;"/>
                     <span id="chosen-file-name">No file chosen</span>
                     <button id="sendFileBtn" class="btn primary-btn" disabled>Send File</button>
                </div>
                <div class="files-list">
                   </div>
            </div>
            <footer class="card-footer">
                <p class="status-text">Select a file to send.</p>
                 <button class="btn secondary-btn" id="disconnect-peer-btn">Disconnect</button>
            </footer>
        </div>
    </section>
  `;

   const fileInput = document.getElementById("fileInput");
   const sendFileBtn = document.getElementById("sendFileBtn");
   const chosenFileName = document.getElementById("chosen-file-name");
   const statusText = document.querySelector("#file-transfer-screen .status-text");

   fileInput.addEventListener("change", (event) => {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            // Basic size check example (e.g., 1GB limit due to memory buffering)
            const maxSize = 1.5 * 1024 * 1024 * 1024; // 1 GB
            if (file.size > maxSize) {
                 statusText.textContent = `File too large (${(file.size / (1024*1024*1024)).toFixed(2)} GB). Max ${maxSize / (1024*1024*1024)} GB allowed.`;
                 statusText.style.color = "red";
                 sendFileBtn.disabled = true;
                 fileInput.value = ""; // Clear selection
                 chosenFileName.textContent = "No file chosen";
            } else {
                 chosenFileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
                 sendFileBtn.disabled = false;
                 statusText.textContent = `Ready to send ${file.name}.`;
                 statusText.style.color = 'inherit';
            }
        } else {
            chosenFileName.textContent = "No file chosen";
            sendFileBtn.disabled = true;
             statusText.textContent = `Select a file to send.`;
             statusText.style.color = 'inherit';
        }
    });

  sendFileBtn.addEventListener("click", () => {
    const fileInput = document.getElementById("fileInput");
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
       if (receiverId) {
            sendFileBtn.disabled = true; // Prevent double clicks
            statusText.textContent = `Preparing ${file.name}...`;
            // Call the original sendFile function which reads the buffer
            sendFile(file);
       } else {
            statusText.textContent = "Error: Receiver not connected.";
            statusText.style.color = 'red';
       }
    } else {
         statusText.textContent = "Please select a file first.";
         statusText.style.color = 'red';
    }
  });

   document.getElementById("disconnect-peer-btn").addEventListener("click", () => {
         showInitialOptions();
         // Emit event to server if needed
         currentRoomCode = null;
         receiverId = null;
    });
}

// --- Socket Event Handlers ---
socket.on("connect", () => {
  console.log("✅ Connected to server with ID:", socket.id);
  // Reset state on connect/reconnect unless already in a process
   if (!currentRoomCode) {
       showInitialOptions();
   }
});

socket.on("disconnect", (reason) => {
  console.log(`🔌 Disconnected from server: ${reason}`);
  updateStatusMessage("#dynamic-content .status-message p, #file-transfer-screen .status-text", "Disconnected. Please refresh.", true);
  // Reset UI and state fully on disconnect
  showInitialOptions();
  receiverId = null;
  currentRoomCode = null;
});

socket.on("room-created", (newRoomCode) => {
    console.log(`✅ Room ${newRoomCode} created successfully.`);
    showWaitingRoom(newRoomCode);
});

socket.on("room-exists", (attemptedCode) => {
    console.warn(`⚠️ Room ${attemptedCode} already exists.`);
    updateStatusMessage("#dynamic-content .room-box p:first-of-type", `Room code ${attemptedCode} is in use. Try creating again.`, true); // Target specific p
    const createBtn = document.getElementById("create-room-btn");
    if(createBtn) createBtn.disabled = false; // Re-enable button
});

socket.on("room-creation-failed", (message) => {
    console.error(`❌ Room creation failed: ${message}`);
     updateStatusMessage("#dynamic-content .room-box p:first-of-type", `Error: ${message}. Please try again.`, true);
    const createBtn = document.getElementById("create-room-btn");
    if(createBtn) createBtn.disabled = false;
});

// Correctly handle the data object from the server
socket.on("user-joined", (data) => {
  console.log("Received user-joined event with data:", data);
  // Check if we are actually waiting in the created room
  if (currentRoomCode && !receiverId) {
    // Extract receiverId from the data object sent by the refined server
    receiverId = data.receiverId;
    console.log(`🤝 Receiver ${receiverId} joined room ${currentRoomCode}.`);
    updateStatusMessage("#dynamic-content .status-message p", 'Receiver connected! Ready to send files.', false); // Update waiting room status
    // Short delay before switching UI? Optional.
    setTimeout(showFileTransferUI, 500); // Switch to file selection UI
  } else {
      console.log("Received user-joined but not waiting or already have a receiver.", data);
  }
});

socket.on("peer-disconnected", ({ roomCode, reason }) => {
    if (roomCode === currentRoomCode && receiverId) {
        console.warn(`🚶 Receiver disconnected: ${reason}`);
        receiverId = null; // Clear receiver ID
        // Revert to waiting screen, allowing a new receiver to join
        showWaitingRoom(currentRoomCode);
        // Update status message in the re-shown waiting room
        setTimeout(() => updateStatusMessage("#dynamic-content .status-message p", `Receiver disconnected. Waiting for a new receiver...`, true), 100);
    }
});

socket.on("transfer-error", ({ transferId, message }) => {
    // Find the corresponding progress node using transferId if FileSharing needs it
    console.error(`❌ Transfer Error from server: ${message}`);
    // Update general status
    updateStatusMessage("#file-transfer-screen .status-text", `Transfer Failed: ${message}`, true);
     // Re-enable send button potentially
    const sendFileBtn = document.getElementById("sendFileBtn");
    if (sendFileBtn) sendFileBtn.disabled = false;
});

socket.on("transfer-aborted", ({ transferId, reason }) => {
    console.warn(`️ Transfer Aborted by server/peer: ${reason}`);
    updateStatusMessage("#file-transfer-screen .status-text", `Transfer Aborted: ${reason}`, true);
     const sendFileBtn = document.getElementById("sendFileBtn");
     if (sendFileBtn) sendFileBtn.disabled = false;
});

// --- Core File Sending Logic ---
function handleCreateRoom() {
  console.log("Creating room...");  // Add this log to confirm the function is being triggered
  const createBtn = document.getElementById("create-room-btn");
  if(createBtn) createBtn.disabled = true;
  updateStatusMessage("#dynamic-content .room-box p:first-of-type", "Creating room...");
  const newRoomCode = randomIdGenerator(6); // Use 6 char ID for rooms
  console.log("Generated room code:", newRoomCode);  // Log generated room code
  socket.emit("create-room", newRoomCode);
  showWaitingRoom(newRoomCode); // Show waiting room UI
}


// This function now reads the entire file buffer, then calls shareFile from FileSharing.js
// WARNING: Reads entire file into memory!
function sendFile(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    const buffer = new Uint8Array(e.target.result); // The file buffer
    console.log(`Read file ${file.name} into buffer (${buffer.byteLength} bytes)`);

    // Prepare metadata
    const metadata = {
        filename: file.name,
        // total_buffer_size included in FileSharing.js emit
        file_type: file.type || 'application/octet-stream',
        last_modified: file.lastModified
    };

    // Create UI element for progress
    const fileListContainer = document.querySelector("#file-transfer-screen .files-list");
    fileListContainer.innerHTML = ''; // Clear previous items
    const fileItem = document.createElement("div");
    fileItem.classList.add("item");
    // We'll let FileSharing.js manage the progress node content
    fileItem.innerHTML = `
      <div class="progress">Starting...</div>
      <div class="filename">${file.name} (${(buffer.byteLength / (1024 * 1024)).toFixed(2)} MB)</div>
    `;
    fileListContainer.appendChild(fileItem);
    const progressNode = fileItem.querySelector(".progress");

    // Update status
    updateStatusMessage("#file-transfer-screen .status-text", `Sending ${file.name}...`, false);

    // *** Call the imported shareFile function ***
    shareFile(socket, receiverId, metadata, buffer, progressNode)
      .then(() => {
          console.log(`shareFile process completed successfully for ${metadata.filename}`);
          updateStatusMessage("#file-transfer-screen .status-text", `${metadata.filename} sent successfully. Select another file?`, false);
           resetSendButtonState(); // Reset after successful completion
      })
      .catch((error) => {
          console.error(`shareFile process failed for ${metadata.filename}:`, error);
           updateStatusMessage("#file-transfer-screen .status-text", `Failed to send ${metadata.filename}: ${error.message}`, true);
            resetSendButtonState(); // Reset on failure
      });

  };

  reader.onerror = function(e) {
      console.error("FileReader error:", e);
      updateStatusMessage("#file-transfer-screen .status-text", `Error reading file: ${e.target.error}`, true);
      resetSendButtonState();
  };

  // Start reading the file
  reader.readAsArrayBuffer(file);
}

function resetSendButtonState() {
     const sendFileBtn = document.getElementById("sendFileBtn");
     const fileInput = document.getElementById("fileInput");
     const chosenFileName = document.getElementById("chosen-file-name");
     if (sendFileBtn) sendFileBtn.disabled = !fileInput?.files?.length > 0; // Enable only if a file is selected
     if(fileInput) fileInput.value = ""; // Clear file input selection
     if(chosenFileName) chosenFileName.textContent = "No file chosen";
}


// --- Initial Event Listeners ---
// Listener for the main "Send Files" button
// Listener for the main "Send Files" button
sendBtn.addEventListener("click", () => { // Modified to arrow function
  console.log("Send Files button clicked"); // Add this line
  showRoomCreationPrompt();
});

// Listener for the main "Receive Files" button (if it exists)
if (receiveBtn) {
    receiveBtn.addEventListener("click", () => {
        window.location.href = "./receiver.html"; // Navigate to receiver page
    });
}

// Handle visibility change
document.addEventListener('visibilitychange', () => {
  const state = document.visibilityState === 'hidden' ? 'background' : 'foreground';
  socket.emit('tab-state', { state });
});

// --- Start ---
// Initial UI state is handled by the 'connect' event handler