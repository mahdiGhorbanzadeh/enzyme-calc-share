const BN = require('bn.js');
const ONE_HUNDRED_PERCENT = new BN("10000"); 
const { SettlementType } = require('./enum');


async function settle(_comptrollerAddress,_specificFeeContract,_sharesIssued) {

    let rate = await _specificFeeContract.callStatic.getRateForFund(_comptrollerAddress);

    const newSharesIssued = _sharesIssued.mul(new BN(rate.toString())).div(ONE_HUNDRED_PERCENT);

    console.log("----------------------------------");
    console.log("newSharesIssued ", newSharesIssued.toString());
    console.log("----------------------------------");

    return {
        newSharesIssued,
        settlementType: SettlementType.Direct
    };
}

module.exports = {
    settle
}