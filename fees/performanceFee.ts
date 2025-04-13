import { ethers } from "ethers";
import { SettlementType } from "./enum";

const BN = require("bn.js");


const ONE_HUNDRED_PERCENT = new BN("10000");


const SHARE_UNIT = new BN("1000000000000000000");


export async function settle(_comptrollerAddress:string, _vaultAddress:string,specificFeeContract:ethers.Contract,_gav:any,_sharesSupply:any) {
    
    let gav = new BN(_gav.toString());
    let sharesSupply = new BN(_sharesSupply.toString());

    const feeInfo = await specificFeeContract.getFeeInfoForFund(_comptrollerAddress);

    console.log("----------------------------------");
    console.log("feeInfo ", feeInfo);
    console.log("----------------------------------");

    return await calcSharesDue(gav,sharesSupply,feeInfo);

}


async function calcSharesDue(_gav:any,_sharesSupply:any,_feeInfo:any) {

    if (_gav.eq("0")) {
        return { sharesDue: new BN("0"), settlementType: SettlementType.None };
    }

    if (_sharesSupply.eq("0")) {
        return { sharesDue: new BN("0"), settlementType: SettlementType.None };
    }

    const sharePrice = calcGrossShareValue(_gav, _sharesSupply);

    if (new BN(sharePrice.toString()).lte(new BN(_feeInfo.highWaterMark.toString()))) {
        return { sharesDue: new BN("0"), settlementType: SettlementType.None };
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

function calcGrossShareValue(_gav:any, _sharesSupply:any) {
    if (_sharesSupply.eq("0")) {
        return SHARE_UNIT;
    }
    
    return new BN(_gav.toString()).mul(new BN(SHARE_UNIT.toString())).div(new BN(_sharesSupply.toString()));
}