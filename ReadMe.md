# Quick Send 🚀

**Quick Send** is a real-time, peer-to-peer (P2P)-inspired file sharing web app built with **Node.js**, **Express**, and **Socket.IO**, designed for fast, direct file transfers between devices on the same network — all through your browser, with no installation or sign-up required.

---

## 🌟 Goals

- Provide a free, open-source tool for local network file sharing.  
- Ensure ease of use: no user accounts, no app installs.  
- Explore P2P-style transfers that emphasize speed, privacy, and minimal server intervention.

---

## ✨ Features

- **Real-time Transfer**: File chunks are streamed between peers (via Socket.IO relay).  
- **No Sign-Up**: 100% in-browser, no user accounts needed.  
- **Easy Connections**: Share Room Code or scan a QR to connect.  
- **Modern File Handling**: Uses File System Access API when available.  
- **File Size Limit**: Configurable limit (e.g., 1GB) to prevent oversized file transfers.  
- **Responsive UI**: Includes dark/light themes, connection status, and progress feedback.

---

## 💻 Tech Stack

### Backend

- Node.js  
- Express.js (serving static files & routing)  
- Socket.IO (signaling & data relay)  
- dotenv (for environment variables)

### Frontend

- HTML5, CSS3 (CSS Variables)  
- Vanilla JavaScript (ES Modules)  
- Font Awesome (icons)  
- `qrcode.js` (QR generation)  
- `html5-qrcode` (QR scanning)  
- AOS (scroll animations)

---

## ⚙️ Setup & Installation

### Prerequisites

- Node.js (LTS version recommended)

### Steps

```bash
git clone https://github.com/Aniket-Mani/Quick-Send
cd quick-send
npm install
```

### Environment Setup

Create a `.env` file in the root with:

```env
PORT=5050
```

### Start the Server

```bash
node server.js
# or with auto-reload:
npx nodemon server.js
```

---

## 🌐 Access the App

- **Sender**: http://localhost:5050  
- **Receiver**: http://localhost:5050/receiver.html

To test across devices on the same local network, replace `localhost` with your machine’s local IP:

```
http://<your-local-ip>:5050
http://<your-local-ip>:5050/receiver.html
```

---

## 📖 Usage Instructions

### 📨 Sender

1. Go to `http://localhost:5050`  
2. Click **Send Files**  
3. Share the generated **Room Code** or **QR Code**  
4. Wait for the receiver to join  
5. Select and send a file

### 📥 Receiver

1. Go to `http://localhost:5050/receiver.html`  
2. Connect using:  
   - **Room Code**, or  
   - **QR Scan** (allow camera access)  
3. Choose where to save the file if prompted  
4. File will auto-download when transfer completes

> If File System Access API isn’t supported, file is downloaded via memory buffer (may fail for large files)

---

## 🔧 Configuration

- **Port**: Set in `.env`  
- **Server Constants**: Modify `server.js`  
  - `MAX_CHUNK_BUFFER_SIZE`  
  - `PING_TIMEOUT_DEFAULT`  
  - `TRANSFER_INACTIVITY_TIMEOUT`  
- **Client File Size Limit**: Set in `main.js`

---

## 🙋 FAQ

### ❓ Does this use true P2P (WebRTC)?

No. It currently uses Socket.IO as a relay. WebRTC may be integrated in future versions.

### ❓ Why do large transfers fail?

If the File System Access API is unsupported, the file is buffered in memory, which can exceed browser limits.

### ❓ Why doesn't QR scanning work via local IP?

QR scanning requires camera access, which is only allowed in secure contexts (HTTPS or localhost). Workarounds include setting up HTTPS or using `localhost`.

### ❓ Can I send multiple files?

Not yet. Only one file per session is currently supported.

### ❓ Is the transfer encrypted?

Not by default. To encrypt the connection, serve over **HTTPS**. WebRTC (when implemented) uses **DTLS encryption**.

---

## 📜 License

MIT License

Copyright (c) 2025 [Aniket Mani]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


