pragma solidity ^0.4.26;

// * https://kakaodome.com/ - Embed yourself in Klaytn Chain history, IMMUTABLE, for eternity.
// *
// * @author SN, hiep.bui
// * @date 24/09/2019
contract KakaoDome {
    uint public constant PIXEL_PRICE_IN_WEI = 1 ether;
    uint public constant LAND_SIZE = 1000;
    uint public constant CELL_SIZE = 10;
    uint public constant CELL_AREA = CELL_SIZE * CELL_SIZE;
    uint public constant AUTO_APPROVE_PENDING_TIME = 2 * 24 * 60 * 60; // 2 days
    uint public constant MAX_EDIT_TIME = 30 * 24 * 60 * 60; // 30 days

    uint constant MAXIMUM_NUM_STAKERS = 1500;
    uint constant MINIMUM_STAKING_AMOUNT = 4 * CELL_AREA * PIXEL_PRICE_IN_WEI; // 400 TOMO

    uint constant MAXIMUM_REJECT_PROCESSING_FEE = 10 ether;

    bool[100][100] public occupiedCells;

    struct Land {
        address owner;
        address previousOwner;
        uint16 leftCoordinate;
        uint16 topCoordinate;
        uint16 width;
        uint16 height;
        uint8 status; // 0-pending, 1-approve, 2-reject, 3-pendingResale
        uint registeredDate;
        address affWallet; // 0x0 means no ref
        bool onSale; // false (default) means disabled
        uint salePrice;
        uint resalePrice;
        bytes landData;
    }

    bool public resaleAllow;

    // Standard contract ownership transfer.
    address public owner;
    address private nextOwner;

    // Admin account.
    address public admin;

    // Standard modifier on methods invokable only by contract owner.
    modifier onlyOwner {
        require(msg.sender == owner, "OnlyOwner methods called by non-owner.");
        _;
    }

    // Standard modifier on methods invokable only by contract owner.
    modifier onlyAdmin {
        require(msg.sender == admin, "OnlyAdmin methods called by non-admin.");
        _;
    }

    // Standard modifier on methods invokable only by contract owner and admin.
    modifier onlyOwnerOrAdmin {
        require(msg.sender == owner || msg.sender == admin, "OnlyOwnerOrAdmin methods called by non-owner/admin.");
        _;
    }

    // Standard contract ownership transfer implementation,
    function approveNextOwner(address _nextOwner) external onlyOwner {
        require(_nextOwner != owner, "Cannot approve current owner.");
        nextOwner = _nextOwner;
    }

    function acceptNextOwner() external {
        require(msg.sender == nextOwner, "Can only accept preapproved new owner.");
        owner = nextOwner;
    }

    // Change admin account.
    function setAdmin(address newAdmin) external onlyOwner {
        admin = newAdmin;
    }

    mapping(uint => Land) public lands;
    // Mapping from staker address to staking amount.
    mapping(address => uint) public stakingAmounts;
    address [MAXIMUM_NUM_STAKERS] public stakers;
    uint public numStakers = 0;
    uint public totalStakingAmount = 0;

    uint public numberRegisteredLands = 0;
    uint public numberOccupiedCells = 0;

    event Buy(address indexed owner, uint idx, address indexed affWallet);

    event Withdraw(address indexed beneficiary, uint withdrawAmount);
    event FailedWithdraw(address indexed beneficiary, uint withdrawAmount);
    event Refund(address indexed beneficiary, uint refundAmount);
    event FailedRefund(address indexed beneficiary, uint refundAmount);
    event Sale(address indexed beneficiary, uint saleAmount);
    event FailedSale(address indexed beneficiary, uint saleAmount);

    event AddStaker(address indexed staker);
    event RemoveStaker(address indexed staker);

    event Distribute(address indexed beneficiary, uint amount);
    event FailedDistribute(address indexed beneficiary, uint amount);

    constructor() public {
        owner = msg.sender;
        admin = msg.sender;
        resaleAllow = false;
    }

    function setResaleAllow(bool _resaleAllow) external onlyOwner {
        resaleAllow = _resaleAllow;
    }

    function buy(address _owner, uint16 _leftCoordinate, uint16 _topCoordinate, uint16 _width, uint16 _height, address _affWallet, bytes _landData) external payable returns (uint _idx) {
        require(_leftCoordinate >= 0, "_leftCoordinate must be greater than or equal to 0");
        require(_topCoordinate >= 0, "_topCoordinate must be greater than or equal to 0");
        require(_leftCoordinate + _width <= LAND_SIZE / CELL_SIZE, "_leftCoordinate + _width must be less than or equal to 100");
        require(_topCoordinate + _height <= LAND_SIZE / CELL_SIZE, "_topCoordinate + _height must be less than or equal to 100");
        uint stringDataLength = 96 + sliceUint(_landData, 0) + sliceUint(_landData, 32) + sliceUint(_landData, 64);
        require((stringDataLength == _landData.length) || (stringDataLength + _width * _height * CELL_AREA * 2 == _landData.length), "invalid _landData");
        uint cost = PIXEL_PRICE_IN_WEI * uint(_width) * uint(_height) * CELL_AREA;
        if (msg.sender != owner && msg.sender != admin) {
            require(cost > 0);
            require(msg.value >= cost, "Not enough cost for the land");
            if (_affWallet != address(0)) {
                require(stakingAmounts[_affWallet] > 0, "_affWallet is not a staking account");
            }
        }
        if (_affWallet != address(0)) {
            require(stakingAmounts[_affWallet] > 0, "_affWallet is not a staking account");
        }

        uint16 x;
        uint16 y;

        for (x = _leftCoordinate; x < _leftCoordinate + _width; x++)
            for (y = _topCoordinate; y < _topCoordinate + _height; y++)
                require(occupiedCells[x][y] == false, "There is a cell occupied already");

        _idx = numberRegisteredLands;
        Land storage land = lands[_idx];
        land.owner = _owner;
        land.previousOwner = address(0);
        land.leftCoordinate = _leftCoordinate;
        land.topCoordinate = _topCoordinate;
        land.width = _width;
        land.height = _height;
        land.landData = _landData;
        land.status = 0;
        land.registeredDate = now;
        land.onSale = false;
        land.salePrice = cost;
        land.affWallet = _affWallet;
        land.resalePrice = 0;
        ++numberRegisteredLands;

        for (x = _leftCoordinate; x < _leftCoordinate + _width; x++)
            for (y = _topCoordinate; y < _topCoordinate + _height; y++)
                occupiedCells[x][y] = true;

        numberOccupiedCells += _width * _height;

        emit Buy(msg.sender, _idx, _affWallet);

        return _idx;
    }

    // Land must be purchased in 10x10 pixel blocks.
    // _landData can contains either rgbData or not. The latter admins will need to push it after the purchase made.
    //    function buy(uint16 _leftCoordinate, uint16 _topCoordinate, uint16 _width, uint16 _height, address _affWallet, bytes _landData) external payable returns (uint _idx) {
    //        return operateBuy(msg.sender, _leftCoordinate, _topCoordinate, _width, _height, _affWallet, _landData);
    //    }

    function adminApprove(uint _idx) external onlyOwnerOrAdmin {
        require(_idx >= 0, "_idx must be greater than or equal to 0");
        require(_idx < numberRegisteredLands, "_idx must be less than numberRegisteredLands");

        Land storage land = lands[_idx];
        require(land.status == 0 || land.status == 3, "Not able to approve this land anymore");

        if (land.status == 0) {
            // first sale: 10% for ref, 10% for buyer, 10% for stakers
            uint tenPercent = land.salePrice / 10;
            if (land.affWallet != address(0)) {
                land.owner.transfer(tenPercent);
                land.affWallet.transfer(tenPercent);
            }
            //            if
            addStaker(land.owner, land.salePrice);
            splitStakingDividend(tenPercent);
        } else if (land.status == 3) {
            // re-sale:
            // 135%: 100% back to previous owner, 5% fee, 30% split:
            //                                 - 60%: previous owner
            //                                 - 10%: affWallet
            //                                 - 30%: stakers
            uint resalePercentage = 135;
            uint previousOwnerReceive = land.resalePrice * 100 / resalePercentage;
            uint thirtyPercent = land.resalePrice * (resalePercentage - 105) / 100;
            // 30% resalePrice
            if (land.resalePrice >= MINIMUM_STAKING_AMOUNT) {
                if (land.affWallet != address(0)) {
                    land.affWallet.transfer(thirtyPercent / 10);
                }
                addStaker(land.owner, land.resalePrice);
            }
            if (land.salePrice >= MINIMUM_STAKING_AMOUNT) {
                removeStaker(land.previousOwner, land.salePrice);
            }
            land.previousOwner.transfer(previousOwnerReceive + thirtyPercent * 6 / 10);
            splitStakingDividend(thirtyPercent * 3 / 10);
            land.salePrice = land.resalePrice;
            land.resalePrice = 0;
        }

        land.status = 1;
    }

    function adminReject(uint _idx) external onlyOwnerOrAdmin {
        require(_idx >= 0, "_idx must be greater than or equal to 0");
        require(_idx < numberRegisteredLands, "_idx must be less than numberRegisteredLands");

        Land storage land = lands[_idx];
        require(land.status != 2, "This land is rejected already");
        require(owner == msg.sender || now - land.registeredDate <= MAX_EDIT_TIME, "This land is expired to reject");

        if (land.status == 0) {
            // first sale:
            land.status = 2;
            uint16 _leftCoordinate = land.leftCoordinate;
            uint16 _topCoordinate = land.topCoordinate;
            uint16 _width = land.width;
            uint16 _height = land.height;
            uint16 x;
            uint16 y;

            for (x = _leftCoordinate; x < _leftCoordinate + _width; x++)
                for (y = _topCoordinate; y < _topCoordinate + _height; y++)
                    occupiedCells[x][y] = false;

            numberOccupiedCells -= _width * _height;
        }

        // fee 1% or upto 10 TOMO
        uint refundAmount = land.salePrice * 99 / 100;
        if (refundAmount + MAXIMUM_REJECT_PROCESSING_FEE < land.salePrice) {
            refundAmount = land.salePrice - MAXIMUM_REJECT_PROCESSING_FEE;
        }

        if (land.owner.send(refundAmount)) {
            emit Refund(land.owner, refundAmount);
        } else {
            emit FailedRefund(land.owner, refundAmount);
        }

        if (land.status == 3) {
            // re-sale: set back to previous owner
            land.status = 1;
            land.owner = land.previousOwner;
            land.previousOwner = address(0);
            land.registeredDate = now;
            land.onSale = true;
        }
    }

    function adminEditData(uint _idx, bytes _landData) external onlyOwnerOrAdmin {
        require(_idx >= 0, "_idx must be greater than or equal to 0");
        require(_idx < numberRegisteredLands, "_idx must be less than numberRegisteredLands");

        Land storage land = lands[_idx];

        require(land.status != 2, "This land is rejected already");
        require(owner == msg.sender || now - land.registeredDate <= MAX_EDIT_TIME, "This land is expired to edit");

        land.landData = _landData;
        land.registeredDate = now;
    }

    function replaceLandOwner(uint _idx, address _newOwner, uint _resalePrice) external onlyOwnerOrAdmin {
        require(_idx >= 0, "_idx must be greater than or equal to 0");
        require(_idx < numberRegisteredLands, "_idx must be less than numberRegisteredLands");
        Land storage land = lands[_idx];
        removeStaker(land.owner, land.salePrice);
        addStaker(_newOwner, (_resalePrice > 0) ? _resalePrice : land.salePrice);
        land.owner = _newOwner;
        if (_resalePrice > 0) {
            land.salePrice = _resalePrice;
        }
    }

    // set to 0 to disable sale
    function setOnSale(uint _idx, bool _onSale) external {
        require(!_onSale || resaleAllow, "Resale is not allowed at the moment");

        Land storage land = lands[_idx];

        require(land.owner == msg.sender, "You are not the owner of this land");
        require(land.status == 1 || ((land.status == 0 || land.status == 3) && now - land.registeredDate >= AUTO_APPROVE_PENDING_TIME), "This land is not accepted yet");

        land.onSale = _onSale;
    }

    function setResalePrice(uint _idx, uint _resalePrice) external {
        Land storage land = lands[_idx];
        require(resaleAllow, "Resale is not allowed at the moment");
        require(land.owner == msg.sender, "You are not the owner of this land");
        require(_resalePrice * 2 >= land.salePrice, "Resale price must be at least 50% of sale price");
        require(land.status == 1 || ((land.status == 0 || land.status == 3) && now - land.registeredDate >= AUTO_APPROVE_PENDING_TIME), "This land is not accepted yet");

        land.resalePrice = _resalePrice;
        land.onSale = true;
    }

    function buySaleLand(uint _idx, bytes _landData) external payable {
        require(resaleAllow, "Resale is not allowed at the moment");

        Land storage land = lands[_idx];

        require(land.onSale, "This land is not for sale");
        require(land.status == 1 || ((land.status == 0 || land.status == 3) && now - land.registeredDate >= AUTO_APPROVE_PENDING_TIME), "This land is not accepted yet");
        require(land.owner != msg.sender, "You can not re-buy your own land");

        uint16 _width = land.width;
        uint16 _height = land.height;

        uint stringDataLength = 96 + sliceUint(_landData, 0) + sliceUint(_landData, 32) + sliceUint(_landData, 64);
        require((stringDataLength == _landData.length) || (stringDataLength + _width * _height * CELL_AREA * 2 == _landData.length), "invalid _landData");

        uint saleAmount = msg.value;
        if (msg.sender != owner && msg.sender != admin) {
            require(saleAmount >= land.resalePrice, "Not enough for the land sale price");
        }
        land.previousOwner = land.owner;
        land.owner = msg.sender;
        land.landData = _landData;
        land.status = 3;
        land.registeredDate = now;
        land.onSale = false;
    }

    /// withdraw allows the owner to transfer out the balance of the contract.
    function withdrawFunds(address beneficiary, uint withdrawAmount) external onlyOwner {
        require(withdrawAmount <= address(this).balance, "withdrawAmount is greater than balance.");
        if (beneficiary.send(withdrawAmount)) {
            emit Withdraw(beneficiary, withdrawAmount);
        } else {
            emit FailedWithdraw(beneficiary, withdrawAmount);
        }
    }

    function luckyDraw(bytes32 blockHash0, bytes32 blockHash1, bytes32 blockHash2) public view returns (uint16 _gridX, uint16 _gridY, bool _winner) {
        bytes32 entropy = keccak256(abi.encodePacked(blockHash0, blockHash1));
        entropy = keccak256(abi.encodePacked(entropy, blockHash2));
        _gridX = uint16(uint256(entropy) % 1000);
        _gridY = uint16(uint256(entropy) / 1000 % 1000);
        _winner = occupiedCells[_gridX / 10][_gridY / 10];
    }

    function addStaker(address staker, uint amount) internal {
        if (stakingAmounts[staker] == 0) {
            require(numStakers < MAXIMUM_NUM_STAKERS, "Number of staker exceeds limit");
            stakingAmounts[staker] = amount;
            stakers[numStakers] = staker;
            numStakers = numStakers + 1;
            emit AddStaker(staker);
        } else {
            stakingAmounts[staker] += amount;
        }
        totalStakingAmount += amount;
    }

    function removeStaker(address staker, uint amount) internal {
        require(stakingAmounts[staker] >= amount, "Staker does not have enough staking fund");
        stakingAmounts[staker] -= amount;
        if (stakingAmounts[staker] == 0) {
            for (uint16 i = 0; i < numStakers; i++) {
                if (stakers[i] == staker) {
                    for (uint16 j = i; j + 1 < numStakers; j++) {
                        stakers[j] = stakers[j + 1];
                    }
                    stakers[numStakers - 1] = address(0);
                    numStakers = numStakers - 1;
                    emit RemoveStaker(staker);
                    break;
                }
            }
        }
        totalStakingAmount -= amount;
    }

    function setStakerAmount(address staker, uint amount) external onlyOwner {
        if (amount == 0) {
            return removeStaker(staker, amount);
        }
        if (stakingAmounts[staker] == 0) {
            require(numStakers < MAXIMUM_NUM_STAKERS, "Number of staker exceeds limit");
            stakingAmounts[staker] = amount;
            totalStakingAmount += amount;
            stakers[numStakers] = staker;
            numStakers = numStakers + 1;
            emit AddStaker(staker);
        } else {
            totalStakingAmount = totalStakingAmount - stakingAmounts[staker] + amount;
            stakingAmounts[staker] = amount;
        }
    }

    function splitStakingDividend(uint amount) internal {
        if (amount > 0 && numStakers > 0) {
            for (uint i = 0; i < numStakers; i++) {
                address staker = (i < numStakers) ? stakers[i] : stakers[0];
                if (staker != address(0)) {
                    uint stakingReward = amount * stakingAmounts[staker] / totalStakingAmount;
                    if (stakingReward >= 1000) {// not sending dust such as 1000 wei
                        staker.transfer(stakingReward);
                    }
                }
            }
        }
    }

    function distribute() external payable {
        uint amount = msg.value;
        require(amount >= 1 ether, "Do not distribute dust (too small).");
        require(numStakers > 0, "There is no staker to distribute to.");
        for (uint i = 0; i < numStakers; i++) {
            address staker = stakers[i];
            if (staker != address(0)) {
                uint stakingReward = amount * stakingAmounts[staker] / totalStakingAmount;
                if (stakingReward >= 1000) {// not sending dust such as 1000 wei
                    if (staker.send(stakingReward)) {
                        emit Distribute(staker, stakingReward);
                    } else {
                        emit FailedDistribute(staker, stakingReward);
                    }
                }
            }
        }
    }

    function reward(address[] _addresses) external payable {
        uint numAddress = _addresses.length;
        require(numAddress >= 1, "Number of address must be greater than 0");
        require(msg.value > 0, "Reward must be greater than 0");
        uint amount = msg.value;
        for (uint i = 0; i < numAddress; i++) {
            address addr = _addresses[i];
            addr.transfer(amount / numAddress);
        }
    }

    function sliceUint(bytes memory bs, uint start) internal pure returns (uint) {
        require(bs.length >= start + 32, "slicing out of range");
        uint x;
        assembly {
            x := mload(add(bs, add(0x20, start)))
        }
        return x;
    }

    // https://github.com/GNSPS/solidity-bytes-utils
    function concatStorage(bytes storage _preBytes, bytes memory _postBytes) internal {
        assembly {
            let fslot := sload(_preBytes_slot)
            let slength := div(and(fslot, sub(mul(0x100, iszero(and(fslot, 1))), 1)), 2)
            let mlength := mload(_postBytes)
            let newlength := add(slength, mlength)
            switch add(lt(slength, 32), lt(newlength, 32))
            case 2 {
                sstore(_preBytes_slot, add(fslot, add(mul(div(mload(add(_postBytes, 0x20)), exp(0x100, sub(32, mlength))), exp(0x100, sub(32, newlength))), mul(mlength, 2))))
            }
            case 1 {
                mstore(0x0, _preBytes_slot)
                let sc := add(keccak256(0x0, 0x20), div(slength, 32))
                sstore(_preBytes_slot, add(mul(newlength, 2), 1))
                let submod := sub(32, slength)
                let mc := add(_postBytes, submod)
                let end := add(_postBytes, mlength)
                let mask := sub(exp(0x100, submod), 1)
                sstore(sc, add(and(fslot, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00), and(mload(mc), mask)))
                for {
                    mc := add(mc, 0x20)
                    sc := add(sc, 1)
                } lt(mc, end) {
                    sc := add(sc, 1)
                    mc := add(mc, 0x20)
                } {
                    sstore(sc, mload(mc))
                }
                mask := exp(0x100, sub(mc, end))
                sstore(sc, mul(div(mload(mc), mask), mask))
            }
            default {
                mstore(0x0, _preBytes_slot)
                let sc := add(keccak256(0x0, 0x20), div(slength, 32))
                sstore(_preBytes_slot, add(mul(newlength, 2), 1))
                let slengthmod := mod(slength, 32)
                let mlengthmod := mod(mlength, 32)
                let submod := sub(32, slengthmod)
                let mc := add(_postBytes, submod)
                let end := add(_postBytes, mlength)
                let mask := sub(exp(0x100, submod), 1)
                sstore(sc, add(sload(sc), and(mload(mc), mask)))
                for {
                    sc := add(sc, 1)
                    mc := add(mc, 0x20)
                } lt(mc, end) {
                    sc := add(sc, 1)
                    mc := add(mc, 0x20)
                } {
                    sstore(sc, mload(mc))
                }
                mask := exp(0x100, sub(mc, end))
                sstore(sc, mul(div(mload(mc), mask), mask))
            }
        }
    }
}
