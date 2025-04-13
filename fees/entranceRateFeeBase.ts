import { ethers } from "ethers";
import { SettlementType } from "./enum";

const BN = require("bn.js");
const ONE_HUNDRED_PERCENT = new BN("10000");


export async function settle(
  _comptrollerAddress:string,
  _specificFeeContract:ethers.Contract,
  _sharesIssued:any
) {
  let rate = await _specificFeeContract.callStatic.getRateForFund(
    _comptrollerAddress
  );

  console.log("----------------------------------");
  console.log("rate ", rate.toString());
  console.log("----------------------------------");

  const sharesDue = _sharesIssued
    .mul(new BN(rate.toString()))
    .div(ONE_HUNDRED_PERCENT);

  console.log("----------------------------------");
  console.log("sharesDue ", sharesDue.toString());
  console.log("----------------------------------");

  return {
    sharesDue,
    settlementType: SettlementType.Direct,
  };
}
