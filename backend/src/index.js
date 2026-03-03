import express from "express";
import authRoutes from "./routes/auth.route.js";
import dotenv from "dotenv";
import { connectDB } from "./lib/db.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import User from "./models/user.model.js";
import path from "path";
import { fileURLToPath } from "url"; // 1. Add this

dotenv.config();

// 2. Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const frontendPort = process.env.FRONTEND_PORT_ENV || 5000;
const backendPort = process.env.PORT || process.env.BACKEND_PORT_ENV || 5001;

const allowedOrigins = [
  `http://localhost:${frontendPort}`,
  `http://192.168.31.96:${frontendPort}`,
  "https://goodpanda.onrender.com" // Update this if your URL changes
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

const userConnectedClientMap = {};

io.on("connection", async (connectedClient) => {
  const userId = connectedClient.handshake.query.userId;
  if (userId) {
    userConnectedClientMap[userId] = connectedClient.id;
    try {
      const user = await User.findById(userId);
      if (user) {
        console.log(`✅ User ${user.fullname} connected`);
        connectedClient.user = user; 
      }
    } catch (err) {
      console.log("Socket user fetch error");
    }
  }
  io.emit("getOnlineUsers", Object.keys(userConnectedClientMap));

  connectedClient.on("user-message", async (message) => {
    const name = connectedClient.user?.fullname || "Unknown";
    io.emit("message", { name, theMessage: message });
  });

  connectedClient.on("disconnect", () => {
    if (userId) delete userConnectedClientMap[userId];
    io.emit("getOnlineUsers", Object.keys(userConnectedClientMap));
  });
});

app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use('/api/auth', authRoutes);

// 3. PRODUCTION SETTINGS
if (process.env.NODE_ENV === "production") {
  // We are in backend/src/
  // ../ moves to backend/
  // ../../ moves to root/
  const frontendPath = path.resolve(__dirname, "../../frontend/dist");
  
  app.use(express.static(frontendPath));

  app.get("*path", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// 4. Listen on dynamic port
server.listen(backendPort, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${backendPort}`);
  connectDB();
});