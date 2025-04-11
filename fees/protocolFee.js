
const { BN } = require('bn.js');
const ethers = require('ethers');
const { SettlementType } = require('./enum');

const SECONDS_IN_YEAR = new BN("31557600");
const MAX_BPS = new BN("10000");



async function payFee(_protocolFeeContract,_vaultProxy,_sharesSupply) {

    let lastPaid = new BN((await _protocolFeeContract.getLastPaidForVault(_vaultProxy)).toString());

    if(lastPaid.eq(new BN("0"))) {
        return;
    }

    console.log("----------------------------------");
    console.log("lastPaid ", lastPaid);
    console.log("----------------------------------");

    const currentTimestamp = new BN(Math.round(Date.now() / 1000).toString());

    const secondsSinceSettlement = currentTimestamp.sub(new BN(lastPaid.toString()));

    if(secondsSinceSettlement.gt(new BN("0"))) {

        let feeBps = new BN((await _protocolFeeContract.getFeeBpsForVault(_vaultProxy)).toString());

        let sharesDue = calcSharesDueForVault(_sharesSupply, feeBps, secondsSinceSettlement);

        console.log("----------------------------------");
        console.log("sharesDue ", sharesDue);
        console.log("----------------------------------");

        return {
            sharesDue: sharesDue,
            settlementType: SettlementType.Mint
        };

    }
    
    return;

}


function calcSharesDueForVault(_sharesSupply,_feeBps,_secondsDue) {
    sharesSupply = new BN(_sharesSupply.toString());
    feeBps = new BN(_feeBps.toString());
    secondsDue = new BN(_secondsDue.toString());

    const rawSharesDue = sharesSupply
        .mul(feeBps)
        .mul(secondsDue)
        .div(SECONDS_IN_YEAR)
        .div(MAX_BPS);

    const supplyNetRawSharesDue = sharesSupply.sub(rawSharesDue);

    if (supplyNetRawSharesDue.eq("0")) {
        return new BN("0");
    }

    const sharesDue = rawSharesDue.mul(sharesSupply).div(supplyNetRawSharesDue);

    return sharesDue;
}

module.exports = {
    payFee
}