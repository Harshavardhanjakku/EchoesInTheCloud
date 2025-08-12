# EchoesInTheCloud

> Real-time, scalable chat application built with Node.js, Express, Socket.IO, and MongoDB — delivering seamless messaging across the cloud.

---

## Table of Contents

- [EchoesInTheCloud](#echoesinthecloud)
  - [Table of Contents](#table-of-contents)
  - [About](#about)
  - [Features](#features)
  - [Tech Stack](#tech-stack)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Environment Variables](#environment-variables)
  - [API Endpoints](#api-endpoints)
  - [WebSocket Events](#websocket-events)
  - [Folder Structure](#folder-structure)
  - [Contributing](#contributing)
  - [License](#license)
  - [Contact](#contact)

---

## About

EchoesInTheCloud is a modern chat application that supports real-time messaging with persistent storage. Designed for speed, scalability, and ease of use, it integrates MongoDB to save message history and Socket.IO for bidirectional WebSocket communication.

---

## Features

* Real-time chat with multiple clients
* Persistent message history stored in MongoDB
* User identification with customizable usernames
* REST API endpoint to fetch chat history
* Cross-Origin Resource Sharing (CORS) enabled for frontend-backend integration
* Robust error handling and reconnection support

---

## Tech Stack

* **Backend:** Node.js, Express.js
* **WebSocket:** Socket.IO
* **Database:** MongoDB (Mongoose ORM)
* **Environment Management:** dotenv
* **Other:** CORS middleware, HTTP server

---

## Getting Started

### Prerequisites

* Node.js (v16+)
* npm or yarn
* MongoDB Atlas or local MongoDB instance
* Git

---

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Harshavardhanjakku/EchoesInTheCloud.git
   cd EchoesInTheCloud
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory:

   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   CLIENT_ORIGIN=http://localhost:3000
   ```

4. **Start the server**

   ```bash
   npm start
   ```

---

## Usage

* Connect your frontend client to the Socket.IO server URL.
* Use the provided REST endpoint `/messages` to fetch message history.
* Exchange real-time messages with other connected users.

---

## Environment Variables

| Variable        | Description                            | Example                       |
| --------------- | -------------------------------------- | ----------------------------- |
| `PORT`          | Port on which server listens           | 5000                          |
| `MONGO_URI`     | MongoDB connection string              | `mongodb+srv://user:pass@...` |
| `CLIENT_ORIGIN` | Allowed origin for CORS (frontend URL) | `http://localhost:3000`       |

---

## API Endpoints

| Method | Endpoint    | Description                 |
| ------ | ----------- | --------------------------- |
| GET    | `/messages` | Get the latest 500 messages |

---

## WebSocket Events

| Event             | Description                    | Payload Example                                |
| ----------------- | ------------------------------ | ---------------------------------------------- |
| `connection`      | Fired when a client connects   | Socket connection object                       |
| `message-history` | Server sends last 500 messages | Array of message objects                       |
| `message`         | Client sends a new message     | `{ user: "User", text: "Hello!", time: Date }` |
| `message`         | Server broadcasts new message  | Same as above                                  |
| `disconnect`      | Client disconnects             | Socket ID                                      |

---

## Folder Structure

```
EchoesInTheCloud/
├── server/
│   ├── server.js           # Express and Socket.IO backend
│   ├── models/
│   │   └── Message.js      # Mongoose message schema
│   └── .env               # Environment variables (gitignored)
├── client/                 # (Optional) Frontend source code
├── .gitignore
├── package.json
└── README.md
```

---

## Contributing

Contributions are welcome!
Please open an issue or submit a pull request for improvements or bug fixes.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Contact

**Jakku Harshavardhan**

* GitHub: [Harshavardhanjakku](https://github.com/Harshavardhanjakku)
* Email: [jakkuharshavardhan2004@gmail.com](mailto:jakkuharshavardhan2004@gmail.com)

---

*Thank you for checking out EchoesInTheCloud! Stay connected.* 🚀

---
