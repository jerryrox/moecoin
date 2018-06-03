const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const Blockchain = require('./blockchain');
const P2P = require("./p2p");

const {getBlockChain, createNewBlock} = Blockchain;
const {startP2PServer, connectToPeers} = P2P;

const PORT = process.env.HTTP_PORT || 3000;
const app = express();

// Middlewares
app.use(bodyParser.json());
app.use(morgan("combined"));

// Start server
const server = app.listen(PORT, () => {
    console.log("Server started on port " + PORT);
});

// Routes
app.get("/blocks", (req, res) => {
    res.send(getBlockChain());
});

app.post("/blocks", (req, res) => {
    const data = req.body.data;
    const newBlock = createNewBlock(data);
    res.send(newBlock);
});

app.post("/peers", (req, res) => {
    const peer = req.body.peer;
    connectToPeers(peer);
    res.send();
});

// WebSocket server
startP2PServer(server);