const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const app = express();
const { ObjectId } = require('mongodb');
const { Server } = require('socket.io');
const http = require('http');
require('dotenv').config();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use(cors());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Database connection function
async function connectDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

// Connect to MongoDB when server starts
connectDB();

async function fetchTransactions() {
  try {
    const database = client.db("finance");
    const transactions = database.collection("transactions");
    return await transactions.find({}).sort({ date: -1 }).toArray();
  } catch (error) {
    console.error("Database Error:", error);
    return [];
  }
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("getTransactions", async () => {
    const transactions = await fetchTransactions();
    socket.emit("transactionsData", transactions);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// Broadcast updates to all connected clients
async function broadcastTransactions() {
  const transactions = await fetchTransactions();
  io.emit("transactionsData", transactions);
}

// API Routes
app.get('/api/transactions', async (req, res) => {
  try {
    const result = await fetchTransactions();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const database = client.db("finance");
    const transactions = database.collection("transactions");
    const newTransaction = {
      ...req.body,
      amount: Number(req.body.amount), // Ensure amount is stored as a number
      createdAt: new Date()
    };
    const result = await transactions.insertOne(newTransaction);
    await broadcastTransactions();
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const database = client.db("finance");
    const transactions = database.collection("transactions");
    const result = await transactions.deleteOne({ _id: new ObjectId(req.params.id) });
    await broadcastTransactions();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const database = client.db("finance");
    const transactions = database.collection("transactions");
    const result = await transactions.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, amount: Number(req.body.amount) } }
    );
    await broadcastTransactions();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});