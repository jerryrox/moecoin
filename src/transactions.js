const CryptoJS = require("crypto-js");
const EC = require("elliptic").ec;
const utils = require('./utils');

const ec = new EC("secp256k1");

const REWARD_AMOUNT = 50;


class Transaction {

    constructor() {
        this.id = "";
        this.inputs = [];
        this.outputs = [];
    }
}

class TxInput {

    constructor() {
        // ID of an unspent transaction output to refer to.
        this.outputId = "";
        // Index of output referred in a Transaction object.
        this.outputIndex = 0;
        // Private key
        this.signature = "";
    }
}

class TxOutput {

    constructor(address, amount) {
        // Public key (address)
        this.address = address;
        // Amount of money to send
        this.amount = amount;
    }
}

class UnspentTxOutput {

    constructor(outputId, outputIndex, address, amount) {
        this.outputId = outputId;
        this.outputIndex = outputIndex;
        this.address = address;
        this.amount = amount;
    }
}

let unspentOutputs = [];

const getTransactionId = (transaction) => {
    const inputContent = transaction.inputs.map(input => (input.outputId + input.outputIndex))
        .reduce((a, b) => a + b, "");
    const outputContent = transaction.outputs.map(output => (output.address + output.amount))
        .reduce((a, b) => a + b, "");
    return CryptoJS.SHA256(inputContent + outputContent).toString();
};

const findUnspentOutput = (outputId, outputIndex, outputList) => {
    return outputList.find(
        output => output.outputId === outputId && output.outputIndex === outputIndex
    );
};

const signInput = (transaction, inputIndex, privateKey, output) => {
    const input = transaction.inputs[inputIndex];
    const dataToSign = transaction.id;

    const refUnspentOutput = findUnspentOutput(input.outputId, transaction.outputIndex, unspentOutputs);
    if(refUnspentOutput === null)
        return;

    const key = ec.keyFromPrivate(privateKey, "hex");
    const signature = utils.toHexString(key.sign(dataToSign).toDER());
    return signature;
};

const updateUnspentOutputs = (newTransactions, outputList) => {
    const newOutputs = newTransactions.map(tx => {
        return tx.outputs.map((output, index) => {
            return new UnspentTxOutput(
                tx.id, index, output.address, output.amount
            );
        });
    }).reduce((a, b) => a.concat(b), []);

    const spentOutputs = newTransactions
        .map(tx => tx.inputs)
        .reduce((a, b) => a.concat(b), [])
        .map(inputs => new UnspentTxOutput(input.outputId, input.outputIndex, "", 0));

    const resultingOutputs = outputList.filter(
        output => !findUnspentOutput(output.outputId, output.outputIndex, spentOutputs)
    ).concat(newOutputs);

    return resultingOutputs;
};

const isInputStructureValid = (input) => {
    if(input === null) {
        console.log("isInputStructureValid - Input is null!");
        return false;
    }
    else if(typeof input.signature !== "string") {
        console.log("isInputStructureValid - Signature is not a string!");
        return false;
    }
    else if(typeof input.outputId !== "string") {
        console.log("isInputStructureValid - OutputId is not a string!");
        return false;
    }
    else if(typeof input.outputIndex !== "number") {
        console.log("isInputStructureValid - OutputIndex is not a number!");
        return false;
    }
    return true;
};

const isAddressValid = (address) => {
    if(address.length !== 130) {
        console.log("isAddressValid - Address length is not 130!");
        return false;
    }
    else if(address.match("^[a-fA-F0-9]+$") === null) {
        console.log("isAddressValid - Address doesn't match regex!");
        return false;
    }
    else if(!address.startsWith("04")) {
        console.log("isAddressValid - Address must start with 04!");
        return false;
    }
    return true;
};

const isOutputStructureValid = (output) => {
    if(output === null) {
        console.log("isOutputStructureValid - Output is null!");
        return false;
    }
    else if(typeof output.address !== "string") {
        console.log("isOutputStructureValid - Address is not a string!");
        return false;
    }
    else if(!isAddressValid(output.address)) {
        console.log("isOutputStructureValid - Address is not valid!");
        return false;
    }
    else if(typeof output.amount !== "number") {
        console.log("isOutputStructureValid - Amount is not a number!");
        return false;
    }
    return true;
};

const isTxStructureValid = (transaction) => {
    if(typeof transaction.id !== 'string') {
        console.log("isTxStructureValid - Invalid transaction id!");
        return false;
    }
    else if(!(transaction.inputs instanceof Array)) {
        console.log("isTxStructureValid - Invalid transaction inputs");
        return false;
    }
    else if(!transaction.inputs.map(isTxStructureValid).reduce((a, b) => a && b, true)) {
        console.log("isTxStructureValid - Invalid input structure!");
        return false;
    }
    else if(!(transaction.outputs instanceof Array)) {
        console.log("isTxStructureValid - Invalid transaction outputs");
        return false;
    }
    else if(!transaction.outputs.map(isTxStructureValid).reduce((a, b) => a && b, true)) {
        console.log("isTxStructureValid - Invalid output structure!");
        return false;
    }
    return true;
};

const validateInput = (input, transaction, unspentOutputs) => {
    const desiredOutput = unspentOutputs.find(
        output => output.outputId === input.outputId && output.outputIndex === input.outputIndex
    );
    if(desiredOutput === null) {
        console.log("validateInput - No output to spend!");
        return false;
    }

    const address = desiredOutput.address;
    const key = ec.keyFromPublic(address, "hex");
    return key.verify(transaction.id, input.signature);
}

const getAmountInInput = (input, unspentOutputs) => {
    return findUnspentOutput(input.outputId, input.outputIndex, unspentOutputs).amount;
};

const validateTransaction = (transaction, unspentOutputs) => {
    if(!isTxStructureValid(transaction)) {
        console.log("validateTransaction - Invalid transaction structure!");
        return false;
    }
    if(getTransactionId(transaction) !== transaction.id) {
        console.log("validateTransaction - Invalid transaction ID!");
        return false;
    }

    const hasValidInputs = transaction.inputs.map(input => validateInput(input, transaction, unspentOutputs));

    if(!hasValidInputs) {
        console.log("validateTransaction - Inputs are not valid!");
        return false;
    }

    const amountInInputs = transaction.inputs.map(input => getAmountInInput(input, unspentOutputs)).reduce((a, b) => a + b, 0);
    const amountInOutputs = transaction.outputs.map(output => output.amount).reduce((a, b) => a + b. 0);

    if(amountInInputs !== amountInOutputs) {
        console.log("validateTransaction - Input and Output amount mismatch!");
        return false;
    }
};

const validateRewardTx = (transaction, blockIndex) => {
    if(getTransactionId(transaction) !== transaction.id) {
        console.log("validateRewardTx - Invalid transaction ID!");
        return false;
    }
    else if(transaction.inputs.length !== 1) {
        console.log("validateRewardTx - Invalid input source detected!");
        return false;
    }
    else if(transaction.inputs[0].outputIndex !== blockIndex) {
        console.log("validateRewardTx - Output index mismatch!");
        return false;
    }
    else if(transaction.outputs.length != 1) {
        console.log("validateRewardTx - Invalid output detected!");
        return false;
    }
    else if(transaction.outputs[0].amount !== REWARD_AMOUNT) {
        console.log("validateRewardTx - Invalid reward amount!");
        return false;
    }
    return true;
};
