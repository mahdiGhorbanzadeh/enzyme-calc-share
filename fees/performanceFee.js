
const { BN } = require('bn.js');
const ethers = require('ethers');
const { SettlementType } = require('./enum');


const ONE_HUNDRED_PERCENT = new BN("10000");


const SHARE_UNIT = new BN("1000000000000000000");


async function settle(_comptrollerAddress, _vaultAddress,specificFeeContract,_gav,_sharesSupply) {
    
    let gav = new BN(_gav.toString());
    let sharesSupply = new BN(_sharesSupply.toString());

    const feeInfo = await specificFeeContract.getFeeInfoForFund(_comptrollerAddress);

    console.log("----------------------------------");
    console.log("feeInfo ", feeInfo);
    console.log("----------------------------------");

    return await calcSharesDue(_comptrollerAddress, _vaultAddress, gav,sharesSupply,feeInfo);

}


async function calcSharesDue(_comptrollerProxy, _vaultProxy, _gav,_sharesSupply,_feeInfo) {

    if (_gav.eq("0")) {
        return;
    }

    if (_sharesSupply.eq("0")) {
        return;
    }

    const sharePrice = calcGrossShareValue(_gav, _sharesSupply);

    console.log("----------------------------------");
    console.log("loghereeeeeeeeeeeeeeeee ");
    console.log("----------------------------------");
    
    if (new BN(sharePrice.toString()).lte(new BN(_feeInfo.highWaterMark.toString()))) {
        return;
    }

    // Calculate the shares due, inclusive of inflation
    const priceIncrease = new BN(sharePrice.toString()).sub(new BN(_feeInfo.highWaterMark.toString()));


    console.log("----------------------------------");
    console.log("sharePrice ", sharePrice.toString());
    console.log("highWaterMark ", _feeInfo.highWaterMark.toString());
    console.log("priceIncrease ", priceIncrease.toString());
    console.log("----------------------------------");

    const rawValueDue = priceIncrease.mul(new BN(_sharesSupply.toString())).mul(new BN(_feeInfo.rate.toString())).div(ONE_HUNDRED_PERCENT).div(SHARE_UNIT);

    console.log("----------------------------------");
    console.log("rawValueDue ", rawValueDue);
    console.log("----------------------------------");

    const sharesDue = rawValueDue.mul(new BN(_sharesSupply.toString())).div(new BN(_gav.toString()).sub(rawValueDue));

    console.log("----------------------------------");
    console.log("sharesDue ", sharesDue.toString());
    console.log("----------------------------------");

    return { sharesDue, settlementType: SettlementType.Mint };
}

function calcGrossShareValue(_gav, _sharesSupply) {
    if (_sharesSupply.eq("0")) {
        return SHARE_UNIT;
    }
    return new BN(_gav.toString()).mul(new BN(SHARE_UNIT.toString())).div(new BN(_sharesSupply.toString()));
}

module.exports = {
    settle
}