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

//--------------- fees functions section ---------------

const managementFee = require("./fees/managementFee");
const performanceFee = require("./fees/performanceFee");
const { SettlementType } = require("./fees/enum");

//--------------- provider section ---------------

const provider = new ethers.providers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/kqgkrVW6bE-5gWKYcTnMwSCfoXLGYxSR"); // Replace with your RPC URL

const comptrollerAddress = "0xa0bc8040cb1314542b58989fd54a78620d23895c";
const feeManagerAddress = "0xaf0dffac1ce85c3fce4c2bf50073251f615eefc4";


const FeeHook = {
    Continuous: 0,
    PreBuyShares: 1,
    PostBuyShares: 2,  // The value we need
    PreRedeemShares: 3
};

const feeAddresses = {
    managementFee:'0xFaF2c3DB614E9d38fE05EDc634848BE7Ff0542B9',
    performanceFee:'0xfeDC73464Dfd156d30F6524654a5d56E766DA0c3'
}

async function calculateShares(investmentAmount, minSharesQuantity) {

    try {
        const comptrollerContract = new ethers.Contract(comptrollerAddress, comptroller.abi, provider);

        const gav = await comptrollerContract.callStatic.calcGav();

        console.log("----------------------------------");
        console.log("gav ", gav);
        console.log("----------------------------------");

        await _checkFeeManager(gav,comptrollerContract);

    }catch (error) {
        console.error("Error calculating gav:", error);
    }
}

async function _checkFeeManager(_gav,comptrollerContract) {

    const feeManagerContract = new ethers.Contract(feeManagerAddress, feeManager.abi, provider);

    const fees = await feeManagerContract.callStatic.getEnabledFeesForFund(comptrollerAddress);

    const valutAddress = await comptrollerContract.callStatic.getVaultProxy();

    console.log("----------------------------------");
    console.log("valutAddress ", valutAddress);
    console.log("----------------------------------");

    const ValutContract = new ethers.Contract(valutAddress, vault.abi, provider);

    if(fees.length > 0) {
        console.log("----------------------------------");
        console.log("fees ", fees);
        console.log("----------------------------------");
        
        let sharesSupply = new BN((await ValutContract.callStatic.totalSupply()).toString());

        console.log("----------------------------------");
        console.log("sharesSupply before", sharesSupply);
        console.log("----------------------------------");

        for(let i = 0; i < fees.length; i++) {

            let specificFeeAddress = fees[i];

            let specificFeeContract = new ethers.Contract(specificFeeAddress,getAbi(specificFeeAddress), provider);

            let res = await specificFeeContract.callStatic.settlesOnHook(FeeHook.PreBuyShares);

            if (!res.settles_) {
                continue;
            }

            if(specificFeeAddress === feeAddresses.managementFee) {
                let {sharesDue,settlementType} = await managementFee.settle(comptrollerAddress, valutAddress,specificFeeContract,ValutContract,sharesSupply);

                if(settlementType && settlementType === SettlementType.Mint) {
                    sharesSupply = sharesSupply.add(new BN(sharesDue.toString()));
                }
                
            }else if(specificFeeAddress === feeAddresses.performanceFee) {
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

    return;
}

function getAbi(address) {
    if(address === feeAddresses.managementFee) {
        return managementFeeAbi.abi;
    }else if(address === feeAddresses.performanceFee) {
        return performanceFeeAbi.abi;
    }
}
// Example usage
(async () => {
  const investment = ethers.utils.parseEther("1"); // Example: 1 ETH
  const minShares = 1; // Minimum shares quantity
  await calculateShares(investment, minShares);
})();
