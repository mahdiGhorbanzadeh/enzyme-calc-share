
const BN = require('bn.js');
const { SettlementType } = require('./enum');
const RATE_SCALE_BASE = new BN("1000000000000000000000000000");

async function settle(comptrollerAddress, vaultAddress,specificFeeContract,ValutContract,_sharesSupply) {
    const feeInfo = await specificFeeContract.callStatic.getFeeInfoForFund(comptrollerAddress);

    console.log("----------------------------------");
    console.log("feeInfo ", feeInfo);
    console.log("----------------------------------");

    const currentTimestamp = new BN(Math.round(Date.now() / 1000).toString()); // Convert milliseconds to seconds

    const secondsSinceSettlement = currentTimestamp.sub(new BN(feeInfo.lastSettled.toString()));

    if(secondsSinceSettlement.gt(new BN("0"))) {

        const sharesSupply = _sharesSupply;
        const vaultProxyBalance = await ValutContract.callStatic.balanceOf(vaultAddress);

        console.log("----------------------------------");
        console.log("totalSupply ", sharesSupply.toString());
        console.log("----------------------------------");

        if(new BN(sharesSupply.toString()).gt(new BN("0"))) {

            let netSharesSupply = new BN(sharesSupply.toString()).sub(new BN(vaultProxyBalance.toString()));

            let sharesDue = new BN("0");

            if (new BN(netSharesSupply.toString()).gt(new BN("0"))) {
                                
                const rateGrowth = rpow(feeInfo.scaledPerSecondRate, secondsSinceSettlement, RATE_SCALE_BASE).sub(new BN(RATE_SCALE_BASE.toString()));

                console.log("----------------------------------");
                console.log("netSharesSupply ", netSharesSupply.toString());
                console.log("----------------------------------");

                sharesDue = netSharesSupply.mul(rateGrowth).div(new BN(RATE_SCALE_BASE.toString()));
                

                console.log("----------------------------------");
                console.log("sharesDue ", sharesDue.toString());
                console.log("----------------------------------");

                return {
                    sharesDue: sharesDue.toString(),
                    settlementType: SettlementType.Mint
                };
            }
        }

    }
}


const rpow = (x, n, base) => {

    x = new BN(x.toString());

    n = new BN(n.toString());

    base = new BN(base.toString());

    if (x.isZero()) {
        return n.isZero() ? new BN("1") : new BN("0");
    }

    let z = n.mod(new BN("2")).isZero() ? base : x;
    let half = base.div(new BN("2"));

    n = n.div(new BN("2"));

    while (!n.isZero()) {
        let xx = x.mul(x);

        let xxRound = xx.add(half);
        if (xxRound.lt(xx)) {
            throw new Error("Overflow detected");
        }

        x = xxRound.div(base);

        if (!n.mod(new BN("2")).isZero()) {
            let zx = z.mul(x);

            let zxRound = zx.add(half);
            if (zxRound.lt(zx)) {
                throw new Error("Overflow detected");
            }

            z = zxRound.div(base);
        }

        n = n.div(new BN("2"));
    }

    return z;
}

module.exports = {
    settle
}