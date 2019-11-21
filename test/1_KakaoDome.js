const TomoDome = artifacts.require('stakingDome');

const Web3Utils = require('web3-utils');
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:7545'));
const jimp = require('jimp');
const hex2dec = require('hex2dec');

expectThrow = async promise => {
	try {
		await promise;
	} catch (error) {
		return;
	}
	assert.fail('Expected throw not received');
};

function toWei(num) {
	return Web3Utils.toWei(String(num), 'ether');
};

function fromWei(num) {
	return Web3Utils.fromWei(num, 'ether');
};

function toBN(num) {
	return Web3Utils.toBN(num);
};

function toUint256(num) {
	return Web3Utils.soliditySha3({type: 'uint256', value: num});
};

function toBytes(str) {
	return Web3Utils.utf8ToHex(str);
};

function bytesToString(bytes) {
	return Web3Utils.toUtf8(bytes);
};

function toHex(num) {
	return Web3Utils.toHex(num);
};

function hexToBytes(hex) {
	return Web3Utils.hexToBytes(hex);
};

function bytesToHex(bytes) {
	return Web3Utils.bytesToHex(bytes);
};

async function mining(blocks) {
	for (let i = 0; i < blocks; i++) {
		await web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_mine', params: [], id: 0});
	}
};

async function getCurrentBlock() {
	return await web3.eth.getBlockNumber(function (error, result) {
		if (!error) {
			console.log(result);
			return result;
		} else {
			console.log(error);
			return 0;
		}
	});
};

async function getBalance(address) {
	return await web3.eth.getBalance(address);
};

function mergeData(title, link, quote) {
	const titleBytes = toBytes(title);
	const linkBytes = toBytes(link);
	const quoteBytes = toBytes(quote);
	const titleLength = toHex((titleBytes.length - 2) / 2);
	const linkLength = toHex((linkBytes.length - 2) / 2);
	const quoteLength = toHex((quoteBytes.length - 2) / 2);
	return '0x' + titleLength.substr(2).padStart(64, '0') +
		linkLength.substr(2).padStart(64, '0') +
		quoteLength.substr(2).padStart(64, '0') +
		titleBytes.substr(2) +
		linkBytes.substr(2) +
		quoteBytes.substr(2);
};

contract('1_KakaoDome', function (accounts) {
	it('should work', async () => {
		const banker = accounts[0];

		const creator = accounts[1];
		const owner = accounts[2];
		const admin = accounts[3];

		const buyer01 = accounts[4];
		const buyer02 = accounts[5];
		const buyer03 = accounts[6];

		const tomoDome = await TomoDome.new({from: creator, gas: 6000000});
		console.log('  |-> TomoDome Address:', tomoDome.address);

		await tomoDome.approveNextOwner(owner, {from: creator});
		await tomoDome.acceptNextOwner({from: owner});

		await tomoDome.setAdmin(admin, {from: owner});

		console.log("  |-> TomoDome's Owner:           ", await tomoDome.owner());
		console.log("  |-> TomoDome's Admin:           ", await tomoDome.admin());
		console.log("  |-> TomoDome's Balance:         ", String(fromWei(await web3.eth.getBalance(tomoDome.address))));

		let leftCoordinate, topCoordinate, width, height, title, link, quote, rgbData, landData, amount;

		leftCoordinate = 1;
		topCoordinate = 1;
		width = 2;
		height = 2;
		title = 'SN';
		link = 'https://sn.com';
		quote = 'Tomo to da moon';
		// rgbData = hexToBytes("0x0123");
		// amount = width * height * 100 * 0.00001;
		amount = width * height * 100 * 1;

		// rgbData = rgbData.substr(0, 100000);

		landData = mergeData(title, link, quote);

		// console.log(landData);
		// 020e0f534e68747470733a2f2f736e2e636f6d546f6d6f20746f206461206d6f6f6e0123
		// 0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000f534e68747470733a2f2f736e2e636f6d546f6d6f20746f206461206d6f6f6e01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567
		// 0000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000000000000000000000000000000000000000020534e68747470733a2f2f736e2e636f6d546f6d6f20746f206461206d6f6f6e01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af01234567c289c2abc38dc3af
		// 0000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000000000000000000000000000000000000000020534e68747470733a2f2f736e2e636f6d546f6d6f20746f206461206d6f6f6e0123

		// console.log(leftCoordinate, topCoordinate, width, height, 0, landData);

		console.log('toBytes(landData).length =', toBytes(landData).length);

		console.log(landData);

		await tomoDome.buy(leftCoordinate, topCoordinate, width, height, '0x0000000000000000000000000000000000000000', landData, {
			value: toWei(amount),
			gas: 80000000,
			from: buyer01,
		});

		await tomoDome.adminApprove(0, false, {
			gas: 80000000,
			from: admin,
		});

		/*******************************************************************/
		console.log('AFTER BUY 0');
		console.log("  |-> TomoDome's Balance:               ", String(fromWei(await web3.eth.getBalance(tomoDome.address))));
		console.log("  |-> TomoDome's Buyer01 balance:       ", String(fromWei(await web3.eth.getBalance(buyer01))));
		console.log("  |-> TomoDome's Buyer02 balance:       ", String(fromWei(await web3.eth.getBalance(buyer02))));
		console.log("  |-> TomoDome's Buyer03 balance:       ", String(fromWei(await web3.eth.getBalance(buyer03))));
		console.log("  |-> TomoDome's numberOccupiedCells:   ", String(await tomoDome.numberOccupiedCells()));
		console.log("  |-> TomoDome's numberRegisteredLands: ", String(await tomoDome.numberRegisteredLands()));
		console.log('/*****************************************/');
		/*******************************************************************/

		/*******************************************************************/
		let land = await tomoDome.lands(0);
		console.log('LAND[0]');
		console.log("  |-> TomoDome's Land[0].owner:          ", land['owner']);
		console.log("  |-> TomoDome's Land[0].leftCoordinate: ", String(land['leftCoordinate']));
		console.log("  |-> TomoDome's Land[0].topCoordinate:  ", String(land['topCoordinate']));
		console.log("  |-> TomoDome's Land[0].width:          ", String(land['width']));
		console.log("  |-> TomoDome's Land[0].height:         ", String(land['height']));
		console.log("  |-> TomoDome's Land[0].landData.length:", land['landData'].length);
		console.log("  |-> TomoDome's Land[0].status:         ", String(land['status']));
		console.log("  |-> TomoDome's Land[0].registeredDate: ", String(land['registeredDate']));
		console.log("  |-> TomoDome's numberOccupiedCells:    ", String(await tomoDome.numberOccupiedCells()));
		console.log("  |-> TomoDome's numberRegisteredLands:  ", String(await tomoDome.numberRegisteredLands()));
		console.log('/*****************************************/');
		/*******************************************************************/

		leftCoordinate = 30;
		topCoordinate = 30;

		await tomoDome.buy(leftCoordinate, topCoordinate, width, height, buyer01, landData, {
			value: toWei(amount),
			gas: 80000000,
			from: buyer02,
		});

		await tomoDome.adminApprove(1, false,  {
			gas: 80000000,
			from: admin,
		});
		console.log('Amount: ', amount);
		console.log('AFTER BUY 1');
		console.log("  |-> TomoDome's Balance:               ", String(fromWei(await web3.eth.getBalance(tomoDome.address))));
		console.log("  |-> TomoDome's Buyer01 balance:       ", String(fromWei(await web3.eth.getBalance(buyer01))));
		console.log("  |-> TomoDome's Buyer02 balance:       ", String(fromWei(await web3.eth.getBalance(buyer02))));
		console.log("  |-> TomoDome's Buyer03 balance:       ", String(fromWei(await web3.eth.getBalance(buyer03))));
		console.log("  |-> TomoDome's numberOccupiedCells:   ", String(await tomoDome.numberOccupiedCells()));
		console.log("  |-> TomoDome's numberRegisteredLands: ", String(await tomoDome.numberRegisteredLands()));
		console.log('/*****************************************/');
		await tomoDome.setResaleAllow(true, {
			from: owner,
		});

		await tomoDome.setOnSale(1, true, {from: buyer02});
		await tomoDome.setSalePrice(1, toWei(300), {from: buyer02});

		await tomoDome.buySaleLand(1, landData, {
			value: toWei(300),
			gas: 80000000,
			from: buyer03,
		});

		console.log('AFTER Resale 1');
		console.log("  |-> TomoDome's Balance:               ", String(fromWei(await web3.eth.getBalance(tomoDome.address))));
		console.log("  |-> TomoDome's Buyer01 balance:       ", String(fromWei(await web3.eth.getBalance(buyer01))));
		console.log("  |-> TomoDome's Buyer02 balance:       ", String(fromWei(await web3.eth.getBalance(buyer02))));
		console.log("  |-> TomoDome's Buyer03 balance:       ", String(fromWei(await web3.eth.getBalance(buyer03))));
		console.log("  |-> TomoDome's numberOccupiedCells:   ", String(await tomoDome.numberOccupiedCells()));
		console.log("  |-> TomoDome's numberRegisteredLands: ", String(await tomoDome.numberRegisteredLands()));
		console.log('/*****************************************/');

		await tomoDome.adminApprove(1, false, {
			gas: 80000000,
			from: admin,
		});

		console.log('AFTER approve');
		console.log("  |-> TomoDome's Balance:               ", String(fromWei(await web3.eth.getBalance(tomoDome.address))));
		console.log("  |-> TomoDome's Buyer01 balance:       ", String(fromWei(await web3.eth.getBalance(buyer01))));
		console.log("  |-> TomoDome's Buyer02 balance:       ", String(fromWei(await web3.eth.getBalance(buyer02))));
		console.log("  |-> TomoDome's Buyer03 balance:       ", String(fromWei(await web3.eth.getBalance(buyer03))));
		console.log("  |-> TomoDome's numberOccupiedCells:   ", String(await tomoDome.numberOccupiedCells()));
		console.log("  |-> TomoDome's numberRegisteredLands: ", String(await tomoDome.numberRegisteredLands()));
		console.log('/*****************************************/');

		await tomoDome.setOnSale(1, true, {from: buyer03});

		await tomoDome.setSalePrice(1, toWei(200), {from: buyer03});

		await tomoDome.buySaleLand(1, landData, {
			value: toWei(200),
			gas: 80000000,
			from: buyer02,
		});

		await tomoDome.adminReject(1, {
			gas: 80000000,
			from: admin,
		});

		/*******************************************************************/
		console.log('AFTER RESALE 2 - REJECT');
		console.log("  |-> TomoDome's Balance:               ", String(fromWei(await web3.eth.getBalance(tomoDome.address))));
		console.log("  |-> TomoDome's Buyer01 balance:       ", String(fromWei(await web3.eth.getBalance(buyer01))));
		console.log("  |-> TomoDome's Buyer02 balance:       ", String(fromWei(await web3.eth.getBalance(buyer02))));
		console.log("  |-> TomoDome's Buyer03 balance:       ", String(fromWei(await web3.eth.getBalance(buyer03))));
		console.log("  |-> TomoDome's numberOccupiedCells:   ", String(await tomoDome.numberOccupiedCells()));
		console.log("  |-> TomoDome's numberRegisteredLands: ", String(await tomoDome.numberRegisteredLands()));
		console.log('/*****************************************/');
		/*******************************************************************/

		await expectThrow(tomoDome.withdrawFunds(buyer01, toWei('600'), {
			gas: 80000000,
			from: admin,
		}));

		await tomoDome.withdrawFunds(buyer01, toWei('600'), {
			gas: 80000000,
			from: owner,
		});

		console.log('AFTER WITHDRAW');
		console.log("  |-> TomoDome's Balance:               ", String(fromWei(await web3.eth.getBalance(tomoDome.address))));
		console.log("  |-> TomoDome's Buyer01 balance:       ", String(fromWei(await web3.eth.getBalance(buyer01))));
		console.log("  |-> TomoDome's Buyer02 balance:       ", String(fromWei(await web3.eth.getBalance(buyer02))));
		console.log("  |-> TomoDome's Buyer03 balance:       ", String(fromWei(await web3.eth.getBalance(buyer03))));
		console.log('/*****************************************/');

		leftCoordinate = 50;
		topCoordinate = 50;
		amount = 0;
		// await tomoDome.manualBuy(leftCoordinate, topCoordinate, width, height, '0x0000000000000000000000000000000000000000', landData, {
		//     gas: 80000000,
		//     from: buyer01
		// });
		// console.log("AFTER MANUAL lBUY 0");
		// console.log("  |-> TomoDome's Balance:               ", String(fromWei(await web3.eth.getBalance(tomoDome.address))));
		// console.log("  |-> TomoDome's Buyer01 balance:       ", String(fromWei(await web3.eth.getBalance(buyer01))));
		// console.log("  |-> TomoDome's Buyer02 balance:       ", String(fromWei(await web3.eth.getBalance(buyer02))));
		// console.log("  |-> TomoDome's Buyer03 balance:       ", String(fromWei(await web3.eth.getBalance(buyer03))));
		// console.log("  |-> TomoDome's numberOccupiedCells:   ", String(await tomoDome.numberOccupiedCells()));
		// console.log("  |-> TomoDome's numberRegisteredLands: ", String(await tomoDome.numberRegisteredLands()));
		// console.log("/*****************************************/");
		//
		await tomoDome.buy(leftCoordinate, topCoordinate, width, height, '0x0000000000000000000000000000000000000000', landData, {
			gas: 80000000,
			from: admin,
		});
		await tomoDome.adminApprove(2, true, {
			gas: 80000000,
			from: admin,
		});
		console.log('AFTER MANUAL BUY 1');
		console.log("  |-> TomoDome's Balance:               ", String(fromWei(await web3.eth.getBalance(tomoDome.address))));
		console.log("  |-> TomoDome's Buyer01 balance:       ", String(fromWei(await web3.eth.getBalance(buyer01))));
		console.log("  |-> TomoDome's Buyer02 balance:       ", String(fromWei(await web3.eth.getBalance(buyer02))));
		console.log("  |-> TomoDome's Buyer03 balance:       ", String(fromWei(await web3.eth.getBalance(buyer03))));
		console.log("  |-> TomoDome's numberOccupiedCells:   ", String(await tomoDome.numberOccupiedCells()));
		console.log("  |-> TomoDome's numberRegisteredLands: ", String(await tomoDome.numberRegisteredLands()));
		console.log('/*****************************************/');
		leftCoordinate = 80;
		topCoordinate = 80;

		await tomoDome.buy(leftCoordinate, topCoordinate, width, height, '0x0000000000000000000000000000000000000000', landData, {
			gas: 80000000,
			from: owner,
		});
		console.log('AFTER MANUAL BUY 2');
		console.log("  |-> TomoDome's Balance:               ", String(fromWei(await web3.eth.getBalance(tomoDome.address))));
		console.log("  |-> TomoDome's Buyer01 balance:       ", String(fromWei(await web3.eth.getBalance(buyer01))));
		console.log("  |-> TomoDome's Buyer02 balance:       ", String(fromWei(await web3.eth.getBalance(buyer02))));
		console.log("  |-> TomoDome's Buyer03 balance:       ", String(fromWei(await web3.eth.getBalance(buyer03))));
		console.log("  |-> TomoDome's numberOccupiedCells:   ", String(await tomoDome.numberOccupiedCells()));
		console.log("  |-> TomoDome's numberRegisteredLands: ", String(await tomoDome.numberRegisteredLands()));
		console.log('/*****************************************/');

		await tomoDome.distribute({
			gas: 80000000,
			from: owner,
            value: toWei(300),
		});
		console.log('AFTER MANUAL DISTRIBUTE 1');
		console.log("  |-> TomoDome's Balance:               ", String(fromWei(await web3.eth.getBalance(tomoDome.address))));
		console.log("  |-> TomoDome's Buyer01 balance:       ", String(fromWei(await web3.eth.getBalance(buyer01))));
		console.log("  |-> TomoDome's Buyer02 balance:       ", String(fromWei(await web3.eth.getBalance(buyer02))));
		console.log("  |-> TomoDome's Buyer03 balance:       ", String(fromWei(await web3.eth.getBalance(buyer03))));
		console.log("  |-> TomoDome's numberOccupiedCells:   ", String(await tomoDome.numberOccupiedCells()));
		console.log("  |-> TomoDome's numberRegisteredLands: ", String(await tomoDome.numberRegisteredLands()));
		console.log('/*****************************************/');

		await tomoDome.distribute({
			gas: 80000000,
			from: buyer03,
			value: toWei(300),
		});
		console.log('AFTER MANUAL DISTRIBUTE 2');
		console.log("  |-> TomoDome's Balance:               ", String(fromWei(await web3.eth.getBalance(tomoDome.address))));
		console.log("  |-> TomoDome's Buyer01 balance:       ", String(fromWei(await web3.eth.getBalance(buyer01))));
		console.log("  |-> TomoDome's Buyer02 balance:       ", String(fromWei(await web3.eth.getBalance(buyer02))));
		console.log("  |-> TomoDome's Buyer03 balance:       ", String(fromWei(await web3.eth.getBalance(buyer03))));
		console.log("  |-> TomoDome's numberOccupiedCells:   ", String(await tomoDome.numberOccupiedCells()));
		console.log("  |-> TomoDome's numberRegisteredLands: ", String(await tomoDome.numberRegisteredLands()));
		console.log('/*****************************************/');

		await tomoDome.sendTransaction({from: banker, value: toWei(10001)});

		/*******************************************************************/
		console.log('\nDEPLOYMENT SUCCESSFUL');
	});
});

// 000000000000000000
// firstInstallmentTime  =  1545494400
// installmentPeriod     =  2592000
// numInstallments       =  50
// installmentAmount     =  10000000000000000000000000
// initialSupply         =  100000
