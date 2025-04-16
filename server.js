import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;
const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Configuration ---
const MAX_CHUNK_BUFFER_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB (Adjust with caution!)
const PING_TIMEOUT_DEFAULT = 60000; // 60 seconds
const PING_INTERVAL = 25000; // 25 seconds
const INACTIVE_TRANSFER_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const TRANSFER_INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Serve static files (like index.html, receiver.html, main.js, receiver.js, css)
app.use(express.static(join(__dirname, "public")));

// Limit JSON body size (though not directly used for file chunks)
app.use(express.json({ limit: "1mb" }));

const server = createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: MAX_CHUNK_BUFFER_SIZE, // Max buffer size for Socket.IO messages
  cors: {
    origin: "*", // WARNING: Be more specific in production!
    methods: ["GET", "POST"]
  },
  pingTimeout: PING_TIMEOUT_DEFAULT,
  pingInterval: PING_INTERVAL
});

// --- State Management ---
// Store active rooms: { roomCode: { senderId: string, receiverId: string | null } }
const activeRooms = new Map();
// Store active transfers: { transferId: { senderId: string, receiverId: string, metadata: any, lastActivity: number } }
const activeTransfers = new Map();

// --- Cleanup Interval for Stale Transfers ---
setInterval(() => {
  const now = Date.now();
  for (const [id, transfer] of activeTransfers.entries()) {
    if (now - transfer.lastActivity > TRANSFER_INACTIVITY_TIMEOUT) {
      console.log(`🧹 Cleaning up inactive transfer: ${id}`);
      // Notify sender and receiver if possible
      io.to(transfer.senderId).emit("transfer-aborted", { transferId: id, reason: "Timeout" });
      io.to(transfer.receiverId).emit("transfer-aborted", { transferId: id, reason: "Timeout" });
      activeTransfers.delete(id);
    }
  }
}, INACTIVE_TRANSFER_CLEANUP_INTERVAL);

// --- Socket.IO Connection Handling ---
io.on("connection", (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // --- Room Management ---
  socket.on("create-room", (roomCode) => {
    
    if (!roomCode || typeof roomCode !== 'string' || roomCode.length < 4) {
        socket.emit("room-creation-failed", "Invalid room code provided.");
        return;
    }
    if (activeRooms.has(roomCode)) {
      socket.emit("room-exists", roomCode);
      console.log(`⚠️ Room already exists attempt: ${roomCode} by ${socket.id}`);
      return;
    }

    activeRooms.set(roomCode, { senderId: socket.id, receiverId: null });
    socket.join(roomCode); // Sender joins the Socket.IO room
    socket.emit("room-created", roomCode); // Confirm creation to sender
    console.log(`✅ Room created: ${roomCode} by sender ${socket.id}`);
  });

  socket.on("join-room", ({ roomCode }) => {
    const room = activeRooms.get(roomCode);

    if (!room) {
      socket.emit("join-failed", "Room does not exist.");
      console.log(`❌ Join failed (no room): ${roomCode} by ${socket.id}`);
      return;
    }

    if (room.receiverId) {
      socket.emit("join-failed", "Room already has a receiver.");
      console.log(`❌ Join failed (receiver exists): ${roomCode} by ${socket.id}`);
      return;
    }

    if (room.senderId === socket.id) {
        socket.emit("join-failed", "Sender cannot join their own room as receiver.");
        console.log(`❌ Join failed (sender is receiver): ${roomCode} by ${socket.id}`);
        return;
    }

    // Assign receiver and notify
    room.receiverId = socket.id;
    socket.join(roomCode); // Receiver joins the Socket.IO room
    socket.emit("join-success", roomCode); // Confirm join to receiver
    // Notify the sender that the receiver has joined, sending receiver's ID
    io.to(room.senderId).emit("user-joined", { receiverId: socket.id });
    console.log(`✅ Receiver ${socket.id} joined room: ${roomCode}`);
  });

  // --- File Transfer Events ---

  // 1. Sender sends metadata (includes receiverId)
  socket.on("file-meta", ({ receiverId, metadata }) => {
    const { transferId } = metadata;
    if (!transferId || !receiverId || !metadata) {
        console.error(`❌ Invalid file-meta received from ${socket.id}`);
        socket.emit("transfer-error", { transferId, message: "Invalid metadata received by server." });
        return;
    }

    // Check if receiver is still connected (basic check)
    if (!io.sockets.sockets.get(receiverId)) {
         console.error(`❌ Receiver ${receiverId} not found for file-meta from ${socket.id}`);
         socket.emit("transfer-error", { transferId, message: "Receiver disconnected before transfer started." });
         return;
    }

    console.log(`📄 Metadata received for transfer ${transferId} from ${socket.id} to ${receiverId}`);
    activeTransfers.set(transferId, {
      senderId: socket.id,
      receiverId: receiverId,
      metadata: metadata,
      lastActivity: Date.now()
    });

    // Relay metadata to the specific receiver
    io.to(receiverId).emit("fs-meta", metadata);
  });

  // 2. Sender sends a file chunk (includes receiverId)
  socket.on("file-chunk", ({ receiverId, transferId, chunk, offset, isLastChunk }, ack) => {
    const transfer = activeTransfers.get(transferId);

    if (!transfer || transfer.senderId !== socket.id || transfer.receiverId !== receiverId) {
      console.warn(`⚠️ Received chunk for invalid/mismatched transfer: ${transferId} from ${socket.id}`);
      if (ack) ack({ received: false, error: "Invalid transfer details" });
      return;
    }

    // Check if receiver is still connected
    if (!io.sockets.sockets.get(receiverId)) {
         console.error(`❌ Receiver ${receiverId} disconnected during transfer ${transferId}`);
         socket.emit("transfer-error", { transferId, message: "Receiver disconnected during transfer." });
         activeTransfers.delete(transferId); // Clean up transfer
         if (ack) ack({ received: false, error: "Receiver disconnected" });
         return;
    }

    transfer.lastActivity = Date.now(); // Update activity timer

    // Relay chunk to the specific receiver
    // We rely on receiver requesting next chunk, but still pass isLastChunk info
    io.to(receiverId).emit("fs-chunk", { transferId, chunk, offset, isLastChunk });

    // Acknowledge receipt to sender (server received it)
    if (ack) ack({ received: true });
    // console.log(`🧱 Chunk relayed for ${transferId} (Offset: ${offset}, Last: ${isLastChunk})`); // Can be very verbose
  });

  // 3. Receiver requests the next batch/chunk
  socket.on("next-batch", ({ transferId }) => {
    const transfer = activeTransfers.get(transferId);

    // Ensure the request comes from the correct receiver for this transfer
    if (transfer && transfer.receiverId === socket.id) {
      transfer.lastActivity = Date.now(); // Update activity on request too
      // Notify the original sender to send the next chunk for this specific transfer
      io.to(transfer.senderId).emit(`next-batch-${transferId}`);
      // console.log(`➡️ Next batch request for ${transferId} relayed to sender ${transfer.senderId}`);
    } else {
      console.warn(`⚠️ Received 'next-batch' for unknown/mismatched transfer ${transferId} from ${socket.id}`);
      // Optionally notify receiver if transfer doesn't exist
      socket.emit("transfer-aborted", { transferId, reason: "Transfer not found or invalid." });
    }
  });

  // 4. Sender indicates transfer completion (Optional but good practice)
  // Note: Receiver primarily determines completion by receiving all bytes now.
  socket.on("file-end", ({ receiverId, transferId }) => {
     const transfer = activeTransfers.get(transferId);
     if (transfer && transfer.senderId === socket.id && transfer.receiverId === receiverId) {
         console.log(`✅ Sender ${socket.id} signalled end for transfer ${transferId}`);
         // Optionally notify receiver (though they should know from isLastChunk/byte count)
         // io.to(receiverId).emit("fs-sender-complete", { transferId });
         activeTransfers.delete(transferId); // Clean up completed transfer
     } else {
         console.warn(`⚠️ Received 'file-end' for unknown/mismatched transfer ${transferId} from ${socket.id}`);
     }
  });

  // --- Handling Client Background/Foreground State ---
  socket.on("tab-state", ({ state }) => {
    // Adjust ping timeout based on tab state to prevent premature disconnection
    const newTimeout = state === "background" ? PING_TIMEOUT_DEFAULT * 3 : PING_TIMEOUT_DEFAULT;
    // Socket.IO v3/v4 doesn't expose _pingTimeout directly in a safe way.
    // Reconnecting or adjusting keep-alive might be better, but this is a simple attempt.
    // This might not reliably work across all environments.
    console.log(`💡 Tab state for ${socket.id}: ${state}. (Timeout adjustment may be limited)`);
  });

  // --- Disconnect Handling ---
  socket.on("disconnect", (reason) => {
    console.log(`🔌 Disconnected: ${socket.id}, Reason: ${reason}`);

    // Clean up rooms where this user was sender or receiver
    let deletedRoomCode = null;
    for (const [roomCode, room] of activeRooms.entries()) {
      if (room.senderId === socket.id) {
        console.log(`🗑️ Room ${roomCode} removed (sender disconnected).`);
        // Notify receiver if they were connected
        if (room.receiverId) {
          io.to(room.receiverId).emit("peer-disconnected", { roomCode, reason: "Sender left." });
        }
        activeRooms.delete(roomCode);
        deletedRoomCode = roomCode;
        break; // Sender can only be in one room
      } else if (room.receiverId === socket.id) {
        console.log(`🗑️ Room ${roomCode} receiver position cleared (receiver disconnected).`);
        room.receiverId = null; // Allow a new receiver to join
        // Notify sender
        io.to(room.senderId).emit("peer-disconnected", { roomCode, reason: "Receiver left." });
        // No need to delete the room itself, sender might still be waiting
      }
    }

    // Clean up active transfers initiated BY this user (as sender)
    for (const [id, transfer] of activeTransfers.entries()) {
      if (transfer.senderId === socket.id) {
        console.log(`🗑️ Transfer ${id} removed (sender disconnected).`);
        // Notify receiver if connected
        io.to(transfer.receiverId)?.emit("transfer-aborted", { transferId: id, reason: "Sender disconnected." });
        activeTransfers.delete(id);
      }
      // If the disconnected user was the RECEIVER, the transfer will timeout via the interval check
      // or the SENDER will get an error on the next `file-chunk` attempt.
    }
  });

  // --- Error Handling ---
   socket.on("error", (err) => {
     console.error(`❌ Socket Error (${socket.id}):`, err.message);
   });
});

// --- Health Check Endpoint ---
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    activeRooms: activeRooms.size,
    activeTransfers: activeTransfers.size,
    connectedClients: io.engine.clientsCount
  });
});

// --- Start Server ---
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is live on http://0.0.0.0:${PORT}`);
});