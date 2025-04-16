// FileSharing.js (Modified to match server expectations)

// Configuration (Consider making these configurable)
export const CHUNK_SIZE = 128 * 1024; // 128 KB chunks
export const BATCH_SIZE = 5; // Send 5 chunks before waiting for 'next-batch' signal
export const MAX_RETRIES = 3; // Max retries on batch send failure

// In-memory store for transfer state on the sender client
// Note: This will be cleared if the sender refreshes the page.
export const activeTransfers = new Map();

export function randomIdGenerator(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}


/**
 * Initiates the file sharing process.
 * @param {object} socket - The Socket.IO client instance.
 * @param {string} receiverId - The socket ID of the recipient.
 * @param {object} metadata - File metadata (name, size, type, etc.).
 * @param {Uint8Array} buffer - The entire file content as a buffer.
 * @param {HTMLElement} progressNode - The DOM element to update with progress.
 */
export async function shareFile(socket, receiverId, metadata, buffer, progressNode) {
  const transferId = randomIdGenerator();
  console.log(`Initiating transfer ${transferId} for ${metadata.filename} to ${receiverId}`);

  activeTransfers.set(transferId, {
    buffer: buffer,
    offset: 0,
    metadata: metadata,
    progressNode: progressNode,
    isActive: true,
    receiverId: receiverId // Store receiverId for retries/logic
  });

  // Update progress node immediately
  progressNode.textContent = "0%";

  // Emit metadata to the server to relay to the receiver
  // Ensure payload matches server expectation: { receiverId, metadata }
  socket.emit("file-meta", {
    receiverId: receiverId, // Use 'receiverId' key
    metadata: {
      ...metadata,
      transferId: transferId,
      total_buffer_size: buffer.length, // Ensure total size is correct
      // buffer_size (chunk size) isn't strictly needed by receiver/server here
      // but can be sent if useful for receiver logic (though CHUNK_SIZE is defined here)
    }
  });
  console.log(`Sent file-meta for ${transferId}`);

  // Start sending chunks after metadata is sent
  // The receiver will request the first batch via 'next-batch' after processing metadata
  await sendFileChunks(socket, receiverId, transferId);
}

/**
 * Sends file chunks in batches, waiting for acknowledgment and 'next-batch' signal.
 * @param {object} socket - The Socket.IO client instance.
 * @param {string} receiverId - The socket ID of the recipient.
 * @param {string} transferId - The unique ID for this transfer.
 */
export async function sendFileChunks(socket, receiverId, transferId) {
  const transfer = activeTransfers.get(transferId);
  if (!transfer || !transfer.isActive) {
    console.warn(`Transfer ${transferId} not active or found in sendFileChunks.`);
    return;
  }

  let retryCount = 0;

  // Wait for the first 'next-batch' signal from the receiver (via server)
  // This ensures the receiver is ready after processing metadata.
  console.log(`Waiting for initial next-batch signal for ${transferId}`);
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
        console.warn(`Timeout waiting for initial next-batch for ${transferId}`);
        handleTransferFailure(transferId, "Timeout waiting for receiver readiness.");
        resolve(); // Resolve to prevent hanging, failure handled inside
    }, 30000); // 30 second timeout for receiver readiness

    socket.once(`next-batch-${transferId}`, () => {
      console.log(`Received initial next-batch signal for ${transferId}. Starting chunk loop.`);
      clearTimeout(timeout);
      resolve();
    });
  });

  // Check if transfer failed during wait
  if (!transfer.isActive) return;


  while (transfer.offset < transfer.buffer.length && transfer.isActive) {
    const batchStart = transfer.offset;
    // Calculate end, ensuring it doesn't exceed buffer length
    const batchEnd = Math.min(batchStart + (CHUNK_SIZE * BATCH_SIZE), transfer.buffer.length);
    const currentBatchSize = batchEnd - batchStart;

    console.log(`Sending batch for ${transferId}: Offset ${batchStart}, Size ${currentBatchSize}`);

    let batchPromises = [];
    let chunksInBatch = 0;

    try {
      for (let currentChunkOffset = batchStart; currentChunkOffset < batchEnd; currentChunkOffset += CHUNK_SIZE) {
        const chunkEnd = Math.min(currentChunkOffset + CHUNK_SIZE, transfer.buffer.length);
        const chunk = transfer.buffer.slice(currentChunkOffset, chunkEnd);
        const isLastChunk = (chunkEnd >= transfer.buffer.length);
        chunksInBatch++;

        batchPromises.push(
          new Promise((resolve, reject) => {
            // Emit chunk, expecting server acknowledgment
            // Ensure payload matches server: { receiverId, transferId, chunk, offset, isLastChunk }, ack
            socket.emit("file-chunk", {
              receiverId: receiverId, // Use 'receiverId' key
              transferId: transferId,
              chunk: chunk,
              offset: currentChunkOffset,
              isLastChunk: isLastChunk
            }, (ack) => {
              // Check server ack object
              if (ack && ack.received === true) {
                // console.log(`Chunk ack received for offset ${currentChunkOffset}`);
                resolve();
              } else {
                console.error(`Chunk NACK received for offset ${currentChunkOffset}:`, ack?.error || 'Unknown reason');
                reject(new Error(ack?.error || 'Chunk not acknowledged by server'));
              }
            });
          })
        );
      } // End loop through chunks in batch

      // Wait for all server acknowledgments for the current batch
      await Promise.all(batchPromises);
      console.log(`Batch acknowledged by server for ${transferId}. Offset: ${batchStart}, Chunks: ${chunksInBatch}`);

      // All chunks in the batch acknowledged by server, update offset
      transfer.offset = batchEnd;
      updateProgress(transfer); // Update UI progress
      retryCount = 0; // Reset retry count on successful batch

      // If not done, wait for the next 'next-batch' signal from the receiver
      if (transfer.offset < transfer.buffer.length) {
        console.log(`Waiting for next-batch signal for ${transferId} (after offset ${transfer.offset})`);
        await new Promise((resolve) => {
           const batchTimeout = setTimeout(() => {
               console.warn(`Timeout waiting for next-batch signal (after offset ${transfer.offset}) for ${transferId}`);
               handleTransferFailure(transferId, "Timeout waiting for receiver signal.");
               resolve(); // Resolve to prevent hanging
           }, 30000); // 30s timeout for next signal

          socket.once(`next-batch-${transferId}`, () => {
            // console.log(`Received next-batch signal for ${transferId}`);
            clearTimeout(batchTimeout);
            resolve();
          });
        });
         // Check if transfer failed during wait
        if (!transfer.isActive) break;
      }

    } catch (err) { // Catch errors from Promise.all (chunk NACK) or other issues
      console.error(`Batch send error for ${transferId} at offset ${batchStart}:`, err);
      retryCount++;
      if (retryCount <= MAX_RETRIES && transfer.isActive) {
        console.warn(`Retrying batch send for ${transferId} (Attempt ${retryCount}/${MAX_RETRIES})...`);
        // Optional: Implement backoff delay
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        // Continue loop will retry the same batch (offset hasn't changed)
        continue;
      } else {
        console.error(`Max retries reached or transfer inactive for ${transferId}. Aborting.`);
        handleTransferFailure(transferId, `Failed to send batch: ${err.message || 'Max retries reached'}`);
        break; // Exit the while loop
      }
    }
  } // End while loop

  // After loop finishes or breaks
  if (transfer.isActive && transfer.offset >= transfer.buffer.length) {
    // Successfully sent all chunks
    console.log(`✅ All chunks sent for ${transferId}. Emitting file-end.`);
    // Ensure payload matches server: { receiverId, transferId }
    socket.emit("file-end", {
        receiverId: receiverId, // Use 'receiverId' key
        transferId: transferId
    });
    updateProgress(transfer, "Sent!"); // Final UI update
    transfer.isActive = false; // Mark as complete locally
    // Clean up transfer state after a short delay
    setTimeout(() => activeTransfers.delete(transferId), 5000);

  } else if (!transfer.isActive) {
      console.log(`Transfer ${transferId} was marked inactive during sendFileChunks.`);
       // Failure handled by handleTransferFailure
  } else {
       console.error(`sendFileChunks loop exited unexpectedly for ${transferId}. Offset: ${transfer.offset}, Total: ${transfer.buffer.length}`);
       handleTransferFailure(transferId, "Unknown error during chunk sending.");
  }
}


/**
 * Updates the progress indicator in the DOM.
 * @param {object} transfer - The transfer state object.
 * @param {string} [statusText=null] - Optional text to display instead of percentage.
 */
function updateProgress(transfer, statusText = null) {
  if (!transfer || !transfer.progressNode) return;

  if (statusText) {
    transfer.progressNode.textContent = statusText;
  } else {
    const percent = Math.min(100, Math.floor((transfer.offset / transfer.buffer.length) * 100));
    transfer.progressNode.textContent = `${percent}%`;
  }
}

/**
 * Handles transfer failure, updating UI and state.
 * @param {string} transferId - The ID of the failed transfer.
 * @param {string} reason - The reason for failure.
 */
function handleTransferFailure(transferId, reason) {
    const transfer = activeTransfers.get(transferId);
    if (!transfer || !transfer.isActive) return; // Already handled or doesn't exist

    transfer.isActive = false; // Mark as inactive
    if (transfer.progressNode) {
        transfer.progressNode.textContent = "Failed!";
        transfer.progressNode.style.color = "red"; // Indicate error visually
    }
    console.error(`Transfer ${transferId} failed: ${reason}`);
    // No need to emit file-end on failure
    // Clean up transfer state after a delay
    setTimeout(() => activeTransfers.delete(transferId), 5000);

    // Optionally, inform the user more broadly (e.g., using a status message area)
    // updateStatusMessage(`Transfer of ${transfer.metadata?.filename} failed: ${reason}`, true);
}