'use strict';
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Invoke the telco-roaming-contract to get the history of a SubscriberSim object.
 * node getSimHistory.js <simPublicKey>
 * eg. node getSimHistory.js sim1
 *
 *
 * 1. call getHistoryForSim which returns the log of all changes made to the SubscriberSim object with the given publicKey.
 *
 * Will throw an error if sim does not exist.
 * Otherwise, should successfully complete without errors and return the history for the SubscriberSim.
 */

const fs = require('fs');
const path = require('path');

// Bring Fabric SDK network class
const { FileSystemWallet, Gateway } = require('fabric-network');

// A wallet stores a collection of identities for use
let walletDir = path.join(path.dirname(require.main.filename),'fabric/_idwallet');
const wallet = new FileSystemWallet(walletDir);
const configDirectory = path.join(process.cwd(), 'fabric');
const configPath = path.join(configDirectory, 'config.json');
const configJSON = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(configJSON);
let channelName = config.channel_name;
let smartContractName = config.smart_contract_name;
let connection_file = config.connection_file;
let appAdmin = config.appAdmin;

let gatewayDiscoveryEnabled = 'enabled' in config.gatewayDiscovery?config.gatewayDiscovery.enabled:true;
let gatewayDiscoveryAsLocalhost = 'asLocalhost' in config.gatewayDiscovery?config.gatewayDiscovery.asLocalhost:true;

const ccpPath = path.join(configDirectory, connection_file);
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

const gateway = new Gateway();

process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    console.log('An unhandled rejection was found - ', error.message);
    return process.exit(1);
});

async function main() {
    if(process.argv.length !== 3){
        throw new Error('Process argv length is ' + process.argv.length + '. It should be 3');
    }

    let simPublicKey = process.argv[2];

    // A gateway defines the peers used to access Fabric networks

    await gateway.connect(ccp, { wallet, identity: appAdmin , discovery: {enabled: gatewayDiscoveryEnabled, asLocalhost:gatewayDiscoveryAsLocalhost }});
    // eslint-disable-next-line no-unused-vars
    const network = await gateway.getNetwork(channelName);

    const contract = network.getContract(smartContractName);

    const simHistory = await contract.evaluateTransaction('getHistoryForSim',simPublicKey);
    console.log(JSON.parse(simHistory));
}

main();