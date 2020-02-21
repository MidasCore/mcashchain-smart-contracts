pragma solidity ^0.5.8;

/**
 * @title SafeMath
 * @dev Unsigned math operations with safety checks that revert on error
 */
library SafeMath {
    /**
    * @dev Multiplies two unsigned integers, reverts on overflow.
    */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b);

        return c;
    }

    /**
    * @dev Integer division of two unsigned integers truncating the quotient, reverts on division by zero.
    */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
    * @dev Subtracts two unsigned integers, reverts on overflow (i.e. if subtrahend is greater than minuend).
    */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a);
        uint256 c = a - b;

        return c;
    }

    /**
    * @dev Adds two unsigned integers, reverts on overflow.
    */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a);

        return c;
    }

    /**
    * @dev Divides two unsigned integers and returns the remainder (unsigned integer modulo),
    * reverts when dividing by zero.
    */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0);
        return a % b;
    }
}

contract M1ToMcashUnidexSwap {
    using SafeMath for uint256;

    uint256 constant BPS_MULTIPLE = 100000000;
    address payable constant BURN_ADDRESS = address(0x3218c66df4defcdcbb183f457bdeed8939c08952d5); // MAAAAAAAAAAAAAAAAAAAAAAAAAAAHF57Ay

    uint256 public m1TokenId;
    string public m1Symbol;

    uint256 public m1MinCapTrade;
    uint256 public m1MaxCapTrade;

    uint256 public mcashMinCapTrade;
    uint256 public mcashMaxCapTrade;

    uint16 public commissionInPer10000; // per ten thousand

    uint16 public changingRatePer10000;
    uint256 public m1McashTradeRatioInBps; // in 10^8

    uint16 public burnRatePer10000;
    uint256 public burnMinAmount;

    uint16 public affRatePer10000;

    // Standard contract ownership and administratorship.
    address payable public owner;
    address payable private nextOwner;
    address public admin;

    event Trade(uint256 indexed srcTokenId, uint256 indexed destTokenId, uint256 srcAmount, uint256 destAmount, address indexed refWallet);
    event WithdrawFunds(uint256 indexed tokenId, uint256 amount, address indexed destination);
    event Affiliate(address indexed trader, uint256 amount, address indexed refWallet);
    event Burn(uint256 indexed srcTokenId, uint256 amount);

    constructor(uint256 _m1TokenId, string memory _m1Symbol) payable public {
        owner = msg.sender;
        admin = msg.sender;
        m1TokenId = _m1TokenId;
        m1Symbol = _m1Symbol;
    }

    // Standard modifier on methods invokable only by contract owner.
    modifier onlyOwner {
        require(msg.sender == owner, "OnlyOwner methods called by non-owner.");
        _;
    }

    modifier onlyAdmin {
        require(msg.sender == admin, "OnlyAdmin methods called by non-admin.");
        _;
    }

    // Standard modifier on methods invokable only by contract owner and admin.
    modifier onlyOwnerOrAdmin {
        require(msg.sender == owner || msg.sender == admin, "OnlyOwnerOrAdmin methods called by non-owner/admin.");
        _;
    }

    function() payable external {
    }

    // Change admin account.
    function setAdmin(address newAdmin) external onlyOwner {
        admin = newAdmin;
    }

    // Standard contract ownership transfer implementation,
    function approveNextOwner(address payable _nextOwner) external onlyOwner {
        require(_nextOwner != owner, "Cannot approve current owner.");
        nextOwner = _nextOwner;
    }

    function acceptNextOwner() external {
        require(msg.sender == nextOwner, "Can only accept preapproved new owner.");
        owner = nextOwner;
    }

    function setLiquidityParams(uint256 _m1MinCapTrade, uint256 _m1MaxCapTrade,
        uint256 _mcashMinCapTrade, uint256 _mcashMaxCapTrade) external onlyOwnerOrAdmin {
        require(changingRatePer10000 == 0 || _mcashMaxCapTrade.mul(changingRatePer10000) < BPS_MULTIPLE, "_mcashMaxCapTrade is set too high");
        m1MinCapTrade = _m1MinCapTrade;
        m1MaxCapTrade = _m1MaxCapTrade;
        mcashMinCapTrade = _mcashMinCapTrade;
        mcashMaxCapTrade = _mcashMaxCapTrade;
    }

    function setTradeRatioParams(uint16 _commissionInPer10000, uint16 _changingRatePer10000, uint256 _m1McashTradeRatioInBps) external onlyOwnerOrAdmin {
        require(mcashMaxCapTrade == 0 || _changingRatePer10000 == 0 || mcashMaxCapTrade.mul(_changingRatePer10000) < BPS_MULTIPLE, "_changingRatePer10000 is set too high");
        commissionInPer10000 = _commissionInPer10000;
        changingRatePer10000 = _changingRatePer10000;
        m1McashTradeRatioInBps = _m1McashTradeRatioInBps;
    }

    function setBurnParams(uint16 _burnRatePer10000, uint256 _burnMinAmount) external onlyOwnerOrAdmin {
        burnRatePer10000 = _burnRatePer10000;
        burnMinAmount = _burnMinAmount;
    }

    function setAffRate(uint16 _affRatePer10000) external onlyOwnerOrAdmin {
        affRatePer10000 = _affRatePer10000;
    }

    function getBurnAmount(uint256 mcashAmount) public view returns (uint256) {
        if (burnRatePer10000 == 0) return 0;
        uint256 burnAmount = mcashAmount.mul(burnRatePer10000).div(10000);
        if (burnAmount < burnMinAmount) burnAmount = burnMinAmount;
        if (mcashAmount <= burnAmount) return mcashAmount;
        return burnAmount;
    }

    function getM1TradeAmount(uint256 mcashAmount) public view returns (uint256) {
        if (burnRatePer10000 > 0) {
            uint256 burnAmount = getBurnAmount(mcashAmount);
            if (mcashAmount <= burnAmount) return 0;
            mcashAmount = mcashAmount - burnAmount;
        }

        uint256 newDeltaRate = BPS_MULTIPLE - (mcashAmount * changingRatePer10000 / BPS_MULTIPLE);
        uint256 newM1McashTradeRatioInBps = m1McashTradeRatioInBps.mul(newDeltaRate).div(BPS_MULTIPLE);

        newM1McashTradeRatioInBps = m1McashTradeRatioInBps.add(newM1McashTradeRatioInBps).div(2);
        return mcashAmount.mul(newM1McashTradeRatioInBps).mul(10000 - commissionInPer10000).div(BPS_MULTIPLE).div(10000);
    }

    function getMcashTradeAmount(uint256 m1Amount) public view returns (uint256) {
        uint256 __destTradeAmount = m1Amount.mul(BPS_MULTIPLE).mul(10000 - commissionInPer10000).div(m1McashTradeRatioInBps).div(10000);

        uint256 newDeltaRate = BPS_MULTIPLE + (__destTradeAmount * changingRatePer10000 / BPS_MULTIPLE);
        uint256 newM1McashTradeRatioInBps = m1McashTradeRatioInBps.mul(newDeltaRate).div(BPS_MULTIPLE);

        newM1McashTradeRatioInBps = m1McashTradeRatioInBps.add(newM1McashTradeRatioInBps).div(2);
        uint256 mcashAmount = m1Amount.mul(BPS_MULTIPLE).mul(10000 - commissionInPer10000).div(newM1McashTradeRatioInBps).div(10000);

        if (burnRatePer10000 > 0) {
            uint256 burnAmount = getBurnAmount(mcashAmount);
            if (mcashAmount <= burnAmount) return 0;
            mcashAmount = mcashAmount - burnAmount;
        }
        return mcashAmount;
    }

    function marketTrade(uint256 srcTokenId, uint256 destTokenId, address payable refWallet) public payable {
        trade(srcTokenId, destTokenId, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, 0x1, refWallet);
    }

    function trade(uint256 srcTokenId, uint256 destTokenId, uint256 destAmount, uint256 minAcceptedDestAmount, address payable refWallet) public payable {
        require(destAmount >= minAcceptedDestAmount, "destAmount needs to greater than or equal to minAcceptedDestAmount");
        require(srcTokenId != destTokenId && (srcTokenId == m1TokenId || destTokenId == m1TokenId));
        uint256 srcAmount;
        uint256 currentDestTradeAmount;
        if (srcTokenId == 0) {
            srcAmount = msg.value;
            require(srcAmount > 0 && srcAmount >= mcashMinCapTrade && srcAmount <= mcashMaxCapTrade, "Invalid srcAmount");
            currentDestTradeAmount = getM1TradeAmount(srcAmount);
        } else {
            require(msg.tokenid == m1TokenId, "Sending not supported M1 tokens");
            srcAmount = msg.tokenvalue;
            require(srcAmount > 0 && srcAmount >= m1MinCapTrade && srcAmount <= m1MaxCapTrade, "Invalid srcAmount");
            currentDestTradeAmount = getMcashTradeAmount(srcAmount);
        }
        require(currentDestTradeAmount >= minAcceptedDestAmount, "minAcceptedDestAmount not satisfied");
        if (currentDestTradeAmount > destAmount) currentDestTradeAmount = destAmount;
        address payable destAddress = msg.sender;
        uint256 deltaRate;
        if (srcTokenId == 0) {
            destAddress.transfertoken(currentDestTradeAmount, m1TokenId);
            // every 10k MCASH: decrease 1.0%
            deltaRate = BPS_MULTIPLE - (srcAmount * changingRatePer10000 / BPS_MULTIPLE);
            m1McashTradeRatioInBps = m1McashTradeRatioInBps.mul(deltaRate).div(BPS_MULTIPLE);
            if (refWallet != address(0) && affRatePer10000 > 0) {
                uint256 affPayment = srcAmount.mul(affRatePer10000).div(10000);
                refWallet.transfer(affPayment);
                emit Affiliate(destAddress, affPayment, refWallet);
            }
            if (burnRatePer10000 > 0) {
                uint256 burnAmount = getBurnAmount(srcAmount);
                address(BURN_ADDRESS).transfer(burnAmount);
                emit Burn(srcTokenId, burnAmount);
            }
        } else {
            destAddress.transfer(currentDestTradeAmount);
            // every 10k MCASH: increase 1.0%
            deltaRate = BPS_MULTIPLE + (currentDestTradeAmount * changingRatePer10000 / BPS_MULTIPLE);
            m1McashTradeRatioInBps = m1McashTradeRatioInBps.mul(deltaRate).div(BPS_MULTIPLE);
            if (refWallet != address(0) && affRatePer10000 > 0) {
                uint256 affPayment = currentDestTradeAmount.mul(affRatePer10000).div(10000);
                refWallet.transfer(affPayment);
                emit Affiliate(destAddress, affPayment, refWallet);
            }
            if (burnRatePer10000 > 0) {
                uint256 burnAmount = getBurnAmount(currentDestTradeAmount);
                address(BURN_ADDRESS).transfer(burnAmount);
                emit Burn(srcTokenId, burnAmount);
            }
        }
        emit Trade(srcTokenId, destTokenId, srcAmount, currentDestTradeAmount, refWallet);
    }

    function withdraw(uint256 tokenId, uint256 amount, address payable destination) public onlyOwner returns (bool) {
        require(tokenId == tokenId || tokenId == m1TokenId, "Invalid tokenId");
        if (tokenId == 0) {
            destination.transfer(amount);
        } else {
            destination.transfertoken(amount, m1TokenId);
        }
        emit WithdrawFunds(tokenId, amount, destination);
        return true;
    }

    // All funds are transferred to contract owner.
    function kill() external onlyOwner {
        owner.transfer(address(this).balance);
        owner.transfertoken(address(this).tokenbalance(m1TokenId), m1TokenId);
        selfdestruct(owner);
    }
}
