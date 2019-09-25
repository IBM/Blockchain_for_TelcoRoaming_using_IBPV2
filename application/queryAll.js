'use strict';
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Invoke the telco-roaming-contract to get the latest snapshot of all objects in the blockchain.
 * node queryAll.js
 * eg. node queryAll.js
 *
 *
 * 1. call queryAll which returns the latest snapshot of all objects in the blockchain.
 *
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

    // A gateway defines the peers used to access Fabric networks

    await gateway.connect(ccp, { wallet, identity: appAdmin , discovery: {enabled: gatewayDiscoveryEnabled, asLocalhost:gatewayDiscoveryAsLocalhost }});
    // eslint-disable-next-line no-unused-vars
    const network = await gateway.getNetwork(channelName);

    const contract = network.getContract(smartContractName);

    const queryResults = await contract.evaluateTransaction('queryAll');
    const queryResultsArray = JSON.parse(queryResults);
    for(let i = 0; i < queryResultsArray.length; i++){
        console.log('Key: ' + queryResultsArray[i].Key + '\nRecord:');
        console.log(queryResultsArray[i].Record);
        console.log('\n');
    }
}

main();