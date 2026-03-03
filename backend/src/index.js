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

dotenv.config();

const app = express();
const server = http.createServer(app);

// 1. Dynamic CORS Logic for both Express and Socket.io
const frontendPort = process.env.FRONTEND_PORT_ENV || 5000;
const backendPort = process.env.PORT || process.env.BACKEND_PORT_ENV || 5001;

const allowedOrigins = [
  `http://localhost:${frontendPort}`,
  `http://192.168.31.96:${frontendPort}`,
  "https://goodpanda.onrender.com" // Replace with your actual Render URL
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
        // FIX: Safe logging to prevent crash
        console.log(`✅ User ${user.fullname} connected (ID: ${connectedClient.id})`);
        connectedClient.user = user; 
      }
    } catch (err) {
      console.log("Socket user fetch error");
    }
  }

  io.emit("getOnlineUsers", Object.keys(userConnectedClientMap));

  connectedClient.on("user-message", async (message) => {
    // Using the user we attached to the client for safety and speed
    const name = connectedClient.user?.fullname || "Unknown";
    console.log(`📩 Message from ${name}: `, message);
    io.emit("message", { name, theMessage: message });
  });

  connectedClient.on("disconnect", () => {
    console.log("❌ A user disconnected", connectedClient.id);
    if (userId) delete userConnectedClientMap[userId];
    io.emit("getOnlineUsers", Object.keys(userConnectedClientMap));
  });
});

app.use(cookieParser());
app.use(express.json());

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// API Routes
app.use('/api/auth', authRoutes);

// 2. Production Static Serving
if (process.env.NODE_ENV === "production") {
  // process.cwd() points to the project root (where backend/ and frontend/ folders live)
  const frontendPath = path.join(process.cwd(), "frontend", "dist");
  
  // Serve static files
  app.use(express.static(frontendPath));

  // Catch-all route
  app.get("*path", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// 3. Listen on process.env.PORT (Required by Render)
server.listen(backendPort, () => {
  console.log(`🚀 Server running on port ${backendPort}`);
  connectDB();
});