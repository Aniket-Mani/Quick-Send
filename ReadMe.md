```markdown
# Quick Send 🚀

A real-time, peer-to-peer (P2P) inspired file sharing web application built with Node.js, Express, and Socket.IO. Allows users to quickly send files directly between devices on the same network without needing accounts or installations.

## Description

Quick Send provides a simple interface for transferring files directly between two browsers. One user acts as a sender, creating a unique room, while the other acts as a receiver, joining the room using a code or QR scan. The application prioritizes direct connections (using WebRTC principles, though the current server relays data) for speed and privacy.

## Key Features ✨

* **Real-time Transfer:** Files are chunked and streamed directly between connected peers via a server relay.
* **No Sign-up Required:** Works entirely in the browser with no need for user accounts or software installation.
* **Easy Connection:** Connect devices using simple, unique Room Codes or by scanning a QR code (requires camera access on receiver).
* **Secure & Private Focus:** Aims for direct P2P transfer principles, minimizing server interaction with file content (server currently relays chunks).
* **Client-Side File Size Limit:** Configurable limit (defaulted previously to 1GB) to prevent accidental selection of extremely large files.
* **Modern File Handling:** Utilizes the File System Access API on the receiver side (when available) for efficient saving, with a memory buffer fallback.
* **Dark/Light Theme:** User-selectable theme preference stored in local storage.
* **Responsive Design:** UI adapts to different screen sizes.
* **Transfer Progress:** Basic per-file progress indication on the receiver side.
* **Connection Status:** Visual indicator for server connection.

## Tech Stack 💻

* **Backend:**
    * Node.js
    * Express.js (for serving static files and basic routing)
    * Socket.IO (for WebSocket communication, signaling, and data relay)
    * `dotenv` (for environment variables)
* **Frontend:**
    * HTML5
    * CSS3 (with CSS Variables)
    * Vanilla JavaScript (ES Modules)
    * Font Awesome (for icons)
    * `qrcode.js` (for generating QR codes)
    * `html5-qrcode` (for scanning QR codes)
    * `aos` (Animate On Scroll library for subtle animations)

## Project Structure 📁

```
quick-send/
├── public/                 # Static files served by Express
│   ├── index.html          # Main sender page
│   ├── receiver.html       # Receiver page
│   ├── style.css           # Main shared styles
│   ├── receiver.css        # Styles specific to receiver page
│   ├── JS/
│   │   ├── main.js         # Client-side logic for sender (index.html)
│   │   ├── receiver.js     # Client-side logic for receiver (receiver.html)
│   │   ├── style.js        # UI interactions (theme, mobile nav, etc.)
│   │   └── scroll-handler.js # Smooth scrolling logic
│   ├── images/
│   │   └── about-illustration.svg
│   └── favicon/
│       └── ...             # Favicon files
├── server.js               # Main backend server file
├── package.json
├── package-lock.json
└── .env                    # Environment variables (e.g., PORT)
```

*(Note: Ensure your files match this structure, especially placing static assets inside the `public` folder as configured in `server.js`)*

## Setup & Installation ⚙️

1.  **Prerequisites:**
    * Node.js (includes npm) installed (e.g., LTS version)
2.  **Clone the Repository:**
    ```bash
    git clone <your-repository-url>
    cd quick-send
    ```
3.  **Install Dependencies:**
    ```bash
    npm install
    ```
4.  **Create Environment File:**
    * Create a file named `.env` in the root directory.
    * Add the following line, adjusting the port if needed:
        ```env
        PORT=5050
        ```

## Running the Application ▶️

1.  **Start the Server:**
    ```bash
    node server.js
    ```
    * Alternatively, use `nodemon` for development (auto-restarts on changes): `nodemon server.js` (requires `npm install -g nodemon` or as a dev dependency).
2.  **Access the Application:**
    * **Sender:** Open your browser and navigate to `http://localhost:5050` (or your configured port).
    * **Receiver:** Open your browser (preferably on a different device on the same network for testing transfer) and navigate to `http://localhost:5050/receiver.html`.
    * **Network Access:** To access from other devices on your local network, find your computer's local IP address (e.g., `192.168.x.x`) and access `http://<your-local-ip>:5050` and `http://<your-local-ip>:5050/receiver.html`. *(See Limitations regarding QR scanning on non-localhost HTTP)*.

## Usage Instructions 📖

1.  **Sender:**
    * Open the main page (`http://localhost:5050`).
    * Click "Send Files".
    * A unique Room Code and QR code will be generated.
    * Share the Room Code or have the receiver scan the QR code.
    * Wait for the receiver to join (status will update).
    * Once the receiver joins, click "Choose File", select the file you want to send (respecting the size limit).
    * Click "Send File".
2.  **Receiver:**
    * Open the receiver page (`http://localhost:5050/receiver.html`).
    * **Option 1 (Code):** Enter the Room Code provided by the sender and click "Connect".
    * **Option 2 (QR):** Click "Scan QR Code". Grant camera permission if prompted. Scan the QR code displayed on the sender's screen.
    * Once connected, wait for the sender to initiate the transfer.
    * If the browser supports the File System Access API, you will be prompted to choose a save location for the incoming file. Accept to start the download.
    * If the API is not supported, the file will be buffered in memory and automatically downloaded as a Blob when the transfer completes (this may fail for very large files).
    * Monitor the progress in the file list.
    * Use the "Cancel Active Transfer" button if needed.

## Configuration 🔧

* **Port:** Set the `PORT` in the `.env` file.
* **Server Limits:** Constants like `MAX_CHUNK_BUFFER_SIZE`, `PING_TIMEOUT_DEFAULT`, `TRANSFER_INACTIVITY_TIMEOUT` can be adjusted directly in `server.js`. Be cautious when increasing buffer sizes.
* **Client File Size Limit:** The maximum allowed file size check upon selection is configured within the sender's JavaScript (`public/JS/main.js`).

## Known Issues & Limitations ⚠️

* **Large File Transfers (>1-2 GB):** Transfers of very large files are likely to fail, primarily due to browser memory limitations on the receiver side if the File System Access API is not used (memory buffer fallback). Server resources can also be strained.
* **Secure Context for QR Scan:** QR code scanning requires camera access, which needs a secure context (HTTPS or localhost). Scanning will **not** work when accessing the receiver page via `http://<local-ip-address>:port`. Use `localhost`, HTTPS, or other workarounds (like ADB forwarding for Android) for testing this feature.
* **Server Relay:** The current implementation primarily relays data through the server. While aiming for P2P principles, it may not establish a direct WebRTC data channel, potentially bottlenecking transfers through the server's bandwidth and resources.
* **Basic Error Handling:** Error handling for network interruptions or unexpected issues can be improved.
* **Single File Transfer:** The UI currently appears designed for transferring one file at a time per session.


## License

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
```