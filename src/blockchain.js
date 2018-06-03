const CryptoJS = require("crypto-js");
const hexToBinary = require("hex-to-binary");

const BLOCK_GEN_INTERVAL = 10;
const DIFF_ADJUST_INTERVAL = 10;

class Block {

    constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}

const genesisBlock = new Block(
    0,
    "6E862C22973992457ADC001C5B3A18976FF20ABFEEA6B00BA5363F9210404D61",
    null,
    1527900734,
    "Anime r0xx",
    0,
    0
);

let blockChain = [genesisBlock];

const getLatestBlock = () => {
    return blockChain[blockChain.length-1];
};

const getTimestamp = () => {
    return Math.round(new Date().getTime() / 1000);
};

const getBlockChain = () => {
    return blockChain;
};

const createHash = (index, previousHash, timestamp, data, difficulty, nonce) => {
    return CryptoJS.SHA256(index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce).toString();
};

const createNewBlock = (data) => {
    const previousBlock = getLatestBlock();
    const newBlockIndex = previousBlock.index + 1;
    const newTimestamp = getTimestamp();
    const difficulty = findDifficulty();

    const newBlock = findBlock(
        newBlockIndex,
        previousBlock.hash,
        newTimestamp,
        data,
        difficulty
    );
    addBlockToChain(newBlock);
    require("./p2p").broadcastNewBlock();
    return newBlock;
};

const findDifficulty = () => {
    const latestBlock = getLatestBlock();

    // Calculate new difficulty every interval.
    if(latestBlock.index % DIFF_ADJUST_INTERVAL === 0 &&
        latestBlock.index !== 0) {
        return calculateDifficulty(latestBlock, getBlockChain());
    }
    return latestBlock.difficulty;
};

const calculateDifficulty = (latestBlock, chain) => {
    const lastCalculatedBlock = chain[chain.length-DIFF_ADJUST_INTERVAL];
    const timeExpected = BLOCK_GEN_INTERVAL * DIFF_ADJUST_INTERVAL;
    const timeTaken = latestBlock.timestamp - lastCalculatedBlock.timestamp;

    if(timeTaken < timeExpected / 2)
        return lastCalculatedBlock.difficulty + 1;
    else if(timeTaken > timeExpected * 2)
        return lastCalculatedBlock.difficulty - 1;
    else
        return lastCalculatedBlock.difficulty;
};

const findBlock = (index, previousHash, timestamp, data, difficulty) => {
    let nonce = 0;
    while(true) {
        const hash = createHash(
            index,
            previousHash,
            timestamp,
            data,
            difficulty,
            nonce
        );
        
        if(hashMatchesDifficulty(hash, difficulty))
            return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);

        nonce ++;
    }
};

const hashMatchesDifficulty = (hash, difficulty) => {
    const hashInBinary = hexToBinary(hash);
    const requiredZeros = "0".repeat(difficulty);
    return hashInBinary.startsWith(requiredZeros);
};

const getBlockHash = (block) => {
    return createHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);
};

const isTimestampValid = (newBlock, oldBlock) => {
    return (
        oldBlock.timestamp - 60 < newBlock.timestamp &&
        newBlock.timestamp - 60 < getTimestamp()
    );
};

const isBlockValid = (newBlock, latestBlock) => {
    if(!isBlockStructureValid(newBlock)) {
        console.log("isBlockValid - Invalid newBlock structure!");
        return false;
    }
    else if(latestBlock.index + 1 !== newBlock.index) {
        console.log("isBlockValid - Invalid index!");
        return false;
    }
    else if(latestBlock.hash !== newBlock.previousHash) {
        console.log("isBlockValid - Invalid previousHash!");
        return false;
    }
    else if(getBlockHash(newBlock) !== newBlock.hash) {
        console.log("isBlockValid - Invalid newBlock hash!");
        return false;
    }
    else if(!isTimestampValid(newBlock, latestBlock)) {
        console.log("isBlockValid - Invalid timestamp!");
        return false;
    }
    return true;
};

const isBlockStructureValid = (block) => {
    return (
        typeof block.index === "number" &&
        typeof block.hash === "string" &&
        typeof block.previousHash === "string" &&
        typeof block.timestamp === "number" &&
        typeof block.data === "string"
    );
};

const isChainValid = (targetChain) => {
    const isGenesisValid = block => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };

    if(!isGenesisValid(targetChain[0])) {
        console.log("isChainValid - Invalid genesis block mismatch!");
        return false;
    }

    for(let i=1; i<targetChain.length; i++) {
        if(!isBlockValid(targetChain[i], targetChain[i-1])) {
            console.log(`isChainValid - Invalid block sequence at index: ${i}`);
            return false;
        }
    }
    return true;
};

const getDifficultySum = (chain) => {
    return chain.map(block => block.difficulty)
        .map(diff => diff * diff)
        .reduce((a, b) => a + b);
};

const replaceChain = (newChain) => {
    if(isChainValid(newChain)) {
        if(getDifficultySum(newChain) > getDifficultySum(getBlockChain())) {
            if(newChain.length > getBlockChain().length) {
                blockChain = newChain;
                return true;
            }
            console.log("replaceChain - newChain's length is smaller!");
            return false;
        }
        console.log("replaceChain - newChain's difficulty is not valid!");
        return false;
    }
    console.log("replaceChain - newChain is not valid!");
    return false;
};

const addBlockToChain = (newBlock) => {
    if(isBlockValid(newBlock, getLatestBlock())) {
        getBlockChain().push(newBlock);
        return true;
    }
    console.log("addBlockToChain - newBlock is not valid!");
    return false;
};

module.exports = {
    getLatestBlock,
    getBlockChain,
    createNewBlock,
    isBlockStructureValid,
    addBlockToChain,
    replaceChain
};