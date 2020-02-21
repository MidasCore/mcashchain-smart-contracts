const fs = require('fs');
const web3 = require('web3');
const web3Utils = require('web3-utils');
const hex2dec = require('hex2dec');
const deployUtil = require('../deploy-util');

const FULL_NODE = 'https://testnet.mcash.network';

let node = {
    fullHost: FULL_NODE,
};

const McashWeb = require('mcashweb');

const BURN_ADDRESS = 'MAAAAAAAAAAAAAAAAAAAAAAAAAAAHF57Ay';

const ZERONET_SMART_CONTRACT_OWNER_ADDRESS = '<sercret>';
const ZERONET_SMART_CONTRACT_OWNER_PK = '<sercret>';

const ZERONET_ADMIN_ADDRESS = '<sercret>';
const ZERONET_ADMIN_PK = '<sercret>';

const TESTER_ADDRESS = '<sercret>';

const TOKEN_ID = 1000012;
const M1_SWAP_CONTRACT = '<sercret>';

const mcashWeb = new McashWeb({
    fullHost: FULL_NODE,
    privateKey: ZERONET_SMART_CONTRACT_OWNER_PK,
});

async function queryBalance(address) {
    const accountData = await mcashWeb.mcash.getAccount(address);
    const mcashBalance = accountData.hasOwnProperty('balance') ? accountData['balance'] : 0;
    const tokenBalance = (accountData.hasOwnProperty('assets') && accountData['assets'].length > 0) ? accountData['assets'][0]['value'] : 0;
    console.log('mcashBalance=', (mcashBalance / 1e8).toFixed(2), 'MCASH');
    console.log('tokenBalance=', (tokenBalance / 1e4).toFixed(2), 'MCCT');
}

async function deployContract() {
    // https://testnet.mcashscan.io/#/token/TOKEN_ID
    // MultiCoinCasinoTestnet (MCCT)
    const contract_name = 'UnidexReserve.MCASH-MCC.v1';
    const _m1TokenId = TOKEN_ID;
    const _m1Symbol = 'MCCT';

    const parameters = [_m1TokenId, _m1Symbol];

    let contractBuildRawData = fs.readFileSync('../../build-mcashbox/M1ToMcashUnidexReserve.json');
    let contractBuild = JSON.parse(contractBuildRawData);

    const contractAbi = contractBuild['abi'];
    const contractBytecode = contractBuild['bytecode'].substr(2);

    const options = {
        feeLimit: 100000000000, // Total Energy Cost: 7935022
        name: contract_name,
        originEnergyLimit: 10000000,
        userFeePercentage: 0,
        callValue: 0,
        parameters: parameters,
        abi: contractAbi,
        bytecode: contractBytecode,
    };

    const rez = await deployUtil.createSmartContract(mcashWeb, options, ZERONET_SMART_CONTRACT_OWNER_ADDRESS, ZERONET_SMART_CONTRACT_OWNER_PK);
    console.log(rez);
}

async function setParams() {
    const m1MinCapTrade = 10e4;
    const m1MaxCapTrade = 10000e4;

    const mcashMinCapTrade = 10e8;
    const mcashMaxCapTrade = 10000e8;

    const commissionInPer10000 = 100; // 1%
    const changingRatePer10000 = 200; // every 10k MCASH: increase/decrease 2.0%
    const m1McashTradeRatioInBps = 5000; // 1 MCASH = 0.5 MCC -> 100000000 uMCASH = 5000 uMCC

    const burnRatePer10000 = 50; // 0.5%
    const burnMinAmount = 1e8;
    const affRatePer10000 = 50; // 0.5%

    const _m1MinCapTrade = {
        type: 'uint256',
        value: m1MinCapTrade,
    };
    const _m1MaxCapTrade = {
        type: 'uint256',
        value: m1MaxCapTrade,
    };
    const _mcashMinCapTrade = {
        type: 'uint256',
        value: mcashMinCapTrade,
    };
    const _mcashMaxCapTrade = {
        type: 'uint256',
        value: mcashMaxCapTrade,
    };
    const _commissionInPer10000 = {
        type: 'uint16',
        value: commissionInPer10000,
    };
    const _changingRatePer10000 = {
        type: 'uint16',
        value: changingRatePer10000,
    };
    const _m1McashTradeRatioInBps = {
        type: 'uint256',
        value: m1McashTradeRatioInBps,
    };
    const _burnRatePer10000 = {
        type: 'uint16',
        value: burnRatePer10000,
    };
    const _burnMinAmount = {
        type: 'uint256',
        value: burnMinAmount,
    };
    const _affRatePer10000 = {
        type: 'uint16',
        value: affRatePer10000,
    };

    let params, tx_res;

    params = [_m1MinCapTrade, _m1MaxCapTrade, _mcashMinCapTrade, _mcashMaxCapTrade];
    tx_res = await deployUtil.triggerSmartContract(mcashWeb, M1_SWAP_CONTRACT, 'setLiquidityParams(uint256,uint256,uint256,uint256)', {}, params);
    console.log('setLiquidityParams(): tx_res=', tx_res);

    params = [_commissionInPer10000, _changingRatePer10000, _m1McashTradeRatioInBps];
    // function setTradeRatioParams(uint16 _commissionInPer10000, uint16 _changingRatePer10000, uint256 _m1McashTradeRatioInBps) external onlyOwnerOrAdmin {
    tx_res = await deployUtil.triggerSmartContract(mcashWeb, M1_SWAP_CONTRACT, 'setTradeRatioParams(uint16,uint16,uint256)', {}, params);
    console.log('setTradeRatioParams(): tx_res=', tx_res);

    params = [_burnRatePer10000, _burnMinAmount];
    // function setBurnParams(uint16 _burnRatePer10000, uint256 _burnMinAmount) external onlyOwnerOrAdmin {
    tx_res = await deployUtil.triggerSmartContract(mcashWeb, M1_SWAP_CONTRACT, 'setBurnParams(uint16,uint256)', {}, params);
    console.log('setTradeRatioParams(): tx_res=', tx_res);

    params = [_affRatePer10000];
    // function setAffRate(uint16 _affRatePer10000) external onlyOwnerOrAdmin {
    tx_res = await deployUtil.triggerSmartContract(mcashWeb, M1_SWAP_CONTRACT, 'setAffRate(uint16)', {}, params);
    console.log('setTradeRatioParams(): tx_res=', tx_res);
}

async function printVariables() {
    console.log(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'owner'));
    console.log(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'admin'));

    console.log('------------------------');
    console.log('m1MinCapTrade=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1MinCapTrade')));
    console.log('m1MaxCapTrade=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1MaxCapTrade')));
    console.log('mcashMinCapTrade=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'mcashMinCapTrade')));
    console.log('mcashMaxCapTrade=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'mcashMaxCapTrade')));
    console.log('------------------------');
    console.log('commissionInPer10000=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'commissionInPer10000')));
    console.log('changingRatePer10000=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'changingRatePer10000')));
    console.log('------------------------');
    console.log('burnRatePer10000=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'burnRatePer10000')));
    console.log('burnMinAmount=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'burnMinAmount')));
    console.log('affRatePer10000=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'affRatePer10000')));
    console.log('------------------------');
    console.log('m1TokenId=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1TokenId')));
    const m1Symbol = await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1Symbol');
    console.log('m1Symbol.length=', m1Symbol.length);
    console.log('m1Symbol=', web3Utils.hexToUtf8('0x' + m1Symbol.substr(128)));
    console.log('m1McashTradeRatioInBps=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1McashTradeRatioInBps')));
    console.log('------------------------');

}

async function topupReserve() {
    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);

    console.log(await deployUtil.sendMcash(mcashWeb, M1_SWAP_CONTRACT, 10000e8, ZERONET_SMART_CONTRACT_OWNER_ADDRESS, ZERONET_SMART_CONTRACT_OWNER_PK));
    console.log(await deployUtil.sendM1Token(mcashWeb, M1_SWAP_CONTRACT, 10000e4, TOKEN_ID, ZERONET_SMART_CONTRACT_OWNER_ADDRESS, ZERONET_SMART_CONTRACT_OWNER_PK));
    console.log(await deployUtil.sendMcash(mcashWeb, BURN_ADDRESS, 1, ZERONET_SMART_CONTRACT_OWNER_ADDRESS, ZERONET_SMART_CONTRACT_OWNER_PK));

    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);
}

// function getM1TradeAmount(uint256 mcashAmount) public view returns (uint256) {
async function queryGetM1TradeAmount(mcashAmount) {
    const _mcashAmount = {
        type: 'uint256',
        value: mcashAmount,
    };
    const rez = await deployUtil.querySmartContract(mcashWeb, M1_SWAP_CONTRACT, 'getM1TradeAmount(uint256)', {}, [_mcashAmount], ZERONET_ADMIN_ADDRESS, ZERONET_ADMIN_PK);
    console.log(hex2dec.hexToDec(rez));
    return rez;
}

// function getMcashTradeAmount(uint256 m1Amount) public view returns (uint256) {
async function queryGetMcashTradeAmount(m1Amount) {
    const _m1Amount = {
        type: 'uint256',
        value: m1Amount,
    };
    const rez = await deployUtil.querySmartContract(mcashWeb, M1_SWAP_CONTRACT, 'getMcashTradeAmount(uint256)', {}, [_m1Amount], ZERONET_ADMIN_ADDRESS, ZERONET_ADMIN_PK);
    console.log(hex2dec.hexToDec(rez));
    return rez;
}

async function swapMcashToM1() {
    console.log('m1McashTradeRatioInBps=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1McashTradeRatioInBps')));
    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(ZERONET_ADMIN_ADDRESS);
    await queryBalance(BURN_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);

    const tradeAmount = 1000e8;

    const srcTokenId = 0;
    const destTokenId = TOKEN_ID;
    const destAmount = 1e8;
    const minAcceptedDestAmount = 1000;
    const refWallet = ZERONET_ADMIN_ADDRESS;
    const _srcTokenId = {
        type: 'uint256',
        value: srcTokenId,
    };
    const _destTokenId = {
        type: 'uint256',
        value: destTokenId,
    };
    const _destAmount = {
        type: 'uint256',
        value: destAmount,
    };
    const _minAcceptedDestAmount = {
        type: 'uint256',
        value: minAcceptedDestAmount,
    };
    const _refWallet = {
        type: 'address',
        value: refWallet,
    };
    const options = {
        callValue: tradeAmount,
    };
    const params = [_srcTokenId, _destTokenId, _destAmount, _minAcceptedDestAmount, _refWallet];
    const tx_res = await deployUtil.triggerSmartContract(mcashWeb, M1_SWAP_CONTRACT, 'trade(uint256,uint256,uint256,uint256,address)', options, params);
    console.log('trade(): tx_res=', tx_res);

    console.log('m1McashTradeRatioInBps=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1McashTradeRatioInBps')));
    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(ZERONET_ADMIN_ADDRESS);
    await queryBalance(BURN_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);
}

async function marketSellMcashToM1() {
    console.log('m1McashTradeRatioInBps=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1McashTradeRatioInBps')));
    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(ZERONET_ADMIN_ADDRESS);
    await queryBalance(BURN_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);

    const tradeAmount = 1000e8;

    const srcTokenId = 0;
    const destTokenId = TOKEN_ID;
    const destAmount = 1e8;
    const minAcceptedDestAmount = 1000;
    const refWallet = ZERONET_ADMIN_ADDRESS;
    const _srcTokenId = {
        type: 'uint256',
        value: srcTokenId,
    };
    const _destTokenId = {
        type: 'uint256',
        value: destTokenId,
    };
    const _refWallet = {
        type: 'address',
        value: refWallet,
    };
    const options = {
        callValue: tradeAmount,
    };
    const params = [_srcTokenId, _destTokenId, _refWallet];
    const tx_res = await deployUtil.triggerSmartContract(mcashWeb, M1_SWAP_CONTRACT, 'marketTrade(uint256,uint256,address)', options, params);
    console.log('trade(): tx_res=', tx_res);

    console.log('m1McashTradeRatioInBps=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1McashTradeRatioInBps')));
    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(ZERONET_ADMIN_ADDRESS);
    await queryBalance(BURN_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);
}

async function swapM1ToMcash() {
    console.log('m1McashTradeRatioInBps=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1McashTradeRatioInBps')));
    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);

    const tradeAmount = 4919339;

    const srcTokenId = TOKEN_ID;
    const destTokenId = 0;
    const destAmount = 1e15;
    const minAcceptedDestAmount = 1;
    const refWallet = ZERONET_SMART_CONTRACT_OWNER_ADDRESS;
    const _srcTokenId = {
        type: 'uint256',
        value: srcTokenId,
    };
    const _destTokenId = {
        type: 'uint256',
        value: destTokenId,
    };
    const _destAmount = {
        type: 'uint256',
        value: destAmount,
    };
    const _minAcceptedDestAmount = {
        type: 'uint256',
        value: minAcceptedDestAmount,
    };
    const _refWallet = {
        type: 'address',
        value: refWallet,
    };
    const options = {
        tokenId: srcTokenId,
        tokenValue: tradeAmount,
    };
    const params = [_srcTokenId, _destTokenId, _destAmount, _minAcceptedDestAmount, _refWallet];
    const tx_res = await deployUtil.triggerSmartContract(mcashWeb, M1_SWAP_CONTRACT, 'trade(uint256,uint256,uint256,uint256,address)', options, params);
    console.log('trade(): tx_res=', tx_res);

    console.log('m1McashTradeRatioInBps=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1McashTradeRatioInBps')));
    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);
}

async function marketSellM1ToMcash() {
    console.log('m1McashTradeRatioInBps=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1McashTradeRatioInBps')));
    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);

    const tradeAmount = 4000000;

    const srcTokenId = TOKEN_ID;
    const destTokenId = 0;
    const destAmount = 1e15;
    const minAcceptedDestAmount = 1;
    const refWallet = ZERONET_SMART_CONTRACT_OWNER_ADDRESS;
    const _srcTokenId = {
        type: 'uint256',
        value: srcTokenId,
    };
    const _destTokenId = {
        type: 'uint256',
        value: destTokenId,
    };
    const _refWallet = {
        type: 'address',
        value: refWallet,
    };
    const options = {
        tokenId: srcTokenId,
        tokenValue: tradeAmount,
    };
    const params = [_srcTokenId, _destTokenId, _refWallet];
    const tx_res = await deployUtil.triggerSmartContract(mcashWeb, M1_SWAP_CONTRACT, 'marketTrade(uint256,uint256,address)', options, params);
    console.log('trade(): tx_res=', tx_res);

    console.log('m1McashTradeRatioInBps=', hex2dec.hexToDec(await deployUtil.queryVariableValue(mcashWeb, M1_SWAP_CONTRACT, 'm1McashTradeRatioInBps')));
    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);
}

async function withdraw(tokenId, amount, destination) {
    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);

    const _tokenId = {
        type: 'uint256',
        value: tokenId,
    };
    const _amount = {
        type: 'uint256',
        value: amount,
    };
    const _destination = {
        type: 'address',
        value: destination,
    };
    const options = {};
    const tx_res = await deployUtil.triggerSmartContract(mcashWeb, M1_SWAP_CONTRACT, 'withdraw(uint256,uint256,address)', options, [_tokenId, _amount, _destination]);
    console.log('withdrawMcash(): tx_res=', tx_res);

    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);
}

async function kill() {
    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);

    const tx_res = await deployUtil.triggerSmartContract(mcashWeb, M1_SWAP_CONTRACT, 'kill()', {}, []);
    console.log('kill(): tx_res=', tx_res);

    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);
}

async function testSendBack() {
    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);

    const options = {
        callValue: 1,
    };
    const tx_res = await deployUtil.triggerSmartContract(mcashWeb, M1_SWAP_CONTRACT, 'testSendBack()', options, []);
    console.log('testSendBack(): tx_res=', tx_res);

    await queryBalance(ZERONET_SMART_CONTRACT_OWNER_ADDRESS);
    await queryBalance(M1_SWAP_CONTRACT);
}

// queryBalance(M1_SWAP_CONTRACT);

// deployContract();

// setParams();

// printVariables();

// topupReserve();

// queryGetM1TradeAmount(100000e8);
// queryGetMcashTradeAmount(10000e4);

// swapMcashToM1();

// swapM1ToMcash();

// marketSellMcashToM1();
// marketSellM1ToMcash();

// testSendBack();

// withdraw(0, 10000e8, ZERONET_SMART_CONTRACT_OWNER_ADDRESS);

// withdraw(TOKEN_ID, 5000e4, ZERONET_SMART_CONTRACT_OWNER_ADDRESS);

// kill();
