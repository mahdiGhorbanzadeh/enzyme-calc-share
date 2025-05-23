import { ethers } from "ethers";
import { SettlementType } from "./enum";

const BN = require("bn.js");

const RATE_SCALE_BASE = new BN("1000000000000000000000000000");

export async function settle(
  comptrollerAddress:string,
  vaultAddress:string,
  specificFeeContract:ethers.Contract,
  ValutContract:ethers.Contract,
  _sharesSupply:any,
  _provider:ethers.providers.Provider
) {
  const feeInfo = await specificFeeContract.callStatic.getFeeInfoForFund(
    comptrollerAddress
  );

  const latestBlockNumber = await _provider.getBlockNumber();
  const latestBlock = await _provider.getBlock(latestBlockNumber);

  const currentTimestamp = new BN(latestBlock.timestamp.toString()); // Convert milliseconds to seconds

  console.log("----------------------------------");
  console.log("feeInfo ", {
    lastSettled: feeInfo.lastSettled.toString(),
    scaledPerSecondRate: feeInfo.scaledPerSecondRate.toString(),
    currentTimestamp: currentTimestamp.toString(),
  });
  console.log("----------------------------------");

  const secondsSinceSettlement = currentTimestamp.sub(
    new BN(feeInfo.lastSettled.toString())
  );

  if (secondsSinceSettlement.gt(new BN("0"))) {
    const sharesSupply = _sharesSupply;
    const vaultProxyBalance = await ValutContract.callStatic.balanceOf(
      vaultAddress
    );

    console.log("----------------------------------");
    console.log("totalSupply ", sharesSupply.toString());
    console.log("----------------------------------");

    if (new BN(sharesSupply.toString()).gt(new BN("0"))) {
      let netSharesSupply = new BN(sharesSupply.toString()).sub(
        new BN(vaultProxyBalance.toString())
      );

      let sharesDue = new BN("0");

      if (new BN(netSharesSupply.toString()).gt(new BN("0"))) {
        const rateGrowth = rpow(
          feeInfo.scaledPerSecondRate,
          secondsSinceSettlement,
          RATE_SCALE_BASE
        ).sub(new BN(RATE_SCALE_BASE.toString()));

        console.log("----------------------------------");
        console.log("netSharesSupply ", netSharesSupply.toString());
        console.log("----------------------------------");

        sharesDue = netSharesSupply
          .mul(rateGrowth)
          .div(new BN(RATE_SCALE_BASE.toString()));

        console.log("----------------------------------");
        console.log("sharesDue ", sharesDue.toString());
        console.log("----------------------------------");

        return {
          sharesDue: sharesDue.toString(),
          settlementType: SettlementType.Mint,
        };
      }
    }
  }
}

const rpow = (x:any, n:any, base:any) => {
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
};