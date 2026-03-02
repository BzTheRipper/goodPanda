import express from "express";
import authRoutes from "./routes/auth.route.js";
import dotenv from "dotenv";
import { connect } from "mongoose";
import { connectDB } from "./lib/db.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import User from "./models/user.model.js";
import path from "path";

// To use dotenv
dotenv.config();
const backendPort = process.env.BACKEND_PORT_ENV;
const frontedPort = process.env.FRONTEND_PORT_ENV;
const __dirname = path.resolve();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [`http://localhost:5000`],
    credentials: true
  }
});

// Used to store online users
const userConnectedClientMap = {}; //{userId: connectedClientId}

// From here actually we are connecting with socket connection
io.on("connection", async (connectedClient) => {


  const userId = connectedClient.handshake.query.userId;
  if (userId) {
    userConnectedClientMap[userId] = connectedClient.id
  }
  const userName = await (User.findById(userId));
  console.log(`A new user, ${userName.fullname} has been connected, socket ID: ${connectedClient.id}`);

  // io.emit is used to send the events to all the connected clients or basically broadcasting it
  io.emit("getOnlineUsers", Object.keys(userConnectedClientMap));


  connectedClient.on("user-message", async (message) => {
    const theUser = await User.findById(connectedClient.handshake.query.userId);
    console.log(`A message from ${theUser.fullname}: `, message);
    const userInfo = {
      name: theUser.fullname,
      theMessage: message
    };
    io.emit("message", userInfo);
  })

  // For Disconnection
  connectedClient.on("disconnect", () => {
    console.log("A user has been disconnected", connectedClient.id)
    delete userConnectedClientMap[userId];
    io.emit("getOnlineUsers", Object.keys(userConnectedClientMap));
  })
})

app.use(cookieParser());
app.use(express.json());



app.use(cors({
  origin: [`http://localhost:5000`],
  credentials: true
}));

app.use('/api/auth', authRoutes);

if (process.env.MODE === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  })
}

server.listen(backendPort, () => {
  console.log(`Server started at http://192.168.31.96:${backendPort}`)
  connectDB();
})

app.get('/', (req, res) => {
  res.send("Hi");
})