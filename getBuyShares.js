const ethers = require('ethers');

const BN = require('bn.js');

//--------------- common abi section ---------------
const comptroller = require("./comptroller.json");
const feeManager = require("./feeManager.json");
const vault = require("./vault.json");

//--------------- fees abi section ---------------
const IFee = require("./IFee.json");
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

const provider = new ethers.providers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/kqgkrVW6bE-5gWKYcTnMwSCfoXLGYxSR"); // Replace with your RPC URL

const comptrollerAddress = "0xa52a8ee6b539eea273f67a722c10e2b908cf3b61"; //"0xa0bc8040cb1314542b58989fd54a78620d23895c";
const feeManagerAddress = "0xaf0dffac1ce85c3fce4c2bf50073251f615eefc4";
const protocolFeeAddress = "0xe97980f1d43c4cd4f1eef0277a2dea7ddbc2cd13";


const FeeHook = {
    Continuous: 0,
    PreBuyShares: 1,
    PostBuyShares: 2,
    PreRedeemShares: 3
};

const preBuySharesFeeAddresses = {
    managementFee:'0xFaF2c3DB614E9d38fE05EDc634848BE7Ff0542B9',
    performanceFee:'0xfeDC73464Dfd156d30F6524654a5d56E766DA0c3',
}

const postBuySharesFeeAddresses = {
    entranceRateFee:'0xFb8DF7D5e320020Cd8047226b81cf6d68F3E3C19'
}

async function calculateShares(investmentAmount, minSharesQuantity) {

    try {
        const comptrollerContract = new ethers.Contract(comptrollerAddress, comptroller.abi, provider);

        const gav = await comptrollerContract.callStatic.calcGav();

        console.log("----------------------------------");
        console.log("gav ", gav);
        console.log("----------------------------------");

        await _checkFeeManager(gav,comptrollerContract,investmentAmount);

    }catch (error) {
        console.error("Error calculating gav:", error);
    }
}

async function _checkFeeManager(_gav,comptrollerContract,investment) {

    const feeManagerContract = new ethers.Contract(feeManagerAddress, feeManager.abi, provider);

    const fees = await feeManagerContract.callStatic.getEnabledFeesForFund(comptrollerAddress);

    const valutAddress = await comptrollerContract.callStatic.getVaultProxy();

    console.log("----------------------------------");
    console.log("valutAddress ", valutAddress);
    console.log("----------------------------------");

    const ValutContract = new ethers.Contract(valutAddress, vault.abi, provider);

    //---------------- preBuyShares section ----------------

    let sharesSupply = new BN((await ValutContract.callStatic.totalSupply()).toString());

    console.log("----------------------------------");
    console.log("sharesSupply before", sharesSupply);
    console.log("----------------------------------");

    if(fees.length > 0) {
        console.log("----------------------------------");
        console.log("fees ", fees);
        console.log("----------------------------------");

        for(let i = 0; i < fees.length; i++) {

            console.log("----------------------------------");
            console.log("fees[i] ", fees[i]);
            console.log("----------------------------------");

            let specificFeeAddress = fees[i];

            if(!getPreBuySharesFeeAbi(specificFeeAddress)){
                continue
            }

            let specificFeeContract = new ethers.Contract(specificFeeAddress,getPreBuySharesFeeAbi(specificFeeAddress), provider);

            let res = await specificFeeContract.callStatic.settlesOnHook(FeeHook.PreBuyShares);

            if (!res.settles_) {
                continue;
            }

            if(specificFeeAddress === preBuySharesFeeAddresses.managementFee) {
                let {sharesDue,settlementType} = await managementFee.settle(comptrollerAddress, valutAddress,specificFeeContract,ValutContract,sharesSupply);

                if(settlementType && settlementType === SettlementType.Mint) {
                    sharesSupply = sharesSupply.add(new BN(sharesDue.toString()));
                }
                
            }else if(specificFeeAddress === preBuySharesFeeAddresses.performanceFee) {
                let {sharesDue,settlementType} = await performanceFee.settle(comptrollerAddress, valutAddress,specificFeeContract,_gav,sharesSupply);

                if(settlementType && settlementType === SettlementType.Mint) {
                    sharesSupply = sharesSupply.add(new BN(sharesDue.toString()));
                }
            }
        }

        console.log("----------------------------------");
        console.log("sharesSupply after", sharesSupply.toString());
        console.log("----------------------------------");
    }

    //---------------- protocolFee section ----------------

    let protocolFeeContract = new ethers.Contract(protocolFeeAddress,protocolFeeAbi.abi, provider);

    let {sharesDue,settlementType} = await protocolFee.payFee(protocolFeeContract,valutAddress,sharesSupply);

    if(settlementType && settlementType === SettlementType.Mint) {
        sharesSupply = sharesSupply.add(new BN(sharesDue.toString()));
    }
    
    //---------------- calculate shares due ----------------

    let denominationAssetAddress = await comptrollerContract.callStatic.getDenominationAsset();

    let denominationAssetContract = new ethers.Contract(denominationAssetAddress,vault.abi, provider);

    let denominationAssetUnit = await denominationAssetContract.callStatic.decimals();
    
    let sharePrice = calcGrossShareValue(_gav, sharesSupply,new BN("10").pow(new BN(denominationAssetUnit.toString())));

    console.log("----------------------------------");
    console.log("sharePrice ", sharePrice.toString());
    console.log("----------------------------------");


    let sharesIssued = new BN(investment.toString()).mul(SHARES_UNIT).div(new BN(sharePrice.toString()));

    console.log("----------------------------------");
    console.log("sharesIssued ", sharesIssued.toString());
    console.log("----------------------------------");


    //---------------- postBuyShares section ----------------

    if(fees.length > 0) {
        console.log("----------------------------------");
        console.log("fees ", fees);
        console.log("----------------------------------");

        for(let i = 0; i < fees.length; i++) {

            console.log("----------------------------------");
            console.log("fees[i] ", fees[i]);
            console.log("----------------------------------");

            let specificFeeAddress = fees[i];

            if(!getPostBuySharesFeeAbi(specificFeeAddress)){
                continue
            }

            let specificFeeContract = new ethers.Contract(specificFeeAddress,getPostBuySharesFeeAbi(specificFeeAddress), provider);

            let res = await specificFeeContract.callStatic.settlesOnHook(FeeHook.PostBuyShares);

            if (!res.settles_) {
                continue;
            }

            if(specificFeeAddress === postBuySharesFeeAddresses.entranceRateFee) {
                let {newSharesIssued,settlementType} = await entranceRateFee.settle(comptrollerAddress,specificFeeContract,sharesIssued);

                if(settlementType && settlementType === SettlementType.Direct) {
                    sharesIssued = newSharesIssued;
                }
            }
        }
    }

    console.log("----------------------------------");
    console.log("sharesIssued ", sharesIssued.toString());
    console.log("----------------------------------");
}

function calcGrossShareValue(_gav, _sharesSupply, _denominationAssetUnit) {

    let sharesSupply = new BN(_sharesSupply.toString());
    let gav = new BN(_gav.toString());
    let denominationAssetUnit = new BN(_denominationAssetUnit.toString());

    if (sharesSupply.isZero()) {
        return denominationAssetUnit;
    }

    return gav.mul(SHARES_UNIT).div(sharesSupply);
}

function getPreBuySharesFeeAbi(address) {
    if(address === preBuySharesFeeAddresses.managementFee) {
        return managementFeeAbi.abi;
    }else if(address === preBuySharesFeeAddresses.performanceFee) {
        return performanceFeeAbi.abi;
    }
}

function getPostBuySharesFeeAbi(address) {
    if(address === postBuySharesFeeAddresses.entranceRateFee) {
        return entranceRateFeeAbi.abi;
    }
}

// Example usage
(async () => {
  const investment = new BN("10000000"); // Example: 1 ETH
  const minShares = 1; // Minimum shares quantity
  await calculateShares(investment, minShares);
})();
