import express from "express";
import authRoutes from "./routes/auth.route.js";
import dotenv from "dotenv";
import { connect } from "mongoose";
import { connectDB } from "./lib/db.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";

// To use dotenv
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://192.168.31.96:5000", "http://localhost:5000"], 
    credentials: true
  }
});

// From here actually we are connecting with socket connection
io.on("connection", (connectedClient) => {
    console.log("A new user has been connected", connectedClient.id);

    // For Disconnection
    connectedClient.on("disconnect", () => {
        console.log("A user has been disconnected", connectedClient.id)
    })
})

app.use(cookieParser());
app.use(express.json()); 

const backendPort = process.env.BACKEND_PORT_ENV;
const frontedPort = process.env.FRONTEND_PORT_ENV;

app.use(cors({
  origin: [`http://192.168.31.96:${frontedPort}`, `http://localhost:${frontedPort}`],
  credentials: true
}));

app.use('/api/auth', authRoutes);

server.listen(backendPort, () => {
    console.log(`Server started at http://192.168.31.96:${backendPort}`)
    connectDB();
})

app.get('/', (req, res) => {
    res.send("Hi");
})