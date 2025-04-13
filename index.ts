import { ethers } from "ethers";

const BN = require("bn.js");

require("dotenv").config();

//--------------- common abi section ---------------
const comptroller = require("./comptroller.json");
const feeManager = require("./feeManager.json");
const vault = require("./vault.json");

//--------------- fees abi section ---------------
const performanceFeeAbi = require("./fees-json/performanceFee.json");
const managementFeeAbi = require("./fees-json/managementFee.json");
const protocolFeeAbi = require("./fees-json/protocolFee.json");
const entranceRateFeeAbi = require("./fees-json/entranceRateFeeBase.json");

//--------------- fees functions section ---------------

const managementFee = require("./fees/managementFee");
const performanceFee = require("./fees/performanceFee");
const protocolFee = require("./fees/protocolFee");
const entranceRateFee = require("./fees/entranceRateFeeBase");

const { SettlementType } = require("./fees/enum");

//--------------- constants section ---------------

const SHARES_UNIT = new BN("1000000000000000000");

//--------------- provider section ---------------

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL); // Replace with your RPC URL

const comptrollerAddress = "0x3f5b984a726c30e29db939438b6b10357c76537f";
const feeManagerAddress = "0xddd7432671f5adc1c82c7c875624c1b0bc461deb";
const protocolFeeAddress = "0xb8e6eda0ce8fddd21f0b0268a43a57b9296e23d5";


const preBuySharesFeeAddresses = {
  managementFee: "0x97F13B3040A565be791D331B0edd4b1b58dBD843",
  performanceFee: "0xBC63AfE28C66a6279BD3A55A4d0D3Ab61f479BDf",
};

const postBuySharesFeeAddresses = {
  entranceRateFee: "0x88c9a11c7bB8bC274388d0db864ab87C14fb78B8",
};

async function calculateShares(investmentAmount:bigint) {
  try {
    const comptrollerContract = new ethers.Contract(
      comptrollerAddress,
      comptroller.abi,
      provider
    );

    const gav = await comptrollerContract.callStatic.calcGav();

    console.log("----------------------------------");
    console.log("gav ", gav);
    console.log("----------------------------------");

    await _checkFeeManager(gav, comptrollerContract, investmentAmount);
  } catch (error) {
    console.error("Error calculating gav:", error);
  }
}

async function _checkFeeManager(_gav:bigint, comptrollerContract:ethers.Contract, investment:bigint) {
  const feeManagerContract = new ethers.Contract(
    feeManagerAddress,
    feeManager.abi,
    provider
  );

  const fees = await feeManagerContract.callStatic.getEnabledFeesForFund(
    comptrollerAddress
  );

  const valutAddress = await comptrollerContract.callStatic.getVaultProxy();

  console.log("----------------------------------");
  console.log("valutAddress ", valutAddress);
  console.log("----------------------------------");

  const ValutContract = new ethers.Contract(valutAddress, vault.abi, provider);

  //---------------- preBuyShares section ----------------

  let sharesSupply = new BN(
    (await ValutContract.callStatic.totalSupply()).toString()
  );

  console.log("----------------------------------");
  console.log("fees ", fees);
  console.log("----------------------------------");

  if (fees.length > 0) {
    for (let i = 0; i < fees.length; i++) {
      let specificFeeAddress = fees[i];

      if (!getPreBuySharesFeeAbi(specificFeeAddress)) {
        continue;
      }

      let specificFeeContract = new ethers.Contract(
        specificFeeAddress,
        getPreBuySharesFeeAbi(specificFeeAddress),
        provider
      );

      console.log("----------------------------------");
      console.log("fees[i] ", fees[i]);
      console.log("----------------------------------");

      if (specificFeeAddress === preBuySharesFeeAddresses.managementFee) {
        let { sharesDue, settlementType } = await managementFee.settle(
          comptrollerAddress,
          valutAddress,
          specificFeeContract,
          ValutContract,
          sharesSupply,
          provider
        );

        if (settlementType && settlementType === SettlementType.Mint) {
          console.log("----------------------------------");
          console.log("sharesDue managementFee ", sharesDue.toString());
          console.log("----------------------------------");

          sharesSupply = sharesSupply.add(new BN(sharesDue.toString()));
        }
      } else if (
        specificFeeAddress === preBuySharesFeeAddresses.performanceFee
      ) {
        let { sharesDue, settlementType } = await performanceFee.settle(
          comptrollerAddress,
          valutAddress,
          specificFeeContract,
          _gav,
          sharesSupply
        );

        if (settlementType && settlementType === SettlementType.Mint) {
          console.log("----------------------------------");
          console.log("sharesDue performanceFee ", sharesDue.toString());
          console.log("----------------------------------");

          sharesSupply = sharesSupply.add(new BN(sharesDue.toString()));
        }
      }
    }
  }

  //---------------- protocolFee section ----------------

  let protocolFeeContract = new ethers.Contract(
    protocolFeeAddress,
    protocolFeeAbi.abi,
    provider
  );

  let { sharesDue, settlementType } = await protocolFee.payFee(
    protocolFeeContract,
    valutAddress,
    sharesSupply
  );

  if (settlementType && settlementType === SettlementType.Mint) {
    console.log("----------------------------------");
    console.log("sharesDue protocolFee ", sharesDue.toString());
    console.log("----------------------------------");

    sharesSupply = sharesSupply.add(new BN(sharesDue.toString()));
  }

  //---------------- calculate shares due ----------------

  let denominationAssetAddress =
    await comptrollerContract.callStatic.getDenominationAsset();

  let denominationAssetContract = new ethers.Contract(
    denominationAssetAddress,
    vault.abi,
    provider
  );

  let denominationAssetUnit =
    await denominationAssetContract.callStatic.decimals();

  let sharePrice = calcGrossShareValue(
    _gav,
    sharesSupply,
    new BN("10").pow(new BN(denominationAssetUnit.toString()))
  );

  let sharesIssued = new BN(investment.toString())
    .mul(SHARES_UNIT)
    .div(new BN(sharePrice.toString()));

  //---------------- postBuyShares section ----------------

  if (fees.length > 0) {
    for (let i = 0; i < fees.length; i++) {
      let specificFeeAddress = fees[i];

      if (!getPostBuySharesFeeAbi(specificFeeAddress)) {
        continue;
      }

      let specificFeeContract = new ethers.Contract(
        specificFeeAddress,
        getPostBuySharesFeeAbi(specificFeeAddress),
        provider
      );

      console.log("----------------------------------");
      console.log("fees[i] ", fees[i]);
      console.log("----------------------------------");

      if (specificFeeAddress === postBuySharesFeeAddresses.entranceRateFee) {
        let { sharesDue, settlementType } = await entranceRateFee.settle(
          comptrollerAddress,
          specificFeeContract,
          sharesIssued
        );

        if (settlementType && settlementType === SettlementType.Direct) {
          console.log("----------------------------------");
          console.log("sharesDue entranceRateFee ", sharesDue.toString());
          console.log("----------------------------------");

          console.log("sharesIssued before", sharesIssued.toString());

          sharesIssued = sharesIssued.sub(new BN(sharesDue.toString()));
        }
      }
    }
  }

  console.log("----------------------------------");
  console.log("sharesIssued ", sharesIssued.toString());
  console.log("----------------------------------");
}

function calcGrossShareValue(_gav:bigint, _sharesSupply:bigint, _denominationAssetUnit:bigint) {
  let sharesSupply = new BN(_sharesSupply.toString());
  let gav = new BN(_gav.toString());
  let denominationAssetUnit = new BN(_denominationAssetUnit.toString());

  if (sharesSupply.isZero()) {
    return denominationAssetUnit;
  }

  return gav.mul(SHARES_UNIT).div(sharesSupply);
}

function getPreBuySharesFeeAbi(address:string) {
  if (address === preBuySharesFeeAddresses.managementFee) {
    return managementFeeAbi.abi;
  } else if (address === preBuySharesFeeAddresses.performanceFee) {
    return performanceFeeAbi.abi;
  }
}

function getPostBuySharesFeeAbi(address:string) {
  if (address === postBuySharesFeeAddresses.entranceRateFee) {
    return entranceRateFeeAbi.abi;
  }
}

// Example usage
(async () => {
  const investment = new BN("1000000");
  await calculateShares(investment);
})();
