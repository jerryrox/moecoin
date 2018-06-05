const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const Blockchain = require('./blockchain');
const P2P = require("./p2p");
const Wallet = require("./wallet");
const MemPool = require("./memPool");

const {getBlockChain, createNewBlock, getAccountBalance, sendTransaction} = Blockchain;
const {startP2PServer, connectToPeers} = P2P;
const {initWallet, getPublicFromWallet} = Wallet;
const {getMemPool} = MemPool;

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
app.route("/blocks")
    .get((req, res) => {
        res.send(getBlockChain());
    })
    .post((req, res) => {
        const newBlock = createNewBlock();
        res.send(newBlock);
    });

app.get("/me/balance", (req, res) => {
    const balance = getAccountBalance();
    res.send({
        balance
    });
});

app.post("/peers", (req, res) => {
    const peer = req.body.peer;
    connectToPeers(peer);
    res.send();
});

app.get("/me/address", (req, res) => {
    res.send(getPublicFromWallet());
});

app.route("/transactions")
    .get((req, res) => {
        res.send(getMemPool());
    })
    .post((req, res) => {
        try {
            const { address, amount } = req.body;
            if(address === undefined || amount === undefined)
                throw Error("Please specify an address and an amount.");

            const resp = sendTransaction(address, amount);
            res.send(resp);
        }
        catch(e) {
            console.log(e);
            res.status(400).send(e.message);
        }
    });

initWallet();
// WebSocket server
startP2PServer(server);